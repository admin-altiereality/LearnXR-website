#!/usr/bin/env node
/**
 * Align LearnXR C-suite agents (cto, cmo, cbdo, cfo) with the CEO after board approval:
 * - Set reportsTo -> CEO
 * - POST /api/agents/:id/skills/sync with CEO's desiredSkills
 * - PATCH runtimeConfig with CEO's heartbeat policy (fallback if CEO interval is 0)
 *
 * Env:
 *   PAPERCLIP_BASE_URL      default http://127.0.0.1:3100
 *   PAPERCLIP_COMPANY_ID    required (UUID)
 *   PAPERCLIP_COOKIE        Optional. Board Cookie header (authenticated / remote). Not required for loopback
 *                            when Paperclip is in local_trusted mode (implicit board — same as Simple Browser).
 *   PAPERCLIP_CEO_AGENT_ID  optional; if unset, the sole non-terminated agent with role "ceo" is used
 *   PAPERCLIP_DRY_RUN       if "1" or "true", log actions only
 *   PAPERCLIP_AUTH_HEADER   optional; if set, sent as Authorization (e.g. "Bearer ...") instead of/in addition to cookie
 *   PAPERCLIP_RESUME_CEO    if "0" or "false", do not POST /agents/:ceoId/resume when CEO is paused
 *
 * Usage:
 *   PAPERCLIP_COMPANY_ID=... node scripts/paperclip/align-learnxr-c-suite.mjs
 *   # remote / authenticated Paperclip still needs PAPERCLIP_COOKIE or PAPERCLIP_AUTH_HEADER
 */

const EXEC_ROLES = new Set(["cto", "cmo", "cbdo", "cfo"]);
const EXEC_URL_KEYS = new Set(["cto", "cmo", "cbdo", "cfo"]);
const DEFAULT_HEARTBEAT_FALLBACK = {
  enabled: true,
  intervalSec: 3600,
  cooldownSec: 10,
  wakeOnDemand: true,
  maxConcurrentRuns: 1,
};

function isLoopbackBase(base) {
  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h === "::1";
  } catch {
    return false;
  }
}

/** Paperclip role saved as "general" if UI role was wrong; match urlKey or name. */
function inferCanonicalExecRole(agent) {
  if (EXEC_ROLES.has(agent.role)) return agent.role;
  const key = typeof agent.urlKey === "string" ? agent.urlKey.trim().toLowerCase() : "";
  if (EXEC_URL_KEYS.has(key)) return key;
  const n = typeof agent.name === "string" ? agent.name.trim().toLowerCase() : "";
  if (EXEC_URL_KEYS.has(n)) return n;
  return null;
}

function isLearnxrExecutive(agent, ceoId) {
  if (agent.id === ceoId) return false;
  if (agent.status !== "idle") return false;
  return inferCanonicalExecRole(agent) !== null;
}

function env(name, fallback = "") {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
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

/** Match server parseSchedulerHeartbeatPolicy defaults */
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

async function main() {
  const base = env("PAPERCLIP_BASE_URL", "http://127.0.0.1:3100");
  const companyId = env("PAPERCLIP_COMPANY_ID", "");
  const cookie = env("PAPERCLIP_COOKIE", "");
  const auth = env("PAPERCLIP_AUTH_HEADER", "");

  if (!companyId) {
    console.error("Missing PAPERCLIP_COMPANY_ID");
    process.exit(1);
  }
  const loopback = isLoopbackBase(base);
  if (!cookie && !auth && !loopback) {
    console.error(
      "Set PAPERCLIP_COOKIE and/or PAPERCLIP_AUTH_HEADER for non-loopback Paperclip, or use PAPERCLIP_BASE_URL=http://127.0.0.1:3100 (local_trusted implicit board).",
    );
    process.exit(1);
  }
  if (loopback && !cookie && !auth) {
    console.log("(loopback) No cookie — using Paperclip local_trusted implicit board API access\n");
  }

  const dry = isDryRun();
  if (dry) console.log("[dry-run] no mutations will be sent\n");

  const agents = await request(base, "GET", `/api/companies/${companyId}/agents`);
  if (!Array.isArray(agents)) {
    console.error("Unexpected agents list response");
    process.exit(1);
  }

  const active = (a) => a.status !== "terminated";
  let ceoId = env("PAPERCLIP_CEO_AGENT_ID", "").trim();
  const ceos = agents.filter((a) => a.role === "ceo" && active(a));
  if (!ceoId) {
    if (ceos.length === 0) {
      console.error("No CEO agent found (role=ceo, not terminated). Set PAPERCLIP_CEO_AGENT_ID.");
      process.exit(1);
    }
    if (ceos.length > 1) {
      console.error(
        `Multiple CEOs found (${ceos.map((c) => c.id).join(", ")}). Set PAPERCLIP_CEO_AGENT_ID.`,
      );
      process.exit(1);
    }
    ceoId = ceos[0].id;
  } else {
    const ceo = agents.find((a) => a.id === ceoId);
    if (!ceo || !active(ceo)) {
      console.error("PAPERCLIP_CEO_AGENT_ID does not match an active agent in this company");
      process.exit(1);
    }
  }

  const ceo = agents.find((a) => a.id === ceoId);
  console.log(`CEO: ${ceo.name} (${ceoId}) role=${ceo.role} status=${ceo.status}`);

  const resumeCeo = env("PAPERCLIP_RESUME_CEO", "true").toLowerCase();
  if (!dry && ceo.status === "paused" && resumeCeo !== "0" && resumeCeo !== "false" && resumeCeo !== "no") {
    await request(base, "POST", `/api/agents/${ceoId}/resume`, null);
    console.log("Resumed paused CEO.\n");
    const refreshed = await request(base, "GET", `/api/companies/${companyId}/agents`);
    if (Array.isArray(refreshed)) {
      const row = refreshed.find((a) => a.id === ceoId);
      if (row) Object.assign(ceo, row);
    }
  }

  const ceoSkills = await request(base, "GET", `/api/agents/${ceoId}/skills`);
  const desiredSkills = Array.isArray(ceoSkills?.desiredSkills) ? [...ceoSkills.desiredSkills] : [];
  if (desiredSkills.length === 0) {
    console.warn(
      "CEO desiredSkills is empty — skipping skills/sync for executives. Configure CEO skills in Paperclip, then re-run.",
    );
  }

  const executives = agents.filter((a) => isLearnxrExecutive(a, ceoId));

  if (executives.length === 0) {
    console.log(
      "No idle executives to align. Need role cto|cmo|cbdo|cfo — or agent name/urlKey CTO|CMO|CBDO|CFO (e.g. urlKey \"cto\").",
    );
    process.exit(0);
  }

  console.log(`Aligning ${executives.length} executive(s) -> CEO ${ceoId}\n`);

  for (const ex of executives) {
    const canonRole = inferCanonicalExecRole(ex);
    const label = `${ex.name} (${ex.id}) role=${ex.role} urlKey=${ex.urlKey ?? ""} -> canon=${canonRole}`;
    const summary = { agent: label, reportsTo: null, role: null, skills: null, heartbeat: null };

    const patchBase = {};
    if (ex.reportsTo !== ceoId) {
      summary.reportsTo = `${ex.reportsTo ?? "null"} -> ${ceoId}`;
      patchBase.reportsTo = ceoId;
    } else {
      summary.reportsTo = "unchanged";
    }
    if (canonRole && ex.role !== canonRole) {
      summary.role = `${ex.role} -> ${canonRole}`;
      patchBase.role = canonRole;
    } else {
      summary.role = "unchanged";
    }
    if (!dry && Object.keys(patchBase).length > 0) {
      await request(base, "PATCH", `/api/agents/${ex.id}`, patchBase);
    }

    if (desiredSkills.length > 0) {
      if (!dry) {
        await request(base, "POST", `/api/agents/${ex.id}/skills/sync`, { desiredSkills });
      }
      summary.skills = `sync ${desiredSkills.length} skill key(s)`;
    } else {
      summary.skills = "skipped (no CEO skills)";
    }

    const before = heartbeatPolicy(ex.runtimeConfig);
    const mergedRc = mergeRuntimeConfig(ex.runtimeConfig, ceo.runtimeConfig);
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

  console.log("\nDone. Verify: org chart under CEO, GET /api/instance/scheduler-heartbeats, then a test run or heartbeat.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
