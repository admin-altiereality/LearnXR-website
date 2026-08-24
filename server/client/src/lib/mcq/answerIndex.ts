/**
 * Single resolver for "which option is the correct one".
 *
 * There were six copies of this logic (two fetch layers, four players) and they
 * disagreed, so a question could be scored differently depending on which screen you
 * answered it on. The disagreement that mattered: some copies subtracted 1 from
 * `correct_option_index` to "convert 1-based DB to 0-based frontend", but every writer
 * in this repo stores it 0-based already —
 *   - `server/src/services/mcqGenerationService.ts` clamps to 0..options.length-1 and
 *     its prompt says "0-based integer, 0-3"
 *   - `Components/studio/tabs/McqTab.tsx` writes the .map() index
 *   - `functions/src/routes/curriculum.ts` uses Array.findIndex
 * so that shift was a second, unconditional decrement: B scored as A, C as B, D as C.
 *
 * The rule here: **the stored answer TEXT wins.** It carries no base convention and no
 * letter mapping, so it cannot be misread. A numeric index is used only when no text is
 * available, and is taken as 0-based with no shift. When both exist and disagree, the
 * text wins and the mismatch is logged — a wrong index is a data defect, and silently
 * scoring against it is how this went unnoticed.
 */

/** Fields that have been observed holding the option list, in priority order. */
const OPTION_ARRAY_FIELDS = ['options', 'choices', 'answers'] as const;

/**
 * Scalar option fields, grouped by naming scheme. Grouped rather than flat because a
 * document using `option_a..d` must not also contribute its `a..d` aliases — the old flat
 * sweep concatenated every matching key and could produce eight options for a four-option
 * question.
 */
const OPTION_FIELD_GROUPS = [
  ['option_a', 'option_b', 'option_c', 'option_d'],
  ['optionA', 'optionB', 'optionC', 'optionD'],
  ['option1', 'option2', 'option3', 'option4'],
  ['option_1', 'option_2', 'option_3', 'option_4'],
  ['a', 'b', 'c', 'd'],
] as const;

/** Fields that hold the correct answer as text. */
const ANSWER_TEXT_FIELDS = [
  'correct_option_text',
  'correct_answer_text',
  'correct_text',
  'answer_text',
] as const;

/** Fields that hold the correct answer as a numeric index. */
const ANSWER_INDEX_FIELDS = [
  'correct_option_index',
  'correct_answer_index',
  'correct_index',
  'correctIndex',
] as const;

type McqLike = Record<string, unknown>;

/** Compare answer text tolerantly — trailing spaces and case must not decide a score. */
function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Pull the option list out of whatever shape the document uses.
 *
 * Note the n8n curriculum path (`functions/src/routes/curriculum.ts`) writes
 * `option1..option4` scalars and NO `options` array, so the scalar groups are not a
 * legacy nicety — they are the live shape for every n8n-ingested lesson.
 */
export function extractMcqOptions(data: McqLike | null | undefined): string[] {
  if (!data) return [];

  for (const field of OPTION_ARRAY_FIELDS) {
    const value = data[field];
    if (Array.isArray(value) && value.length > 0) {
      return value.map((v) => String(v ?? ''));
    }
  }

  for (const group of OPTION_FIELD_GROUPS) {
    const values = group.map((key) => data[key]).filter((v) => v !== undefined && v !== null && v !== '');
    if (values.length > 0) return values.map((v) => String(v));
  }

  return [];
}

export interface ResolvedAnswer {
  /** 0-based index into `options`, or -1 when the document does not say. */
  index: number;
  /** Which field decided it — useful in logs when a document is wrong. */
  source: 'text' | 'letter' | 'index' | 'unresolved';
  /** Set when a numeric index disagreed with the answer text. */
  mismatch?: { fromText: number; fromIndex: number };
}

/**
 * Resolve the correct option for one MCQ.
 *
 * Returns -1 rather than defaulting to 0 when nothing resolves. Defaulting to 0 is what
 * made a whole quiz look like "the answer is always A": an unreadable document scored
 * option A correct instead of announcing that it could not be read.
 */
export function resolveCorrectAnswer(
  data: McqLike | null | undefined,
  options: string[]
): ResolvedAnswer {
  if (!data || options.length === 0) return { index: -1, source: 'unresolved' };

  // 1. The answer text — authoritative.
  let fromText = -1;
  for (const field of ANSWER_TEXT_FIELDS) {
    const raw = data[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const target = normalizeText(raw);
    if (!target) continue;
    const found = options.findIndex((opt) => normalizeText(opt) === target);
    if (found >= 0) {
      fromText = found;
      break;
    }
  }

  // 2. A single letter, A/B/C/D.
  let fromLetter = -1;
  for (const field of ['correct_answer', 'correct_option', 'answer'] as const) {
    const raw = data[field];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed.length !== 1) continue;
    const candidate = trimmed.toUpperCase().charCodeAt(0) - 65;
    if (candidate >= 0 && candidate < options.length) {
      fromLetter = candidate;
      break;
    }
  }

  // 3. A numeric index — 0-based, NOT shifted.
  let fromIndex = -1;
  for (const field of ANSWER_INDEX_FIELDS) {
    const raw = data[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (Number.isFinite(parsed)) {
      fromIndex = parsed;
      break;
    }
  }
  if (fromIndex < 0 || fromIndex >= options.length) fromIndex = -1;

  if (fromText >= 0) {
    const mismatch =
      fromIndex >= 0 && fromIndex !== fromText ? { fromText, fromIndex } : undefined;
    return { index: fromText, source: 'text', ...(mismatch ? { mismatch } : {}) };
  }
  if (fromLetter >= 0) return { index: fromLetter, source: 'letter' };
  if (fromIndex >= 0) return { index: fromIndex, source: 'index' };
  return { index: -1, source: 'unresolved' };
}

/**
 * Resolve and log. Use this at every call site so a bad document is reported once, in a
 * consistent shape, wherever it is loaded from.
 */
export function resolveCorrectAnswerIndex(
  data: McqLike | null | undefined,
  options: string[],
  context = 'mcq'
): number {
  const resolved = resolveCorrectAnswer(data, options);

  if (resolved.mismatch) {
    console.warn(
      `[${context}] correct answer disagrees with correct_option_index — trusting the text`,
      {
        question: String((data as McqLike)?.question ?? (data as McqLike)?.question_text ?? '').slice(0, 90),
        answerText: options[resolved.mismatch.fromText],
        storedIndexPointsAt: options[resolved.mismatch.fromIndex],
        fromText: resolved.mismatch.fromText,
        fromIndex: resolved.mismatch.fromIndex,
      }
    );
  } else if (resolved.source === 'unresolved' && options.length > 0) {
    console.warn(`[${context}] no correct answer could be resolved for this question`, {
      question: String((data as McqLike)?.question ?? (data as McqLike)?.question_text ?? '').slice(0, 90),
      optionCount: options.length,
      sawFields: [...ANSWER_TEXT_FIELDS, ...ANSWER_INDEX_FIELDS, 'correct_answer'].filter(
        (f) => (data as McqLike)?.[f] !== undefined
      ),
    });
  }

  return resolved.index;
}
