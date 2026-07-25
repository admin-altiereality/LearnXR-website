import AnimatedSection, { AnimatedList } from '../../AnimatedSection';
import { featureBento } from '../data/landingContent';
import { GlassCard } from '../ui/GlassCard';
import { SectionHeading } from '../ui/SectionHeading';
import { cn } from '@/lib/utils';

export const FeaturesBentoSection = () => (
  <section
    id="features"
    aria-labelledby="features-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <AnimatedSection>
      <SectionHeading
        id="features-heading"
        eyebrow="Product features"
        title="A bento of immersive learning"
        description="Content covered up to K-12 — STEM, humanities, immersive lessons, and field trips."
      />
    </AnimatedSection>

    <AnimatedList className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3" itemClassName="h-full">
      {featureBento.map((card) => (
        <GlassCard
          key={card.title}
          className={cn('group relative h-full min-h-[220px] overflow-hidden p-0', card.span)}
        >
          <img
            src={card.image}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-105"
            width={640}
            height={400}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/70 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
            <h3 className="font-display text-xl font-semibold text-white sm:text-2xl">{card.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/75">{card.description}</p>
          </div>
        </GlassCard>
      ))}
    </AnimatedList>
  </section>
);
