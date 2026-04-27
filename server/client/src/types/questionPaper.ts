/**
 * Question Paper types
 *
 * Data model for AI-generated CBSE/RBSE-style question papers.
 * Persisted in Firestore collection `question_papers/{paperId}`.
 */

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

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice (MCQ)',
  fill_blank: 'Fill in the Blanks',
  true_false: 'True / False',
  match_columns: 'Match the Column',
  one_word: 'One-word Answer',
  very_short: 'Very Short Answer',
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  case_based: 'Case-based / Passage',
  assertion_reason: 'Assertion–Reason',
  diagram_label: 'Diagram / Label',
};

export const QUESTION_TYPE_DEFAULT_MARKS: Record<QuestionType, number> = {
  mcq: 1,
  fill_blank: 1,
  true_false: 1,
  match_columns: 1,
  one_word: 1,
  very_short: 2,
  short_answer: 3,
  long_answer: 5,
  case_based: 4,
  assertion_reason: 1,
  diagram_label: 3,
};

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
  /** If true, AI also generates an `OR` alternative for each question in this group */
  internal_choice: boolean;
  bloom_tag?: BloomTag;
  topic_hint?: string;
}

export interface PaperSection {
  id: string;
  /** Display name e.g. "A", "B" */
  name: string;
  /** Optional theme label e.g. "Reading", "Writing" */
  label?: string;
  max_marks: number;
  groups: QuestionGroup[];
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface CaseSubQuestion {
  prompt: string;
  type: Exclude<QuestionType, 'case_based'>;
  marks: number;
  options?: string[];
  correct_answer?: string;
  answer_index?: number;
}

export interface GeneratedQuestion {
  id: string;
  section_id: string;
  /** Sequential number within the whole paper, e.g. "1", "2" */
  number: string;
  /** Sub-letter for multi-part questions, e.g. "A", "B" */
  sub_number?: string;
  type: QuestionType;
  prompt: string;
  /** For bilingual papers, translation of `prompt` */
  prompt_secondary?: string;
  marks: number;
  difficulty?: Difficulty;
  bloom_tag?: BloomTag;
  /** MCQ / Assertion-Reason options */
  options?: string[];
  /** Match-the-Column pairs */
  pairs?: MatchPair[];
  /** Passage text for case-based */
  passage?: string;
  passage_secondary?: string;
  /** Sub-questions for case-based */
  sub_questions?: CaseSubQuestion[];
  /** Placeholder description for diagram-based questions */
  diagram_prompt?: string;
  /** 0-based answer index for MCQ / A-R */
  answer_index?: number;
  /** Free-text answer for non-MCQ types */
  correct_answer?: string;
  explanation?: string;
  /** If this question is an `OR` alternative to the previous one */
  is_or_alternative?: boolean;
  /** Points to the base question this is an alternative to */
  alternative_of?: string;
}

export interface AnswerKeyEntry {
  question_id: string;
  /** Human-readable answer text (what to print in the answer key) */
  answer: string;
  marking_scheme?: string;
}

export interface SchoolHeader {
  name: string;
  address?: string;
  board?: string;
  logo_url?: string;
  /** Optional tagline/motto */
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
  bloom_distribution_target?: Partial<Record<BloomTag, number>>;
  difficulty_distribution_target?: Partial<Record<Difficulty, number>>;
  school: SchoolHeader;
}

export interface PaperSource {
  type: 'chapter' | 'upload' | 'none';
  chapterId?: string;
  storagePath?: string;
  pdfUrl?: string;
  /** Raw text provided directly (no PDF) */
  rawText?: string;
}

export interface QuestionPaperDoc {
  id: string;
  created_by_uid: string;
  school_id?: string;
  class_id?: string;
  curriculum?: string;
  subject: string;
  chapter_ids?: string[];
  source: PaperSource;
  status: 'draft' | 'final';
  blueprint: PaperBlueprint;
  questions: GeneratedQuestion[];
  answer_key: AnswerKeyEntry[];
  /** Model used for generation (for debugging / regeneration) */
  model?: string;
  created_at: string;
  updated_at: string;
}

/** Payload sent to the generation API */
export interface GenerateQuestionPaperRequest {
  source: PaperSource;
  blueprint: PaperBlueprint;
  /** When true, request verbose reasoning (internal only) */
  debug?: boolean;
}

export interface GenerateQuestionPaperResponse {
  questions: GeneratedQuestion[];
  answer_key: AnswerKeyEntry[];
  model: string;
}

// ============================================================================
// Blueprint presets
// ============================================================================

export const PAPER_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'ur', label: 'Urdu (اردو)' },
  { code: 'sa', label: 'Sanskrit (संस्कृतम्)' },
];

export const BOARD_OPTIONS = ['CBSE', 'RBSE', 'ICSE', 'State Board', 'IB', 'Cambridge', 'NIOS'];

export const DEFAULT_INSTRUCTIONS_50 = [
  'All questions are compulsory.',
  'The paper is divided into sections; attempt all sections.',
  'Marks for each question are indicated against it.',
  'Read each question carefully before answering.',
  'Write answers neatly in the space provided.',
];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface BlueprintPreset {
  id: string;
  label: string;
  description: string;
  build: () => PaperBlueprint;
}

function emptySchool(): SchoolHeader {
  return { name: '' };
}

export const BLUEPRINT_PRESETS: BlueprintPreset[] = [
  {
    id: 'annual_50',
    label: 'Annual / Practice — 50 marks',
    description: 'Three sections, CBSE/RBSE primary school pattern (mirrors Delhi DoE practice paper).',
    build: () => ({
      title: 'Annual Examination Practice Paper',
      session: '2025-26',
      duration_mins: 120,
      max_marks: 50,
      language: 'en',
      class: '',
      subject: '',
      curriculum: 'CBSE',
      instructions: [...DEFAULT_INSTRUCTIONS_50],
      include_answer_key: true,
      school: emptySchool(),
      sections: [
        {
          id: uid('sec'),
          name: 'A',
          label: 'Objective',
          max_marks: 20,
          groups: [
            {
              id: uid('grp'),
              type: 'mcq',
              count: 8,
              marks_per_q: 2,
              difficulty: 'easy',
              internal_choice: false,
            },
            {
              id: uid('grp'),
              type: 'fill_blank',
              count: 4,
              marks_per_q: 1,
              difficulty: 'easy',
              internal_choice: false,
            },
          ],
        },
        {
          id: uid('sec'),
          name: 'B',
          label: 'Short Answer',
          max_marks: 15,
          groups: [
            {
              id: uid('grp'),
              type: 'short_answer',
              count: 5,
              marks_per_q: 3,
              difficulty: 'medium',
              internal_choice: true,
            },
          ],
        },
        {
          id: uid('sec'),
          name: 'C',
          label: 'Long Answer',
          max_marks: 15,
          groups: [
            {
              id: uid('grp'),
              type: 'long_answer',
              count: 3,
              marks_per_q: 5,
              difficulty: 'medium',
              internal_choice: true,
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'term_80',
    label: 'Term Exam — 80 marks (CBSE)',
    description: 'Four sections covering MCQ, VSA, SA, LA, and Case-based — current CBSE pattern.',
    build: () => ({
      title: 'Term Examination',
      session: '2025-26',
      duration_mins: 180,
      max_marks: 80,
      language: 'en',
      class: '',
      subject: '',
      curriculum: 'CBSE',
      instructions: [
        'All questions are compulsory.',
        'The question paper has 5 sections: A, B, C, D and E.',
        'Section A has MCQs and Assertion-Reason (1 mark each).',
        'Section B has Very Short Answer questions (2 marks each).',
        'Section C has Short Answer questions (3 marks each).',
        'Section D has Long Answer questions (5 marks each).',
        'Section E has Case-based questions (4 marks each).',
        'Internal choices are provided in some questions.',
      ],
      include_answer_key: true,
      school: emptySchool(),
      sections: [
        {
          id: uid('sec'),
          name: 'A',
          label: 'Objective',
          max_marks: 20,
          groups: [
            { id: uid('grp'), type: 'mcq', count: 16, marks_per_q: 1, difficulty: 'easy', internal_choice: false },
            { id: uid('grp'), type: 'assertion_reason', count: 4, marks_per_q: 1, difficulty: 'medium', internal_choice: false },
          ],
        },
        {
          id: uid('sec'),
          name: 'B',
          label: 'Very Short Answer',
          max_marks: 10,
          groups: [{ id: uid('grp'), type: 'very_short', count: 5, marks_per_q: 2, difficulty: 'medium', internal_choice: true }],
        },
        {
          id: uid('sec'),
          name: 'C',
          label: 'Short Answer',
          max_marks: 18,
          groups: [{ id: uid('grp'), type: 'short_answer', count: 6, marks_per_q: 3, difficulty: 'medium', internal_choice: true }],
        },
        {
          id: uid('sec'),
          name: 'D',
          label: 'Long Answer',
          max_marks: 20,
          groups: [{ id: uid('grp'), type: 'long_answer', count: 4, marks_per_q: 5, difficulty: 'hard', internal_choice: true }],
        },
        {
          id: uid('sec'),
          name: 'E',
          label: 'Case-based',
          max_marks: 12,
          groups: [{ id: uid('grp'), type: 'case_based', count: 3, marks_per_q: 4, difficulty: 'medium', internal_choice: false }],
        },
      ],
    }),
  },
  {
    id: 'unit_20',
    label: 'Unit Test — 20 marks',
    description: 'Quick unit test: objective + short answer. 45 minutes.',
    build: () => ({
      title: 'Unit Test',
      session: '2025-26',
      duration_mins: 45,
      max_marks: 20,
      language: 'en',
      class: '',
      subject: '',
      curriculum: 'CBSE',
      instructions: ['All questions are compulsory.', 'Read the paper carefully before answering.'],
      include_answer_key: true,
      school: emptySchool(),
      sections: [
        {
          id: uid('sec'),
          name: 'A',
          label: 'Objective',
          max_marks: 10,
          groups: [
            { id: uid('grp'), type: 'mcq', count: 6, marks_per_q: 1, difficulty: 'easy', internal_choice: false },
            { id: uid('grp'), type: 'fill_blank', count: 4, marks_per_q: 1, difficulty: 'easy', internal_choice: false },
          ],
        },
        {
          id: uid('sec'),
          name: 'B',
          label: 'Short Answer',
          max_marks: 10,
          groups: [{ id: uid('grp'), type: 'short_answer', count: 5, marks_per_q: 2, difficulty: 'medium', internal_choice: false }],
        },
      ],
    }),
  },
  {
    id: 'english_50',
    label: 'English Annual — 50 marks (Reading/Writing/Grammar/Textbook)',
    description: 'Four-section English paper covering Reading, Writing, Grammar, Textbook.',
    build: () => ({
      title: 'Annual Examination Practice Paper',
      session: '2025-26',
      duration_mins: 120,
      max_marks: 50,
      language: 'en',
      class: '',
      subject: 'English',
      curriculum: 'CBSE',
      instructions: [
        'All questions are compulsory.',
        'Question paper is divided into 4 sections.',
        'Section A – Reading – 10 Marks',
        'Section B – Writing – 10 Marks',
        'Section C – Grammar – 10 Marks',
        'Section D – Textbook – 20 Marks',
        'Marks of each question is indicated against it.',
      ],
      include_answer_key: true,
      school: emptySchool(),
      sections: [
        {
          id: uid('sec'),
          name: 'A',
          label: 'Reading',
          max_marks: 10,
          groups: [{ id: uid('grp'), type: 'case_based', count: 2, marks_per_q: 5, difficulty: 'easy', internal_choice: false }],
        },
        {
          id: uid('sec'),
          name: 'B',
          label: 'Writing',
          max_marks: 10,
          groups: [{ id: uid('grp'), type: 'short_answer', count: 2, marks_per_q: 5, difficulty: 'medium', internal_choice: true }],
        },
        {
          id: uid('sec'),
          name: 'C',
          label: 'Grammar',
          max_marks: 10,
          groups: [{ id: uid('grp'), type: 'fill_blank', count: 10, marks_per_q: 1, difficulty: 'easy', internal_choice: false }],
        },
        {
          id: uid('sec'),
          name: 'D',
          label: 'Textbook',
          max_marks: 20,
          groups: [
            { id: uid('grp'), type: 'very_short', count: 5, marks_per_q: 2, difficulty: 'medium', internal_choice: false },
            { id: uid('grp'), type: 'long_answer', count: 2, marks_per_q: 5, difficulty: 'medium', internal_choice: true },
          ],
        },
      ],
    }),
  },
];

export function buildEmptyBlueprint(): PaperBlueprint {
  return BLUEPRINT_PRESETS[0].build();
}

export function totalMarksFromSections(sections: PaperSection[]): number {
  return sections.reduce((sum, s) => sum + s.max_marks, 0);
}

export function expectedSectionMarks(section: PaperSection): number {
  return section.groups.reduce((sum, g) => sum + g.count * g.marks_per_q, 0);
}

export function validateBlueprint(bp: PaperBlueprint): string[] {
  const errors: string[] = [];
  if (!bp.title.trim()) errors.push('Paper title is required.');
  if (!bp.subject.trim()) errors.push('Subject is required.');
  if (!bp.class.trim()) errors.push('Class is required.');
  if (!bp.school.name.trim()) errors.push('School name is required.');
  if (bp.max_marks <= 0) errors.push('Max marks must be positive.');
  if (bp.duration_mins <= 0) errors.push('Duration must be positive.');
  if (bp.sections.length === 0) errors.push('At least one section is required.');
  const sectionsSum = totalMarksFromSections(bp.sections);
  if (sectionsSum !== bp.max_marks) {
    errors.push(`Sum of section marks (${sectionsSum}) must equal total max marks (${bp.max_marks}).`);
  }
  for (const s of bp.sections) {
    const gs = expectedSectionMarks(s);
    if (gs !== s.max_marks) {
      errors.push(`Section ${s.name}: question groups sum to ${gs}, but section max is ${s.max_marks}.`);
    }
    if (s.groups.length === 0) {
      errors.push(`Section ${s.name}: at least one question group required.`);
    }
  }
  return errors;
}
