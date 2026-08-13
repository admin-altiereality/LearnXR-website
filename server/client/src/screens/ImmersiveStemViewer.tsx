import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLesson } from '../contexts/LessonContext';
import { buildNativeLicensedLesson } from '../lib/licensedContent';
import {
  getLicensedContentManifest,
  startLicensedEmbedSession,
} from '../services/licensedContentService';
import type { LicensedContentManifest } from '../types/licensedContent';

export default function ImmersiveStemViewer() {
  const { contentId = '' } = useParams();
  const navigate = useNavigate();
  const { startLesson } = useLesson();
  const [manifest, setManifest] = useState<LicensedContentManifest | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getLicensedContentManifest(contentId);
        if (cancelled) return;
        setManifest(loaded);
        if (loaded.delivery_mode === 'krpano_native') {
          const lesson = buildNativeLicensedLesson(loaded);
          sessionStorage.setItem('activeLesson', JSON.stringify(lesson));
          sessionStorage.setItem('learnxr_licensed_content_id', loaded.id);
          startLesson(lesson.chapter, lesson.topic);
          navigate('/vrlessonplayer-krpano', { replace: true });
          return;
        }
        const hostedSession = await startLicensedEmbedSession(contentId);
        if (!cancelled) setLaunchUrl(hostedSession.launch_url);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'This experience could not be launched.');
      }
    })();
    return () => { cancelled = true; };
  }, [contentId, navigate, startLesson]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#12181b] p-5 text-white">
        <section className="w-full max-w-xl border border-white/15 bg-[#1b2428] p-7">
          <ShieldAlert className="h-8 w-8 text-[#f2b95d]" />
          <h1 className="mt-5 text-2xl font-semibold">Hosted experience unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">{error}</p>
          <p className="mt-3 text-sm leading-6 text-white/65">
            LearnXR will not fall back to shared credentials or an expiring public link. This item becomes available after the provider SSO embed is licensed and configured.
          </p>
          <button type="button" onClick={() => navigate('/immersive-stem')} className="mt-6 inline-flex h-10 items-center gap-2 bg-white px-4 text-sm font-semibold text-black">
            <ArrowLeft className="h-4 w-4" /> Back to library
          </button>
        </section>
      </main>
    );
  }

  if (!manifest || !launchUrl) {
    return <div className="flex min-h-screen items-center justify-center bg-[#12181b] text-sm text-white/70"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Starting licensed experience</div>;
  }

  return (
    <main className="relative h-screen overflow-hidden bg-black">
      <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between bg-black/80 px-4 text-white backdrop-blur">
        <button type="button" onClick={() => navigate('/immersive-stem')} className="inline-flex h-9 items-center gap-2 px-2 text-sm font-semibold hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" /> Library
        </button>
        <div className="min-w-0 px-4 text-center">
          <div className="truncate text-sm font-semibold">{manifest.title}</div>
          <div className="text-xs text-white/55">Hosted by {manifest.provider}</div>
        </div>
        <ExternalLink className="h-4 w-4 text-white/55" />
      </header>
      <iframe
        title={manifest.title}
        src={launchUrl}
        className="h-full w-full border-0 pt-14"
        allow="fullscreen; xr-spatial-tracking"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}
