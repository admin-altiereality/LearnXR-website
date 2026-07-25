import AnimatedSection, { AnimatedList } from '../../AnimatedSection';
import { whoWeAre, whyCards } from '../data/landingContent';
import { GlassCard } from '../ui/GlassCard';
import { SectionHeading } from '../ui/SectionHeading';
import { learnXRFontStyle } from '../../LearnXRTypography';

export const WhyLearnXRSection = () => (
  <section
    id="why-learnxr"
    aria-labelledby="why-learnxr-heading"
    className="relative z-10 overflow-hidden px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <div className="pointer-events-none absolute inset-y-0 right-0 w-[min(42vw,420px)] opacity-40">
      <img
        src={whoWeAre.image}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover object-left"
        width={420}
        height={640}
      />
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#050816]/70 to-[#050816]" />
    </div>

    <div className="relative mx-auto max-w-7xl">
      <AnimatedSection>
        <SectionHeading
          id="why-learnxr-heading"
          eyebrow={whoWeAre.eyebrow}
          title="Why LearnXR"
          description={whoWeAre.lines[0]}
          align="left"
          className="max-w-3xl"
        />
        <p className="mt-4 max-w-2xl text-lg text-white/70" style={learnXRFontStyle}>
          {whoWeAre.lines[1]}
        </p>
      </AnimatedSection>

      <AnimatedList className="mt-12 grid gap-5 sm:grid-cols-2" itemClassName="h-full">
        {whyCards.map((card) => (
          <GlassCard key={card.title} className="h-full p-6 sm:p-8">
            <h3 className="font-display text-xl font-semibold text-white">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">{card.description}</p>
          </GlassCard>
        ))}
      </AnimatedList>
    </div>
  </section>
);
