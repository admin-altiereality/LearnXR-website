/**
 * Reads LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT from functions/.env then server/.env
 * (server wins on duplicate keys), validates JSON, and runs:
 *   firebase functions:secrets:set LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT --data-file=... --project <project>
 *
 * Usage: node scripts/set-learnxr-client-secret-from-env.mjs [projectId]
 * Default project: learnxr-evoneuralai
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(functionsRoot, '..');

function parseEnvFile(absPath) {
  const out = {};
  if (!fs.existsSync(absPath)) return out;
  const txt = fs.readFileSync(absPath, 'utf8');
  for (const line of txt.split('\n')) {
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
    val = val.replace(/\\n/g, '\n');
    out[key] = val;
  }
  return out;
}

function resolveSecretRaw(merged) {
  let raw = (merged.LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT || '').trim();
  const fileKey = (
    merged.LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT_FILE || ''
  ).trim();
  if (!raw && fileKey) {
    const fp = path.isAbsolute(fileKey)
      ? fileKey
      : path.join(repoRoot, fileKey);
    if (fs.existsSync(fp)) raw = fs.readFileSync(fp, 'utf8').trim();
  }
  if (!raw) return '';
  if (fs.existsSync(raw) && fs.statSync(raw).isFile()) {
    raw = fs.readFileSync(raw, 'utf8').trim();
  }
  if (!raw.startsWith('{')) {
    try {
      const dec = Buffer.from(raw, 'base64').toString('utf8').trim();
      if (dec.startsWith('{')) raw = dec;
    } catch {
      // ignore
    }
  }
  return raw;
}

const projectId = process.argv[2] || 'learnxr-evoneuralai';
const dataFileArg = process.argv[3];

let jsonStr = '';

if (dataFileArg) {
  const fp = path.isAbsolute(dataFileArg)
    ? dataFileArg
    : path.join(repoRoot, dataFileArg);
  if (!fs.existsSync(fp)) {
    console.error('File not found:', fp);
    process.exit(1);
  }
  jsonStr = fs.readFileSync(fp, 'utf8').trim();
} else if (process.env.LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT?.trim()) {
  jsonStr = process.env.LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT.trim();
} else {
  const fromFunctions = parseEnvFile(path.join(functionsRoot, '.env'));
  const fromServer = parseEnvFile(path.join(repoRoot, 'server', '.env'));
  const merged = { ...fromFunctions, ...fromServer };
  jsonStr = resolveSecretRaw(merged);
  if (!jsonStr) jsonStr = tryBuildFromFirebaseEnvVars(merged);
}

function tryBuildFromFirebaseEnvVars(merged) {
  const pid = (merged.FIREBASE_PROJECT_ID || '').trim();
  const email = (merged.FIREBASE_CLIENT_EMAIL || '').trim();
  let pk = (merged.FIREBASE_PRIVATE_KEY || '').trim();
  if (!pid || !email || !pk) return '';
  if (pid !== 'learnxr-evoneuralai') return '';
  if ((pk.startsWith('"') && pk.endsWith('"')) || (pk.startsWith("'") && pk.endsWith("'")))
    pk = pk.slice(1, -1);
  pk = pk.replace(/\\n/g, '\n');
  if (!pk.includes('BEGIN PRIVATE KEY')) return '';
  const stub = {
    type: 'service_account',
    project_id: pid,
    private_key_id: (merged.FIREBASE_PRIVATE_KEY_ID || 'auto-from-env').trim() || 'auto-from-env',
    private_key: pk,
    client_email: email,
    client_id: (merged.FIREBASE_CLIENT_ID || '').trim() || '000000000000000000000',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  };
  return JSON.stringify(stub);
}

if (!jsonStr) {
  console.error(
    'Missing learnxr-evoneuralai service account JSON. Use one of:\n' +
      '  1) server/.env: FIREBASE_PROJECT_ID=learnxr-evoneuralai + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY\n' +
      '  2) LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT / _FILE in server/.env or functions/.env\n' +
      '  3) Env var LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT\n' +
      '  4) node scripts/set-learnxr-client-secret-from-env.mjs [project] <path-to-sa.json>',
  );
  process.exit(1);
}

try {
  JSON.parse(jsonStr);
} catch (e) {
  console.error('Value is not valid JSON:', e.message);
  process.exit(1);
}

const tmp = path.join(functionsRoot, '.learnxr-client-sa.secret.tmp.json');
fs.writeFileSync(tmp, jsonStr, 'utf8');

const result = spawnSync(
  'firebase',
  [
    'functions:secrets:set',
    'LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT',
    '--project',
    projectId,
    '--data-file',
    tmp,
    '--force',
  ],
  { stdio: 'inherit', shell: true, cwd: repoRoot },
);

try {
  fs.unlinkSync(tmp);
} catch {
  // ignore
}

process.exit(result.status === null ? 1 : result.status);
