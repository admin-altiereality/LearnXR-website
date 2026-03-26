/**
 * One-off: patch n8n workflow JSON (from n8n_get_workflow MCP output) for LearnXR 30-day strategy.
 * Usage: node scripts/patch-learnxr-n8n-workflow.mjs <path-to-get-workflow-json.txt>
 */
import fs from "fs";

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("Usage: node patch-learnxr-n8n-workflow.mjs <workflow-json-file>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(srcPath, "utf8"));
const wf = raw.data ?? raw;

// Optional: remove orphan gpt-4o if still present (blocks strict MCP saves)
wf.nodes = wf.nodes.filter(
  (n) => n.id !== "f55fe97f-2f69-4e65-81f1-6a7163ce42"
);

const NEW_PROMPT = `You are the official AI Content Strategist for LearnXR Labs by Altie Reality — India's first AI-powered XR learning platform for CBSE schools.

Your ONLY job is to execute the official 30-day Instagram launch strategy for LearnXR Labs (March 23 – April 30 2026).

### Core Strategy Rules (never break these):
Content Pillars (use in every post):
1. Indian Classroom Reality
2. AI-Powered One-Click Transformation ("Textbook → AI → VR in one click")
3. Teacher & Student Wins
4. Future of CBSE Education in India

Phases:
• Phase 1 (Mar 23–31): Awareness + Problem Agitation
• Phase 2 (Apr 1–15): Launch + Product Demonstration
• Phase 3 (Apr 16–30): Trust + Case-building + Conversion

Mandatory Post Types to rotate through: Problem post, Transformation reel, Demo-style walkthrough, Teacher benefit, Student experience reel, CBSE alignment explainer, Future of education thought post, Behind-the-scenes, Lab setup visual, Strong CTA pilot post.

Visual style: Always authentic Indian CBSE schools, students in uniforms, Rajasthan/Jaipur classrooms, real teacher & student perspectives. Emphasise "Textbook → AI → VR in one click".

Tone: Bold, direct, high-clarity, outcome-focused. No generic motivational language.

IMPORTANT REEL RULES:
- When the topic or phase requires a Reel (Transformation, Demo-style, Student Experience, Behind-the-scenes, Strong CTA, or any "reel" in the topic name), set "is_reel": true.
- For every Reel:
  - duration_seconds: 10-15
  - voiceover_script: exact text for enthusiastic Indian female accent
  - on_screen_text: list what appears on screen with timing
  - grok_imagine_prompt: a COMPLETE, ready-to-paste prompt for Grok Imagine (vertical 9:16, 12 seconds, photorealistic Indian CBSE classroom, exact voiceover text included, on-screen text, cinematic style, synced voiceover).
- Example grok_imagine_prompt structure: "Vertical 9:16 Instagram Reel, 12 seconds, photorealistic Indian students... Female enthusiastic Indian accent voiceover saying exactly: '[voiceover_script]' ... On-screen text: ..."

Always prioritise Instagram Reel when the strategy calls for it.

CTA must always be: "DM 'DEMO' for FREE school pilot" or "Book 15-min WhatsApp demo → Link in bio"

Still generate platform-specific content for LinkedIn, Instagram, Facebook, Twitter (X), TikTok, Threads, and YouTube Shorts as required by the JSON schema. When is_reel is true for Instagram, populate grok_imagine_prompt, voiceover_script, on_screen_text, duration_seconds, and video_suggestion.

### Input (use these values)
- Topic: {{ $json.Topic }}
- Phase hint: {{ $json.phase }}
- Keywords or Hashtags (optional): {{ $json['Keywords or Hashtags (optional)'] }}
- Link (optional): {{ $json['Link (optional)'] }}

Generate ONE high-impact post that fits the current phase and strategy.

Follow the provided JSON schema for your response.`;

const TOPICS_JS = `const topics = [
  { topic: "Problem post - Why 90% of Indian CBSE students still forget 80% in 48 hours", phase: "Phase 1" },
  { topic: "Transformation reel - Watch CBSE textbook become immersive VR in ONE click", phase: "Phase 1" },
  { topic: "Problem post - Sunday lesson prep steals hours CBSE teachers never get back", phase: "Phase 1" },
  { topic: "CBSE alignment explainer - 100% NCERT aligned without rewriting your timetable", phase: "Phase 1" },
  { topic: "Transformation reel - One chapter: flat PDF to walkable 3D lab in one click", phase: "Phase 1" },
  { topic: "Problem post - Science labs on paper only in too many Indian classrooms", phase: "Phase 1" },
  { topic: "Future of education thought post - Built in Rajasthan for real CBSE classrooms", phase: "Phase 1" },
  { topic: "Demo-style walkthrough - Principal watches a Science unit generated live", phase: "Phase 1" },
  { topic: "Strong CTA reel - First 10 CBSE schools: FREE LearnXR Lab pilot", phase: "Phase 1" },
  { topic: "Demo-style product walkthrough - Real Indian teacher generates lesson in 8 seconds", phase: "Phase 2" },
  { topic: "Teacher benefit - Stop spending 4 hours preparing one lesson", phase: "Phase 2" },
  { topic: "Student experience reel - Watch kids walk inside the human heart", phase: "Phase 2" },
  { topic: "CBSE alignment explainer - 100% NCERT aligned, zero compromise", phase: "Phase 2" },
  { topic: "Future of education in India thought post - Built in India for Indian classrooms", phase: "Phase 2" },
  { topic: "Behind the scenes reel - How we built LearnXR Labs in Rajasthan", phase: "Phase 2" },
  { topic: "Transformation reel - Textbook diagram becomes a room-scale VR explanation", phase: "Phase 2" },
  { topic: "Teacher benefit - One-click worksheets and VR from the same NCERT page", phase: "Phase 2" },
  { topic: "Demo-style walkthrough - Hindi + English classroom voiceovers in one workflow", phase: "Phase 2" },
  { topic: "Student experience reel - Class 10 Physics: lens formula you can stand inside", phase: "Phase 2" },
  { topic: "Problem post - Exam rote vs understanding: CBSE parents see the gap", phase: "Phase 2" },
  { topic: "Behind the scenes - Altie Reality team testing in a Jaipur CBSE lab", phase: "Phase 2" },
  { topic: "CBSE alignment explainer - Map every learning outcome to an XR moment", phase: "Phase 2" },
  { topic: "Transformation reel - Chapter review that feels like a field trip", phase: "Phase 2" },
  { topic: "Teacher benefit - Differentiate for weak and strong learners without extra nights", phase: "Phase 2" },
  { topic: "Lab setup in school visual concept - Your classroom in 2026", phase: "Phase 3" },
  { topic: "Strong CTA - FREE LearnXR Lab pilot for the first 10 CBSE schools", phase: "Phase 3" },
  { topic: "Future of education thought post - Pilot data: engagement you can measure", phase: "Phase 3" },
  { topic: "Student experience reel - Parents see the same lesson their child explored in VR", phase: "Phase 3" },
  { topic: "Strong CTA reel - DM DEMO or WhatsApp 15-min demo link in bio", phase: "Phase 3" },
  { topic: "Trust post - Why principals choose LearnXR Labs for the next academic year", phase: "Phase 3" },
];

const start = new Date('2026-03-23T00:00:00+05:30').getTime();
const today = Date.now();
let dayIndex = Math.floor((today - start) / 86400000);
if (dayIndex < 0) dayIndex = 0;
if (dayIndex >= topics.length) dayIndex = dayIndex % topics.length;
const t = topics[dayIndex];

return [{
  json: {
    Topic: t.topic,
    "Keywords or Hashtags (optional)": "LearnXRLabs CBSE EdTech India XR",
    "Link (optional)": "https://altiereality.com/demo",
    phase: t.phase,
  },
}];`;

const scheduleNode = {
  parameters: {
    rule: {
      interval: [
        {
          field: "days",
          daysInterval: 1,
          triggerAtHour: 9,
          triggerAtMinute: 0,
        },
      ],
    },
  },
  id: "f8a91c2e-4b2d-4c8e-9f01-learnxrsched01",
  name: "LearnXR Daily 9AM IST",
  type: "n8n-nodes-base.scheduleTrigger",
  typeVersion: 1.2,
  position: [192, 560],
};

const codeNode = {
  parameters: {
    jsCode: TOPICS_JS,
  },
  id: "c7d82b1a-5e3f-4d9a-8c02-learnxrcode01",
  name: "LearnXR 30-Day Topics",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [368, 560],
};

// --- Patch agent prompt ---
const agent = wf.nodes.find((n) => n.name === "Social Media Content Factory");
if (!agent) throw new Error("Social Media Content Factory node not found");
agent.parameters = agent.parameters || {};
agent.parameters.text = "=" + NEW_PROMPT;

// --- Patch Instagram schema in Social Media Content ---
const parser = wf.nodes.find((n) => n.name === "Social Media Content");
if (!parser) throw new Error("Social Media Content node not found");
let schemaStr = parser.parameters.inputSchema;
if (typeof schemaStr !== "string") throw new Error("inputSchema not a string");

const schemaObj = JSON.parse(schemaStr);
const igNew = {
  type: "object",
  properties: {
    image_suggestion: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    emojis: { type: "array", items: { type: "string" } },
    call_to_action: { type: "string" },
    is_reel: { type: "boolean" },
    video_suggestion: { type: "string" },
    grok_imagine_prompt: { type: "string" },
    voiceover_script: { type: "string" },
    on_screen_text: { type: "string" },
    duration_seconds: { type: "integer" },
  },
};
schemaObj.properties.platform_posts.properties.Instagram = igNew;
parser.parameters.inputSchema = JSON.stringify(schemaObj, null, "\t");

// --- Insert nodes (avoid duplicates) ---
if (!wf.nodes.some((n) => n.id === scheduleNode.id)) {
  wf.nodes.push(scheduleNode, codeNode);
}

// --- Connections ---
wf.connections = wf.connections || {};
wf.connections["LearnXR Daily 9AM IST"] = {
  main: [[{ node: "LearnXR 30-Day Topics", type: "main", index: 0 }]],
};
wf.connections["LearnXR 30-Day Topics"] = {
  main: [[{ node: "Social Media Content Factory", type: "main", index: 0 }]],
};

wf.description =
  "✅ Updated for LearnXR Labs 30-Day Strategy + Full Reel Support with Grok Imagine";
wf.settings = wf.settings || {};
wf.settings.timezone = "Asia/Kolkata";

const out = {
  id: wf.id,
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
  description: wf.description,
};

fs.writeFileSync(
  new URL("./learnxr-n8n-workflow-payload.json", import.meta.url),
  JSON.stringify(out),
  "utf8"
);
console.log("Wrote scripts/learnxr-n8n-workflow-payload.json");

const partialOps = {
  id: wf.id,
  operations: [
    {
      type: "updateNode",
      nodeId: parser.id,
      updates: { parameters: { inputSchema: parser.parameters.inputSchema } },
    },
    {
      type: "updateNode",
      nodeId: agent.id,
      updates: { parameters: { text: agent.parameters.text } },
    },
  ],
};
fs.writeFileSync(
  new URL("./learnxr-mcp-partial-ops.json", import.meta.url),
  JSON.stringify(partialOps),
  "utf8"
);
console.log("Wrote scripts/learnxr-mcp-partial-ops.json");
