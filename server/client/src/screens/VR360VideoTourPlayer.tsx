/**
 * 360° equirectangular video VR tour.
 * - Primary: krpano (videoplayer.js) for WebVR, drag, and class view sync.
 * - Fallback: Three.js + video texture if krpano fails to start.
 */

import { OrbitControls, useVideoTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { ArrowLeft, Glasses, Play, Square, Video, Volume2, VolumeX, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { getVr360TourById, type Vr360Player, type Vr360TourItem } from '../config/vr360Tours';
import { useAuth } from '../contexts/AuthContext';
import {
  reportSessionProgress,
  reportStudentView,
  subscribeSession,
  updateTeacherView,
} from '../services/classSessionService';
import { getStorageSafely } from '../utils/firebaseStorage';
import { buildKrpano360VideoXml } from '../lib/krpano/buildKrpano360VideoXml';
import { loadKrpanoScript, embedKrpano } from '../lib/krpano/embedKrpano';
import { Button } from '../Components/ui/button';

const VR360_TOUR_KEY = 'learnxr_vr360_tour';
const KRPANO_TARGET_ID = 'vr360-krpano-embed';
const TEACHER_VIEW_MS = 160;

export interface Vr360TourSessionPayload {
  tourId: string;
  title: string;
  videoPath: string;
  videoStoragePath?: string;
  player?: Vr360Player;
  fromClassSession?: boolean;
}

type KrpanoApi = { call: (a: string) => void; get?: (path: string) => unknown };

function VideoSphere({ url, muted, playing }: { url: string; muted: boolean; playing: boolean }) {
  const texture = useVideoTexture(url, { muted, start: false, crossOrigin: 'anonymous', loop: true, playsInline: true });
  const video = texture.image as HTMLVideoElement;

  useEffect(() => {
    if (playing) {
      const p = video.play();
      if (p !== undefined) p.catch(() => {});
    } else {
      video.pause();
    }
  }, [playing, video]);

  useEffect(() => {
    video.muted = muted;
  }, [muted, video]);

  return (
    <mesh>
      <sphereGeometry args={[500, 64, 64]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

function ViewSyncReporter({ sessionId, userUid, enabled }: { sessionId: string; userUid: string; enabled: boolean }) {
  const { camera } = useThree();
  const last = useRef<{ t: number; h: number; v: number; f: number } | null>(null);
  const tick = useRef(0);
  useFrame(() => {
    if (!enabled || !sessionId) return;
    tick.current += 1;
    if (tick.current % 30 !== 0) return;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const h = (Math.atan2(dir.x, -dir.z) * 180) / Math.PI;
    const v = (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI;
    const f = 'fov' in camera && typeof (camera as THREE.PerspectiveCamera).fov === 'number' ? (camera as THREE.PerspectiveCamera).fov : 90;
    const cur = { t: Date.now(), h, v, f };
    const prev = last.current;
    if (prev && Math.abs(prev.h - h) < 0.3 && Math.abs(prev.v - v) < 0.3) return;
    last.current = cur;
    void reportStudentView(sessionId, userUid, { hlookat: h, vlookat: v, fov: f });
  });
  return null;
}

const VR360VideoTourPlayer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [payload, setPayload] = useState<Vr360TourSessionPayload | null>(null);
  const [mergedTour, setMergedTour] = useState<Vr360TourItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [engine, setEngine] = useState<'krpano' | 'three' | 'pending'>('pending');
  const [inKrpanoVr, setInKrpanoVr] = useState(false);
  const krpanoRef = useRef<KrpanoApi | null>(null);
  const lastTeacherSend = useRef(0);
  const lastStudentReport = useRef(0);

  const syncRef = useRef({
    isTeacher: false,
    isStudent: false,
    classSessionId: null as string | null,
    userId: null as string | null,
  });

  const effectivePlayer: Vr360Player = payload?.player ?? mergedTour?.player ?? 'krpano';

  useEffect(() => {
    const fromState = (location.state as { vr360?: Vr360TourSessionPayload } | null)?.vr360;
    if (fromState?.tourId && (fromState.videoPath || fromState.videoStoragePath)) {
      const tour = getVr360TourById(fromState.tourId);
      setMergedTour(tour ?? null);
      setPayload({ ...fromState, videoPath: fromState.videoPath || tour?.videoPath || '' });
      try {
        sessionStorage.setItem(VR360_TOUR_KEY, JSON.stringify({ ...fromState, fromClassSession: fromState.fromClassSession }));
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const raw = sessionStorage.getItem(VR360_TOUR_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Vr360TourSessionPayload;
        if (p.tourId) {
          const tour = getVr360TourById(p.tourId);
          setMergedTour(tour ?? null);
          if (p.videoPath || p.videoStoragePath || tour) {
            setPayload({
              ...p,
              videoPath: p.videoPath || tour?.videoPath || '',
            });
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }
    const tourParam = searchParams.get('tour') || searchParams.get('id');
    if (tourParam) {
      const t = getVr360TourById(tourParam);
      if (t) {
        setMergedTour(t);
        setPayload({
          tourId: t.id,
          title: t.title,
          videoPath: t.videoPath,
          videoStoragePath: t.videoStoragePath,
          player: t.player,
          fromClassSession: false,
        });
        return;
      }
    }
    setLoadError('No video tour selected. Return to Lessons and choose a 360° tour.');
  }, [location.state, searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!payload) return;
      setUrlError(null);
      if (payload.videoPath?.startsWith('http')) {
        if (!cancelled) setResolvedUrl(payload.videoPath);
        return;
      }
      if (payload.videoStoragePath || mergedTour?.videoStoragePath) {
        const stPath = payload.videoStoragePath || mergedTour?.videoStoragePath;
        if (stPath) {
          const st = await getStorageSafely();
          if (cancelled) return;
          if (!st) {
            setUrlError('Storage not ready');
            if (payload.videoPath) if (!cancelled) setResolvedUrl(new URL(payload.videoPath, window.location.origin).href);
            return;
          }
          try {
            const url = await getDownloadURL(storageRef(st, stPath));
            if (!cancelled) setResolvedUrl(url);
            return;
          } catch (e) {
            console.warn('VR360: getDownloadURL failed, using local path if any', e);
            if (payload.videoPath) {
              if (!cancelled) setResolvedUrl(new URL(payload.videoPath, window.location.origin).href);
              return;
            }
            if (!cancelled) setUrlError('Could not load video from storage. Check login and that the file exists.');
            return;
          }
        }
      }
      if (payload.videoPath) {
        if (!cancelled) setResolvedUrl(new URL(payload.videoPath, window.location.origin).href);
      } else {
        if (!cancelled) setUrlError('No video URL');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, mergedTour?.videoStoragePath]);

  const classSessionId =
    typeof window !== 'undefined' ? sessionStorage.getItem('learnxr_class_session_id') : null;
  const isTeacher = profile?.role === 'teacher' && !!classSessionId && !!user?.uid;
  const isStudent = profile?.role === 'student' && !!classSessionId && !!user?.uid;
  const reportEnabled = isStudent;

  useEffect(() => {
    syncRef.current = {
      isTeacher,
      isStudent,
      classSessionId,
      userId: user?.uid ?? null,
    };
  }, [isTeacher, isStudent, classSessionId, user?.uid]);

  useEffect(() => {
    (window as unknown as { __krpanoOnViewChange?: (h: number, v: number, f: number) => void }).__krpanoOnViewChange = (
      h: number,
      v: number,
      f: number
    ) => {
      const r = syncRef.current;
      if (r.isStudent && r.classSessionId && r.userId) {
        const t = Date.now();
        if (t - lastStudentReport.current < 150) return;
        lastStudentReport.current = t;
        void reportStudentView(r.classSessionId, r.userId, { hlookat: h, vlookat: v, fov: f });
      }
      if (r.isTeacher && r.classSessionId && r.userId) {
        const t = Date.now();
        if (t - lastTeacherSend.current < TEACHER_VIEW_MS) return;
        lastTeacherSend.current = t;
        void updateTeacherView(r.classSessionId, r.userId, { hlookat: h, vlookat: v, fov: f });
      }
    };
    return () => {
      (window as unknown as { __krpanoOnViewChange?: unknown }).__krpanoOnViewChange = undefined;
    };
  }, []);

  useEffect(() => {
    if (!reportEnabled || !classSessionId || !user?.uid) return;
    const name = profile?.displayName || profile?.name || user.email || user.uid;
    const email = user.email || null;
    void reportSessionProgress(classSessionId, user.uid, name, 'exploration', null, undefined, email);
    const id = window.setInterval(() => {
      void reportSessionProgress(classSessionId, user.uid, name, 'exploration', null, undefined, email);
    }, 60000);
    return () => clearInterval(id);
  }, [reportEnabled, classSessionId, user?.uid, profile?.displayName, profile?.name, user?.email]);

  // Student: follow teacher_view
  useEffect(() => {
    if (!isStudent || !classSessionId) return;
    return subscribeSession(classSessionId, (session) => {
      const tv = session?.teacher_view;
      if (!tv) return;
      const k = krpanoRef.current;
      if (!k?.call) return;
      const h = Number(tv.hlookat);
      const v = Number(tv.vlookat);
      const f = tv.fov != null ? Number(tv.fov) : 80;
      if (!Number.isFinite(h) || !Number.isFinite(v)) return;
      try {
        k.call(`tween(view.hlookat,${h},view.vlookat,${v},view.fov,${f},time=0.28)`);
      } catch {
        /* ignore */
      }
    });
  }, [isStudent, classSessionId]);

  // Sync WebXR / krpano VR state so the toolbar can toggle Enter / Exit
  useEffect(() => {
    if (engine !== 'krpano') {
      setInKrpanoVr(false);
      return;
    }
    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      const viewer = krpanoRef.current;
      if (viewer?.get) {
        try {
          const flag = viewer.get('webvr.isenabled');
          const enabled = flag === true || flag === 'true' || flag === 1;
          setInKrpanoVr(enabled);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setTimeout(poll, 500);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const handleEnterVr = useCallback(() => {
    const k = krpanoRef.current;
    if (!k?.call) return;
    try {
      k.call('webvr.enterVR');
    } catch (e) {
      console.warn('[VR360] webvr.enterVR failed:', e);
    }
  }, []);

  const handleExitVr = useCallback(() => {
    const k = krpanoRef.current;
    if (!k?.call) return;
    try {
      k.call('webvr.exitVR');
    } catch (e) {
      console.warn('[VR360] webvr.exitVR failed:', e);
    }
  }, []);

  const onBack = useCallback(() => {
    navigate('/lessons', { replace: true });
  }, [navigate]);

  // krpano embed
  useEffect(() => {
    if (!resolvedUrl) return;
    if (effectivePlayer === 'three') {
      setEngine('three');
      return;
    }

    krpanoRef.current = null;
    setEngine('pending');

    let removed = false;
    const run = async () => {
      try {
        await loadKrpanoScript();
        if (removed) return;
        const container = document.getElementById(KRPANO_TARGET_ID);
        if (!container) return;
        container.innerHTML = '';
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
        const xml = buildKrpano360VideoXml({
          videoUrl: resolvedUrl,
          basePath: '/krpano/',
          origin,
          hlookat: 0,
          vlookat: 0,
          fov: 90,
          webvr: true,
        });
        embedKrpano({
          xml,
          target: KRPANO_TARGET_ID,
          basepath: '/krpano/',
          onready: (k) => {
            if (removed) return;
            krpanoRef.current = k as KrpanoApi;
            setEngine('krpano');
            try {
              (k as KrpanoApi).call('sync_view_to_js');
            } catch {
              /* optional */
            }
            setTimeout(() => {
              if (!krpanoRef.current) return;
              try {
                krpanoRef.current.call('sync_view_to_js');
              } catch {
                /* ignore */
              }
            }, 500);
          },
          onerror: (msg) => {
            console.warn('VR360 krpano error:', msg);
            if (!removed) setEngine('three');
          },
        });
      } catch (e) {
        console.warn('VR360 krpano load failed', e);
        if (!removed) setEngine('three');
      }
    };
    void run();
    return () => {
      removed = true;
      krpanoRef.current = null;
      const c = document.getElementById(KRPANO_TARGET_ID);
      if (c) c.innerHTML = '';
    };
  }, [resolvedUrl, effectivePlayer]);

  const threeUrl = useMemo(() => (resolvedUrl ? resolvedUrl : null), [resolvedUrl]);

  if (loadError || !payload) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-6 z-50">
        <p className="text-foreground text-center max-w-md">{loadError || 'Loading…'}</p>
        <Button onClick={() => navigate('/lessons')}>Back to Lessons</Button>
      </div>
    );
  }

  if (urlError && !resolvedUrl) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-6 z-50">
        <p className="text-foreground text-center max-w-md">{urlError}</p>
        <Button onClick={() => navigate('/lessons')}>Back to Lessons</Button>
      </div>
    );
  }

  const showKrpano = effectivePlayer !== 'three' && (engine === 'krpano' || engine === 'pending');
  const showThree = engine === 'three' || effectivePlayer === 'three';

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/*
        pointer-events-none on the bar so krpano’s own “Enter VR” layer receives clicks; children use pointer-events-auto.
      */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <Button variant="secondary" size="sm" onClick={onBack} className="gap-2 pointer-events-auto shrink-0" type="button">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-white/90 truncate max-w-[50%] select-none min-w-0">
          <Video className="h-4 w-4 shrink-0" />
          <span className="truncate">{payload.title}</span>
        </div>
        <div className="flex items-center gap-1 pointer-events-auto shrink-0">
          {showKrpano && engine === 'krpano' && (
            <Button
              variant={inKrpanoVr ? 'secondary' : 'default'}
              size="sm"
              className="gap-1.5"
              type="button"
              onClick={inKrpanoVr ? handleExitVr : handleEnterVr}
              aria-pressed={inKrpanoVr}
              aria-label={inKrpanoVr ? 'Exit VR' : 'Enter VR'}
            >
              {inKrpanoVr ? <X className="h-4 w-4" /> : <Glasses className="h-4 w-4" />}
              {inKrpanoVr ? 'Exit VR' : 'Enter VR'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMuted((m) => !m)}
            className="gap-1"
            type="button"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPlaying((p) => !p)} className="gap-1" type="button">
            {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? 'Pause' : 'Play'}
          </Button>
        </div>
      </div>

      {showKrpano && (
        <>
          <div id={KRPANO_TARGET_ID} className="h-full w-full" style={{ minHeight: '100vh' }} />
          {engine === 'pending' && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm pointer-events-none">
              Starting 360° player…
            </div>
          )}
        </>
      )}

      {showThree && threeUrl && (
        <Canvas
          className="h-full w-full"
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 0, 0.1], fov: 80, far: 2000, near: 0.1 }}
        >
          <color attach="background" args={['#050810']} />
          <Suspense fallback={null}>
            <VideoSphere url={threeUrl} muted={muted} playing={playing} />
          </Suspense>
          <OrbitControls enableZoom enablePan={false} rotateSpeed={-0.5} />
          {reportEnabled && classSessionId && user?.uid && (
            <ViewSyncReporter sessionId={classSessionId} userUid={user.uid} enabled />
          )}
        </Canvas>
      )}
    </div>
  );
};

export default VR360VideoTourPlayer;
