import { Link } from 'react-router-dom';
import AnimatedSection from '../../AnimatedSection';
import { cta, META_APP_DOWNLOAD_URL } from '../data/landingContent';
import { MagneticButton } from '../ui/MagneticButton';

interface CTASectionProps {
  onBookDemo: () => void;
}

export const CTASection = ({ onBookDemo }: CTASectionProps) => (
  <section
    id="cta"
    aria-labelledby="cta-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <AnimatedSection>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-950 via-[#1a0b2e] to-slate-950 px-6 py-14 text-center shadow-2xl sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />

        <h2 id="cta-heading" className="relative font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          {cta.title}
        </h2>
        <p className="relative mx-auto mt-4 max-w-2xl text-base text-white/75 sm:text-lg">{cta.description}</p>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/case-studies"
            className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 sm:text-base"
          >
            View Case Studies
          </Link>
          <Link
            to="/channel-partners"
            className="inline-flex items-center justify-center rounded-2xl bg-purple-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-600 sm:text-base"
          >
            Join Partner Program
          </Link>
          <MagneticButton variant="ghost" onClick={onBookDemo}>
            Book a Demo
          </MagneticButton>
          <a
            href={META_APP_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-600 sm:text-base"
          >
            <i className="fa-brands fa-meta text-lg" aria-hidden />
            Download LearnXR App
          </a>
        </div>
      </div>
    </AnimatedSection>
  </section>
);
