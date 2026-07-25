import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import AnimatedSection from '../../AnimatedSection';
import { contentSlides } from '../data/landingContent';
import { SectionHeading } from '../ui/SectionHeading';

export const ContentShowcaseSection = () => {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const slide = contentSlides[index];

  const prev = () => setIndex((i) => (i - 1 + contentSlides.length) % contentSlides.length);
  const next = () => setIndex((i) => (i + 1) % contentSlides.length);

  return (
    <section
      id="content"
      aria-labelledby="content-heading"
      className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <AnimatedSection>
        <SectionHeading
          id="content-heading"
          eyebrow="Content"
          title="Content covered upto k-12"
          description="Browse immersive lesson themes across STEM, humanities, and virtual field trips."
        />
      </AnimatedSection>

      <div className="relative mx-auto mt-12 flex max-w-4xl items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-2xl text-white hover:bg-white/10"
        >
          ‹
        </button>

        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.title}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="h-full w-full object-cover"
                loading="lazy"
                width={960}
                height={600}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 sm:p-8">
                <h3 className="font-display text-xl font-semibold text-white sm:text-3xl">{slide.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
                  {slide.description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-2xl text-white hover:bg-white/10"
        >
          ›
        </button>
      </div>

      <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Content slides">
        {contentSlides.map((item, i) => (
          <button
            key={item.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${item.title}`}
            className={`h-2.5 w-2.5 rounded-full ${i === index ? 'bg-purple-500' : 'bg-white/25'}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
};
