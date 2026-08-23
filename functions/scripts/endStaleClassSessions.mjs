/**
 * End stale class sessions.
 *
 * Sessions were only ever moved to 'ended' when a teacher explicitly clicked
 * End Session, so every abandoned session still reads as waiting/active. Those
 * show up to students as "Lesson is Live" and can still be joined by code.
 *
 * This closes:
 *   - every session whose last write is older than the staleness window, and
 *   - all but the newest open session per teacher (only one lesson may be live).
 *
 * Usage:
 *   node functions/scripts/endStaleClassSessions.mjs            # dry run
 *   node functions/scripts/endStaleClassSessions.mjs --apply    # write
 *
 * Auth: uses `gcloud auth print-access-token`, same as the other scripts here.
 */

import { execFileSync } from 'node:child_process';

const projectId = process.env.GCLOUD_PROJECT || 'learnxr-evoneuralai';
const APPLY = process.argv.includes('--apply');
const STALE_AFTER_MS = Number(process.env.SESSION_STALE_AFTER_MS || 8 * 60 * 60 * 1000);

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

/** Firestore REST values -> plain JS (only the fields this script needs). */
function readField(fields, name) {
  const f = fields?.[name];
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('timestampValue' in f) return f.timestampValue;
  if ('nullValue' in f) return null;
  if ('mapValue' in f) return f.mapValue.fields ?? {};
  return null;
}

async function runQuery() {
  const res = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'class_sessions' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'IN',
            value: {
              arrayValue: {
                values: [{ stringValue: 'waiting' }, { stringValue: 'active' }],
              },
            },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`runQuery failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows
    .filter((r) => r.document)
    .map((r) => {
      const fields = r.document.fields ?? {};
      const updated = readField(fields, 'updated_at') || readField(fields, 'created_at');
      return {
        name: r.document.name,
        id: r.document.name.split('/').pop(),
        teacherUid: readField(fields, 'teacher_uid'),
        classId: readField(fields, 'class_id'),
        code: readField(fields, 'session_code'),
        status: readField(fields, 'status'),
        updatedMs: updated ? Date.parse(updated) : NaN,
      };
    });
}

async function endSession(docName) {
  const url =
    `https://firestore.googleapis.com/v1/${docName}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=updated_at`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'ended' },
        updated_at: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) throw new Error(`patch failed for ${docName}: ${res.status} ${await res.text()}`);
}

const open = await runQuery();
console.log(`Found ${open.length} open session(s) in ${projectId}.`);

const now = Date.now();
const toClose = new Map();

// 1. Anything untouched for longer than the window.
for (const s of open) {
  const age = Number.isNaN(s.updatedMs) ? Infinity : now - s.updatedMs;
  if (age > STALE_AFTER_MS) {
    toClose.set(s.id, { ...s, reason: `stale (${Math.round(age / 3600000)}h old)` });
  }
}

// 2. All but the newest remaining session per teacher.
const byTeacher = new Map();
for (const s of open) {
  if (toClose.has(s.id) || !s.teacherUid) continue;
  const list = byTeacher.get(s.teacherUid) ?? [];
  list.push(s);
  byTeacher.set(s.teacherUid, list);
}
for (const [teacher, list] of byTeacher) {
  if (list.length < 2) continue;
  list.sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0));
  list.slice(1).forEach((s) => {
    toClose.set(s.id, { ...s, reason: `superseded (teacher ${teacher} has a newer session)` });
  });
}

if (toClose.size === 0) {
  console.log('Nothing to close.');
  process.exit(0);
}

console.log(`\nWould close ${toClose.size} session(s):`);
for (const s of toClose.values()) {
  console.log(`  ${s.id}  code=${s.code}  class=${s.classId}  ${s.reason}`);
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write these changes.');
  process.exit(0);
}

let closed = 0;
for (const s of toClose.values()) {
  await endSession(s.name);
  closed += 1;
}
console.log(`\nClosed ${closed} session(s).`);
