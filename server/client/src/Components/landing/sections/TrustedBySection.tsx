import AnimatedSection from '../../AnimatedSection';
import { partnerLogos } from '../data/landingContent';
import { Marquee } from '../ui/Marquee';
import { SectionHeading } from '../ui/SectionHeading';

export const TrustedBySection = () => (
  <section
    id="trusted-by"
    aria-labelledby="trusted-by-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-20 lg:px-12"
  >
    <AnimatedSection>
      <SectionHeading
        id="trusted-by-heading"
        eyebrow="In association with"
        title="Trusted by partners in education"
        description="Schools, incubators, and institutions building the future of immersive learning with LearnXR."
      />
    </AnimatedSection>

    <div className="mx-auto mt-10 max-w-6xl">
      <Marquee>
        {partnerLogos.map((logo) => (
          <div
            key={logo.src}
            className="flex h-20 w-36 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 sm:h-24 sm:w-44"
          >
            <img
              src={logo.src}
              alt={logo.alt}
              loading="lazy"
              className="max-h-14 w-auto object-contain opacity-90"
              width={120}
              height={56}
            />
          </div>
        ))}
      </Marquee>
    </div>
  </section>
);
