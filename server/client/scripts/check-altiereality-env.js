/**
 * Run before `vite build --mode lexrn1` (altiereality Hosting).
 *
 * - Merges server/client/.env then .env.lexrn1 the same way Vite does, except empty
 *   override values do not wipe keys from .env (avoids shipping blank Firebase config).
 * - For learnxr.altiereality.com, the browser Firebase SDK must use learnxr-evoneuralai,
 *   not lexrn1 (see repo .env.example).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseEnvFile(relPath) {
  const out = {};
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return out;
  const text = fs.readFileSync(full, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Later file wins for non-empty values only; empty string keeps previous. */
function mergeEnv(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== '') out[k] = v;
  }
  return out;
}

const merged = mergeEnv(parseEnvFile('.env'), parseEnvFile('.env.lexrn1'));

const projectId = merged.VITE_FIREBASE_PROJECT_ID || '';
if (projectId === 'lexrn1') {
  console.error(
    '\n\u274c For altiereality (learnxr.altiereality.com), do NOT set VITE_FIREBASE_PROJECT_ID=lexrn1.\n' +
      'Auth, Firestore, Storage, and Functions in the app must use learnxr-evoneuralai.\n' +
      'Remove that line from .env.lexrn1 or set VITE_FIREBASE_PROJECT_ID=learnxr-evoneuralai.\n' +
      'See .env.example in the repo root.\n',
  );
  process.exit(1);
}

const apiKey = (merged.VITE_FIREBASE_API_KEY || '').trim();
if (!apiKey) {
  console.error(
    '\n\u274c VITE_FIREBASE_API_KEY is missing after merging .env and .env.lexrn1.\n' +
      'Add your Web app API key to server/client/.env (learnxr-evoneuralai), or set it in .env.lexrn1.\n' +
      'Do not leave VITE_FIREBASE_API_KEY= empty in .env.lexrn1 — that overrides .env and breaks production.\n',
  );
  process.exit(1);
}

console.log(
  'Env check OK: VITE_FIREBASE_PROJECT_ID=%s',
  projectId || '(unset; use evoneuralai dev fallbacks only in non-prod)',
);
