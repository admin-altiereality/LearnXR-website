/**
 * Export n8n workflows for Paperclip/n8n inventory (Phase 1).
 * Usage (from server/): pnpm run export-n8n-workflows [-- --out path/to/file.json]
 *
 * Requires: N8N_API_URL, N8N_API_KEY
 * Optional: EXPORT_N8N_INCLUDE_NODES=1 — fetch each workflow by id so trigger inference has nodes (slower).
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const TRIGGER_TYPES: { type: string; label: string }[] = [
  { type: 'n8n-nodes-base.webhook', label: 'Webhook' },
  { type: '@n8n/n8n-nodes-langchain.webhook', label: 'Webhook' },
  { type: 'n8n-nodes-base.scheduleTrigger', label: 'Schedule' },
  { type: 'n8n-nodes-base.cron', label: 'Cron' },
  { type: 'n8n-nodes-base.manualTrigger', label: 'Manual' },
  { type: 'n8n-nodes-base.emailReadImap', label: 'Email' },
  { type: 'n8n-nodes-base.formTrigger', label: 'Form' },
];

type N8nNode = { type?: string; name?: string };
type N8nWorkflow = {
  id: string;
  name: string;
  active?: boolean;
  tags?: { id: string; name: string }[];
  nodes?: N8nNode[];
};

function inferTrigger(nodes: N8nNode[] | undefined): string {
  if (!nodes?.length) return 'unknown';
  const types = new Set(nodes.map((n) => n.type).filter(Boolean) as string[]);
  const found: string[] = [];
  for (const { type, label } of TRIGGER_TYPES) {
    if (types.has(type)) found.push(label);
  }
  return found.length ? [...new Set(found)].join(', ') : 'other';
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let outPath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) {
      outPath = argv[i + 1];
      i++;
    }
  }
  // npm on Windows may drop `--out`; accept a lone `.json` path as output
  if (!outPath && argv.length === 1 && argv[0].endsWith('.json')) {
    outPath = argv[0];
  }
  return { outPath };
}

async function main() {
  const baseRaw = process.env.N8N_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.N8N_API_KEY;
  if (!baseRaw || !apiKey) {
    console.error('Missing N8N_API_URL or N8N_API_KEY in environment.');
    process.exit(1);
  }

  const base = baseRaw.replace(/\/api\/v\d+$/i, '');
  const url = `${base}/api/v1/workflows`;

  const res = await fetch(url, {
    headers: { 'X-N8N-API-KEY': apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`n8n API error ${res.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }

  const raw = (await res.json()) as { data?: N8nWorkflow[] } | N8nWorkflow[];
  let list = Array.isArray(raw) ? raw : raw.data ?? [];

  const includeNodes = process.env.EXPORT_N8N_INCLUDE_NODES === '1';
  if (includeNodes && list.length > 0) {
    const needsDetail = list.some((w) => !w.nodes?.length);
    if (needsDetail) {
      const detailBase = `${base}/api/v1/workflows`;
      const detailed: N8nWorkflow[] = [];
      for (const w of list) {
        const urlId = `${detailBase}/${encodeURIComponent(w.id)}`;
        const dr = await fetch(urlId, {
          headers: { 'X-N8N-API-KEY': apiKey },
        });
        if (!dr.ok) {
          console.error(`Warning: could not fetch workflow ${w.id}: ${dr.status}`);
          detailed.push(w);
          continue;
        }
        const one = (await dr.json()) as N8nWorkflow & { data?: N8nWorkflow };
        const entity = (one as { data?: N8nWorkflow }).data ?? one;
        detailed.push(entity);
      }
      list = detailed;
    }
  }

  const rows = list.map((w) => ({
    workflow_id: String(w.id),
    name: w.name,
    active: Boolean(w.active),
    tags: (w.tags ?? []).map((t) => t.name).join(', '),
    inferred_trigger: inferTrigger(w.nodes),
  }));

  const { outPath } = parseArgs();
  const payload = {
    exportedAt: new Date().toISOString(),
    source: base,
    count: rows.length,
    workflows: rows,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (outPath) {
    const abs = path.isAbsolute(outPath) ? outPath : path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(payload, null, 2), 'utf8');
    console.error(`Wrote ${abs}`);
  }

  console.error('\n--- Markdown table (paste into WORKFLOW_INVENTORY.md) ---\n');
  console.error('| workflow_id | name | active | inferred_trigger | tags | lane | execution_model | notes |');
  console.error('|-------------|------|--------|------------------|------|------|-----------------|-------|');
  for (const r of rows) {
    const name = String(r.name).replace(/\|/g, '\\|');
    console.error(
      `| ${r.workflow_id} | ${name} | ${r.active} | ${r.inferred_trigger} | ${r.tags || ''} | | | |`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
