/**
 * One-off backfill: mirror role / school_id / managed_school_id / partner_id from
 * every `users/{uid}` document onto that user's Auth custom claims.
 *
 * Run this BEFORE deploying the rules that read `request.auth.token.role`. The rules
 * ship with a `get()` fallback for exactly this window, but the fallback is what we
 * are trying to stop paying for, so the sooner every user has claims the better.
 *
 * A user's new claims only reach their client when their ID token next refreshes
 * (about an hour), or immediately if the client calls getIdToken(true). Nobody is
 * locked out in the meantime because of the fallback.
 *
 * Usage, against whichever project is configured for the credentials in scope:
 *
 *   cd functions
 *   npx tsx scripts/backfillUserClaims.ts            # dry run, reports only
 *   npx tsx scripts/backfillUserClaims.ts --apply    # actually writes claims
 */

import * as admin from 'firebase-admin';

const PAGE_SIZE = 300;

interface Summary {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

function claimsFor(data: Record<string, any>): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    role: data.role || 'student',
    claims_updated_at: Date.now(),
  };
  if (typeof data.school_id === 'string' && data.school_id) claims.school_id = data.school_id;
  if (typeof data.managed_school_id === 'string' && data.managed_school_id) {
    claims.managed_school_id = data.managed_school_id;
  }
  if (typeof data.partner_id === 'string' && data.partner_id) claims.partner_id = data.partner_id;
  return claims;
}

/** True when the token already carries exactly these values (ignoring the timestamp). */
function claimsMatch(existing: Record<string, any> | undefined, next: Record<string, unknown>): boolean {
  if (!existing) return false;
  const keys = ['role', 'school_id', 'managed_school_id', 'partner_id'];
  return keys.every((key) => (existing[key] ?? null) === (next[key] ?? null));
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  admin.initializeApp();
  const db = admin.firestore();
  const auth = admin.auth();

  const summary: Summary = { scanned: 0, updated: 0, skipped: 0, failed: 0 };
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  console.log(apply ? 'Applying custom claims...' : 'Dry run — no claims will be written.');

  for (;;) {
    let pageQuery = db
      .collection('users')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);

    const page = await pageQuery.get();
    if (page.empty) break;

    for (const doc of page.docs) {
      summary.scanned += 1;
      const next = claimsFor(doc.data() || {});

      try {
        const user = await auth.getUser(doc.id);
        if (claimsMatch(user.customClaims, next)) {
          summary.skipped += 1;
          continue;
        }
        if (apply) {
          await auth.setCustomUserClaims(doc.id, next);
        }
        summary.updated += 1;
        console.log(`${apply ? 'set' : 'would set'} ${doc.id}:`, next);
      } catch (error) {
        // A users/{uid} document with no matching Auth user is expected for
        // deleted accounts; it is not a failure worth halting the run for.
        const code = (error as { code?: string })?.code;
        if (code === 'auth/user-not-found') {
          summary.skipped += 1;
          continue;
        }
        summary.failed += 1;
        console.error(`failed ${doc.id}:`, error);
      }
    }

    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  }

  console.log('\nBackfill summary:', summary);
  if (!apply) console.log('Re-run with --apply to write these claims.');
}

main().catch((error) => {
  console.error('Backfill aborted:', error);
  process.exit(1);
});
