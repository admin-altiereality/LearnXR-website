import { motion } from 'framer-motion';
import type { StatHighlight } from '../../data/caseStudies/india';
import CitationChip from './CitationChip';

interface StatCardProps {
  stat: StatHighlight;
  index?: number;
}

/**
 * Animated headline statistic card with attribution. The value scales in on
 * scroll; the label and source chips provide full context.
 */
export const StatCard = ({ stat, index = 0 }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.4, 0.25, 1] }}
      className="group relative flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-card-hover sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        {stat.value}
      </span>
      <p className="text-sm leading-snug text-muted-foreground">{stat.label}</p>
      <CitationChip sourceIds={stat.sourceIds} className="mt-auto pt-1" />
    </motion.div>
  );
};

export default StatCard;
