#!/usr/bin/env node
/**
 * Import the repo-local skill `skills/openclaw-paperclip` into Paperclip's company library.
 *
 * Env:
 *   PAPERCLIP_BASE_URL   default http://127.0.0.1:3100
 *   PAPERCLIP_COMPANY_ID required (UUID)
 *   PAPERCLIP_COOKIE     optional (board session)
 *   PAPERCLIP_AUTH_HEADER optional Authorization header (e.g. Bearer …)
 *
 * Optional after import (comma-separated agent UUIDs):
 *   PAPERCLIP_ASSIGN_SKILL_AGENT_IDS=id1,id2
 *   Each agent receives a skills/sync with desiredSkills including the imported skill key
 *   returned by the import API (falls back to "openclaw-paperclip/openclaw-paperclip" if missing).
 *
 * Usage (from repo root):
 *   PAPERCLIP_COMPANY_ID=... node scripts/paperclip/import-openclaw-paperclip-skill.mjs
 *
 * From server/:
 *   PAPERCLIP_COMPANY_ID=... node ../scripts/paperclip/import-openclaw-paperclip-skill.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function skillSourcePath() {
  const abs = join(__dirname, "..", "..", "skills", "openclaw-paperclip");
  return abs;
}

function pickSkillKey(importJson) {
  if (!importJson || typeof importJson !== "object") return null;
  const row = Array.isArray(importJson.imported) ? importJson.imported[0] : null;
  const k =
    row?.key ??
    row?.metadata?.skillKey ??
    importJson.key ??
    importJson.skillKey ??
    importJson.canonicalKey ??
    (importJson.skill && importJson.skill.key);
  return typeof k === "string" && k.trim() ? k.trim() : null;
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
      "Set PAPERCLIP_COOKIE and/or PAPERCLIP_AUTH_HEADER for non-loopback Paperclip, or use loopback local_trusted.",
    );
    process.exit(1);
  }
  if (loopback && !cookie && !auth) {
    console.log("(loopback) implicit board API access\n");
  }

  const source = skillSourcePath();
  console.log("Importing skill from local path:\n ", source, "\n");

  const importJson = await request(base, "POST", `/api/companies/${companyId}/skills/import`, {
    source,
  });

  console.log("Import OK:", JSON.stringify(importJson, null, 2));

  const skillKey = pickSkillKey(importJson) ?? "openclaw-paperclip/openclaw-paperclip";
  console.log("\nUse this key in desiredSkills / skills/sync:", skillKey);

  const assignRaw = env("PAPERCLIP_ASSIGN_SKILL_AGENT_IDS", "").trim();
  if (!assignRaw) {
    console.log("\n(Optional) Set PAPERCLIP_ASSIGN_SKILL_AGENT_IDS=id1,id2 to sync this skill onto agents.");
    return;
  }

  const ids = assignRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const agentId of ids) {
    const existing = await request(base, "GET", `/api/agents/${agentId}/skills`);
    const prev = Array.isArray(existing?.skills)
      ? existing.skills.map((s) => s.key || s.id).filter(Boolean)
      : [];
    const desiredSkills = [...new Set([...prev, skillKey])];
    await request(base, "POST", `/api/agents/${agentId}/skills/sync`, { desiredSkills });
    console.log("Synced skill onto agent", agentId);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
