#!/usr/bin/env node
/**
 * Align OpenClaw mirror executives (CTO/CMO/CBDO/CFO) under CEO (OpenClaw):
 * - POST /api/agents/:id/skills/sync with OpenClaw CEO's desiredSkills
 * - PATCH runtimeConfig.heartbeat merged from OpenClaw CEO (same logic as align-learnxr-c-suite)
 *
 * Env:
 *   PAPERCLIP_BASE_URL       default http://127.0.0.1:3100
 *   PAPERCLIP_COMPANY_ID     required
 *   PAPERCLIP_COOKIE         optional
 *   PAPERCLIP_AUTH_HEADER    optional
 *   PAPERCLIP_OC_CEO_NAME    default "CEO (OpenClaw)"
 *   PAPERCLIP_OC_CEO_AGENT_ID optional UUID override
 *   PAPERCLIP_DRY_RUN        if "1", log only
 *
 * Usage:
 *   PAPERCLIP_COMPANY_ID=... node scripts/paperclip/align-openclaw-mirror-c-suite.mjs
 */

const EXEC_ROLES = new Set(["cto", "cmo", "cbdo", "cfo"]);
const DEFAULT_HEARTBEAT_FALLBACK = {
  enabled: true,
  intervalSec: 3600,
  cooldownSec: 10,
  wakeOnDemand: true,
  maxConcurrentRuns: 1,
};

function env(name, fallback = "") {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
}

function isLoopbackBase(base) {
  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h === "::1";
  } catch {
    return false;
  }
}

function isDryRun() {
  const v = env("PAPERCLIP_DRY_RUN", "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseBool(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return undefined;
}

function parseNum(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

function heartbeatPolicy(runtimeConfig) {
  const hb = isPlainObject(runtimeConfig?.heartbeat) ? runtimeConfig.heartbeat : {};
  return {
    enabled: parseBool(hb.enabled) ?? true,
    intervalSec: Math.max(0, parseNum(hb.intervalSec) ?? 0),
  };
}

function buildHeaders() {
  const cookie = env("PAPERCLIP_COOKIE", "");
  const auth = env("PAPERCLIP_AUTH_HEADER", "");
  const h = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (cookie) h.Cookie = cookie;
  if (auth) h.Authorization = auth;
  return h;
}

async function request(base, method, path, jsonBody) {
  const url = `${base.replace(/\/+$/, "")}${path}`;
  const init = { method, headers: buildHeaders() };
  if (jsonBody !== undefined && jsonBody !== null) init.body = JSON.stringify(jsonBody);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  if (!res.ok) {
    const msg = json?.error || json?.message || text || res.statusText;
    throw new Error(`${method} ${path} -> ${res.status}: ${msg}`);
  }
  return json;
}

function mergeRuntimeConfig(execRc, ceoRc) {
  const exec = isPlainObject(execRc) ? { ...execRc } : {};
  const ceoHb = isPlainObject(ceoRc?.heartbeat) ? { ...ceoRc.heartbeat } : {};
  const ceoPolicy = heartbeatPolicy(ceoRc);
  let heartbeat;
  if (ceoPolicy.intervalSec > 0) {
    heartbeat = {
      ...(isPlainObject(exec.heartbeat) ? exec.heartbeat : {}),
      ...ceoHb,
    };
  } else {
    heartbeat = {
      ...(isPlainObject(exec.heartbeat) ? exec.heartbeat : {}),
      ...DEFAULT_HEARTBEAT_FALLBACK,
    };
  }
  return { ...exec, heartbeat };
}

function isOpenclawMirrorExec(agent, ocCeoId) {
  if (agent.id === ocCeoId) return false;
  if (agent.adapterType !== "openclaw_gateway") return false;
  if (agent.status !== "idle") return false;
  if (agent.reportsTo !== ocCeoId) return false;
  return EXEC_ROLES.has(agent.role);
}

async function main() {
  const base = env("PAPERCLIP_BASE_URL", "http://127.0.0.1:3100");
  const companyId = env("PAPERCLIP_COMPANY_ID", "");
  const ocCeoName = env("PAPERCLIP_OC_CEO_NAME", "CEO (OpenClaw)");
  const dry = isDryRun();

  if (!companyId) {
    console.error("Missing PAPERCLIP_COMPANY_ID");
    process.exit(1);
  }
  if (!isLoopbackBase(base) && !env("PAPERCLIP_COOKIE", "") && !env("PAPERCLIP_AUTH_HEADER", "")) {
    console.error("Set PAPERCLIP_COOKIE or PAPERCLIP_AUTH_HEADER for non-loopback.");
    process.exit(1);
  }
  if (dry) console.log("[dry-run] no mutations\n");

  const agents = await request(base, "GET", `/api/companies/${companyId}/agents`);
  if (!Array.isArray(agents)) {
    console.error("Unexpected agents list");
    process.exit(1);
  }

  let ocCeoId = env("PAPERCLIP_OC_CEO_AGENT_ID", "").trim();
  const ocCeos = agents.filter(
    (a) =>
      a.adapterType === "openclaw_gateway" &&
      a.name === ocCeoName &&
      a.status !== "terminated",
  );
  if (!ocCeoId) {
    if (ocCeos.length === 0) {
      console.error(`No OpenClaw CEO agent named "${ocCeoName}". Set PAPERCLIP_OC_CEO_AGENT_ID.`);
      process.exit(1);
    }
    if (ocCeos.length > 1) {
      console.error("Multiple OpenClaw CEOs match name; set PAPERCLIP_OC_CEO_AGENT_ID.");
      process.exit(1);
    }
    ocCeoId = ocCeos[0].id;
  }

  const ocCeo = agents.find((a) => a.id === ocCeoId);
  if (!ocCeo || ocCeo.status === "terminated") {
    console.error("OpenClaw CEO agent id invalid or terminated.");
    process.exit(1);
  }

  console.log(`OpenClaw CEO: ${ocCeo.name} (${ocCeoId})\n`);

  const ceoSkills = await request(base, "GET", `/api/agents/${ocCeoId}/skills`);
  const desiredSkills = Array.isArray(ceoSkills?.desiredSkills) ? [...ceoSkills.desiredSkills] : [];
  if (desiredSkills.length === 0) {
    console.warn("OpenClaw CEO desiredSkills empty — skipping skills/sync for mirror execs.");
  }

  const executives = agents.filter((a) => isOpenclawMirrorExec(a, ocCeoId));
  if (executives.length === 0) {
    console.log("No idle OpenClaw mirror executives (cto/cmo/cbdo/cfo reporting to OpenClaw CEO).");
    process.exit(0);
  }

  console.log(`Aligning ${executives.length} OpenClaw mirror executive(s)\n`);

  for (const ex of executives) {
    const label = `${ex.name} (${ex.id}) role=${ex.role}`;
    const summary = { agent: label, skills: null, heartbeat: null };

    if (desiredSkills.length > 0) {
      if (!dry) {
        await request(base, "POST", `/api/agents/${ex.id}/skills/sync`, { desiredSkills });
      }
      summary.skills = `sync ${desiredSkills.length} skill key(s)`;
    } else {
      summary.skills = "skipped";
    }

    const before = heartbeatPolicy(ex.runtimeConfig);
    const mergedRc = mergeRuntimeConfig(ex.runtimeConfig, ocCeo.runtimeConfig);
    const after = heartbeatPolicy(mergedRc);
    const hbChanged = before.enabled !== after.enabled || before.intervalSec !== after.intervalSec;
    summary.heartbeat = hbChanged
      ? `enabled=${before.enabled} interval=${before.intervalSec}s -> enabled=${after.enabled} interval=${after.intervalSec}s`
      : "unchanged";

    if (hbChanged || JSON.stringify(ex.runtimeConfig ?? {}) !== JSON.stringify(mergedRc)) {
      if (!dry) {
        await request(base, "PATCH", `/api/agents/${ex.id}`, { runtimeConfig: mergedRc });
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
