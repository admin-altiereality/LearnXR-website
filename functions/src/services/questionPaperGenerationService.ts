/**
 * Question Paper Generation Service (Firebase Functions)
 *
 * Generates a full CBSE/RBSE-style question paper from a source PDF + blueprint
 * using OpenAI in JSON mode. The OpenAI API key is read from `process.env.OPENAI_API_KEY`
 * which is populated by Firebase Functions v2 secrets (see functions/src/index.ts).
 *
 * Firestore project: learnxr-evoneuralai. Admin SDK is initialised in utils/services.ts
 * (Application Default Credentials via the function service account), so the storage
 * bucket resolved from `admin.storage().bucket()` matches the project.
 */

import OpenAI from 'openai';
import * as admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Types (mirror of client/src/types/questionPaper.ts)
// ---------------------------------------------------------------------------

export type QuestionType =
  | 'mcq'
  | 'fill_blank'
  | 'true_false'
  | 'match_columns'
  | 'one_word'
  | 'very_short'
  | 'short_answer'
  | 'long_answer'
  | 'case_based'
  | 'assertion_reason'
  | 'diagram_label';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type BloomTag =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyse'
  | 'evaluate'
  | 'create';

export interface QuestionGroup {
  id: string;
  type: QuestionType;
  count: number;
  marks_per_q: number;
  difficulty: Difficulty;
  internal_choice: boolean;
  bloom_tag?: BloomTag;
  topic_hint?: string;
}

export interface PaperSection {
  id: string;
  name: string;
  label?: string;
  max_marks: number;
  groups: QuestionGroup[];
}

export interface SchoolHeader {
  name: string;
  address?: string;
  board?: string;
  logo_url?: string;
  tagline?: string;
}

export interface PaperBlueprint {
  title: string;
  session: string;
  duration_mins: number;
  max_marks: number;
  language: string;
  secondary_language?: string;
  class: string;
  subject: string;
  teacher_name?: string;
  curriculum?: string;
  chapter_ids?: string[];
  instructions: string[];
  sections: PaperSection[];
  include_answer_key: boolean;
  school: SchoolHeader;
}

export interface PaperSource {
  type: 'chapter' | 'upload' | 'none';
  chapterId?: string;
  storagePath?: string;
  pdfUrl?: string;
  rawText?: string;
}

export interface GeneratedQuestion {
  id: string;
  section_id: string;
  number: string;
  sub_number?: string;
  type: QuestionType;
  prompt: string;
  prompt_secondary?: string;
  marks: number;
  difficulty?: Difficulty;
  bloom_tag?: BloomTag;
  options?: string[];
  pairs?: Array<{ left: string; right: string }>;
  passage?: string;
  passage_secondary?: string;
  sub_questions?: Array<{
    prompt: string;
    type: Exclude<QuestionType, 'case_based'>;
    marks: number;
    options?: string[];
    correct_answer?: string;
    answer_index?: number;
  }>;
  diagram_prompt?: string;
  answer_index?: number;
  correct_answer?: string;
  explanation?: string;
  is_or_alternative?: boolean;
  alternative_of?: string;
}

export interface AnswerKeyEntry {
  question_id: string;
  answer: string;
  marking_scheme?: string;
}

export interface GenerateInput {
  source: PaperSource;
  blueprint: PaperBlueprint;
  sourceCharLimit?: number;
  /** Authenticated UID — required to bind storagePath/pdfUrl to the caller. */
  userId: string;
}

export interface GenerateOutput {
  questions: GeneratedQuestion[];
  answer_key: AnswerKeyEntry[];
  model: string;
}

// ---------------------------------------------------------------------------
// Language helpers
// ---------------------------------------------------------------------------

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  pa: 'Punjabi',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  bn: 'Bengali',
  kn: 'Kannada',
  ml: 'Malayalam',
  or: 'Odia',
  ur: 'Urdu',
  sa: 'Sanskrit',
};

function langLabel(code?: string): string {
  if (!code) return 'English';
  return LANG_LABELS[code.toLowerCase()] ?? code;
}

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractSourceText(
  src: PaperSource,
  maxChars: number,
  userId: string,
): Promise<string> {
  if (src.type === 'none') return '';
  if (src.rawText && src.rawText.trim().length > 0) {
    return src.rawText.slice(0, maxChars);
  }

  // Lazy imports keep deploy-time side effects minimal.
  const { assertUserOwnedStoragePath } = require('../utils/storagePathOwnership') as typeof import('../utils/storagePathOwnership');
  const { assertSafeUserPdfUrl, fetchUrlWithLimits } = require('../utils/ssrfGuard') as typeof import('../utils/ssrfGuard');

  let buffer: Buffer | null = null;

  if (src.storagePath) {
    const ownedPath = assertUserOwnedStoragePath(userId, src.storagePath);
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(ownedPath);
      const [exists] = await file.exists();
      if (exists) {
        const [contents] = await file.download();
        buffer = contents;
      }
    } catch (err) {
      console.warn('[questionPaper] Storage path download failed:', (err as Error).message);
      throw err instanceof Error && err.message.includes('not owned')
        ? err
        : new Error('Failed to read source PDF from storage.');
    }
  }

  if (!buffer && src.pdfUrl) {
    const safeUrl = assertSafeUserPdfUrl(src.pdfUrl, userId);
    try {
      buffer = await fetchUrlWithLimits(safeUrl.toString());
    } catch (err) {
      console.warn('[questionPaper] PDF URL fetch error:', (err as Error).message);
      throw err instanceof Error ? err : new Error('Failed to fetch source PDF URL.');
    }
  }

  if (!buffer) return '';

  try {
    // pdf-parse is CJS; load lazily to avoid deploy-time top-level side effects.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? '').replace(/\s+\n/g, '\n').trim();
    return text.slice(0, maxChars);
  } catch (err) {
    console.warn('[questionPaper] pdf-parse failed:', (err as Error).message);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function blueprintBrief(bp: PaperBlueprint): string {
  const lines: string[] = [];
  lines.push(`Title: ${bp.title}`);
  lines.push(`Session: ${bp.session}`);
  lines.push(`Class: ${bp.class}`);
  lines.push(`Subject: ${bp.subject}`);
  if (bp.curriculum) lines.push(`Curriculum: ${bp.curriculum}`);
  lines.push(`Duration: ${bp.duration_mins} minutes`);
  lines.push(`Maximum Marks: ${bp.max_marks}`);
  lines.push(`Primary language: ${langLabel(bp.language)}`);
  if (bp.secondary_language) {
    lines.push(`Also include a ${langLabel(bp.secondary_language)} translation of every prompt in "prompt_secondary".`);
  }
  if (bp.instructions.length) {
    lines.push('General Instructions (to be printed verbatim on the paper):');
    bp.instructions.forEach((i, idx) => lines.push(`  ${idx + 1}. ${i}`));
  }
  lines.push('Sections:');
  for (const s of bp.sections) {
    const label = s.label ? ` — ${s.label}` : '';
    lines.push(`  Section ${s.name}${label} (max ${s.max_marks} marks):`);
    for (const g of s.groups) {
      const parts = [
        `${g.count} × ${g.marks_per_q}m = ${g.count * g.marks_per_q}m`,
        g.type,
        `difficulty=${g.difficulty}`,
        g.internal_choice ? 'with OR (internal choice)' : 'no internal choice',
      ];
      if (g.bloom_tag) parts.push(`bloom=${g.bloom_tag}`);
      if (g.topic_hint) parts.push(`topic=${g.topic_hint}`);
      lines.push(`    - ${parts.join(', ')}`);
    }
  }
  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are a senior K-12 assessment designer specialising in the Indian school system (CBSE and Rajasthan Board / RBSE).

Your job is to create a complete, print-ready question paper that exactly matches the blueprint given by the teacher. Follow these rules strictly:

1. Ground every question in the provided source material. Paraphrase — do NOT copy text verbatim. Do not invent facts that are not supported by the source. If the source is insufficient for a question, fall back to the subject/class/curriculum common knowledge.
2. The paper must have exactly the sections, groups, counts, marks-per-question and difficulties listed in the blueprint. Never exceed or fall short.
3. Use Indian school English conventions (e.g. "Tick the correct answer", "Encircle", "Fill in the blanks") and Indian contextual examples (rupees, local names, local scenarios).
4. For MCQs produce exactly 4 options labelled in the JSON array (the UI will label them (i)/(ii)/(iii)/(iv)) and set "answer_index" (0-based).
5. For Fill-in-the-Blanks, replace the blank with "______" in "prompt" and put the expected word/phrase in "correct_answer".
6. For True/False, set "prompt" to the statement and "correct_answer" to "True" or "False".
7. For Match-the-Column, provide "pairs": an array of { left, right } describing the CORRECT pairing; the UI will shuffle for display.
8. For Case-based / Passage-based, provide a short passage under "passage" and 3-5 sub_questions (each with its own type, marks, options, and answer).
9. For Assertion-Reason, "options" must be the four standard CBSE options:
   (i) Both A and R are true and R is the correct explanation of A.
   (ii) Both A and R are true but R is not the correct explanation of A.
   (iii) A is true but R is false.
   (iv) A is false but R is true.
   Frame the Assertion as "Assertion (A): <statement>" and the Reason as "Reason (R): <statement>" joined with a newline. Set "answer_index" accordingly.
10. For Diagram/Label questions, set "diagram_prompt" with a description of what the teacher should paste in (e.g. "Diagram of plant cell — label the nucleus, cell wall, and chloroplast"). The answer must be written in "correct_answer".
11. For any group marked "internal_choice=true", after producing each base question also emit exactly ONE additional question with "is_or_alternative": true and "alternative_of" set to the base question's id; this alternative covers the same learning outcome at the same marks.
12. Numbering: assign sequential "number" across the ENTIRE paper starting at "1" (e.g. "1", "2", ...). Sub-parts of a single question (e.g. MCQ bundles or passage questions) should share the same "number" and differ in "sub_number" ("A", "B", ...). Internal-choice alternatives share the number of the base question.
13. ALWAYS populate "answer_key" with one entry per question (including alternatives) when include_answer_key is true. Use a concise, correct answer in "answer"; for Long Answers, add a 1-2 line "marking_scheme" with step marks.
14. All questions must be unique, clearly worded, age-appropriate and aligned to the given class and subject.
15. Output MUST be a valid JSON object matching the schema described by the user message. No markdown, no prose outside JSON.`;

function outputSchemaDescription(): string {
  return `Schema:
{
  "questions": [
    {
      "id": string,
      "section_id": string (copy from blueprint section ids),
      "number": string,
      "sub_number"?: string,
      "type": "mcq"|"fill_blank"|"true_false"|"match_columns"|"one_word"|"very_short"|"short_answer"|"long_answer"|"case_based"|"assertion_reason"|"diagram_label",
      "prompt": string,
      "prompt_secondary"?: string,
      "marks": number,
      "difficulty"?: "easy"|"medium"|"hard",
      "bloom_tag"?: "remember"|"understand"|"apply"|"analyse"|"evaluate"|"create",
      "options"?: string[],
      "pairs"?: [{"left": string, "right": string}],
      "passage"?: string,
      "passage_secondary"?: string,
      "sub_questions"?: [{"prompt": string, "type": string, "marks": number, "options"?: string[], "correct_answer"?: string, "answer_index"?: number}],
      "diagram_prompt"?: string,
      "answer_index"?: number,
      "correct_answer"?: string,
      "explanation"?: string,
      "is_or_alternative"?: boolean,
      "alternative_of"?: string
    }
  ],
  "answer_key": [
    {"question_id": string, "answer": string, "marking_scheme"?: string}
  ]
}`;
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'gpt-4o';
const FALLBACK_MODEL = 'gpt-4o-mini';
const DEFAULT_SOURCE_LIMIT = 18_000; // chars; ~4.5k tokens

export async function generateQuestionPaper(input: GenerateInput): Promise<GenerateOutput> {
  const openaiKey = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
  if (!openaiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Set it in Firebase Functions secrets: `firebase functions:secrets:set OPENAI_API_KEY`.'
    );
  }

  const model = (process.env.QUESTION_PAPER_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const openai = new OpenAI({ apiKey: openaiKey });

  if (!input.userId) {
    throw new Error('Authenticated userId is required to generate a question paper.');
  }

  const sourceLimit = input.sourceCharLimit ?? DEFAULT_SOURCE_LIMIT;
  const sourceText = await extractSourceText(input.source, sourceLimit, input.userId);

  const sourceSection =
    sourceText.length > 0
      ? `Source material (use as the primary basis; paraphrase — do not copy verbatim):\n"""\n${sourceText}\n"""`
      : 'No source PDF text was provided. Rely on the stated subject, class and curriculum common knowledge to construct the paper.';

  const userPrompt = [
    'Generate a complete question paper in strict JSON matching this schema:',
    outputSchemaDescription(),
    '',
    'Blueprint:',
    blueprintBrief(input.blueprint),
    '',
    `Include answer_key: ${input.blueprint.include_answer_key ? 'YES (required for every question including OR alternatives and case sub-questions)' : 'NO (return empty answer_key array)'}.`,
    '',
    sourceSection,
  ].join('\n');

  let rawContent = '';
  let modelUsed = model;

  async function callOpenAI(modelName: string): Promise<string> {
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.55,
      max_tokens: 8000,
    });
    return completion.choices[0]?.message?.content ?? '';
  }

  try {
    rawContent = await callOpenAI(model);
  } catch (apiErr: unknown) {
    const err = apiErr as { status?: number; message?: string; error?: { message?: string } };
    const msg = err?.error?.message ?? err?.message ?? String(apiErr);
    if (err?.status === 401 || /invalid.*api.*key|authentication/i.test(msg)) {
      throw new Error('OpenAI API key is invalid or expired.');
    }
    if (err?.status === 429 || (err?.status && err.status >= 500)) {
      console.warn('[questionPaper] Primary model failed, falling back:', msg);
      rawContent = await callOpenAI(FALLBACK_MODEL);
      modelUsed = FALLBACK_MODEL;
    } else {
      throw new Error(`OpenAI API error: ${msg}`);
    }
  }

  if (!rawContent) {
    throw new Error('No response from question-paper generation.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Invalid JSON from question-paper generator. Please try again.');
  }

  const { questions, answer_key } = normalizePaper(parsed, input.blueprint);
  return { questions, answer_key, model: modelUsed };
}

// ---------------------------------------------------------------------------
// Normalization / validation
// ---------------------------------------------------------------------------

function normalizePaper(
  raw: unknown,
  blueprint: PaperBlueprint
): { questions: GeneratedQuestion[]; answer_key: AnswerKeyEntry[] } {
  const data = (raw ?? {}) as { questions?: unknown; answer_key?: unknown };
  const rawQs = Array.isArray(data.questions) ? data.questions : [];
  const rawAk = Array.isArray(data.answer_key) ? data.answer_key : [];

  const sectionByName = new Map<string, string>();
  blueprint.sections.forEach((s) => {
    sectionByName.set(s.name.toLowerCase(), s.id);
    sectionByName.set(s.id.toLowerCase(), s.id);
  });

  const questions: GeneratedQuestion[] = rawQs
    .map((q: unknown, idx: number) => {
      const r = (q ?? {}) as Record<string, unknown>;
      const type = (String(r.type ?? 'short_answer') as QuestionType) || 'short_answer';
      const rawSectionId = String(r.section_id ?? '').trim();
      const sectionId =
        blueprint.sections.find((s) => s.id === rawSectionId)?.id ??
        sectionByName.get(rawSectionId.toLowerCase()) ??
        blueprint.sections[0]?.id ??
        '';
      const id = String(r.id ?? `q_${idx + 1}_${Math.random().toString(36).slice(2, 8)}`);
      const marks = Number(r.marks ?? 1);
      const optionsRaw = Array.isArray(r.options) ? r.options.map((o) => String(o)) : undefined;
      const pairsRaw = Array.isArray(r.pairs)
        ? (r.pairs as Array<Record<string, unknown>>).map((p) => ({
            left: String(p.left ?? ''),
            right: String(p.right ?? ''),
          }))
        : undefined;
      const subQsRaw = Array.isArray(r.sub_questions)
        ? (r.sub_questions as Array<Record<string, unknown>>).map((sq) => ({
            prompt: String(sq.prompt ?? ''),
            type: String(sq.type ?? 'short_answer') as Exclude<QuestionType, 'case_based'>,
            marks: Number(sq.marks ?? 1),
            options: Array.isArray(sq.options) ? (sq.options as unknown[]).map((o) => String(o)) : undefined,
            correct_answer: sq.correct_answer != null ? String(sq.correct_answer) : undefined,
            answer_index: typeof sq.answer_index === 'number' ? (sq.answer_index as number) : undefined,
          }))
        : undefined;

      let answerIndex: number | undefined;
      if (typeof r.answer_index === 'number') {
        answerIndex = r.answer_index;
      } else if (typeof r.correct_option_index === 'number') {
        answerIndex = r.correct_option_index as number;
      }
      if (optionsRaw && answerIndex != null) {
        answerIndex = Math.max(0, Math.min(optionsRaw.length - 1, answerIndex));
      }

      return {
        id,
        section_id: sectionId,
        number: String(r.number ?? String(idx + 1)),
        sub_number: r.sub_number != null ? String(r.sub_number) : undefined,
        type,
        prompt: String(r.prompt ?? ''),
        prompt_secondary: r.prompt_secondary != null ? String(r.prompt_secondary) : undefined,
        marks: Number.isFinite(marks) && marks > 0 ? marks : 1,
        difficulty: ['easy', 'medium', 'hard'].includes(String(r.difficulty))
          ? (r.difficulty as Difficulty)
          : undefined,
        bloom_tag: ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'].includes(String(r.bloom_tag))
          ? (r.bloom_tag as BloomTag)
          : undefined,
        options: optionsRaw,
        pairs: pairsRaw,
        passage: r.passage != null ? String(r.passage) : undefined,
        passage_secondary: r.passage_secondary != null ? String(r.passage_secondary) : undefined,
        sub_questions: subQsRaw,
        diagram_prompt: r.diagram_prompt != null ? String(r.diagram_prompt) : undefined,
        answer_index: answerIndex,
        correct_answer: r.correct_answer != null ? String(r.correct_answer) : undefined,
        explanation: r.explanation != null ? String(r.explanation) : undefined,
        is_or_alternative: r.is_or_alternative === true,
        alternative_of: r.alternative_of != null ? String(r.alternative_of) : undefined,
      };
    })
    .filter((q) => q.prompt.trim().length > 0);

  // Re-number sequentially (base questions only); alternatives share the preceding number.
  let displayNum = 0;
  let lastBaseNumber = '1';
  for (const q of questions) {
    if (q.is_or_alternative) {
      q.number = lastBaseNumber;
    } else {
      displayNum += 1;
      q.number = String(displayNum);
      lastBaseNumber = q.number;
    }
  }

  const answer_key: AnswerKeyEntry[] = rawAk
    .map((a: unknown) => {
      const r = (a ?? {}) as Record<string, unknown>;
      return {
        question_id: String(r.question_id ?? ''),
        answer: String(r.answer ?? ''),
        marking_scheme: r.marking_scheme != null ? String(r.marking_scheme) : undefined,
      };
    })
    .filter((a) => a.question_id.length > 0 && a.answer.length > 0);

  return { questions, answer_key };
}
