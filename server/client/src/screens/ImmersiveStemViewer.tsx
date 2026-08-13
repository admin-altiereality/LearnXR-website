import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLesson } from '../contexts/LessonContext';
import { buildNativeLicensedLesson } from '../lib/licensedContent';
import {
  getLicensedContentManifest,
  startLicensedEmbedSession,
  startLicensedExternalLink,
} from '../services/licensedContentService';
import type { LicensedContentManifest } from '../types/licensedContent';

export default function ImmersiveStemViewer() {
  const { contentId = '' } = useParams();
  const navigate = useNavigate();
  const { startLesson } = useLesson();
  const [manifest, setManifest] = useState<LicensedContentManifest | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [licenseEndsAt, setLicenseEndsAt] = useState<string | null>(null);
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
        if (loaded.delivery_mode === 'external_link') {
          const externalSession = await startLicensedExternalLink(contentId);
          if (!cancelled) {
            setLaunchUrl(externalSession.launch_url);
            setLicenseEndsAt(externalSession.license_ends_at);
          }
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
          <h1 className="mt-5 text-2xl font-semibold">Licensed experience unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">{error}</p>
          <p className="mt-3 text-sm leading-6 text-white/65">
            The LearnXR curriculum lesson remains available even when a provider link or license is unavailable.
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

  if (manifest.delivery_mode === 'external_link') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#12181b] p-5 text-white">
        <section className="w-full max-w-2xl border border-white/15 bg-[#1b2428] p-7 sm:p-9">
          <div className="flex h-11 w-11 items-center justify-center bg-[#1f766d] text-white">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div className="mt-6 text-xs font-semibold uppercase text-white/50">Licensed Corinth 3D enrichment</div>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{manifest.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            This interactive model opens on the provider site. Your LearnXR lesson and class session stay available when you return.
          </p>
          {licenseEndsAt && (
            <p className="mt-4 text-xs text-white/45">
              Provider access currently licensed through {new Date(licenseEndsAt).toLocaleDateString()}.
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={launchUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
            >
              Open Corinth 3D <ExternalLink className="h-4 w-4" />
            </a>
            <button type="button" onClick={() => navigate('/immersive-stem')} className="inline-flex h-11 items-center gap-2 border border-white/20 px-5 text-sm font-semibold hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Back to library
            </button>
          </div>
        </section>
      </main>
    );
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
