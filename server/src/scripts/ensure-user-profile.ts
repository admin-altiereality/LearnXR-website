/**
 * Ensure a user has a Firestore profile in users/{uid} with a role.
 * Run from server directory: npx tsx src/scripts/ensure-user-profile.ts <uid> [role]
 * Example: npx tsx src/scripts/ensure-user-profile.ts abc123 superadmin
 * Roles: student | teacher | principal | admin | superadmin | school | associate
 */

import * as admin from 'firebase-admin';
import { getAdminApp } from '../config/firebase-admin';

const uid = process.argv[2];
const role = (process.argv[3] || 'student').toLowerCase();

const validRoles = ['student', 'teacher', 'principal', 'admin', 'superadmin', 'school', 'associate'];
if (!uid) {
  console.error('Usage: npx tsx src/scripts/ensure-user-profile.ts <uid> [role]');
  console.error('Example: npx tsx src/scripts/ensure-user-profile.ts <firebase-uid> superadmin');
  process.exit(1);
}
if (!validRoles.includes(role)) {
  console.error('Invalid role. Use one of:', validRoles.join(', '));
  process.exit(1);
}

async function main() {
  const app = getAdminApp();
  if (!app) {
    console.error('Firebase Admin not initialized.');
    console.error('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in server/.env');
    console.error('Or place learnxr-evoneuralai-firebase-adminsdk-*.json in project root.');
    process.exit(1);
  }

  const db = admin.firestore(app);
  const ref = db.collection('users').doc(uid);

  await ref.set(
    {
      role,
      updatedAt: new Date().toISOString(),
      profileEnsuredAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log('Profile set for', uid, 'with role', role);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
