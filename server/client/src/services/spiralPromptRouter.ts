/**
 * spiralPromptRouter
 * ------------------
 * Decides what to do with a voice prompt on the LKG `/spiral` page.
 *
 * Order of precedence:
 *   1. Generation / environment commands (not Q&A) — before question heuristic
 *   2. Question heuristic
 *   3. Keyword match against the static VR360_TOURS catalog
 *   4. AI prompt classifier (POST /ai-detection/detect → mesh|skybox|both)
 *   5. Fallback: treat as a question
 *
 * v1 deliberately skips a Firestore lookup of the student's previously
 * generated assets (TODO below) so we can ship without async ranking.
 */

import { aiDetectionService } from './aiDetectionService';
import { VR360_TOURS, type Vr360TourItem } from '../config/vr360Tours';
import { searchSpiralContent, type SpiralSuggestion } from './spiralContentSearch';

export type SpiralRoute =
  | { kind: 'question'; text: string }
  | { kind: 'tour'; tour: Vr360TourItem; text: string }
  | { kind: 'suggestions'; text: string; suggestions: SpiralSuggestion[]; fallbackRoute?: SpiralRoute }
  | { kind: 'generateSkybox'; prompt: string; meshDescription?: string }
  | { kind: 'generate3D'; prompt: string; meshDescription?: string }
  | { kind: 'generateBoth'; prompt: string; meshDescription?: string };

export type SpiralIntentKind = SpiralRoute['kind'];

/**
 * `do` / `does` are omitted here so "do a castle" routes to generation, not Q&A.
 * Real "do you / does it" questions are handled by `isDoDoesQuestion`.
 */
const QUESTION_STARTERS = [
  'what',
  'why',
  'how',
  'who',
  'when',
  'where',
  'is',
  'are',
  'can',
  'could',
  'should',
  'would',
  'did',
  'tell me',
  'explain',
  'describe',
  'define',
  'meaning of',
  "what's",
  "why's",
  "who's",
];

function isDoDoesQuestion(lower: string): boolean {
  if (/^do\s+(you|we|they|I|not)\b/.test(lower)) return true;
  if (/^does\s+(it|the|this|that|he|she|a|an|anyone|anybody|your|my)\b/.test(lower)) {
    return true;
  }
  return false;
}

/** Creation / world commands — prefer skybox+mesh flow over Q&A. */
export function looksLikeGenerationOrEnvironmentCommand(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (/^(create|make|generate|build|draw|design|add|place|render)\b/.test(lower)) return true;
  if (/^(i want|i need|give me|make me|get me|let's make|let us make)\b/.test(lower)) {
    return true;
  }
  if (/^show me\s+(a|an|the|my)\s+/.test(lower) && !/^show me (why|how|if|when)\b/.test(lower)) {
    return true;
  }
  if (/\b(skybox|equirectangular|3d model|3d object|3d character)\b/.test(lower)) {
    return true;
  }
  return false;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with',
  'show', 'me', 'please', 'i', 'want', 'see', 'view', 'look', 'this', 'that',
  '360', 'tour', 'vr', 'video',
]);

const SKYBOX_KEYWORDS = [
  'world', 'place', 'environment', 'skybox', 'room', 'classroom', 'forest', 'jungle',
  'space', 'planet', 'moon', 'mars', 'ocean', 'underwater', 'beach', 'city', 'village',
  'farm', 'garden', 'mountain', 'desert', 'castle', 'museum', 'temple', 'palace', 'school',
  'lab', 'laboratory', 'park', 'zoo', 'scene', 'landscape',
];

const ASSET_KEYWORDS = [
  '3d', 'model', 'asset', 'object', 'character', 'animal', 'dinosaur', 'car', 'bus',
  'train', 'rocket', 'robot', 'tree', 'flower', 'ball', 'cube', 'sphere', 'statue',
  'toy', 'apple', 'mango', 'dog', 'cat', 'cow', 'lion', 'tiger', 'bird', 'fish',
  'person', 'boy', 'girl', 'hero', 'arjun',
];

function containsAny(lower: string, keywords: string[]): boolean {
  return keywords.some((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
}

function inferGenerationRoute(text: string): SpiralRoute | null {
  const lower = text.toLowerCase();
  const skyboxLike = containsAny(lower, SKYBOX_KEYWORDS);
  const assetLike = containsAny(lower, ASSET_KEYWORDS);
  const hasSpatialJoin = /\b(in|inside|with|near|beside|under|over|on)\b/.test(lower);

  if (skyboxLike && (assetLike || hasSpatialJoin)) {
    return { kind: 'generateBoth', prompt: text };
  }
  if (skyboxLike) {
    return { kind: 'generateSkybox', prompt: text };
  }
  if (assetLike) {
    return { kind: 'generate3D', prompt: text };
  }

  const words = tokenize(text);
  // A child often says just "dinosaur" or a character name. Treat short
  // non-question nouns as a 3D asset request instead of asking Q&A.
  if (looksLikeGenerationOrEnvironmentCommand(text) || (words.length > 0 && words.length <= 4)) {
    return { kind: 'generate3D', prompt: text };
  }

  return null;
}

/**
 * Does the prompt look like a question?
 * Catches both "what is photosynthesis" and "tell me about Mars".
 */
export function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith('?')) return true;
  const lower = trimmed.toLowerCase();
  if (isDoDoesQuestion(lower)) return true;
  return QUESTION_STARTERS.some(
    (starter) => lower === starter || lower.startsWith(starter + ' ')
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t));
}

function tokensFromTour(tour: Vr360TourItem): string[] {
  const corpus = [tour.title, tour.description || ''].join(' ');
  return tokenize(corpus);
}

/**
 * Score a tour against prompt tokens. Returns a number in [0, 1] roughly.
 * Awards higher scores for substring matches on the title.
 */
function scoreTour(promptTokens: string[], promptText: string, tour: Vr360TourItem): number {
  if (promptTokens.length === 0) return 0;
  const tourTokens = new Set(tokensFromTour(tour));
  if (tourTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of promptTokens) {
    if (tourTokens.has(t)) overlap += 1;
  }

  const lowerPrompt = promptText.toLowerCase();
  const titleLower = tour.title.toLowerCase();
  const titleHit = titleLower
    .split(/[^a-z0-9]+/)
    .filter((s) => s.length >= 3)
    .some((seg) => lowerPrompt.includes(seg));

  const overlapScore = overlap / Math.max(promptTokens.length, 1);
  return overlapScore + (titleHit ? 0.5 : 0);
}

export function findBestTour(text: string): Vr360TourItem | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  let best: { tour: Vr360TourItem; score: number } | null = null;
  for (const tour of VR360_TOURS) {
    const score = scoreTour(tokens, text, tour);
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { tour, score };
    }
  }
  return best?.tour ?? null;
}

/**
 * Main entry point used by the Spiral page.
 *
 * Calls into the AI prompt-detection backend only when we cannot answer the
 * routing question locally — keeps latency low for the common cases.
 */
export async function routePrompt(
  rawText: string,
  options: { allowExistingContentLookup?: boolean; profile?: unknown } = {}
): Promise<SpiralRoute> {
  const text = (rawText || '').trim();
  if (!text) {
    return { kind: 'question', text: '' };
  }

  if (looksLikeGenerationOrEnvironmentCommand(text)) {
    // Fall through to tour match + AI detection.
  } else if (isQuestion(text)) {
    return { kind: 'question', text };
  }

  // TODO(v2): match against the student's previously generated assets in
  // Firestore so "show me my dinosaur" loads the existing GLB.
  let localFallback: SpiralRoute | null = null;

  try {
    const detection = await aiDetectionService.detectPromptType(text);
    if (detection.success && detection.data) {
      const promptType = detection.data.promptType;
      const meshDescription = detection.data.meshDescription;

      if (promptType === 'both') {
        localFallback = { kind: 'generateBoth', prompt: text, meshDescription };
      }
      if (promptType === 'skybox') {
        localFallback = { kind: 'generateSkybox', prompt: text, meshDescription };
      }
      if (promptType === 'mesh') {
        localFallback = { kind: 'generate3D', prompt: text, meshDescription };
      }
      // promptType === 'unknown' falls through.
    }
  } catch (err) {
    console.warn('spiralPromptRouter: ai detection failed, falling back to Q&A', err);
  }

  const localGenerationRoute = inferGenerationRoute(text);
  if (localGenerationRoute?.kind === 'generateBoth') {
    localFallback = localGenerationRoute;
  } else if (!localFallback) {
    localFallback = localGenerationRoute;
  }

  if (options.allowExistingContentLookup) {
    const suggestions = await searchSpiralContent(text, {
      profile: options.profile as any,
      limit: 4,
    });

    if (suggestions.length > 0) {
      return {
        kind: 'suggestions',
        text,
        suggestions,
        fallbackRoute: localFallback || { kind: 'generateBoth', prompt: text },
      };
    }
  }

  const matchedTour = findBestTour(text);
  if (matchedTour) {
    return { kind: 'tour', tour: matchedTour, text };
  }

  if (localFallback) {
    return localFallback;
  }

  return { kind: 'question', text };
}

export default routePrompt;
