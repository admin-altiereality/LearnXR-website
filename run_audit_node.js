const cp = require('child_process');
const fs = require('fs');
try {
  const out = cp.execSync('node scripts/paperclip/audit-openclaw-capabilities.mjs', {
    env: { ...process.env, PAPERCLIP_COMPANY_ID: 'ef83bc97-7d29-4e99-9ad0-4c48aa25e978' }
  }).toString();
  fs.writeFileSync('audit_results.txt', out);
} catch (e) {
  fs.writeFileSync('audit_results.txt', e.stderr ? e.stderr.toString() : e.message);
}
