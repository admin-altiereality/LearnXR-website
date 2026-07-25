import AnimatedSection, { AnimatedList } from '../../AnimatedSection';
import { impactProof } from '../data/landingContent';
import { GlassCard } from '../ui/GlassCard';
import { SectionHeading } from '../ui/SectionHeading';

export const ImpactProofSection = () => (
  <section
    id="impact"
    aria-labelledby="impact-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <AnimatedSection>
      <SectionHeading
        id="impact-heading"
        eyebrow="Impact"
        title="Proof that matters"
        description="Qualitative signals from funding, curriculum coverage, partnerships, and educator trust — not vanity metrics."
      />
    </AnimatedSection>

    <AnimatedList className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4" itemClassName="h-full">
      {impactProof.map((item) => (
        <GlassCard key={item.label} className="flex h-full flex-col p-6">
          <p className="font-display text-lg font-semibold text-white">{item.label}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/65">{item.detail}</p>
        </GlassCard>
      ))}
    </AnimatedList>
  </section>
);
