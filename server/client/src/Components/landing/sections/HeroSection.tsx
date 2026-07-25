import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { learnXRFontStyle } from '../../LearnXRTypography';
import { hero, META_APP_DOWNLOAD_URL } from '../data/landingContent';
import { LandingHeader } from '../LandingHeader';
import { MagneticButton } from '../ui/MagneticButton';

const LandingHeroScene = lazy(() => import('./LandingHeroScene'));

interface HeroSectionProps {
  onBookDemo: () => void;
  onLogin: () => void;
}

export const HeroSection = ({ onBookDemo, onLogin }: HeroSectionProps) => {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.2, once: false });
  const [canMountScene, setCanMountScene] = useState(false);

  useEffect(() => {
    if (!reduceMotion && inView) setCanMountScene(true);
  }, [inView, reduceMotion]);

  return (
    <section
      ref={sectionRef}
      id="hero"
      aria-labelledby="hero-heading"
      className="relative z-10 flex min-h-[100dvh] flex-col overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/50 to-[#050816]" aria-hidden />

      {!reduceMotion && canMountScene ? (
        <div className="absolute inset-0 z-0 opacity-90" aria-hidden>
          <Suspense fallback={null}>
            <LandingHeroScene active={inView} />
          </Suspense>
        </div>
      ) : (
        <div className="absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(109,40,217,0.25),transparent_60%)]" />
          <img
            src={hero.images.vr}
            alt=""
            className="absolute bottom-0 right-0 w-[min(55vw,480px)] opacity-30"
            loading="eager"
          />
          <img
            src={hero.images.astro}
            alt=""
            className="absolute left-[8%] top-[22%] w-[min(28vw,200px)] opacity-40"
            loading="eager"
          />
        </div>
      )}

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <LandingHeader onBookDemo={onBookDemo} onLogin={onLogin} />

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-8 text-center sm:px-8">
          <h1
            id="hero-heading"
            className="inline-block max-w-full break-words text-5xl leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl xl:text-[9rem] xl:tracking-[0.5rem]"
            style={learnXRFontStyle}
          >
            <span className="text-white">Learn</span>
            <span className="text-purple-700">XR</span>
          </h1>

          <motion.p
            className="mt-5 max-w-2xl text-base font-medium tracking-wide text-white sm:text-xl"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {hero.tagline}
          </motion.p>

          <motion.p
            className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {hero.supporting}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Link
              to="/case-studies"
              className="inline-flex items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 sm:text-base"
            >
              View Case Studies
            </Link>
            <Link
              to="/channel-partners"
              className="inline-flex items-center justify-center rounded-2xl bg-purple-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-600 sm:text-base"
            >
              Become a Channel Partner
            </Link>
            <MagneticButton variant="ghost" onClick={onBookDemo}>
              Book a Demo
            </MagneticButton>
          </motion.div>

          <motion.div
            className="mt-4"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <a
              href={META_APP_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-600 sm:px-5 sm:text-base"
            >
              <i className="fa-brands fa-meta text-lg" aria-hidden />
              Download LearnXR App
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
