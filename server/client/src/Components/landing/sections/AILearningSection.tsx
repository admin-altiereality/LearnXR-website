import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import AnimatedSection from '../../AnimatedSection';
import { aiExperiences } from '../data/landingContent';
import { GlassCard } from '../ui/GlassCard';
import { SectionHeading } from '../ui/SectionHeading';
import { cn } from '@/lib/utils';

export const AILearningSection = () => {
  const [activeId, setActiveId] = useState(aiExperiences[0]?.id ?? 'tutor');
  const reduceMotion = useReducedMotion();
  const active = aiExperiences.find((item) => item.id === activeId) ?? aiExperiences[0];

  return (
    <section
      id="ai-learning"
      aria-labelledby="ai-learning-heading"
      className="relative z-10 px-4 py-16 sm:px-8 sm:py-24 lg:px-12"
    >
      <AnimatedSection>
        <SectionHeading
          id="ai-learning-heading"
          eyebrow="AI learning experience"
          title="Intelligence inside every immersive lesson"
          description="Demonstrate how LearnXR blends tutoring, classrooms, self-paced paths, and assessments."
        />
      </AnimatedSection>

      <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-wrap gap-2 lg:flex-col" role="tablist" aria-label="AI learning modes">
          {aiExperiences.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === activeId}
              onClick={() => setActiveId(item.id)}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors sm:text-base',
                item.id === activeId
                  ? 'border-purple-500/60 bg-purple-700/30 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10',
              )}
            >
              {item.title}
            </button>
          ))}
        </div>

        <GlassCard className="relative min-h-[240px] overflow-hidden p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-purple-600/25 blur-3xl" />
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              role="tabpanel"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Showcase</p>
              <h3 className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">{active.title}</h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">{active.description}</p>
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </div>
    </section>
  );
};
