/**
 * Minimal server: health + Paperclip n8n bridge only (for smoke tests).
 * Usage: npx tsx src/scripts/smoke-paperclip-n8n.ts [--port 5055]
 */
import * as dotenv from 'dotenv';
import express from 'express';
import * as http from 'http';
import * as path from 'path';
import paperclipN8nBridgeRoutes from '../routes/paperclipN8nBridge';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parsePort(): number {
  const i = process.argv.indexOf('--port');
  if (i >= 0 && process.argv[i + 1]) {
    const p = parseInt(process.argv[i + 1], 10);
    if (Number.isFinite(p) && p > 0) return p;
  }
  return 5055;
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', scope: 'smoke-paperclip-n8n' }));
app.use('/api/paperclip-n8n', paperclipN8nBridgeRoutes);

const PORT = parsePort();

const server = http.createServer(app);

async function runChecks(base: string, secret: string): Promise<void> {
  const h = await fetch(`${base}/health`);
  console.log('\n[1] GET /health ->', h.status, await h.text());

  const bridgeHealth = await fetch(`${base}/api/paperclip-n8n/health`);
  console.log('[2] GET /api/paperclip-n8n/health ->', bridgeHealth.status, await bridgeHealth.text());

  const triggerBody = {
    workflowKey: 'ui-pdf-to-vr-lesson',
    correlationId: `smoke-${Date.now()}`,
    payload: { note: 'smoke-paperclip-n8n script' },
  };
  const tr = await fetch(`${base}/api/paperclip-n8n/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(triggerBody),
  });
  const trText = await tr.text();
  console.log('[3] POST /api/paperclip-n8n/trigger ->', tr.status, trText.slice(0, 800));

  const n8nKey = process.env.N8N_API_KEY;
  const n8nBase = (process.env.N8N_API_URL || '').replace(/\/$/, '').replace(/\/api\/v\d+$/i, '');
  if (n8nKey && n8nBase) {
    const ex = await fetch(`${n8nBase}/api/v1/executions?limit=3`, {
      headers: { 'X-N8N-API-KEY': n8nKey },
    });
    const exText = await ex.text();
    console.log(
      '[4] GET n8n /api/v1/executions?limit=3 ->',
      ex.status,
      ex.ok ? exText.slice(0, 400) + (exText.length > 400 ? '…' : '') : exText.slice(0, 400),
    );
  } else {
    console.log('[4] SKIP direct n8n executions (N8N_API_KEY or N8N_API_URL missing)');
  }
}

server.listen(PORT, async () => {
  const base = `http://127.0.0.1:${PORT}`;
  console.log(`Smoke server listening on ${base}`);
  const secret = process.env.PAPERCLIP_BRIDGE_SECRET || '';
  if (!secret) {
    console.error('PAPERCLIP_BRIDGE_SECRET missing in .env');
    server.close();
    process.exit(1);
  }
  try {
    await runChecks(base, secret);
  } catch (e) {
    console.error('Check failed:', e);
  }
  server.close();
  process.exit(0);
});
