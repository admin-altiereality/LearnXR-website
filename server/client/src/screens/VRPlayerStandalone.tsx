/**
 * Standalone VR player – no ProtectedRoute. Used by Android WebView with token-based API.
 * Reads chapterId, topicId, idToken from URL; fetches GET /api/lesson-bundle with Bearer token;
 * renders Krpano 360° + 3D assets, TTS playback, MCQ quiz, and optional class session sync.
 *
 * UI: auto-hiding HUD, left-anchored drawer (never overlaps Krpano joypad at bottom-right),
 * compact language toggle, pointer-events passthrough top bar.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { buildKrpanoXml } from '../lib/krpano/buildKrpanoXml';
import { loadKrpanoScript, embedKrpano } from '../lib/krpano/embedKrpano';
import { ensureRenderAssetBridgeReady, toRenderAssetBridgeUrl } from '../lib/krpano/renderAssetBridge';
import { applyTeacherViewToKrpano } from '../lib/krpano/applyTeacherView';
import { getApiBaseUrl, getProxyAssetUrl, getProxyAssetUrlForThreejs } from '../utils/apiConfig';
import { auth } from '../config/firebase';
import {
  subscribeSession,
  reportSessionProgress,
  reportStudentView,
  updateTeacherView,
} from '../services/classSessionService';
import {
  trackLessonLaunch,
  updateLessonLaunch,
  saveQuizScore,
} from '../services/lessonTrackingService';
import type { UserProfile } from '../utils/rbac';
import type { ClassSession, SessionLessonPhase } from '../types/lms';
import type { LanguageCode } from '../types/curriculum';

const KRPANO_CONTAINER_ID = 'krpano_standalone_container';
const HUD_TIMEOUT_MS = 4000;

type LessonPhase = 'loading' | 'intro' | 'explanation' | 'outro' | 'quiz' | 'completed';
type TTSStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

interface TTSEntry {
  id: string;
  section: string;
  audioUrl: string;
}

interface MCQEntry {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface BundleData {
  tts: TTSEntry[];
  mcqs: MCQEntry[];
  avatarScripts: { intro?: string; explanation?: string; outro?: string } | null;
  chapter: Record<string, unknown>;
  topic?: Record<string, unknown>;
}

function isGlbOrGltfUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /\.(glb|gltf)([?#]|$)/i.test(url) || /\.glb\b/i.test((url.split('?')[0] ?? '').trim());
}

function isFirebaseStorage(url: string): boolean {
  return url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app');
}

function isRenderAssetUrl(url: string): boolean {
  return typeof url === 'string' && url.includes('/render-asset/') && /\.(glb|gltf)$/i.test((url.split(/[?#]/)[0] ?? url).replace(/\/$/, ''));
}

function isLegacyMeshyCdnUrl(url: string): boolean {
  return /\/\/(?:assets|storage)\.meshy\.ai\//i.test(url) || /\/\/api\.meshy\.ai\//i.test(url);
}

function pickBundleGlbUrl(asset: any): string {
  const candidates = [
    asset?.animated_render_url,
    asset?.render_url,
    asset?.model_urls?.glb,
    asset?.glb_url,
    asset?.file_url,
    asset?.animated_glb_url,
  ];
  const url = candidates.find((candidate) => {
    const value = String(candidate || '');
    return isGlbOrGltfUrl(value) && !isLegacyMeshyCdnUrl(value);
  });
  return url ? String(url) : '';
}

function toKrpanoThreeJsAssetUrl(url: string): string {
  if (!url) return '';
  if (isRenderAssetUrl(url) || url.startsWith('/assets/') || url.startsWith('blob:')) return url;
  return getProxyAssetUrlForThreejs(url);
}

const PHASE_META: Record<string, { label: string; icon: string; color: string }> = {
  loading: { label: 'Loading', icon: '⏳', color: 'bg-slate-500/60' },
  intro:   { label: 'Intro', icon: '👋', color: 'bg-cyan-500/60' },
  explanation: { label: 'Explain', icon: '📖', color: 'bg-violet-500/60' },
  outro:   { label: 'Summary', icon: '✅', color: 'bg-emerald-500/60' },
  quiz:    { label: 'Quiz', icon: '❓', color: 'bg-amber-500/60' },
  completed: { label: 'Done', icon: '🏆', color: 'bg-emerald-500/60' },
};

const LANG_FLAGS: Record<LanguageCode, string> = { en: '🇬🇧', hi: '🇮🇳' };

export default function VRPlayerStandalone() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bundle, setBundle] = useState<BundleData | null>(null);
  const cancelledRef = useRef(false);

  // Language
  const initialLang = (searchParams.get('lang')?.toLowerCase() || 'en') as LanguageCode;
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const [langLoading, setLangLoading] = useState(false);

  // Lesson flow
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [lessonReady, setLessonReady] = useState(false);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('intro');
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const lastPlayedPhaseRef = useRef<LessonPhase | null>(null);

  // HUD auto-hide
  const [hudVisible, setHudVisible] = useState(true);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // TTS
  const [ttsStatus, setTtsStatus] = useState<TTSStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // MCQ
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [showMcqResult, setShowMcqResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const krpanoViewerRef = useRef<{ call?: (action: string) => void } | null>(null);

  // View-only mode: hides all UI, sets initial view, no tracking
  const isViewOnly = searchParams.get('viewOnly') === 'true';
  const initH = parseFloat(searchParams.get('initH') ?? '') || undefined;
  const initV = parseFloat(searchParams.get('initV') ?? '') || undefined;
  const initFov = parseFloat(searchParams.get('initFov') ?? '') || undefined;

  // Class session sync
  const sessionId = searchParams.get('sessionId')?.trim() ?? null;
  const studentUid = searchParams.get('studentUid')?.trim() ?? null;
  const urlRole = searchParams.get('role')?.trim()?.toLowerCase() ?? null;
  const [joinedSession, setJoinedSession] = useState<ClassSession | null>(null);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const urlDisplayName = searchParams.get('displayName')?.trim()
    ? decodeURIComponent(searchParams.get('displayName')!.trim())
    : undefined;
  const urlEmail = searchParams.get('email')?.trim()
    ? decodeURIComponent(searchParams.get('email')!.trim())
    : undefined;

  // Lesson tracking (writes to lesson_launches + student_scores for dashboard consistency)
  const urlSchoolId = searchParams.get('schoolId')?.trim() ?? null;
  const urlClassId = searchParams.get('classId')?.trim() ?? null;
  const launchIdRef = useRef<string | null>(null);
  const lessonStartTimeRef = useRef<number>(0);

  const scripts = bundle?.avatarScripts
    ? [
        bundle.avatarScripts.intro ?? '',
        bundle.avatarScripts.explanation ?? '',
        bundle.avatarScripts.outro ?? '',
      ].filter(Boolean)
    : [];
  const currentScript = scripts[currentScriptIndex] ?? '';
  const ttsData = bundle?.tts ?? [];
  const mcqs = bundle?.mcqs ?? [];
  const currentMcq = mcqs[currentMcqIndex] ?? null;
  const phaseMeta = PHASE_META[lessonPhase] ?? PHASE_META.loading;

  // ── HUD auto-hide logic ──
  const resetHudTimer = useCallback(() => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    setHudVisible(true);
    hudTimerRef.current = setTimeout(() => setHudVisible(false), HUD_TIMEOUT_MS);
  }, []);

  const toggleHud = useCallback(() => {
    setHudVisible((v) => {
      if (!v) {
        if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        hudTimerRef.current = setTimeout(() => setHudVisible(false), HUD_TIMEOUT_MS);
      }
      return !v;
    });
  }, []);

  useEffect(() => {
    if (lessonReady && !showWelcomeScreen && lessonPhase !== 'completed') {
      resetHudTimer();
    }
    return () => { if (hudTimerRef.current) clearTimeout(hudTimerRef.current); };
  }, [lessonReady, showWelcomeScreen, lessonPhase, resetHudTimer]);

  // Keep HUD visible while drawer is open or during quiz
  useEffect(() => {
    if (drawerOpen || lessonPhase === 'quiz') {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      setHudVisible(true);
    }
  }, [drawerOpen, lessonPhase]);

  // ── TTS helpers ──
  const getTTSForCurrentPhase = useCallback((): TTSEntry | null => {
    if (ttsData.length === 0) return null;
    let targetSection = 'full';
    if (lessonPhase === 'intro') targetSection = 'intro';
    else if (lessonPhase === 'explanation') targetSection = 'explanation';
    else if (lessonPhase === 'outro') targetSection = 'outro';
    const match = ttsData.find((t) => t.section === targetSection);
    if (match) return match;
    const fullMatch = ttsData.find((t) => t.section === 'full');
    if (fullMatch) return fullMatch;
    return ttsData[0] ?? null;
  }, [ttsData, lessonPhase]);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setCurrentAudioUrl(null);
    setAudioCurrentTime(0);
    setIsPlayingAudio(false);
  }, []);

  const playTTS = useCallback(() => {
    if (isPlayingAudio) return;
    if (isMuted) { setWaitingForUser(true); return; }
    const ttsEntry = getTTSForCurrentPhase();
    if (!ttsEntry?.audioUrl) { setTtsStatus('error'); setWaitingForUser(true); return; }
    cleanupAudio();
    setIsPlayingAudio(true);
    setTtsStatus('loading');
    const audio = new Audio();
    audioRef.current = audio;
    audio.loop = false;
    audio.onloadedmetadata = () => setAudioDuration(audio.duration);
    audio.ontimeupdate = () => setAudioCurrentTime(audio.currentTime);
    audio.oncanplay = () => setTtsStatus('ready');
    audio.onplay = () => { setTtsStatus('playing'); setCurrentAudioUrl(ttsEntry.audioUrl); setUserPaused(false); };
    audio.onpause = () => { if (!audio.ended) setTtsStatus('paused'); };
    audio.onended = () => { setTtsStatus('ready'); setAudioCurrentTime(0); setCurrentAudioUrl(null); setIsPlayingAudio(false); setWaitingForUser(true); };
    audio.onerror = () => { setTtsStatus('error'); setCurrentAudioUrl(null); setIsPlayingAudio(false); setWaitingForUser(true); };
    audio.src = ttsEntry.audioUrl;
    audio.play().catch(() => { setTtsStatus('error'); setIsPlayingAudio(false); setWaitingForUser(true); });
  }, [isMuted, getTTSForCurrentPhase, isPlayingAudio, cleanupAudio]);

  const pauseTTS = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); setUserPaused(true); }
  }, []);

  const resumeTTS = useCallback(() => {
    if (ttsStatus !== 'paused') return;
    if (audioRef.current) { audioRef.current.play().catch(() => {}); setUserPaused(false); }
    else { playTTS(); setUserPaused(false); }
  }, [ttsStatus, playTTS]);

  const stopTTS = useCallback(() => { cleanupAudio(); setTtsStatus('ready'); }, [cleanupAudio]);

  useEffect(() => {
    if (
      !lessonReady || !['intro', 'explanation', 'outro'].includes(lessonPhase) ||
      ttsData.length === 0 || ttsStatus !== 'ready' || isMuted || userPaused ||
      isPlayingAudio || lastPlayedPhaseRef.current === lessonPhase
    ) return;
    lastPlayedPhaseRef.current = lessonPhase;
    setWaitingForUser(false);
    const t = setTimeout(() => playTTS(), 800);
    return () => clearTimeout(t);
  }, [lessonReady, lessonPhase, ttsData.length, ttsStatus, isMuted, userPaused, isPlayingAudio, playTTS]);

  // ── Lesson flow handlers ──
  const handleStartLesson = useCallback(() => {
    setShowWelcomeScreen(false);
    setLessonReady(true);
    setLessonPhase('intro');
    setCurrentScriptIndex(0);
    lastPlayedPhaseRef.current = null;
    setDrawerOpen(true);
  }, []);

  const handleContinue = useCallback(() => {
    stopTTS();
    setTtsStatus('ready');
    setWaitingForUser(false);
    lastPlayedPhaseRef.current = null;
    if (lessonPhase === 'intro') { setLessonPhase('explanation'); setCurrentScriptIndex(1); }
    else if (lessonPhase === 'explanation') { setLessonPhase('outro'); setCurrentScriptIndex(2); }
    else if (lessonPhase === 'outro') {
      if (mcqs.length > 0) { setLessonPhase('quiz'); setDrawerOpen(true); }
      else setLessonPhase('completed');
    }
  }, [lessonPhase, mcqs.length, stopTTS]);

  const handleReplay = useCallback(() => {
    lastPlayedPhaseRef.current = null;
    stopTTS();
    setWaitingForUser(false);
    setTimeout(() => playTTS(), 200);
  }, [stopTTS, playTTS]);

  const handleMcqSelect = (optionIndex: number) => { if (!showMcqResult) setSelectedAnswer(optionIndex); };

  const handleMcqSubmit = () => {
    if (selectedAnswer === null || !currentMcq) return;
    setMcqAnswers((prev) => ({ ...prev, [currentMcq.id]: selectedAnswer }));
    setShowMcqResult(true);
  };

  const handleMcqNext = () => {
    setShowMcqResult(false);
    setSelectedAnswer(null);
    if (currentMcqIndex < mcqs.length - 1) {
      setCurrentMcqIndex((prev) => prev + 1);
    } else {
      // All questions answered — transition to completed
      setLessonPhase('completed');
    }
  };

  const isTeacherMode = urlRole === 'teacher' || Boolean(sessionId && studentUid && joinedSession && joinedSession.teacher_uid === studentUid);
  const isStudentInSession = Boolean(sessionId && studentUid && joinedSession && !isTeacherMode);

  // Safeguard: if quiz phase but no more questions, force completed
  useEffect(() => {
    if (lessonPhase === 'quiz' && mcqs.length > 0 && currentMcqIndex >= mcqs.length) {
      setLessonPhase('completed');
    }
    if (lessonPhase === 'quiz' && mcqs.length === 0) {
      setLessonPhase('completed');
    }
  }, [lessonPhase, currentMcqIndex, mcqs.length]);

  // ── Language switch: re-fetch bundle ──
  const fetchBundleForLang = useCallback((newLang: LanguageCode) => {
    const chapterId = searchParams.get('chapterId')?.trim();
    const topicId = searchParams.get('topicId')?.trim() || undefined;
    const idToken = searchParams.get('idToken')?.trim();
    if (!chapterId || !idToken) return;
    setLangLoading(true);
    const url = `${getApiBaseUrl()}/lesson-bundle?chapterId=${encodeURIComponent(chapterId)}&topicId=${encodeURIComponent(topicId || '')}&lang=${encodeURIComponent(newLang)}`;
    fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Non-JSON response');
        if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error || `HTTP ${res.status}`); }
        return res.json();
      })
      .then((bundleRes) => {
        setBundle({
          tts: (bundleRes.tts || []).map((t: any) => ({ id: t.id, section: t.script_type || t.section || 'full', audioUrl: t.audio_url || t.audioUrl || t.url || '' })),
          mcqs: (bundleRes.mcqs || []).map((m: any) => ({ id: m.id, question: m.question || m.question_text || '', options: m.options || [], correctAnswer: m.correct_option_index ?? 0, explanation: m.explanation })),
          avatarScripts: bundleRes.avatarScripts || null,
          chapter: bundleRes.chapter || {},
          topic: bundleRes.topic,
        });
        stopTTS();
        lastPlayedPhaseRef.current = null;
        setCurrentMcqIndex(0);
        setMcqAnswers({});
        setSelectedAnswer(null);
        setShowMcqResult(false);
        setLessonPhase('intro');
        setCurrentScriptIndex(0);
        setWaitingForUser(false);
        setLessonReady(true);
        setLangLoading(false);
      })
      .catch((err) => {
        console.warn('[VRPlayerStandalone] lang re-fetch failed:', err?.message);
        setLangLoading(false);
      });
  }, [searchParams, stopTTS]);

  const handleLangChange = useCallback((newLang: LanguageCode) => {
    if (newLang === lang || langLoading) return;
    setLang(newLang);
    fetchBundleForLang(newLang);
  }, [lang, langLoading, fetchBundleForLang]);

  // ── Firebase auth exchange ──
  useEffect(() => {
    const idToken = searchParams.get('idToken')?.trim();
    if (!idToken) {
      console.warn('[VRPlayerStandalone] No idToken in URL — Firestore writes will likely be denied');
      setFirebaseAuthReady(true);
      return;
    }
    let cancelled = false;
    const base = getApiBaseUrl().replace(/\/$/, '');
    fetch(`${base}/auth/custom-token`, { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error(`API returned non-JSON (${ct || 'no content-type'}). Status ${res.status}`);
        if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error || `HTTP ${res.status}`); }
        return res.json();
      })
      .then(async (data: { customToken?: string }) => {
        if (cancelled || !data?.customToken) return;
        await signInWithCustomToken(auth, data.customToken);
        console.log('[VRPlayerStandalone] Firebase auth OK — uid:', auth.currentUser?.uid);
        if (!cancelled) setFirebaseAuthReady(true);
      })
      .catch((err) => {
        console.error('[VRPlayerStandalone] Firebase auth exchange FAILED:', err?.message || err);
        console.warn('[VRPlayerStandalone] Firestore writes (lesson_launches, student_scores, session progress) will likely fail');
        if (!cancelled) setFirebaseAuthReady(true);
      });
    return () => { cancelled = true; };
  }, [searchParams]);

  // ── Class session sync ──
  useEffect(() => {
    if (!sessionId || !firebaseAuthReady) return;
    const unsub = subscribeSession(sessionId, (session) => setJoinedSession(session), (err) => console.warn('[VRPlayerStandalone] subscribeSession error:', err));
    return () => unsub();
  }, [sessionId, firebaseAuthReady]);

  const lastTeacherViewRef = useRef<{ h: number; v: number; fov: number; syncId: number | null } | null>(null);
  useEffect(() => {
    if (!isStudentInSession || !joinedSession?.teacher_view || !krpanoViewerRef.current?.call) return;
    const tv = joinedSession.teacher_view;
    const h = Number(tv.hlookat); const v = Number(tv.vlookat); const fov = Number(tv.fov ?? 90);
    const syncId = typeof tv.sync_id === 'number' && Number.isFinite(tv.sync_id) ? tv.sync_id : null;
    if (Number.isNaN(h) || Number.isNaN(v)) return;
    const prev = lastTeacherViewRef.current;
    const isNewDirect = syncId != null && syncId !== prev?.syncId;
    if (prev && prev.h === h && prev.v === v && prev.fov === fov && !isNewDirect) {
      return;
    }
    lastTeacherViewRef.current = { h, v, fov, syncId };
    applyTeacherViewToKrpano(
      krpanoViewerRef.current,
      { hlookat: h, vlookat: v, fov, sync_id: syncId ?? undefined },
      { force: isNewDirect }
    );
  }, [isStudentInSession, joinedSession?.teacher_view?.hlookat, joinedSession?.teacher_view?.vlookat, joinedSession?.teacher_view?.fov, joinedSession?.teacher_view?.sync_id]);

  useEffect(() => {
    if (isTeacherMode || isViewOnly || !sessionId || !studentUid || !firebaseAuthReady) return;
    const name = auth.currentUser?.displayName ?? urlDisplayName ?? undefined;
    const mail = auth.currentUser?.email ?? urlEmail ?? undefined;
    reportSessionProgress(sessionId, studentUid, name ?? undefined, 'loading', undefined, undefined, mail ?? undefined).catch(() => {});
  }, [isTeacherMode, isViewOnly, sessionId, studentUid, firebaseAuthReady, urlDisplayName, urlEmail]);

  const phaseMap: Record<LessonPhase, SessionLessonPhase> = { loading: 'loading', intro: 'intro', explanation: 'explanation', outro: 'outro', quiz: 'quiz', completed: 'completed' };
  useEffect(() => {
    if (isTeacherMode || isViewOnly || !sessionId || !studentUid || !firebaseAuthReady) return;
    const name = auth.currentUser?.displayName ?? urlDisplayName ?? undefined;
    const mail = auth.currentUser?.email ?? urlEmail ?? undefined;
    const phase = phaseMap[lessonPhase] ?? 'idle';
    if (phase === 'completed' && mcqs.length > 0) {
      const correct = mcqs.filter((m) => mcqAnswers[m.id] === m.correctAnswer).length;
      reportSessionProgress(sessionId, studentUid, name ?? undefined, phase, undefined, {
        score: correct, total: mcqs.length,
        answers: mcqs.map((m, idx) => ({ question_index: idx, correct: mcqAnswers[m.id] === m.correctAnswer, selected_option_index: mcqAnswers[m.id] ?? -1 })),
      }, mail ?? undefined).catch((err) => console.error('[VRPlayerStandalone] reportSessionProgress (completed):', err));
    } else {
      reportSessionProgress(sessionId, studentUid, name ?? undefined, phase, undefined, undefined, mail ?? undefined).catch((err) => console.error('[VRPlayerStandalone] reportSessionProgress:', err));
    }
  }, [isTeacherMode, sessionId, studentUid, firebaseAuthReady, lessonPhase, mcqs.length, mcqAnswers, urlDisplayName, urlEmail]);

  useEffect(() => {
    if (!isStudentInSession || !sessionId || !studentUid || status !== 'ready' || !firebaseAuthReady) return;
    let lastReported = 0;
    const throttleMs = 220;
    const onViewChange = (h: number, v: number, fov: number) => {
      const now = Date.now();
      if (now - lastReported < throttleMs) return;
      lastReported = now;
      reportStudentView(sessionId, studentUid!, { hlookat: h, vlookat: v, fov }).catch(() => {});
    };
    (window as unknown as { __krpanoOnViewChange?: (h: number, v: number, fov: number) => void }).__krpanoOnViewChange = onViewChange;
    krpanoViewerRef.current?.call?.('sync_view_to_js');
    const t = setTimeout(() => krpanoViewerRef.current?.call?.('sync_view_to_js'), 400);
    return () => { clearTimeout(t); (window as unknown as { __krpanoOnViewChange?: unknown }).__krpanoOnViewChange = undefined; };
  }, [isStudentInSession, sessionId, studentUid, status, firebaseAuthReady]);

  // ── Teacher mode: broadcast view to all students ──
  useEffect(() => {
    if (!isTeacherMode || !sessionId || !studentUid || status !== 'ready' || !firebaseAuthReady) return;
    console.log('[VRPlayerStandalone] Teacher broadcast effect active', { sessionId, studentUid });
    let lastSent = 0;
    const throttleMs = 100;
    let broadcastFails = 0;
    const onViewChange = (h: number, v: number, fov: number) => {
      const now = Date.now();
      if (now - lastSent < throttleMs) return;
      lastSent = now;
      updateTeacherView(sessionId, studentUid!, { hlookat: h, vlookat: v, fov })
        .then((ok) => { if (!ok && broadcastFails < 3) { broadcastFails++; console.warn('[VRPlayerStandalone] updateTeacherView returned false — UID mismatch or session not found'); } })
        .catch((err) => console.error('[VRPlayerStandalone] updateTeacherView failed:', err));
    };
    (window as unknown as { __krpanoOnViewChange?: (h: number, v: number, fov: number) => void }).__krpanoOnViewChange = onViewChange;
    console.log('[VRPlayerStandalone] __krpanoOnViewChange set:', typeof (window as any).__krpanoOnViewChange);
    krpanoViewerRef.current?.call?.('sync_view_to_js');
    const t1 = setTimeout(() => krpanoViewerRef.current?.call?.('sync_view_to_js'), 400);
    const t2 = setTimeout(() => krpanoViewerRef.current?.call?.('sync_view_to_js'), 1500);
    let pollCount = 0;
    const poll = setInterval(() => {
      pollCount++;
      krpanoViewerRef.current?.call?.('sync_view_to_js');
      if (pollCount >= 15) clearInterval(poll);
    }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(poll); (window as unknown as { __krpanoOnViewChange?: unknown }).__krpanoOnViewChange = undefined; };
  }, [isTeacherMode, sessionId, studentUid, status, firebaseAuthReady]);

  // ── Lesson tracking: create launch record when lesson starts (student only) ──
  useEffect(() => {
    if (isTeacherMode || isViewOnly || !lessonReady || !firebaseAuthReady || !studentUid || !urlSchoolId) return;
    if (launchIdRef.current) return;
    const chapterId = searchParams.get('chapterId')?.trim();
    const topicId = searchParams.get('topicId')?.trim() || '';
    if (!chapterId) return;

    const chapter = bundle?.chapter as Record<string, any> | undefined;
    const curriculum = (chapter?.curriculum as string) || '';
    const className = (chapter?.class_name as string) || '';
    const subject = (chapter?.subject as string) || '';

    const minimalProfile: UserProfile = {
      uid: studentUid,
      email: urlEmail || auth.currentUser?.email || '',
      role: 'student',
      createdAt: '',
      school_id: urlSchoolId,
      class_ids: urlClassId ? [urlClassId] : [],
    };

    lessonStartTimeRef.current = Date.now();
    trackLessonLaunch(minimalProfile, chapterId, topicId, curriculum, className, subject, 'mobile_vr')
      .then((id) => { if (id) launchIdRef.current = id; })
      .catch((err) => console.error('[VRPlayerStandalone] trackLessonLaunch failed:', err));
  }, [lessonReady, firebaseAuthReady, studentUid, urlSchoolId, urlClassId, bundle?.chapter, searchParams, urlEmail]);

  // ── Lesson tracking: mark completed and save quiz score (student only) ──
  useEffect(() => {
    if (isTeacherMode || isViewOnly || lessonPhase !== 'completed' || !firebaseAuthReady || !studentUid || !urlSchoolId) return;
    const chapterId = searchParams.get('chapterId')?.trim();
    const topicId = searchParams.get('topicId')?.trim() || '';
    if (!chapterId) return;

    console.log('[VRPlayerStandalone] Completion effect fired', { lessonPhase, firebaseAuthReady, studentUid, urlSchoolId, launchId: launchIdRef.current });

    const chapter = bundle?.chapter as Record<string, any> | undefined;
    const curriculum = (chapter?.curriculum as string) || '';
    const className = (chapter?.class_name as string) || '';
    const subject = (chapter?.subject as string) || '';

    const minimalProfile: UserProfile = {
      uid: studentUid,
      email: urlEmail || auth.currentUser?.email || '',
      role: 'student',
      createdAt: '',
      school_id: urlSchoolId,
      class_ids: urlClassId ? [urlClassId] : [],
    };

    const durationSeconds = lessonStartTimeRef.current > 0
      ? Math.round((Date.now() - lessonStartTimeRef.current) / 1000)
      : undefined;

    const doComplete = async () => {
      if (!launchIdRef.current) {
        console.warn('[VRPlayerStandalone] launchIdRef null at completion — creating fallback launch record');
        try {
          const id = await trackLessonLaunch(minimalProfile, chapterId, topicId, curriculum, className, subject, 'mobile_vr');
          if (id) launchIdRef.current = id;
        } catch (err) { console.error('[VRPlayerStandalone] fallback trackLessonLaunch failed:', err); }
      }
      if (launchIdRef.current) {
        updateLessonLaunch(launchIdRef.current, 'completed', durationSeconds)
          .catch((err) => console.error('[VRPlayerStandalone] updateLessonLaunch failed:', err));
      }

      if (mcqs.length > 0) {
        const topic = bundle?.topic as Record<string, any> | undefined;
        const topicObjective = (topic?.topic_objective as string) || '';
        const correct = mcqs.filter((m) => mcqAnswers[m.id] === m.correctAnswer).length;
        const total = mcqs.length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        saveQuizScore(
          minimalProfile, chapterId, topicId, curriculum, className, subject,
          { correct, total, percentage },
          mcqAnswers, 1, durationSeconds,
          launchIdRef.current ?? undefined,
          topicObjective || undefined,
          'mobile_vr'
        ).catch((err) => console.error('[VRPlayerStandalone] saveQuizScore failed:', err));
      }
    };
    doComplete();
  }, [lessonPhase, firebaseAuthReady, studentUid, urlSchoolId, urlClassId, mcqs, mcqAnswers, bundle, searchParams, urlEmail]);

  // ── Fetch bundle and embed krpano ──
  useEffect(() => {
    cancelledRef.current = false;
    const chapterId = searchParams.get('chapterId')?.trim();
    const topicId = searchParams.get('topicId')?.trim() || undefined;
    const idToken = searchParams.get('idToken')?.trim();

    if (!chapterId || !idToken) { setStatus('error'); setErrorMessage('Missing chapterId or idToken in URL.'); return; }

    setStatus('loading');
    const url = `${getApiBaseUrl()}/lesson-bundle?chapterId=${encodeURIComponent(chapterId)}&topicId=${encodeURIComponent(topicId || '')}&lang=${encodeURIComponent(lang)}`;

    fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } })
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const snippet = await res.text().then((t) => t.slice(0, 120)).catch(() => '');
          throw new Error(`Lesson bundle API returned HTML instead of JSON (status ${res.status}). The API may be unreachable. Response: ${snippet}`);
        }
        if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error || `HTTP ${res.status}`); }
        return res.json();
      })
      .then(async (bundleRes) => {
        if (cancelledRef.current) return;
        const skybox = bundleRes.skybox;
        const skyboxUrl = skybox?.imageUrl || skybox?.file_url || (skybox as any)?.skybox_url;
        if (!skyboxUrl) { setStatus('error'); setErrorMessage('Lesson has no skybox image.'); return; }

        const sphereUrlForKrpano = isFirebaseStorage(skyboxUrl) ? skyboxUrl : getProxyAssetUrl(skyboxUrl);
        const rawGlbUrls: string[] = [];
        for (const a of (bundleRes.assets3d || [])) {
          const glb = pickBundleGlbUrl(a);
          if (glb && isGlbOrGltfUrl(glb) && !rawGlbUrls.includes(glb)) rawGlbUrls.push(glb);
        }
        const hasRenderAssetUrls = rawGlbUrls.some((assetUrl) => isRenderAssetUrl(assetUrl));
        const renderAssetBridgeReady = hasRenderAssetUrls ? await ensureRenderAssetBridgeReady() : false;
        if (cancelledRef.current) return;

        const preparedAssetUrls: string[] = [];
        for (const rawUrl of rawGlbUrls) {
          if (isRenderAssetUrl(rawUrl)) {
            if (renderAssetBridgeReady) {
              preparedAssetUrls.push(toRenderAssetBridgeUrl(rawUrl));
            } else {
              console.warn('[VRPlayerStandalone] Skipping Firebase render asset because the render bridge is not ready:', rawUrl);
            }
          } else {
            preparedAssetUrls.push(toKrpanoThreeJsAssetUrl(rawUrl));
          }
        }
        const threeJsAssetUrls = preparedAssetUrls.filter(Boolean);
        console.log('[VRPlayerStandalone] Prepared krpano 3D asset URLs:', threeJsAssetUrls);

        setBundle({
          tts: (bundleRes.tts || []).map((t: any) => ({ id: t.id, section: t.script_type || t.section || 'full', audioUrl: t.audio_url || t.audioUrl || t.url || '' })),
          mcqs: (bundleRes.mcqs || []).map((m: any) => ({ id: m.id, question: m.question || m.question_text || '', options: m.options || [], correctAnswer: m.correct_option_index ?? 0, explanation: m.explanation })),
          avatarScripts: bundleRes.avatarScripts || null,
          chapter: bundleRes.chapter || {},
          topic: bundleRes.topic,
        });

        loadKrpanoScript()
          .then(() => {
            if (cancelledRef.current) return;
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const avatarModelUrl = origin + '/models/avatar3.glb';
            const xml = buildKrpanoXml({ sphereUrl: sphereUrlForKrpano, basePath: '/krpano/', origin, webvr: !isViewOnly, threeJsAssetUrls: threeJsAssetUrls.length > 0 ? threeJsAssetUrls : undefined, avatarModelUrl: isViewOnly ? undefined : avatarModelUrl, hlookat: initH, vlookat: initV, fov: initFov });
            embedKrpano({
              xml, target: KRPANO_CONTAINER_ID, basepath: '/krpano/',
              onready: (krpano: unknown) => { if (!cancelledRef.current) { krpanoViewerRef.current = krpano as { call?: (action: string) => void }; setStatus('ready'); } },
              onerror: (msg) => { if (!cancelledRef.current) { setStatus('error'); setErrorMessage(msg || 'Krpano failed to load.'); } },
            });
          })
          .catch((err) => { if (!cancelledRef.current) { setStatus('error'); setErrorMessage(err?.message || 'Failed to load player.'); } });
      })
      .catch((err) => { if (!cancelledRef.current) { setStatus('error'); setErrorMessage(err?.message || 'Failed to load lesson bundle.'); } });

    return () => { cancelledRef.current = true; cleanupAudio(); };
  }, [searchParams, lang, cleanupAudio]);

  const topicName = (bundle?.topic as any)?.topic_name ?? (bundle?.chapter as any)?.chapter_name ?? 'Lesson';
  const audioProgress = audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0;

  const continueLabel = (() => {
    if (waitingForUser) {
      if (lessonPhase === 'outro' && mcqs.length > 0) return 'Start Quiz';
      if (lessonPhase === 'outro') return 'Complete';
      return 'Continue';
    }
    return isPlayingAudio ? 'Listening…' : 'Continue';
  })();

  // ── Render ──
  // Krpano control zones (must never be covered):
  //   Enter VR / Exit VR : align="top" y=24       → top-center (~60px)
  //   VR Setup           : align="bottom" y=24    → bottom-center
  //   Joypad             : align="rightbottom"     → bottom-right
  //   Level control      : align="rightbottom"     → bottom-right (above joypad)
  //
  // Strategy: ONE centred bottom-edge drawer (left-of-centre to dodge joypad).
  //   Collapsed = thin handle bar. Expanded = slide-up card. Never blocks Krpano.
  //   All containers pointer-events-none; only interactive children get pointer-events-auto.

  const showDrawer = !isTeacherMode && !isViewOnly && lessonPhase !== 'completed' && (
    ['intro', 'explanation', 'outro', 'loading'].includes(lessonPhase) || (lessonPhase === 'quiz' && !!currentMcq)
  );
  const isScriptPhase = ['intro', 'explanation', 'outro', 'loading'].includes(lessonPhase);

  // Teacher / viewOnly mode: auto-start (skip welcome screen) once ready
  useEffect(() => {
    if ((isTeacherMode || isViewOnly) && status === 'ready' && showWelcomeScreen) {
      setShowWelcomeScreen(false);
      setLessonReady(true);
    }
  }, [isTeacherMode, isViewOnly, status, showWelcomeScreen]);

  return (
    <div className="fixed inset-0 w-full h-full bg-black select-none">
      <div id={KRPANO_CONTAINER_ID} className="w-full h-full" />

      {/* Teacher mode: control indicator */}
      {isTeacherMode && status === 'ready' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-violet-500/30">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">Controlling class view</span>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white z-30">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-white/70">Loading lesson…</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white p-4 z-30">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">!</span>
            </div>
            <p className="text-red-400 text-sm font-medium mb-1">Something went wrong</p>
            <p className="text-xs text-white/60">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Welcome screen (student only) */}
      {status === 'ready' && showWelcomeScreen && !isTeacherMode && !isViewOnly && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30">
          <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-w-xs mx-4 text-center">
            <h2 className="text-lg font-bold text-white mb-1">{topicName}</h2>
            <p className="text-xs text-white/50 mb-4">
              {scripts.length > 0 && `${scripts.length} sections`}
              {scripts.length > 0 && mcqs.length > 0 && ' · '}
              {mcqs.length > 0 && `${mcqs.length} questions`}
            </p>

            <div className="flex justify-center mb-5">
              <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-0.5">
                {(['en', 'hi'] as LanguageCode[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => handleLangChange(l)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      lang === l ? 'bg-cyan-500/30 text-cyan-300' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {LANG_FLAGS[l]} {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartLesson}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.97] text-white text-sm font-semibold transition-all"
            >
              Start Lesson
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ACTIVE LESSON HUD — centred bottom drawer design
          All containers: pointer-events-none. Only buttons: pointer-events-auto.
          ══════════════════════════════════════════════════════════════ */}
      {status === 'ready' && lessonReady && !showWelcomeScreen && (
        <>
          {/* ─── CENTRED BOTTOM DRAWER ─── */}
          {showDrawer && (hudVisible || drawerOpen) && (
            <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex justify-center pb-3 px-3">
              {/* Drawer container — max-w keeps it from reaching joypad on right */}
              <div
                className="pointer-events-auto w-full"
                style={{ maxWidth: 340 }}
              >
                {/* ── COLLAPSED: thin handle bar ── */}
                {!drawerOpen ? (
                  <button
                    type="button"
                    onClick={() => { setDrawerOpen(true); resetHudTimer(); }}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/[0.08] active:scale-[0.98] transition-all"
                  >
                    {/* Grab handle */}
                    <div className="w-8 h-0.5 rounded-full bg-white/30" />
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${phaseMeta.color.replace('/60', '')}`} />
                      <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider truncate">{phaseMeta.label}</span>
                      {isScriptPhase && (
                        <div className="flex gap-0.5">
                          {['intro', 'explanation', 'outro'].map((p, i) => (
                            <span key={p} className={`w-1 h-1 rounded-full ${
                              p === lessonPhase ? 'bg-cyan-400' : i <= ['intro', 'explanation', 'outro'].indexOf(lessonPhase) ? 'bg-white/50' : 'bg-white/15'
                            }`} />
                          ))}
                        </div>
                      )}
                      {lessonPhase === 'quiz' && (
                        <span className="text-[9px] text-amber-400 font-bold">Q{currentMcqIndex + 1}/{mcqs.length}</span>
                      )}
                    </div>
                    <div className="w-8 h-0.5 rounded-full bg-white/30" />
                  </button>
                ) : (
                  /* ── EXPANDED: slide-up card ── */
                  <div className="bg-black/75 backdrop-blur-2xl rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl shadow-black/60">

                    {/* ── Header: chapter name + controls + collapse ── */}
                    <div className="flex items-center gap-2 px-3.5 pt-3 pb-2 border-b border-white/[0.06]">
                      {/* Phase indicator dot */}
                      <div className={`shrink-0 w-2 h-2 rounded-full ${phaseMeta.color.replace('/60', '')}`} />

                      {/* Chapter / topic name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider leading-none mb-0.5">{phaseMeta.label}</p>
                        <p className="text-[11px] text-white/90 font-semibold truncate leading-tight">{topicName}</p>
                      </div>

                      {/* Controls cluster */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Language */}
                        <div className="inline-flex rounded-full bg-white/5 border border-white/[0.08] p-px">
                          {(['en', 'hi'] as LanguageCode[]).map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => handleLangChange(l)}
                              disabled={langLoading}
                              className={`w-6 h-5 flex items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                                lang === l ? 'bg-white/15 text-white' : 'text-white/30'
                              } disabled:opacity-40`}
                            >
                              {LANG_FLAGS[l]}
                            </button>
                          ))}
                        </div>

                        {/* Mute */}
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className={`w-6 h-6 flex items-center justify-center rounded-full border border-white/[0.08] transition-all ${
                            isMuted ? 'bg-red-500/25 text-red-300' : 'bg-white/5 text-white/50'
                          }`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {isMuted
                              ? <><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                              : <><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 010 7.07" /></>
                            }
                          </svg>
                        </button>

                        {/* Collapse */}
                        <button
                          onClick={() => setDrawerOpen(false)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/[0.08] text-white/40 hover:text-white transition-all"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ── Script phase body ── */}
                    {isScriptPhase && (
                      <div className="px-3.5 pt-2.5 pb-3">
                        {/* Audio progress */}
                        {isPlayingAudio && audioDuration > 0 && (
                          <div className="h-[3px] rounded-full bg-white/10 mb-2.5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-300" style={{ width: `${audioProgress}%` }} />
                          </div>
                        )}

                        {/* Script text */}
                        <p className="text-[11px] leading-[1.55] text-white/75 line-clamp-3 mb-3">
                          {currentScript || 'Listen to the narration…'}
                        </p>

                        {/* Action row */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleReplay}
                            disabled={isPlayingAudio || !currentScript}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white disabled:opacity-25 transition-all"
                            title="Replay"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 105.69-12.78L1 10" />
                            </svg>
                          </button>

                          <button
                            onClick={handleContinue}
                            disabled={isPlayingAudio && !waitingForUser}
                            className={`flex-1 h-8 text-[11px] font-semibold rounded-xl transition-all ${
                              waitingForUser
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.97]'
                                : isPlayingAudio
                                  ? 'bg-white/[0.04] text-white/30 cursor-default'
                                  : 'bg-white/[0.06] text-white/50'
                            }`}
                          >
                            {continueLabel}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Quiz phase body ── */}
                    {lessonPhase === 'quiz' && currentMcq && (
                      <div className="px-3.5 pt-2.5 pb-3 max-h-[55vh] overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-bold text-amber-400/90 uppercase tracking-widest">Question {currentMcqIndex + 1} of {mcqs.length}</span>
                        </div>

                        <p className="text-[12px] text-white/90 font-medium leading-snug mb-3">{currentMcq.question}</p>

                        <div className="space-y-1.5 mb-3">
                          {currentMcq.options.map((option, idx) => {
                            const isSelected = selectedAnswer === idx;
                            const isCorrect = idx === currentMcq.correctAnswer;
                            const showCorrect = showMcqResult && isCorrect;
                            const showWrong = showMcqResult && isSelected && !isCorrect;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleMcqSelect(idx)}
                                disabled={showMcqResult}
                                className={`w-full text-left px-3 py-2 rounded-xl border text-[11px] transition-all ${
                                  showCorrect ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : showWrong ? 'bg-red-500/15 border-red-500/40 text-red-300'
                                  : isSelected ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                  : 'bg-white/[0.03] border-white/[0.08] text-white/70 active:bg-white/[0.06]'
                                }`}
                              >
                                <span className="font-bold text-white/40 mr-1.5">{String.fromCharCode(65 + idx)}</span>{option}
                              </button>
                            );
                          })}
                        </div>

                        {showMcqResult && currentMcq.explanation && (
                          <p className="text-[10px] text-white/45 mb-3 leading-relaxed">{currentMcq.explanation}</p>
                        )}

                        {!showMcqResult ? (
                          <button
                            onClick={handleMcqSubmit}
                            disabled={selectedAnswer === null}
                            className="w-full h-9 text-[11px] font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-white disabled:opacity-30 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/15"
                          >
                            Submit Answer
                          </button>
                        ) : (
                          <button
                            onClick={handleMcqNext}
                            className="w-full h-9 text-[11px] font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white transition-all active:scale-[0.97] shadow-lg shadow-emerald-500/15"
                          >
                            {currentMcqIndex < mcqs.length - 1 ? 'Next Question' : 'See Results'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── COMPLETED overlay (student only) ─── */}
          {lessonPhase === 'completed' && !isTeacherMode && !isViewOnly && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-30">
              <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-w-xs mx-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🏆</span>
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Lesson Complete!</h2>
                <p className="text-xs text-white/50 mb-2">{topicName}</p>
                {mcqs.length > 0 && (
                  <p className="text-2xl font-bold text-emerald-400 mb-3">
                    {mcqs.filter((m) => mcqAnswers[m.id] === m.correctAnswer).length}/{mcqs.length}
                  </p>
                )}
                <button
                  onClick={() => window.history.back()}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.97] text-white text-sm font-semibold transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
