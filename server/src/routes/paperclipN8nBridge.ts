import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';

const router = express.Router();

type WebhookSecretHeader = {
  headerName: string;
  envVar: string;
};

type WorkflowMapEntry = {
  description?: string;
  webhookPath?: string;
  webhookUrl?: string;
  webhookSecretHeader?: WebhookSecretHeader;
};

type WorkflowMap = Record<string, WorkflowMapEntry>;

function getPublicBase(): string {
  const fromEnv =
    process.env.PAPERCLIP_N8N_PUBLIC_BASE ||
    process.env.N8N_PUBLIC_BASE_URL ||
    '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const api = process.env.N8N_API_URL || '';
  if (!api) return '';
  return api
    .replace(/\/api\/v\d+\/?$/i, '')
    .replace(/\/$/, '');
}

function resolveWorkflowMapPath(): string {
  const custom = process.env.PAPERCLIP_N8N_WORKFLOWS_PATH;
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.resolve(process.cwd(), custom);
  }
  return path.resolve(process.cwd(), 'config', 'paperclip-n8n-workflows.json');
}

function loadWorkflowMap(): WorkflowMap {
  const mapPath = resolveWorkflowMapPath();
  if (!fs.existsSync(mapPath)) {
    throw new Error(`Workflow map not found: ${mapPath}`);
  }
  const raw = fs.readFileSync(mapPath, 'utf8');
  const parsed = JSON.parse(raw) as WorkflowMap;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Workflow map must be a JSON object');
  }
  return parsed;
}

function resolveTargetUrl(entry: WorkflowMapEntry, base: string): string | null {
  if (entry.webhookUrl) {
    return entry.webhookUrl;
  }
  if (entry.webhookPath) {
    const p = entry.webhookPath.replace(/^\//, '');
    if (!base) return null;
    return `${base}/webhook/${p}`;
  }
  return null;
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = process.env.PAPERCLIP_BRIDGE_SECRET;
  if (!secret) {
    return res.status(503).json({
      ok: false,
      message: 'Paperclip bridge is not configured (missing PAPERCLIP_BRIDGE_SECRET).',
    });
  }
  const hdr = req.headers.authorization;
  const token = hdr?.startsWith('Bearer ') ? hdr.slice(7).trim() : null;
  if (!token || token !== secret) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
  next();
}

router.get('/health', (_req, res) => {
  const secret = Boolean(process.env.PAPERCLIP_BRIDGE_SECRET);
  const base = getPublicBase();
  let mapOk = false;
  let mapError: string | undefined;
  try {
    loadWorkflowMap();
    mapOk = true;
  } catch (e: unknown) {
    mapError = e instanceof Error ? e.message : String(e);
  }
  res.json({
    ok: secret && mapOk && Boolean(base),
    bridgeSecretSet: secret,
    publicBaseSet: Boolean(base),
    workflowMapLoaded: mapOk,
    workflowMapError: mapError,
  });
});

router.post('/trigger', authMiddleware, async (req, res) => {
  const body = req.body as {
    workflowKey?: unknown;
    correlationId?: unknown;
    payload?: unknown;
  };

  const workflowKey = typeof body.workflowKey === 'string' ? body.workflowKey.trim() : '';
  if (!workflowKey) {
    return res.status(400).json({ ok: false, message: 'workflowKey is required' });
  }

  const base = getPublicBase();
  if (!base) {
    return res.status(503).json({
      ok: false,
      message: 'Missing PAPERCLIP_N8N_PUBLIC_BASE or N8N_API_URL to build webhook URL.',
    });
  }

  let map: WorkflowMap;
  try {
    map = loadWorkflowMap();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(503).json({ ok: false, message: msg });
  }

  const entry = map[workflowKey];
  if (!entry) {
    return res.status(404).json({ ok: false, message: `Unknown workflowKey: ${workflowKey}` });
  }

  const targetUrl = resolveTargetUrl(entry, base);
  if (!targetUrl) {
    return res.status(500).json({
      ok: false,
      message: `Invalid map entry for ${workflowKey}: set webhookPath or webhookUrl`,
    });
  }

  const correlationId =
    typeof body.correlationId === 'string' && body.correlationId.trim()
      ? body.correlationId.trim()
      : crypto.randomUUID();

  const payload =
    body.payload !== undefined && body.payload !== null && typeof body.payload === 'object'
      ? (body.payload as Record<string, unknown>)
      : {};

  const merged = { ...payload, correlationId };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (entry.webhookSecretHeader?.headerName && entry.webhookSecretHeader.envVar) {
    const val = process.env[entry.webhookSecretHeader.envVar];
    if (val) {
      headers[entry.webhookSecretHeader.headerName] = val;
    }
  }

  try {
    const n8nRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(merged),
    });

    const text = await n8nRes.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.length > 500 ? `${text.slice(0, 500)}…` : text;
    }

    return res.status(n8nRes.ok ? 200 : 502).json({
      ok: n8nRes.ok,
      correlationId,
      workflowKey,
      n8nStatus: n8nRes.status,
      n8nBody: parsed,
    });
  } catch (e: unknown) {
    console.error('paperclip-n8n trigger failed:', e);
    return res.status(502).json({
      ok: false,
      correlationId,
      message: 'Failed to reach n8n webhook',
    });
  }
});

export default router;
