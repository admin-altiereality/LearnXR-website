#!/usr/bin/env node
/**
 * Read-only audit: Paperclip agents vs OpenClaw execution capability.
 *
 * PASS = adapterType is openclaw_gateway, url present in adapterConfig, heartbeat enabled,
 *        and desiredSkills include paperclip + openclaw-paperclip (local/... key prefix).
 *
 * Env:
 *   PAPERCLIP_BASE_URL    default http://127.0.0.1:3100
 *   PAPERCLIP_COMPANY_ID  required
 *   PAPERCLIP_COOKIE      optional
 *   PAPERCLIP_AUTH_HEADER optional
 *   PAPERCLIP_INCLUDE_TERMINATED  if "1", include terminated agents
 *
 * Usage:
 *   PAPERCLIP_COMPANY_ID=... node scripts/paperclip/audit-openclaw-capabilities.mjs
 */

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

async function request(base, method, path) {
  const url = `${base.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, { method, headers: buildHeaders() });
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

const OPENCLAW_ADAPTER = "openclaw_gateway";

function redactConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return {};
  const o = { ...cfg };
  if (typeof o.authToken === "string") o.authToken = o.authToken ? "[set]" : "";
  if (typeof o.password === "string") o.password = o.password ? "[set]" : "";
  if (o.headers && typeof o.headers === "object") {
    const h = { ...o.headers };
    for (const k of Object.keys(h)) {
      if (/token|auth|secret|password/i.test(k)) h[k] = h[k] ? "[redacted]" : "";
    }
    o.headers = h;
  }
  return o;
}

function hasOpenclawSkillKey(desired) {
  if (!Array.isArray(desired)) return false;
  return desired.some((k) => typeof k === "string" && k.includes("openclaw-paperclip"));
}

function hasPaperclipSkill(desired) {
  if (!Array.isArray(desired)) return false;
  return desired.some((k) => typeof k === "string" && k.includes("paperclip/paperclip") && !k.includes("create-"));
}

function evaluate(agent, skillsPayload) {
  const adapter = agent.adapterType || "";
  const desired = Array.isArray(skillsPayload?.desiredSkills) ? skillsPayload.desiredSkills : [];
  const hb = agent.runtimeConfig?.heartbeat || {};
  const hbOk = hb.enabled !== false && (Number(hb.intervalSec) > 0 || hb.intervalSec === undefined);
  const cfg = agent.adapterConfig || {};
  const urlOk =
    typeof cfg.url === "string" &&
    cfg.url.trim() &&
    (cfg.url.startsWith("ws://") || cfg.url.startsWith("wss://"));
  const tokenOk =
    (typeof cfg.authToken === "string" && cfg.authToken.length > 0) ||
    (cfg.headers &&
      typeof cfg.headers === "object" &&
      (cfg.headers["x-openclaw-token"] || cfg.headers["x-openclaw-auth"]));

  if (adapter !== OPENCLAW_ADAPTER) {
    return {
      pass: false,
      reason: `adapterType=${adapter || "?"} (need ${OPENCLAW_ADAPTER})`,
    };
  }
  if (!urlOk) {
    return { pass: false, reason: "adapterConfig.url missing or not ws(s)://" };
  }
  if (!tokenOk) {
    return {
      pass: false,
      reason: "no gateway auth (authToken or x-openclaw-token / x-openclaw-auth header)",
    };
  }
  if (!hbOk) {
    return { pass: false, reason: "heartbeat disabled or intervalSec=0" };
  }
  if (!hasPaperclipSkill(desired)) {
    return { pass: false, reason: "desiredSkills missing paperclip coordination skill" };
  }
  if (!hasOpenclawSkillKey(desired)) {
    return { pass: false, reason: "desiredSkills missing openclaw-paperclip company skill" };
  }
  return { pass: true, reason: "OpenClaw gateway execution capable" };
}

async function main() {
  const base = env("PAPERCLIP_BASE_URL", "http://127.0.0.1:3100");
  const companyId = env("PAPERCLIP_COMPANY_ID", "");
  const includeTerminated = env("PAPERCLIP_INCLUDE_TERMINATED", "").toLowerCase() === "1";

  if (!companyId) {
    console.error("Missing PAPERCLIP_COMPANY_ID");
    process.exit(1);
  }
  const loopback = isLoopbackBase(base);
  if (!loopback && !env("PAPERCLIP_COOKIE", "") && !env("PAPERCLIP_AUTH_HEADER", "")) {
    console.error("Set PAPERCLIP_COOKIE or PAPERCLIP_AUTH_HEADER for non-loopback.");
    process.exit(1);
  }
  if (loopback && !env("PAPERCLIP_COOKIE", "") && !env("PAPERCLIP_AUTH_HEADER", "")) {
    console.log("(loopback) implicit board API access\n");
  }

  const agents = await request(base, "GET", `/api/companies/${companyId}/agents`);
  if (!Array.isArray(agents)) {
    console.error("Unexpected agents response");
    process.exit(1);
  }

  const filtered = includeTerminated ? agents : agents.filter((a) => a.status !== "terminated");

  console.log(
    "Agent audit (OpenClaw execution = openclaw_gateway + ws url + auth + heartbeat + skills)\n",
  );
  console.log(
    "| PASS | name | role | adapter | heartbeat | skills check | notes |\n|------|------|------|---------|-----------|--------------|-------|",
  );

  let passCount = 0;
  for (const a of filtered) {
    let skillsPayload = null;
    try {
      skillsPayload = await request(base, "GET", `/api/agents/${a.id}/skills`);
    } catch {
      skillsPayload = { desiredSkills: [] };
    }
    const { pass, reason } = evaluate(a, skillsPayload);
    if (pass) passCount++;
    const hb = a.runtimeConfig?.heartbeat;
    const hbStr =
      hb == null ? "?" : `${hb.enabled !== false ? "on" : "off"}/${hb.intervalSec ?? "?"}s`;
    const p = pass ? "PASS" : "FAIL";
    const name = (a.name || "").replace(/\|/g, "/");
    console.log(
      `| ${p} | ${name} | ${a.role || ""} | ${a.adapterType || ""} | ${hbStr} | ${pass ? "ok" : "see notes"} | ${reason.replace(/\|/g, "/")} |`,
    );
  }

  console.log(`\nSummary: ${passCount}/${filtered.length} agents pass OpenClaw execution audit.`);
  console.log(
    "\nAdapter reference (this Paperclip build): openclaw_gateway — see /llms/agent-configuration/openclaw_gateway.txt",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
