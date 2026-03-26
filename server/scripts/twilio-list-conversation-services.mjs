import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

function parseEnv(absPath) {
  const out = {};
  if (!fs.existsSync(absPath)) return out;
  for (const line of fs.readFileSync(absPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const e = parseEnv(envPath);
const ac = e.TWILIO_ACCOUNT_SID;
const auth = e.TWILIO_AUTH_TOKEN;
if (!ac || !auth) {
  console.error('Need TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in server/.env');
  process.exit(1);
}

https
  .get(
    {
      hostname: 'conversations.twilio.com',
      path: '/v1/Services?PageSize=50',
      auth: `${ac}:${auth}`,
      headers: { Accept: 'application/json' },
    },
    (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.services?.length) {
            for (const s of j.services) console.log(s.sid, s.friendly_name || '');
          } else {
            console.log('No services or error', r.statusCode, d.slice(0, 400));
          }
        } catch {
          console.log(r.statusCode, d.slice(0, 400));
        }
      });
    },
  )
  .on('error', console.error);
