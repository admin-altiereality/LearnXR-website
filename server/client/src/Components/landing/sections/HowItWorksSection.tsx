import AnimatedSection, { AnimatedList } from '../../AnimatedSection';
import { howItWorks } from '../data/landingContent';
import { GlassCard } from '../ui/GlassCard';
import { SectionHeading } from '../ui/SectionHeading';

export const HowItWorksSection = () => (
  <section
    id="how-it-works"
    aria-labelledby="how-it-works-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <AnimatedSection>
      <SectionHeading
        id="how-it-works-heading"
        eyebrow="How it works"
        title="From curiosity to mastery"
        description="A clear path from discovering content to assessing understanding inside XR."
      />
    </AnimatedSection>

    <ol className="relative mx-auto mt-14 max-w-5xl">
      <div
        className="absolute left-6 top-4 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-purple-500/60 via-cyan-400/30 to-transparent sm:left-1/2 sm:block"
        aria-hidden
      />
      <AnimatedList className="grid gap-6" itemClassName="">
        {howItWorks.map((step, index) => (
          <li key={step.step} className="relative list-none">
            <GlassCard
              className={`flex flex-col gap-3 p-6 sm:p-8 sm:max-w-md ${
                index % 2 === 0 ? 'sm:mr-auto sm:pr-10' : 'sm:ml-auto sm:pl-10'
              }`}
            >
              <span className="font-mono text-sm font-semibold text-cyan-300">{step.step}</span>
              <h3 className="font-display text-xl font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-white/70 sm:text-base">{step.description}</p>
            </GlassCard>
          </li>
        ))}
      </AnimatedList>
    </ol>
  </section>
);
