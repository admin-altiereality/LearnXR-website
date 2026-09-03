/**
 * Rules tests for the custom-claims migration.
 *
 * The identity helpers in firestore.rules now read `request.auth.token` first and only
 * fall back to reading users/{uid}. That fallback exists so users whose ID token
 * predates the claims backfill keep working, so both paths have to be exercised:
 * a caller whose role comes from a claim, and a caller whose role comes only from
 * their user document.
 *
 * Run against the emulator:
 *   firebase emulators:exec --only firestore "node --test tests/firestoreRules.test.mjs"
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before, beforeEach } from 'node:test';

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'learnxr-rules-test',
    // Host/port are discovered from FIRESTORE_EMULATOR_HOST, which
    // `firebase emulators:exec` sets, so this works whatever port is free.
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed the user documents the rules read on the fallback path.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'admin_with_claim'), { role: 'admin' });
    await setDoc(doc(db, 'users', 'admin_without_claim'), { role: 'admin' });
    await setDoc(doc(db, 'users', 'plain_student'), { role: 'student', school_id: 'school_a' });
    await setDoc(doc(db, 'users', 'other_student'), { role: 'student', school_id: 'school_a' });
  });
});

test('a user can always read their own profile', async () => {
  const ctx = testEnv.authenticatedContext('plain_student', { role: 'student' });
  await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 'plain_student')));
});

test('admin identified by a role claim can read another user', async () => {
  // No users/{uid} read is needed for this to pass — the role comes off the token.
  const ctx = testEnv.authenticatedContext('admin_with_claim', { role: 'admin' });
  await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 'plain_student')));
});

test('admin with no claim still works via the user-document fallback', async () => {
  // This is the pre-backfill case: a token issued before claims existed.
  const ctx = testEnv.authenticatedContext('admin_without_claim');
  await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 'plain_student')));
});

test('a student cannot read another student', async () => {
  const ctx = testEnv.authenticatedContext('plain_student', { role: 'student' });
  await assertFails(getDoc(doc(ctx.firestore(), 'users', 'other_student')));
});

test('a forged role claim is only as good as the token, and an unauthenticated caller has none', async () => {
  const ctx = testEnv.unauthenticatedContext();
  await assertFails(getDoc(doc(ctx.firestore(), 'users', 'plain_student')));
});

test('a claim overrides a stale user document', async () => {
  // The trigger keeps claims current, so the token is the authority. A user demoted
  // in Firestore but still holding an admin token is expected to pass until their
  // token refreshes; assert that explicitly so the behaviour is a decision, not a
  // surprise discovered in production.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'admin_with_claim'), { role: 'student' });
  });

  const ctx = testEnv.authenticatedContext('admin_with_claim', { role: 'admin' });
  await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 'plain_student')));
});
