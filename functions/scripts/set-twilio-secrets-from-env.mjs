/**
 * Reads TWILIO_* from functions/.env then server/.env (server wins on duplicates)
 * and runs firebase functions:secrets:set for each required secret.
 *
 * Usage: node scripts/set-twilio-secrets-from-env.mjs [projectId]
 * Default project: learnxr-evoneuralai
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(functionsRoot, '..');

const REQUIRED_KEYS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_CONVERSATIONS_SERVICE_SID',
];

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

const projectId = process.argv[2] || 'learnxr-evoneuralai';
const fromFunctions = parseEnvFile(path.join(functionsRoot, '.env'));
const fromServer = parseEnvFile(path.join(repoRoot, 'server', '.env'));
const merged = { ...fromFunctions, ...fromServer };

const missing = [];
const conversationsPlaceholder = 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
for (const key of REQUIRED_KEYS) {
  const v = String(merged[key] ?? '').trim();
  if (!v) {
    missing.push(key);
    continue;
  }
  if (
    key === 'TWILIO_CONVERSATIONS_SERVICE_SID' &&
    v === conversationsPlaceholder
  ) {
    missing.push(key);
  }
}

if (missing.length) {
  console.error(
    'Missing or placeholder Twilio values in functions/.env or server/.env:\n  ' +
      missing.join('\n  ') +
      '\n\nCreate API keys and Conversations Service in Twilio Console, then fill these.',
  );
  process.exit(1);
}

const tmpDir = path.join(functionsRoot, '.twilio-secrets-tmp');
fs.mkdirSync(tmpDir, { recursive: true });

let failed = false;
for (const key of REQUIRED_KEYS) {
  const raw = String(merged[key]).trim();
  const tmp = path.join(tmpDir, `${key}.txt`);
  fs.writeFileSync(tmp, raw, 'utf8');
  console.log('Setting secret', key, '…');
  const result = spawnSync(
    'firebase',
    [
      'functions:secrets:set',
      key,
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
  if (result.status !== 0) {
    failed = true;
    console.error('Failed to set', key);
    break;
  }
}

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {
  // ignore
}

if (failed) process.exit(1);
console.log('Twilio secrets updated for project', projectId);
