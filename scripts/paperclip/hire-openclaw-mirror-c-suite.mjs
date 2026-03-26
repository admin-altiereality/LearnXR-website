#!/usr/bin/env node
/**
 * Hire OpenClaw gateway mirror executives under CEO (OpenClaw), approve pending hires,
 * optionally print invite-prompt URLs for OpenClaw registration.
 *
 * Prereq: CEO (OpenClaw) exists (role general, openclaw_gateway, reportsTo null).
 *
 * Env:
 *   PAPERCLIP_BASE_URL       default http://127.0.0.1:3100
 *   PAPERCLIP_COMPANY_ID     required
 *   PAPERCLIP_COOKIE         optional
 *   PAPERCLIP_AUTH_HEADER    optional
 *   OPENCLAW_GATEWAY_URL     default ws://127.0.0.1:18789
 *   OPENCLAW_GATEWAY_TOKEN   optional; else read gateway.auth.token from OPENCLAW_CONFIG_PATH
 *   OPENCLAW_CONFIG_PATH     default ~/.openclaw/openclaw.json
 *   PAPERCLIP_OC_CEO_NAME    default "CEO (OpenClaw)" — used to find OpenClaw CEO id
 *   PAPERCLIP_SKIP_APPROVE   if "1", do not POST .../approvals/:id/approve
 *   PAPERCLIP_SKIP_INVITES   if "1", do not POST openclaw/invite-prompt per mirror agent
 *
 * Usage:
 *   PAPERCLIP_COMPANY_ID=... node scripts/paperclip/hire-openclaw-mirror-c-suite.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

function readGatewayToken() {
  const t = env("OPENCLAW_GATEWAY_TOKEN", "");
  if (t) return t;
  const cfgPath =
    env("OPENCLAW_CONFIG_PATH", "") || path.join(os.homedir(), ".openclaw", "openclaw.json");
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    const j = JSON.parse(raw);
    const tok = j?.gateway?.auth?.token;
    if (typeof tok === "string" && tok.length > 0) return tok;
  } catch {
    /* ignore */
  }
  throw new Error(
    "Set OPENCLAW_GATEWAY_TOKEN or ensure ~/.openclaw/openclaw.json has gateway.auth.token",
  );
}

const DEFAULT_SKILLS = [
  "paperclipai/paperclip/paperclip",
  "paperclipai/paperclip/paperclip-create-agent",
  "paperclipai/paperclip/paperclip-create-plugin",
  "paperclipai/paperclip/para-memory-files",
  "local/fb51b06164/openclaw-paperclip",
];

const MIRRORS = [
  { name: "CTO (OpenClaw)", role: "cto", title: "Chief Technology Officer (OpenClaw)", icon: "cpu", capabilities: "OpenClaw mirror: engineering, infra, security context via gateway." },
  { name: "CMO (OpenClaw)", role: "cmo", title: "Chief Marketing Officer (OpenClaw)", icon: "mail", capabilities: "OpenClaw mirror: brand, campaigns, comms via gateway channels." },
  { name: "CBDO (OpenClaw)", role: "cbdo", title: "Chief Business Development Officer (OpenClaw)", icon: "globe", capabilities: "OpenClaw mirror: partnerships, pipeline, school-facing outreach via gateway." },
  { name: "CFO (OpenClaw)", role: "cfo", title: "Chief Financial Officer (OpenClaw)", icon: "target", capabilities: "OpenClaw mirror: budgets, pricing guardrails messaging via gateway." },
];

function heartbeatBlock() {
  return {
    enabled: true,
    intervalSec: 3600,
    cooldownSec: 10,
    wakeOnDemand: true,
    maxConcurrentRuns: 1,
  };
}

async function approveAllPendingHires(base, companyId) {
  const list = await request(base, "GET", `/api/companies/${companyId}/approvals?status=pending`);
  const rows = Array.isArray(list) ? list : list?.value || [];
  for (const a of rows) {
    if (a.type !== "hire_agent") continue;
    await request(base, "POST", `/api/approvals/${a.id}/approve`, {});
    console.log("Approved hire approval:", a.id, a.payload?.name || "");
  }
}

async function main() {
  const base = env("PAPERCLIP_BASE_URL", "http://127.0.0.1:3100");
  const companyId = env("PAPERCLIP_COMPANY_ID", "");
  const skipApprove = env("PAPERCLIP_SKIP_APPROVE", "") === "1";
  const skipInvites = env("PAPERCLIP_SKIP_INVITES", "") === "1";
  const ocCeoName = env("PAPERCLIP_OC_CEO_NAME", "CEO (OpenClaw)");
  const gwUrl = env("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789");
  const token = readGatewayToken();

  if (!companyId) {
    console.error("Missing PAPERCLIP_COMPANY_ID");
    process.exit(1);
  }
  if (!isLoopbackBase(base) && !env("PAPERCLIP_COOKIE", "") && !env("PAPERCLIP_AUTH_HEADER", "")) {
    console.error("Set PAPERCLIP_COOKIE or PAPERCLIP_AUTH_HEADER for non-loopback.");
    process.exit(1);
  }

  const agents = await request(base, "GET", `/api/companies/${companyId}/agents`);
  if (!Array.isArray(agents)) {
    console.error("Unexpected agents list");
    process.exit(1);
  }

  const ocCeo = agents.find((a) => a.name === ocCeoName && a.adapterType === "openclaw_gateway");
  if (!ocCeo || ocCeo.status === "terminated") {
    console.error(`Missing OpenClaw CEO agent named "${ocCeoName}" with openclaw_gateway. Create and approve that hire first.`);
    process.exit(1);
  }
  const ocCeoId = ocCeo.id;
  console.log("OpenClaw CEO:", ocCeo.name, ocCeoId, "status=", ocCeo.status);

  const adapterConfig = {
    url: gwUrl,
    authToken: token,
  };

  for (const m of MIRRORS) {
    const exists = agents.some(
      (a) => a.name === m.name && a.status !== "terminated",
    );
    if (exists) {
      console.log("Skip hire (exists):", m.name);
      continue;
    }
    const body = {
      name: m.name,
      role: m.role,
      title: m.title,
      icon: m.icon,
      reportsTo: ocCeoId,
      capabilities: m.capabilities,
      adapterType: "openclaw_gateway",
      adapterConfig: { ...adapterConfig },
      runtimeConfig: { heartbeat: heartbeatBlock() },
      desiredSkills: [...DEFAULT_SKILLS],
    };
    console.log("Submit hire:", m.name);
    await request(base, "POST", `/api/companies/${companyId}/agent-hires`, body);
  }

  if (!skipApprove) {
    await approveAllPendingHires(base, companyId);
  }

  const refreshed = await request(base, "GET", `/api/companies/${companyId}/agents`);
  const mirrors = refreshed.filter(
    (a) =>
      a.adapterType === "openclaw_gateway" &&
      a.status !== "terminated" &&
      (a.name === ocCeoName || a.name.endsWith("(OpenClaw)")),
  );
  console.log("\nOpenClaw mirror agents:", mirrors.map((a) => `${a.name} ${a.id} ${a.status}`).join("\n"));

  if (!skipInvites) {
    console.log("\n--- OpenClaw invite prompts (fetch URL, paste body into OpenClaw) ---\n");
    for (const a of mirrors) {
      try {
        const inv = await request(
          base,
          "POST",
          `/api/companies/${companyId}/openclaw/invite-prompt`,
          {
            agentMessage: `Join Paperclip agent ${a.name} (${a.id}). Gateway: ${gwUrl}`,
          },
        );
        const url = inv?.onboardingTextUrl || inv?.onboardingTextURL;
        console.log(a.name, a.id);
        console.log("  onboardingTextUrl:", url || JSON.stringify(inv));
        console.log("");
      } catch (e) {
        console.warn("  invite-prompt failed:", a.name, e.message);
      }
    }
    console.log("Complete registration in OpenClaw for each agent (Linked devices / gateway UI as applicable).");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
