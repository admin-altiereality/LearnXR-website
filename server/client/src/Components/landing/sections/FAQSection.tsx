import AnimatedSection, { AnimatedList } from '../../AnimatedSection';
import { faqs } from '../data/landingContent';
import { SectionHeading } from '../ui/SectionHeading';

export const FAQSection = () => (
  <section
    id="faq"
    aria-labelledby="faq-heading"
    className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
  >
    <AnimatedSection>
      <SectionHeading
        id="faq-heading"
        eyebrow="FAQ"
        title="Answers before you book a demo"
        description="Clear answers on platform fit, hardware, curriculum coverage, and how onboarding works."
      />
    </AnimatedSection>

    <AnimatedList className="mx-auto mt-12 max-w-3xl space-y-3" itemClassName="w-full">
      {faqs.map((item) => (
        <details
          key={item.question}
          className="group rounded-2xl border border-white/10 bg-white/5 px-5 py-4 open:bg-white/[0.07]"
        >
          <summary className="cursor-pointer list-none font-display text-base font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden sm:text-lg">
            <span className="flex items-start justify-between gap-4">
              {item.question}
              <span
                className="mt-0.5 shrink-0 text-white/40 transition-transform group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-white/65 sm:text-base">{item.answer}</p>
        </details>
      ))}
    </AnimatedList>
  </section>
);
