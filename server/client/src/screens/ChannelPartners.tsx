import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Handshake, BookOpen, Layers, Headset } from 'lucide-react';
import FuturisticBackground from '../Components/FuturisticBackground';
import AnimatedSection from '../Components/AnimatedSection';
import Seo from '../Components/seo/Seo';
import PartnerBenefits from '../Components/partners/PartnerBenefits';
import PartnerTypes from '../Components/partners/PartnerTypes';
import GlobalReachMap from '../Components/partners/GlobalReachMap';
import PartnerForm from '../Components/partners/PartnerForm';
import SectionErrorBoundary from '../Components/SectionErrorBoundary';
import { PROGRAM_HIGHLIGHTS } from '../data/partners';
import LogoHeader from '../Components/LogoHeader';

const SectionHeading = ({
  eyebrow,
  title,
  description,
  center,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  center?: boolean;
}) => (
  <div className={`mb-8 max-w-3xl space-y-3 ${center ? 'mx-auto text-center' : ''}`}>
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
    <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
    {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
  </div>
);

const VALUE_PROPS = [
  {
    icon: BookOpen,
    title: 'A platform schools want',
    text: 'Curriculum-aligned, AI-assisted immersive lessons that run in the browser and on headsets.',
  },
  {
    icon: Layers,
    title: 'Built to resell',
    text: 'Clear packaging, demo access, and enablement designed for distributors and resellers.',
  },
  {
    icon: Headset,
    title: 'Immersive differentiation',
    text: 'Stand out in your market with next-generation XR learning, not another flat LMS.',
  },
];

const ChannelPartners = () => {
  const scrollToForm = useCallback(() => {
    document.getElementById('partner-apply')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <FuturisticBackground className="min-h-[100dvh] w-full overflow-x-hidden">
      <Seo
        title="Channel Partner Program"
        description="Grow with LearnXR. Join our global channel partner program — attractive margins, territory exclusivity, training, and marketing support for immersive education."
        path="/channel-partners"
      />

      <LogoHeader />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        {/* Hero */}
        <section className="mb-20">
          <AnimatedSection animation="fadeUp">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Handshake className="h-3.5 w-3.5" /> Partner Program
            </span>
          </AnimatedSection>
          <AnimatedSection animation="fadeUp" delay={0.1}>
            <h1 className="mt-5 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Grow With{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                LearnXR
              </span>
            </h1>
          </AnimatedSection>
          <AnimatedSection animation="fadeUp" delay={0.2}>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Partner with LearnXR to bring immersive, AI-assisted learning to schools in your
              market. Earn attractive margins, win protected territories, and lead the shift to
              experiential education.
            </p>
          </AnimatedSection>
          <AnimatedSection animation="fadeUp" delay={0.3}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Apply now <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/case-studies"
                className="inline-flex items-center gap-2 rounded-full border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
              >
                See the evidence
              </Link>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fadeUp" delay={0.4}>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PROGRAM_HIGHLIGHTS.map((h) => (
                <div
                  key={h.label}
                  className="rounded-2xl border border-border/80 bg-card/70 p-5 backdrop-blur-xl"
                >
                  <p className="text-lg font-bold text-primary">{h.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{h.label}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </section>

        {/* Why partner */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Why LearnXR"
            title="A partnership built to win in education"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {VALUE_PROPS.map((vp, i) => (
              <motion.div
                key={vp.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-xl"
              >
                <vp.icon className="h-6 w-6 text-primary" />
                <h3 className="text-base font-semibold text-foreground">{vp.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{vp.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Benefits"
            title="What you get as a LearnXR partner"
            description="Everything you need to sell, deploy, and support immersive learning with confidence."
          />
          <PartnerBenefits />
        </section>

        {/* Partner types */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Who can partner"
            title="Partnership paths for every organization"
            description="Whether you are a single school or a national distributor, there is a path for you."
          />
          <PartnerTypes />
        </section>

        {/* Global reach */}
        <section className="mb-20">
          <SectionHeading
            eyebrow="Global reach"
            title="Active and expansion markets"
            description="LearnXR is growing internationally. We are actively seeking partners in our expansion markets."
          />
          <SectionErrorBoundary label="partner-map">
            <GlobalReachMap />
          </SectionErrorBoundary>
        </section>

        {/* Apply */}
        <section id="partner-apply" className="scroll-mt-24">
          <SectionHeading
            eyebrow="Apply"
            title="Become a LearnXR partner"
            description="Tell us about your organization and our partnerships team will be in touch. Fields marked * are required."
          />
          <PartnerForm />
        </section>
      </div>
    </FuturisticBackground>
  );
};

export default ChannelPartners;
