/**
 * Optional safeguard: when building for learnxr.altiereality.com (altiereality site),
 * the frontend must use learnxr-evoneuralai for Auth, Firestore, Storage, and Functions.
 * Run before build: node scripts/check-altiereality-env.js
 * Exits with 1 if VITE_FIREBASE_PROJECT_ID=lexrn1 (which would break Firestore permissions and API).
 */
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || '';
if (projectId === 'lexrn1') {
  console.error(
    '\n\u274c For altiereality (learnxr.altiereality.com), do NOT set VITE_FIREBASE_PROJECT_ID=lexrn1.\n' +
    'Auth, Firestore, Storage, and Functions must use learnxr-evoneuralai.\n' +
    'Unset VITE_FIREBASE_PROJECT_ID or set it to learnxr-evoneuralai, then rebuild.\n'
  );
  process.exit(1);
}
console.log('Env check OK: Firebase project for backend is', projectId || 'learnxr-evoneuralai (default)');
