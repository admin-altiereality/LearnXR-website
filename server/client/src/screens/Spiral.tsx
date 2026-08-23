/**
 * Spiral — minimal voice-first page for LKG / Class 1 students.
 * ------------------------------------------------------------
 * UI is a single tappable orb on a black canvas. Voice is the only input.
 *
 *   tap orb -> listen -> route -> generate / answer -> show
 *
 * Routing:
 *   - question heuristic       -> /assistant/message + lip-synced TTS
 *   - VR360 keyword match      -> navigate to /vr360-videotour
 *   - ai-detection (skybox)    -> Blockade Labs skybox (style: UHD Render)
 *   - ai-detection (mesh)      -> Meshy 3D asset
 *   - ai-detection (both)      -> skybox + 3D asset in parallel
 *
 * In3D.ai style is auto-selected (UHD Render), so kids never see a picker.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';

import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import { useLesson } from '../contexts/LessonContext';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { SpiralOrbState } from '../Components/spiral/SpiralOrb';
import { SpiralOrb3D } from '../Components/spiral/SpiralOrb3D';
import { ListeningHint } from '../Components/spiral/ListeningHint';
import { TeacherAvatar, type TeacherAvatarHandle } from '../Components/TeacherAvatar';
import { SpiralResultViewer } from '../Components/spiral/SpiralResultViewer';
import { SpiralGenerationProgress, type GenerationProgressItem } from '../Components/spiral/SpiralGenerationProgress';
import { SpiralSuggestions } from '../Components/spiral/SpiralSuggestions';
import { SpiralControls } from '../Components/spiral/SpiralControls';
import { SpiralSessionBanner } from '../Components/spiral/SpiralSessionBanner';
import { SpiralStudentClassesPanel } from '../Components/spiral/SpiralStudentClassesPanel';
import { routePrompt, type SpiralRoute } from '../services/spiralPromptRouter';
import { skyboxApiService } from '../services/skyboxApiService';
import { assetGenerationService } from '../services/assetGenerationService';
import { speakWithAvatar } from '../services/avatarSpeak';
import { askSpiralQuestion } from '../services/spiralQuestionService';
import { buildLessonPayloadFromBundle } from '../services/launchLessonFromBundle';
import type { SpiralSuggestion } from '../services/spiralContentSearch';
import type { Vr360TourItem } from '../config/vr360Tours';
import { topicIdForVr360TourId, VR360_TOUR_CHAPTER_ID } from '../config/vr360Tours';
import { resolveGenerated3DAssetUrl } from '../utils/generatedAssetUrl';
import { createDraftLesson, updateDraftLesson, submitLessonForReview } from '../services/userLessonService';

interface SkyboxStyle {
  id: number | string;
  name: string;
}

type SpiralIntent = 'question' | 'skybox' | 'asset' | 'both' | 'tour' | 'suggestions' | 'unknown';
type SpiralPhase =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'skyboxGenerating'
  | 'assetGenerating'
  | 'suggesting'
  | 'speaking'
  | 'classLaunch';

interface GeneratedSkybox {
  id?: string;
  generationId?: string;
  file_url?: string;
  image: string;
  image_jpg?: string;
  title?: string;
  prompt: string;
}

interface SpiralSceneContext {
  skyboxId?: string | null;
  skyboxPrompt?: string | null;
  skyboxTitle?: string | null;
  assetId?: string | null;
  assetPrompt?: string | null;
}

interface SpiralClassOption {
  id: string;
  label: string;
}

const DEFAULT_AVATAR_CONFIG = {
  curriculum: 'NCERT',
  class: '1',
  subject: 'Mathematics',
};

const FALLBACK_QUESTION_REPLY =
  "I am having trouble answering right now. Try asking me to make a place or a 3D thing.";

function routeToIntent(route: SpiralRoute): SpiralIntent {
  if (route.kind === 'question') return 'question';
  if (route.kind === 'tour') return 'tour';
  if (route.kind === 'suggestions') return 'suggestions';
  if (route.kind === 'generateSkybox') return 'skybox';
  if (route.kind === 'generate3D') return 'asset';
  if (route.kind === 'generateBoth') return 'both';
  return 'unknown';
}

function phaseToOrbState(phase: SpiralPhase): SpiralOrbState {
  if (phase === 'skyboxGenerating' || phase === 'assetGenerating') return 'generating';
  if (phase === 'classLaunch') return 'classLaunch';
  if (phase === 'suggesting') return 'suggesting';
  return phase;
}

function pickUhdRenderStyle(styles: SkyboxStyle[]): SkyboxStyle | null {
  if (!Array.isArray(styles) || styles.length === 0) return null;
  const name = (s: SkyboxStyle) => (s.name || '').toLowerCase();
  const withUhdRender = styles.find((s) => name(s).includes('uhd render'));
  if (withUhdRender) return withUhdRender;
  const withUhdWord = styles.find((s) => /\buhd\b/.test(s.name || ''));
  if (withUhdWord) return withUhdWord;
  const realistic = styles.find((s) => /\brealistic\b/i.test(s.name || ''));
  if (realistic) return realistic;
  // Avoid matching unrelated names like "M3 Advanced (photo/render)" via plain "render".
  return styles[0];
}

function isFollowUpAssetPrompt(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  return /^(add|put|place|insert|bring|make|create|generate|build|draw)\b/.test(lower) ||
    /\b(here|in this|to this|inside this|on it|in the scene|in this world)\b/.test(lower);
}

function promptClearlyRequestsNewEnvironment(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return /^(new|change|replace|switch)\b/.test(lower) ||
    /\b(new world|new place|new environment|different world|different place|change the world|replace the world)\b/.test(lower);
}

function resolveFollowUpRoute(
  route: SpiralRoute,
  text: string,
  sceneContext: SpiralSceneContext
): SpiralRoute {
  const hasExistingScene = Boolean(sceneContext.skyboxId || sceneContext.skyboxPrompt);
  if (!hasExistingScene || promptClearlyRequestsNewEnvironment(text)) {
    return route;
  }

  if (isFollowUpAssetPrompt(text) && route.kind !== 'question' && route.kind !== 'tour') {
    return {
      kind: 'generate3D',
      prompt: text,
      meshDescription: 'meshDescription' in route ? route.meshDescription : undefined,
    };
  }

  if (isFollowUpAssetPrompt(text) && route.kind === 'question') {
    return { kind: 'generate3D', prompt: text };
  }

  return route;
}

function forceCompleteSceneRoute(route: SpiralRoute): SpiralRoute {
  if (route.kind === 'generateBoth') return route;
  if (route.kind === 'generateSkybox') return { kind: 'generateBoth', prompt: route.prompt, meshDescription: route.meshDescription };
  if (route.kind === 'generate3D') return { kind: 'generateBoth', prompt: route.prompt, meshDescription: route.meshDescription };
  if (route.kind === 'suggestions' && route.fallbackRoute) return forceCompleteSceneRoute(route.fallbackRoute);
  if (route.kind === 'question') return { kind: 'generateBoth', prompt: route.text };
  return route;
}

const Spiral = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { startLesson: startLocalLesson } = useLesson();
  const {
    activeSessionId,
    activeSession,
    progressList,
    startSession,
    endSession,
    launchLesson: launchLessonToClass,
    launchScene: launchSceneToClass,
    sessionLoading,
    joinedSessionId,
    joinedSession,
    joinSession: joinClassSession,
    leaveSessionAsStudent,
    sessionError,
    clearSessionError,
  } = useClassSession();

  const avatarRef = useRef<TeacherAvatarHandle | null>(null);
  const styleIdRef = useRef<number | string | null>(null);
  const styleNameRef = useRef<string | null>(null);
  const speakingTimerRef = useRef<number | null>(null);
  const generationTokenRef = useRef<{ id: number; cancelled: boolean } | null>(null);
  const generationProgressTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<SpiralPhase>('idle');
  const orbState = phaseToOrbState(phase);
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
  const [skyboxProgress, setSkyboxProgress] = useState<number | null>(null);
  const [assetProgress, setAssetProgress] = useState<number | null>(null);
  const [generationItems, setGenerationItems] = useState<GenerationProgressItem[]>([]);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [heardText, setHeardText] = useState<string>('');
  const [activeIntent, setActiveIntent] = useState<SpiralIntent>('unknown');
  const [generatedVariations, setGeneratedVariations] = useState<GeneratedSkybox[]>([]);
  const [currentVariationIndex, setCurrentVariationIndex] = useState<number>(0);
  const [generated3DAsset, setGenerated3DAsset] = useState<any | null>(null);
  const [sceneContext, setSceneContext] = useState<SpiralSceneContext>({});
  const [suggestions, setSuggestions] = useState<SpiralSuggestion[]>([]);
  const [suggestionFallbackRoute, setSuggestionFallbackRoute] = useState<SpiralRoute | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<SpiralClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  /** Compact teacher FAB: expandable panel for class + launch */
  const [teacherLaunchPanelOpen, setTeacherLaunchPanelOpen] = useState(false);
  const [submittingSceneForReview, setSubmittingSceneForReview] = useState(false);
  const isMutedRef = useRef<boolean>(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const avatarConfig = useMemo(() => {
    const fromProfile = {
      curriculum: profile?.curriculum,
      class: profile?.class,
      subject: undefined as string | undefined,
    };
    return {
      curriculum: fromProfile.curriculum || DEFAULT_AVATAR_CONFIG.curriculum,
      class: fromProfile.class || DEFAULT_AVATAR_CONFIG.class,
      subject: fromProfile.subject || DEFAULT_AVATAR_CONFIG.subject,
    };
  }, [profile?.curriculum, profile?.class]);

  const isTeacher = profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';

  const clearGenerationProgressTimer = useCallback(() => {
    if (generationProgressTimerRef.current) {
      window.clearInterval(generationProgressTimerRef.current);
      generationProgressTimerRef.current = null;
    }
  }, []);

  const startGenerationProgress = useCallback((initial = 3, ceiling = 92) => {
    clearGenerationProgressTimer();
    setGenerationProgress(initial);
    generationProgressTimerRef.current = window.setInterval(() => {
      setGenerationProgress((prev) => {
        const current = prev ?? initial;
        if (current >= ceiling) return current;
        return Math.min(ceiling, current + Math.max(1, Math.round((ceiling - current) * 0.08)));
      });
    }, 1600);
  }, [clearGenerationProgressTimer]);

  const upsertGenerationItem = useCallback((item: GenerationProgressItem) => {
    setGenerationItems((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === item.id);
      if (existingIndex === -1) return [...prev, item];
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...item };
      return next;
    });
  }, []);

  const resetGenerationDetail = useCallback(() => {
    setSkyboxProgress(null);
    setAssetProgress(null);
    setGenerationItems([]);
  }, []);

  const createGenerationToken = useCallback(() => {
    const token = { id: Date.now(), cancelled: false };
    generationTokenRef.current = token;
    return token;
  }, []);

  const isGenerationCancelled = useCallback((token: { id: number; cancelled: boolean }) => {
    return token.cancelled || generationTokenRef.current?.id !== token.id;
  }, []);

  const goIdle = useCallback(() => {
    clearGenerationProgressTimer();
    setGenerationProgress(null);
    setPhase('idle');
    setProgressMessage('');
  }, [clearGenerationProgressTimer]);

  const cancelActiveGeneration = useCallback(() => {
    if (generationTokenRef.current) {
      generationTokenRef.current.cancelled = true;
    }
    clearGenerationProgressTimer();
    setGenerationProgress(null);
    setGenerationItems((prev) => prev.map((item) => (
      item.status === 'active' ? { ...item, status: 'stopped' } : item
    )));
    setProgressMessage('Stopped. Tap when you want to ask again.');
    setPhase(generatedVariations.length > 0 || generated3DAsset ? 'idle' : 'idle');
  }, [clearGenerationProgressTimer, generated3DAsset, generatedVariations.length]);

  const getVoiceSuggestionIndex = useCallback((text: string): number | null => {
    const lower = text.toLowerCase();
    const direct = lower.match(/\b(?:number|option|choice)\s+([1-4])\b/);
    if (direct) {
      const index = Number(direct[1]) - 1;
      return index >= 0 && index < suggestions.length ? index : null;
    }
    const words = ['first', 'second', 'third', 'fourth'];
    const wordIndex = words.findIndex((word) => lower.includes(word));
    if (wordIndex >= 0 && wordIndex < suggestions.length) return wordIndex;
    if (/\b(play|open|start|launch)\b/.test(lower) && suggestions.length === 1) return 0;
    return null;
  }, [suggestions.length]);

  const updateStatusForIntent = useCallback((intent: SpiralIntent, transcriptText?: string) => {
    const prefix = transcriptText ? `I heard: "${transcriptText}". ` : '';
    const messages: Record<SpiralIntent, string> = {
      question: `${prefix}Answering your question…`,
      skybox: `${prefix}Making a 360 world…`,
      asset: `${prefix}${sceneContext.skyboxId ? 'Adding a 3D object to this world…' : 'Making a 3D object…'}`,
      both: `${prefix}Making a world and a 3D object…`,
      tour: `${prefix}Finding a 360 tour…`,
      suggestions: `${prefix}I found ready-made lessons…`,
      unknown: `${prefix}Understanding…`,
    };
    setProgressMessage(messages[intent]);
  }, [sceneContext.skyboxId]);

  // -------- Style preflight (UHD Render) ----------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await skyboxApiService.getStyles(1, 100);
        const list: SkyboxStyle[] = (res?.data || res?.styles || []) as SkyboxStyle[];
        const chosen = pickUhdRenderStyle(list);
        if (!cancelled && chosen) {
          styleIdRef.current = chosen.id;
          styleNameRef.current = chosen.name;
          console.log('🎨 Spiral default style selected:', chosen.name, chosen.id);
        }
      } catch (err) {
        console.warn('Spiral: failed to fetch skybox styles, will pick first available later', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------- Teacher class options -----------------------------------------
  useEffect(() => {
    if (!user?.uid || profile?.role !== 'teacher') {
      setTeacherClasses([]);
      setSelectedClassId('');
      return;
    }

    let cancelled = false;
    const byId = new Map<string, any>();

    const addClass = (id: string, data: any) => {
      if (!id) return;
      byId.set(id, { id, ...data });
    };

    (async () => {
      try {
        const managedClassIds = Array.isArray(profile?.managed_class_ids) ? profile.managed_class_ids : [];
        await Promise.all(
          managedClassIds.map(async (classId: string) => {
            try {
              const snap = await getDoc(doc(db, 'classes', classId));
              if (snap.exists()) addClass(classId, snap.data());
            } catch {
              /* permissions can vary by role; other queries below may still succeed */
            }
          })
        );

        const managedQuery = profile?.school_id
          ? query(collection(db, 'classes'), where('school_id', '==', profile.school_id), where('teacher_ids', 'array-contains', user.uid), limit(100))
          : query(collection(db, 'classes'), where('teacher_ids', 'array-contains', user.uid), limit(100));
        const managedSnap = await getDocs(managedQuery);
        managedSnap.docs.forEach((classDoc) => addClass(classDoc.id, classDoc.data()));

        if (profile?.school_id) {
          const sharedSnap = await getDocs(
            query(collection(db, 'classes'), where('school_id', '==', profile.school_id), where('shared_with_teachers', 'array-contains', user.uid), limit(100))
          );
          sharedSnap.docs.forEach((classDoc) => addClass(classDoc.id, classDoc.data()));
        }

        if (cancelled) return;
        const options = Array.from(byId.values()).map((classItem) => ({
          id: classItem.id,
          label: [
            classItem.class_name || classItem.name || `Class ${classItem.id.slice(0, 4)}`,
            classItem.section,
            classItem.curriculum,
          ].filter(Boolean).join(' • '),
        }));
        setTeacherClasses(options);
        setSelectedClassId((current) => current || options[0]?.id || '');
      } catch (err) {
        console.warn('Spiral: failed to load teacher classes', err);
        if (!cancelled) setTeacherClasses([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.managed_class_ids, profile?.role, profile?.school_id, user?.uid]);

  // -------- Voice ---------------------------------------------------------
  const handleFinalTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        goIdle();
        return;
      }
      if (suggestions.length > 0) {
        const suggestionIndex = getVoiceSuggestionIndex(trimmed);
        if (suggestionIndex !== null) {
          const selected = suggestions[suggestionIndex];
          if (/\b(launch|class|students|send)\b/i.test(trimmed) && isTeacher) {
            await launchSuggestionToClass(selected);
          } else {
            await playSuggestion(selected);
          }
          return;
        }

        if (/\b(continue|generate|create|make|skip|new|not this)\b/i.test(trimmed)) {
          const fallback = suggestionFallbackRoute || { kind: 'generateBoth' as const, prompt: trimmed };
          setSuggestions([]);
          setSuggestionFallbackRoute(null);
          await executeRoute(forceCompleteSceneRoute(fallback));
          return;
        }
      }

      setPhase('thinking');
      setHeardText(trimmed);
      setActiveIntent('unknown');
      setProgressMessage(`I heard: "${trimmed}". Thinking…`);
      try {
        const allowExistingContentLookup = generatedVariations.length === 0 && !generated3DAsset;
        const initialRoute = await routePrompt(trimmed, {
          allowExistingContentLookup,
          profile,
        });
        const resolvedRoute = resolveFollowUpRoute(initialRoute, trimmed, sceneContext);
        const route = allowExistingContentLookup &&
          (resolvedRoute.kind === 'generateSkybox' || resolvedRoute.kind === 'generate3D')
          ? forceCompleteSceneRoute(resolvedRoute)
          : resolvedRoute;
        const intent = routeToIntent(route);
        setActiveIntent(intent);
        updateStatusForIntent(intent, trimmed);
        await executeRoute(route);
      } catch (err: any) {
        if (err?.message === 'Generation stopped.') {
          goIdle();
          return;
        }
        console.error('Spiral: route execution failed', err);
        setErrorMessage(err?.message || 'Something went wrong. Please try again.');
        await speakAnswer(FALLBACK_QUESTION_REPLY);
      }
    },
    // executeRoute / speakAnswer defined below; included to silence exhaustive-deps via fn refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      generated3DAsset,
      generatedVariations.length,
      getVoiceSuggestionIndex,
      goIdle,
      isTeacher,
      profile,
      sceneContext,
      suggestionFallbackRoute,
      suggestions,
      updateStatusForIntent,
    ]
  );

  const {
    isSupported: voiceSupported,
    transcript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useVoiceInput({
    lang: 'en-US',
    silenceTimeoutMs: 1500,
    onFinalTranscript: handleFinalTranscript,
  });

  useEffect(() => {
    if (voiceError) {
      setErrorMessage(voiceError);
    }
  }, [voiceError]);

  // -------- Speak helper --------------------------------------------------
  const speakAnswer = useCallback(async (text: string) => {
    if (!text) {
      goIdle();
      return;
    }
    // Mute gate: stop any in-flight TTS and skip new audio. We still flash the
    // "speaking" phase so the orb shows the assistant is responding silently.
    if (isMutedRef.current) {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        /* ignore */
      }
      setPhase('speaking');
      setProgressMessage('Audio is muted. Tap the speaker to unmute.');
      const words = text.split(/\s+/).filter(Boolean).length;
      const ms = Math.min(8000, Math.max(1200, words * 80));
      if (speakingTimerRef.current) {
        window.clearTimeout(speakingTimerRef.current);
      }
      speakingTimerRef.current = window.setTimeout(() => {
        goIdle();
        speakingTimerRef.current = null;
      }, ms);
      return;
    }
    setPhase('speaking');
    setProgressMessage('');
    try {
      // Professional female TTS voice. `nova` is enterprise-grade, warm, and
      // classroom-appropriate. We pass it explicitly so future overrides are
      // a one-line change.
      await speakWithAvatar(text, avatarRef, { voice: 'nova' });
    } catch (err) {
      console.warn('Spiral: speakWithAvatar failed', err);
    }
    // Heuristic fallback: estimate audio time from word count and return to idle.
    const words = text.split(/\s+/).filter(Boolean).length;
    const ms = Math.min(20000, Math.max(2200, words * 320));
    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
    }
    speakingTimerRef.current = window.setTimeout(() => {
      goIdle();
      speakingTimerRef.current = null;
    }, ms);
  }, [goIdle]);

  // -------- Conversation reset / mute -------------------------------------
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        try {
          window.speechSynthesis?.cancel?.();
        } catch {
          /* ignore */
        }
        // Stop any HTML audio elements the avatar may have spawned.
        document.querySelectorAll('audio').forEach((audio) => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {
            /* ignore */
          }
        });
      }
      return next;
    });
  }, []);

  const resetConversation = useCallback(() => {
    cancelActiveGeneration();
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      /* ignore */
    }
    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    setSuggestions([]);
    setSuggestionFallbackRoute(null);
    setGeneratedVariations([]);
    setCurrentVariationIndex(0);
    setGenerated3DAsset(null);
    setSceneContext({});
    setHeardText('');
    setActiveIntent('unknown');
    setProgressMessage('');
    setErrorMessage(null);
    resetGenerationDetail();
    goIdle();
  }, [cancelActiveGeneration, goIdle, resetGenerationDetail]);

  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) {
        window.clearTimeout(speakingTimerRef.current);
      }
      if (generationProgressTimerRef.current) {
        window.clearInterval(generationProgressTimerRef.current);
      }
    };
  }, []);

  // -------- Pipelines -----------------------------------------------------
  const askAssistant = useCallback(
    async (question: string): Promise<string> => {
      const answer = await askSpiralQuestion(question, avatarConfig);
      return answer.trim() || FALLBACK_QUESTION_REPLY;
    },
    [avatarConfig]
  );

  const ensureStyleId = useCallback(async (): Promise<number | null> => {
    if (styleIdRef.current !== null) {
      const n = Number(styleIdRef.current);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    try {
      const res = await skyboxApiService.getStyles(1, 100);
      const list: SkyboxStyle[] = (res?.data || res?.styles || []) as SkyboxStyle[];
      const chosen = pickUhdRenderStyle(list);
      if (chosen) {
        styleIdRef.current = chosen.id;
        styleNameRef.current = chosen.name;
        const n = Number(chosen.id);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
    } catch (err) {
      console.warn('Spiral: ensureStyleId failed', err);
    }
    return null;
  }, []);

  const generateSkyboxFlow = useCallback(
    async (prompt: string, token: { id: number; cancelled: boolean }): Promise<GeneratedSkybox | null> => {
      const styleId = await ensureStyleId();
      if (!styleId) {
        toast.error('Could not pick a style for this magic world. Please try again later.');
        return null;
      }
      setPhase('skyboxGenerating');
      startGenerationProgress(5, 94);
      setSkyboxProgress(5);
      upsertGenerationItem({
        id: 'skybox',
        label: 'Creating 360 world',
        detail: prompt,
        progress: 5,
        status: 'active',
        tone: 'skybox',
      });
      setProgressMessage('Drawing your world…');
      const startRes = await skyboxApiService.generateSkybox({
        prompt,
        style_id: styleId,
        userId: user?.uid,
      });
      const generationId =
        (startRes as any)?.data?.generationId ||
        (startRes as any)?.data?.id ||
        (startRes as any)?.generationId;
      if (!generationId) {
        throw new Error('Skybox generation could not be started.');
      }

      const maxAttempts = 180;
      const baseInterval = 2000;
      let attempts = 0;
      let interval = baseInterval;
      while (attempts < maxAttempts) {
        if (isGenerationCancelled(token)) {
          throw new Error('Generation stopped.');
        }
        const statusRes = await skyboxApiService.getSkyboxStatus(String(generationId));
        const data: any = (statusRes as any)?.data || {};
        const status = String(data.status || '').toLowerCase();
        const nextProgress = Math.min(96, Math.round(8 + (attempts / maxAttempts) * 88));
        setGenerationProgress(nextProgress);
        setSkyboxProgress(nextProgress);
        upsertGenerationItem({
          id: 'skybox',
          label: 'Creating 360 world',
          detail: data.prompt || prompt,
          progress: nextProgress,
          status: 'active',
          tone: 'skybox',
        });
        if (status === 'completed' || status === 'complete') {
          const url = data.file_url || data.image || data.thumb_url;
          if (url) {
            setGenerationProgress(100);
            setSkyboxProgress(100);
            upsertGenerationItem({
              id: 'skybox',
              label: '360 world ready',
              detail: data.title || data.prompt || prompt,
              progress: 100,
              status: 'completed',
              tone: 'skybox',
            });
            return {
              id: String(generationId),
              generationId: String(generationId),
              file_url: url,
              image: url,
              image_jpg: url,
              title: data.title || prompt,
              prompt: data.prompt || prompt,
            };
          }
        }
        if (status === 'failed' || status === 'error' || status === 'abort') {
          upsertGenerationItem({
            id: 'skybox',
            label: '360 world failed',
            detail: data.error_message || prompt,
            progress: nextProgress,
            status: 'failed',
            tone: 'skybox',
          });
          throw new Error(data.error_message || 'Skybox generation failed.');
        }
        attempts += 1;
        if (attempts > 1) interval = Math.min(interval * 1.1, 10000);
        await new Promise((r) => setTimeout(r, interval));
      }
      throw new Error('Skybox generation timed out.');
    },
    [ensureStyleId, isGenerationCancelled, startGenerationProgress, upsertGenerationItem, user?.uid]
  );

  const generate3DFlow = useCallback(
    async (prompt: string, skyboxId: string | null | undefined, token: { id: number; cancelled: boolean }): Promise<any | null> => {
      if (!user?.uid) {
        toast.error('Please sign in to make a 3D thing.');
        return null;
      }
      if (!assetGenerationService.isMeshyConfigured()) {
        toast.error('3D maker is not ready right now.');
        return null;
      }
      setPhase('assetGenerating');
      startGenerationProgress(4, 92);
      setAssetProgress(4);
      upsertGenerationItem({
        id: 'asset',
        label: 'Generating 3D asset',
        detail: prompt,
        progress: 4,
        status: 'active',
        tone: 'asset',
      });
      setProgressMessage('Building your 3D friend…');
      const result = await assetGenerationService.generateAssetsFromPrompt(
        {
          originalPrompt: prompt,
          userId: user.uid,
          skyboxId: skyboxId || undefined,
          maxAssets: 1,
          quality: 'medium',
          style: 'realistic',
          outputFormat: 'glb',
        },
        (p) => {
          if (isGenerationCancelled(token)) return;
          if (p?.message) {
            setProgressMessage(p.message);
          }
          if (typeof p?.progress === 'number') {
            const nextProgress = Math.max(4, Math.min(96, Math.round(p.progress)));
            setGenerationProgress(nextProgress);
            setAssetProgress(nextProgress);
            upsertGenerationItem({
              id: 'asset',
              label: p.stage === 'storing' ? 'Storing 3D model' : 'Generating 3D asset',
              detail: p.currentAsset || p.message || prompt,
              progress: nextProgress,
              status: p.stage === 'failed' ? 'failed' : 'active',
              tone: 'asset',
            });
          }
        }
      );
      if (isGenerationCancelled(token)) {
        throw new Error('Generation stopped.');
      }
      const first = result?.assets?.[0];
      const url = first?.downloadUrl || first?.previewUrl;
      if (!url) {
        upsertGenerationItem({
          id: 'asset',
          label: '3D asset failed',
          detail: result?.error || result?.errors?.[0] || prompt,
          progress: assetProgress ?? generationProgress ?? 0,
          status: 'failed',
          tone: 'asset',
        });
        throw new Error('No 3D thing came back. Try again?');
      }
      setGenerationProgress(100);
      setAssetProgress(100);
      upsertGenerationItem({
        id: 'asset',
        label: '3D asset ready',
        detail: first.prompt || prompt,
        progress: 100,
        status: 'completed',
        tone: 'asset',
      });
      return first;
    },
    [assetProgress, generationProgress, isGenerationCancelled, startGenerationProgress, upsertGenerationItem, user?.uid]
  );

  // NOTE: All navigation in Spiral is gated behind explicit user actions
  // (Play / Launch to class / voice command "play first one"). Spiral never
  // auto-routes on the *first* prompt — even when a route maps to a tour, we
  // surface it as a suggestion card instead. The only navigation paths that
  // remain are user-clicked: playTour (from card click or voice "play …") and
  // playLessonSuggestion (same).
  const playTour = useCallback(
    (tour: Vr360TourItem, fromClassSession = false, sessionId?: string | null) => {
      const vr = {
        tourId: tour.id,
        title: tour.title,
        videoPath: tour.videoPath,
        videoStoragePath: tour.videoStoragePath,
        player: tour.player,
        fromClassSession,
      };
      try {
        sessionStorage.setItem('learnxr_vr360_tour', JSON.stringify(vr));
        if (sessionId) sessionStorage.setItem('learnxr_class_session_id', sessionId);
      } catch (err) {
        console.warn('Spiral: failed to cache vr360 tour in sessionStorage', err);
      }
      navigate('/vr360-videotour', { state: { vr360: vr } });
    },
    [navigate]
  );

  const playLessonSuggestion = useCallback(
    async (suggestion: Extract<SpiralSuggestion, { type: 'lesson' }>, sessionId?: string | null) => {
      setPhase('thinking');
      setProgressMessage('Opening the lesson…');
      const { getLessonBundle } = await import('../services/firestore/getLessonBundle');
      const bundle = await getLessonBundle({
        chapterId: suggestion.lesson.chapterId,
        topicId: suggestion.lesson.topicId,
        lang: suggestion.lesson.lang || 'en',
      });
      const payload = buildLessonPayloadFromBundle(bundle, suggestion.lesson.topicId);
      startLocalLesson(payload.chapter, payload.topic);
      if (sessionId) {
        sessionStorage.setItem('learnxr_class_session_id', sessionId);
      }
      navigate('/vrlessonplayer-krpano');
    },
    [navigate, startLocalLesson]
  );

  const playSuggestion = useCallback(
    async (suggestion: SpiralSuggestion) => {
      setSuggestions([]);
      setSuggestionFallbackRoute(null);
      if (suggestion.type === 'vr360') {
        playTour(suggestion.tour);
        return;
      }
      await playLessonSuggestion(suggestion);
    },
    [playLessonSuggestion, playTour]
  );

  const ensureClassSessionForLaunch = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    const classId = selectedClassId || teacherClasses[0]?.id;
    if (!classId) {
      toast.error('Select a class before launching.');
      return null;
    }
    return startSession(classId);
  }, [activeSessionId, selectedClassId, startSession, teacherClasses]);

  const submitGeneratedSceneForReview = useCallback(async () => {
    if (!isTeacher) return;
    const currentSkybox = generatedVariations[currentVariationIndex];
    const skyboxImageUrl = currentSkybox?.file_url || currentSkybox?.image || currentSkybox?.image_jpg;
    if (!skyboxImageUrl) {
      toast.error('Create a 360 world before submitting this scene.');
      return;
    }
    setSubmittingSceneForReview(true);
    try {
      const meshyPayloadUrl = resolveGenerated3DAssetUrl(generated3DAsset as Record<string, unknown>) || undefined;
      const skyboxGlbPayload =
        (typeof currentSkybox?.stored_glb_url === 'string' && currentSkybox.stored_glb_url) ||
        (typeof currentSkybox?.glb_url === 'string' && currentSkybox.glb_url) ||
        skyboxImageUrl;
      const title = sceneContext.skyboxTitle || sceneContext.skyboxPrompt || currentSkybox?.title || 'Spiral generated scene';
      const { lessonId } = await createDraftLesson(title, 'spiral_scene');
      await updateDraftLesson(lessonId, {
        skybox_url: skyboxImageUrl,
        skybox_glb_url: skyboxGlbPayload,
        asset_urls: meshyPayloadUrl ? [meshyPayloadUrl] : [],
      });
      await submitLessonForReview(lessonId);
      toast.success('Scene submitted for Super Admin review.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit this scene for review.');
    } finally {
      setSubmittingSceneForReview(false);
    }
  }, [currentVariationIndex, generated3DAsset, generatedVariations, isTeacher, sceneContext.skyboxPrompt, sceneContext.skyboxTitle]);

  const launchGeneratedSceneToClass = useCallback(async () => {
    if (!isTeacher) return;
    const currentSkybox = generatedVariations[currentVariationIndex];
    const skyboxImageUrl = currentSkybox?.file_url || currentSkybox?.image || currentSkybox?.image_jpg;
    const skyboxId = sceneContext.skyboxId || currentSkybox?.generationId || currentSkybox?.id || null;

    if (!skyboxImageUrl && !skyboxId) {
      toast.error('Create a 360 world before launching this scene.');
      return;
    }

    setPhase('classLaunch');
    setGenerationProgress(15);
    setProgressMessage('Preparing this generated scene for class…');

    const sessionId = await ensureClassSessionForLaunch();
    if (!sessionId) {
      goIdle();
      return;
    }

    const meshyPayloadUrl = resolveGenerated3DAssetUrl(generated3DAsset as Record<string, unknown>) || undefined;
    const skyboxGlbPayload =
      (typeof currentSkybox?.stored_glb_url === 'string' && currentSkybox.stored_glb_url) ||
      (typeof currentSkybox?.glb_url === 'string' && currentSkybox.glb_url) ||
      undefined;

    const ok = await launchSceneToClass(
      {
        type: 'create_scene',
        skybox_id: skyboxId,
        skybox_image_url: skyboxImageUrl,
        skybox_glb_url: skyboxGlbPayload,
        meshy_glb_url: meshyPayloadUrl ?? null,
        name: sceneContext.skyboxTitle || sceneContext.skyboxPrompt || currentSkybox?.title || 'Spiral generated scene',
      },
      sessionId
    );

    setGenerationProgress(100);
    if (ok) {
      toast.success('Generated scene launched to class.');
      setTeacherLaunchPanelOpen(false);
      await speakAnswer('I sent this scene to your class.');
    } else {
      toast.error('Could not launch this scene to class.');
      goIdle();
    }
  }, [
    currentVariationIndex,
    ensureClassSessionForLaunch,
    generated3DAsset,
    generatedVariations,
    goIdle,
    isTeacher,
    launchSceneToClass,
    sceneContext.skyboxId,
    sceneContext.skyboxPrompt,
    sceneContext.skyboxTitle,
    speakAnswer,
  ]);

  const launchSuggestionToClass = useCallback(
    async (suggestion: SpiralSuggestion) => {
      if (!isTeacher) {
        toast.error('Only teachers can launch to class.');
        return;
      }

      setPhase('classLaunch');
      setGenerationProgress(15);
      setProgressMessage('Preparing class launch…');

      const sessionId = await ensureClassSessionForLaunch();
      if (!sessionId) {
        goIdle();
        return;
      }

      const payload =
        suggestion.type === 'vr360'
          ? {
              chapter_id: VR360_TOUR_CHAPTER_ID,
              topic_id: topicIdForVr360TourId(suggestion.tour.id),
              lesson_type: 'vr360_video' as const,
              vr360_tour_id: suggestion.tour.id,
              curriculum: 'VR',
              class_name: '',
              subject: '360° Video Tour',
              lang: 'en',
            }
          : {
              chapter_id: suggestion.lesson.chapterId,
              topic_id: suggestion.lesson.topicId,
              curriculum: suggestion.lesson.curriculum || '',
              class_name: suggestion.lesson.className || '',
              subject: suggestion.lesson.subject || '',
              lang: suggestion.lesson.lang || 'en',
            };

      const ok = await launchLessonToClass(payload, sessionId);
      setGenerationProgress(100);
      if (!ok) {
        toast.error('Could not launch to class.');
        goIdle();
        return;
      }

      toast.success('Content launched to class.');
      setSuggestions([]);
      setSuggestionFallbackRoute(null);

      if (suggestion.type === 'vr360') {
        playTour(suggestion.tour, true, sessionId);
      } else {
        await playLessonSuggestion(suggestion, sessionId);
      }
    },
    [
      ensureClassSessionForLaunch,
      goIdle,
      isTeacher,
      launchLessonToClass,
      playLessonSuggestion,
      playTour,
    ]
  );

  const executeRoute = useCallback(
    async (route: SpiralRoute) => {
      switch (route.kind) {
        case 'question': {
          if (!route.text.trim()) {
            goIdle();
            return;
          }
          const reply = await askAssistant(route.text);
          await speakAnswer(reply);
          return;
        }
        case 'tour': {
          // Spiral never auto-routes — surface the tour as a one-card
          // suggestion so the user (or teacher) explicitly opts in to
          // navigate. Tap "Play" or "Launch to class" to leave this page.
          const tourSuggestion = {
            id: `vr360:${route.tour.id}`,
            type: 'vr360' as const,
            title: route.tour.title.replace(/—.*/g, '').trim(),
            subtitle: '360 video tour',
            description: route.tour.description,
            score: 1,
            tour: route.tour,
          };
          setSuggestions([tourSuggestion]);
          setSuggestionFallbackRoute({ kind: 'generateBoth', prompt: route.text });
          setPhase('suggesting');
          setProgressMessage('Tap Play to open this 360 tour, or continue generating.');
          await speakAnswer('I found a 360 tour for that. Tap play, or keep creating.');
          return;
        }
        case 'suggestions': {
          setSuggestions(route.suggestions);
          setSuggestionFallbackRoute(route.fallbackRoute ? forceCompleteSceneRoute(route.fallbackRoute) : null);
          setPhase('suggesting');
          setProgressMessage('Pick a ready-made lesson, or continue generating a new scene.');
          await speakAnswer('I found ready lessons. Tap play, launch to class, or continue generating.');
          return;
        }
        case 'generateSkybox': {
          resetGenerationDetail();
          const token = createGenerationToken();
          const sky = await generateSkyboxFlow(route.prompt, token);
          if (isGenerationCancelled(token)) {
            goIdle();
            return;
          }
          if (sky) {
            setGeneratedVariations([sky]);
            setCurrentVariationIndex(0);
            setGenerated3DAsset(null);
            setSceneContext({
              skyboxId: sky.generationId || sky.id || null,
              skyboxPrompt: sky.prompt,
              skyboxTitle: sky.title || sky.prompt,
              assetId: null,
              assetPrompt: null,
            });
            await speakAnswer('Here is your new world!');
          } else {
            goIdle();
          }
          return;
        }
        case 'generate3D': {
          resetGenerationDetail();
          const token = createGenerationToken();
          const currentSkyboxId = sceneContext.skyboxId || generatedVariations[currentVariationIndex]?.generationId || generatedVariations[currentVariationIndex]?.id || null;
          if (!currentSkyboxId) {
            setGeneratedVariations([]);
            setCurrentVariationIndex(0);
          }
          const made = await generate3DFlow(route.meshDescription || route.prompt, currentSkyboxId, token);
          if (isGenerationCancelled(token)) {
            goIdle();
            return;
          }
          if (made) {
            setGenerated3DAsset(made);
            setSceneContext((prev) => ({
              ...prev,
              assetId: made.id || null,
              assetPrompt: made.prompt || route.meshDescription || route.prompt,
            }));
            await speakAnswer(currentSkyboxId ? 'I added it to this world!' : 'Look at this!');
          } else {
            goIdle();
          }
          return;
        }
        case 'generateBoth': {
          resetGenerationDetail();
          const token = createGenerationToken();
          const skyResult = await generateSkyboxFlow(route.prompt, token)
            .then((sky) => ({ status: 'fulfilled' as const, value: sky }))
            .catch((reason) => ({ status: 'rejected' as const, reason }));
          if (isGenerationCancelled(token)) {
            goIdle();
            return;
          }

          const skyboxId =
            skyResult.status === 'fulfilled' && skyResult.value
              ? skyResult.value.generationId || skyResult.value.id || null
              : null;

          const meshResult = await generate3DFlow(route.meshDescription || route.prompt, skyboxId, token)
            .then((mesh) => ({ status: 'fulfilled' as const, value: mesh }))
            .catch((reason) => ({ status: 'rejected' as const, reason }));
          if (isGenerationCancelled(token)) {
            goIdle();
            return;
          }

          let anything = false;
          if (skyResult.status === 'fulfilled' && skyResult.value) {
            setGeneratedVariations([skyResult.value]);
            setCurrentVariationIndex(0);
            setSceneContext((prev) => ({
              ...prev,
              skyboxId: skyResult.value?.generationId || skyResult.value?.id || null,
              skyboxPrompt: skyResult.value?.prompt || route.prompt,
              skyboxTitle: skyResult.value?.title || route.prompt,
            }));
            anything = true;
          }
          if (meshResult.status === 'fulfilled' && meshResult.value) {
            setGenerated3DAsset(meshResult.value);
            setSceneContext((prev) => ({
              ...prev,
              assetId: meshResult.value.id || null,
              assetPrompt: meshResult.value.prompt || route.meshDescription || route.prompt,
            }));
            anything = true;
          }
          if (anything) {
            await speakAnswer('Ta-da! Here we go!');
          } else {
            await speakAnswer('I tried my best, but it did not work this time.');
          }
          return;
        }
        default:
          goIdle();
      }
    },
    [
      askAssistant,
      createGenerationToken,
      generate3DFlow,
      generateSkyboxFlow,
      goIdle,
      isGenerationCancelled,
      sceneContext.skyboxId,
      generatedVariations,
      currentVariationIndex,
      resetGenerationDetail,
      speakAnswer,
    ]
  );

  // -------- Tap handler ---------------------------------------------------
  const handleOrbTap = useCallback(async () => {
    setErrorMessage(null);
    if (phase === 'assetGenerating' || phase === 'skyboxGenerating') {
      cancelActiveGeneration();
      return;
    }
    if (phase === 'thinking' || phase === 'classLaunch') return;
    if (phase === 'speaking') {
      // Skip to idle so the kid can ask the next thing.
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        /* ignore */
      }
      if (speakingTimerRef.current) {
        window.clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
      goIdle();
      return;
    }
    if (phase === 'listening') {
      stopVoice();
      return;
    }
    if (!voiceSupported) {
      setErrorMessage(
        'Sorry, voice does not work on this device. Please use Chrome on a phone or laptop.'
      );
      return;
    }
    resetVoice();
    setPhase('listening');
    setProgressMessage('');
    setHeardText('');
    setActiveIntent('unknown');
    try {
      await startVoice();
    } catch (err: any) {
      console.error('Spiral: startVoice failed', err);
      setErrorMessage(err?.message || 'Could not start the microphone.');
      goIdle();
    }
  }, [cancelActiveGeneration, goIdle, phase, resetVoice, startVoice, stopVoice, voiceSupported]);

  // -------- Render --------------------------------------------------------
  const hintLiveText = orbState === 'listening' ? transcript : progressMessage;
  const hasResult = generatedVariations.length > 0 || !!generated3DAsset;
  const hasSuggestions = suggestions.length > 0;
  const currentSkybox = generatedVariations[currentVariationIndex];
  const canLaunchGeneratedScene = isTeacher && Boolean(currentSkybox?.file_url || currentSkybox?.image || sceneContext.skyboxId);
  const orbSize = hasResult ? 148 : 320;
  const isGenerating = phase === 'skyboxGenerating' || phase === 'assetGenerating';
  const orbLabel =
    phase === 'skyboxGenerating'
      ? '360 world'
      : phase === 'assetGenerating'
        ? '3D object'
        : phase === 'listening'
          ? 'Mic on'
          : phase === 'suggesting'
            ? 'Choose'
            : phase === 'classLaunch'
              ? 'Launching'
              : undefined;

  const canReset = hasResult || hasSuggestions || Boolean(heardText) || activeIntent !== 'unknown';

  const showIntentChips = !hasResult && !hasSuggestions;
  const chipRowVisible =
    isMuted || isGenerating || (showIntentChips && (heardText || activeIntent !== 'unknown'));

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#05070d] text-white">
      {/* Premium graphite background gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 20% 18%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(circle at 82% 78%, rgba(167,139,250,0.18), transparent 60%), linear-gradient(180deg, #05070d 0%, #0a0d18 100%)',
        }}
      />

      {/* Background skybox / asset */}
      <div className="pointer-events-auto absolute inset-0 z-0">
        <SpiralResultViewer
          generatedVariations={generatedVariations}
          currentVariationIndex={currentVariationIndex}
          generated3DAsset={generated3DAsset}
        />
      </div>

      {/* Soft vignette so the orb stays readable over busy skyboxes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Top: session banner (teacher / student) */}
      <SpiralSessionBanner
        activeSession={activeSession}
        joinedSession={joinedSession}
        studentCount={progressList.length || undefined}
        isTeacher={isTeacher}
        onEndSession={async () => {
          await endSession();
        }}
        onLeaveSession={leaveSessionAsStudent}
      />

      {/* Right: student joinable classes panel */}
      {isStudent && (
        <SpiralStudentClassesPanel
          sessionLoading={sessionLoading}
          joinedSessionId={joinedSessionId}
          sessionError={sessionError}
          clearSessionError={clearSessionError}
          onJoinWithCode={joinClassSession}
        />
      )}

      <SpiralGenerationProgress
        items={generationItems}
        skyboxProgress={skyboxProgress}
        assetProgress={assetProgress}
        isGenerating={isGenerating}
      />

      <SpiralSuggestions
        suggestions={suggestions}
        isTeacher={isTeacher}
        classOptions={teacherClasses}
        selectedClassId={selectedClassId}
        hasActiveSession={Boolean(activeSessionId)}
        busy={sessionLoading || phase === 'classLaunch'}
        onSelectClass={setSelectedClassId}
        onPlay={(suggestion) => {
          // User-initiated play — explicit click. Spiral never auto-routes.
          void playSuggestion(suggestion);
        }}
        onLaunchToClass={(suggestion) => {
          // User-initiated launch to class.
          void launchSuggestionToClass(suggestion);
        }}
        onContinueGenerating={() => {
          const fallback = suggestionFallbackRoute || { kind: 'generateBoth' as const, prompt: heardText || 'make a learning scene' };
          setSuggestions([]);
          setSuggestionFallbackRoute(null);
          void executeRoute(forceCompleteSceneRoute(fallback));
        }}
      />

      {canLaunchGeneratedScene && (
        <div className="pointer-events-auto absolute left-4 top-24 z-30 flex flex-col gap-2 md:left-6 md:top-28">
          <button
            type="button"
            onClick={() => setTeacherLaunchPanelOpen((o) => !o)}
            aria-expanded={teacherLaunchPanelOpen}
            aria-label={teacherLaunchPanelOpen ? 'Close class launch options' : 'Open class launch options'}
            title="Send scene to class"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500/25 text-emerald-50 shadow-xl backdrop-blur-md transition hover:bg-emerald-500/35"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M3 20h2V4H3v16Zm4 0h1V4H7v16Zm2-16v16h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H9Zm10 8a1 1 0 0 1-1 1h-4v-2h4a1 1 0 0 1 1 1Zm0-4a1 1 0 0 1-1 1h-4V7h4a1 1 0 0 1 1 1Z" />
            </svg>
          </button>
          {teacherLaunchPanelOpen && (
            <div className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/88 p-4 text-white shadow-2xl backdrop-blur-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/75">Class</p>
              {!activeSessionId && teacherClasses.length > 0 && (
                <label className="mt-2 block text-xs font-medium text-white/70">
                  Select class
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/95 px-3 py-2 text-sm text-white outline-none focus:border-emerald-200"
                  >
                    {teacherClasses.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  void launchGeneratedSceneToClass();
                }}
                disabled={
                  sessionLoading || phase === 'classLaunch' || (!activeSessionId && teacherClasses.length === 0)
                }
                className="mt-3 w-full rounded-full bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeSessionId ? 'Launch to class' : 'Start session & launch'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitGeneratedSceneForReview();
                }}
                disabled={submittingSceneForReview}
                className="mt-2 w-full rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit for review
              </button>
            </div>
          )}
        </div>
      )}

      {/* Orb + hint: center before first result, docked bottom-left for follow-up prompts. */}
      <div
        className={`pointer-events-none absolute z-20 flex px-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hasResult || hasSuggestions
            ? 'bottom-24 left-4 items-end justify-start md:bottom-28 md:left-8'
            : 'inset-0 flex-col items-center justify-center'
        }`}
      >
        <div className="pointer-events-auto">
          <SpiralOrb3D
            state={orbState}
            onTap={handleOrbTap}
            size={hasSuggestions ? 132 : orbSize}
            compact={hasResult || hasSuggestions}
            progress={isGenerating || phase === 'classLaunch' ? generationProgress : null}
            statusLabel={orbLabel}
            canCancel={isGenerating}
          />
        </div>
        <div className={`${hasResult || hasSuggestions ? 'ml-4 max-w-sm pb-4 text-left' : 'mt-8 max-w-2xl text-center'}`}>
          <ListeningHint state={orbState} liveText={hintLiveText} compact={hasResult || hasSuggestions} />
        </div>
        {chipRowVisible && (
          <div
            className={`pointer-events-none flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/70 ${
              hasResult || hasSuggestions ? 'absolute bottom-0 left-40 max-w-sm justify-start md:left-48' : 'mt-4 justify-center'
            }`}
          >
            {showIntentChips && heardText && (
              <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">Heard</span>
            )}
            {showIntentChips && activeIntent !== 'unknown' && (
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-100 backdrop-blur-md">
                {activeIntent === 'skybox'
                  ? '360 World'
                  : activeIntent === 'asset'
                    ? '3D Object'
                    : activeIntent === 'both'
                      ? 'World + 3D'
                      : activeIntent}
              </span>
            )}
            {isGenerating && (
              <span className="rounded-full bg-sky-400/15 px-3 py-1 text-sky-100 backdrop-blur-md">Tap orb to stop</span>
            )}
            {isMuted && <span className="rounded-full bg-rose-400/15 px-3 py-1 text-rose-100 backdrop-blur-md">Muted</span>}
          </div>
        )}
        {errorMessage && (
          <div className="pointer-events-auto mt-6 max-w-md rounded-2xl bg-red-500/15 px-5 py-3 text-center text-base text-red-100 backdrop-blur-md ring-1 ring-red-300/30">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Avatar in lower-right (small) */}
      <div className="pointer-events-auto absolute bottom-24 right-6 z-30 h-44 w-36 overflow-hidden rounded-3xl bg-black/30 ring-1 ring-white/10 backdrop-blur-sm md:bottom-28 md:h-56 md:w-44">
        <TeacherAvatar
          ref={avatarRef}
          className="h-full w-full"
          avatarModelUrl="/models/avatar3.glb"
          useAvatarKey
          disableThreadInit
        />
      </div>

      {/* Bottom: visible controls — mic / stop / mute / reset */}
      <SpiralControls
        orbState={orbState}
        isMuted={isMuted}
        micSupported={voiceSupported}
        isGenerating={isGenerating}
        canReset={canReset}
        onToggleMic={handleOrbTap}
        onStopGeneration={cancelActiveGeneration}
        onToggleMute={handleToggleMute}
        onReset={resetConversation}
      />
    </div>
  );
};

export default Spiral;
