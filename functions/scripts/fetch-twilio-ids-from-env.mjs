/**
 * One-shot: read server/.env TWILIO_API_KEY_* + TWILIO_MESSAGING_SERVICE_SID,
 * fetch Account SID from Messaging Service and list Conversations Services.
 * Does not print secrets. Usage: node scripts/fetch-twilio-ids-from-env.mjs
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const serverEnv = path.join(repoRoot, 'server', '.env');

function parseEnv(absPath) {
  const out = {};
  if (!fs.existsSync(absPath)) return out;
  for (const line of fs.readFileSync(absPath, 'utf8').split('\n')) {
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

function getJson(hostname, pathname, authUser, authPass) {
  return new Promise((resolve, reject) => {
    const auth = `${authUser}:${authPass}`;
    https
      .get(
        { hostname, path: pathname, auth, headers: { Accept: 'application/json' } },
        (r) => {
          let d = '';
          r.on('data', (c) => (d += c));
          r.on('end', () => {
            try {
              resolve({ status: r.statusCode, body: JSON.parse(d) });
            } catch {
              resolve({ status: r.statusCode, body: d });
            }
          });
        },
      )
      .on('error', reject);
  });
}

const env = parseEnv(serverEnv);
const keySid = env.TWILIO_API_KEY_SID;
const keySecret = env.TWILIO_API_KEY_SECRET;
const mgSid = env.TWILIO_MESSAGING_SERVICE_SID;

if (!keySid || !keySecret || !mgSid) {
  console.error(
    'Need TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_MESSAGING_SERVICE_SID in server/.env',
  );
  process.exit(1);
}

const ms = await getJson(
  'messaging.twilio.com',
  `/v1/Services/${encodeURIComponent(mgSid)}`,
  keySid,
  keySecret,
);
if (ms.status !== 200 || !ms.body?.account_sid) {
  console.error(
    'Messaging Service lookup failed:',
    ms.status,
    typeof ms.body === 'object' ? ms.body?.message || ms.body?.code : '',
  );
  process.exit(1);
}

console.log('TWILIO_ACCOUNT_SID=' + ms.body.account_sid);

const cs = await getJson(
  'conversations.twilio.com',
  '/v1/Services?PageSize=20',
  keySid,
  keySecret,
);
if (cs.status !== 200 || !cs.body?.services) {
  console.error(
    'Conversations Services list failed:',
    cs.status,
    typeof cs.body === 'object' ? cs.body?.message : '',
  );
  process.exit(1);
}

console.log('# Conversations Services (use TWILIO_CONVERSATIONS_SERVICE_SID=IS...):');
for (const svc of cs.body.services) {
  console.log(`# ${svc.friendly_name || 'unnamed'}\t${svc.sid}`);
}
if (cs.body.services.length === 1) {
  console.log('TWILIO_CONVERSATIONS_SERVICE_SID=' + cs.body.services[0].sid);
}
