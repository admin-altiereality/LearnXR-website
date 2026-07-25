import AnimatedSection from '../../AnimatedSection';
import LinkedInActivity from '../../LinkedInActivity';
import { companyActivity } from '../data/landingContent';
import { SectionHeading } from '../ui/SectionHeading';

export const CompanyActivitySection = () => (
  <section
    id="company-activity"
    aria-labelledby="company-activity-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:gap-14">
      <div className="w-full lg:sticky lg:top-24 lg:w-[42%] lg:self-start">
        <AnimatedSection>
          <SectionHeading
            id="company-activity-heading"
            eyebrow={companyActivity.eyebrow}
            title={companyActivity.title}
            align="left"
            className="max-w-md"
          />
          <img
            src={companyActivity.image}
            alt=""
            loading="lazy"
            className="mt-8 w-full max-w-xs rounded-2xl object-cover ring-1 ring-white/15"
            width={320}
            height={320}
          />
        </AnimatedSection>
      </div>

      <div className="min-w-0 flex-1">
        <LinkedInActivity limit={6} autoRefresh refreshInterval={5 * 60 * 1000} />
      </div>
    </div>
  </section>
);
