import { motion } from 'framer-motion';
import { GraduationCap, Stethoscope, School, Landmark, Sparkles } from 'lucide-react';
import type { CaseStudyEntry } from '../../data/caseStudies/india';
import CitationChip from './CitationChip';

const CATEGORY_META: Record<
  CaseStudyEntry['category'],
  { icon: typeof School; label: string }
> = {
  school: { icon: School, label: 'School' },
  college: { icon: GraduationCap, label: 'Higher Education' },
  medical: { icon: Stethoscope, label: 'Medical' },
  government: { icon: Landmark, label: 'Government' },
  initiative: { icon: Sparkles, label: 'Initiative' },
};

interface CaseStudyCardProps {
  entry: CaseStudyEntry;
  index?: number;
}

export const CaseStudyCard = ({ entry, index = 0 }: CaseStudyCardProps) => {
  const meta = CATEGORY_META[entry.category];
  const Icon = meta.icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.25, 0.4, 0.25, 1] }}
      className="flex h-full flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
        </span>
        <span className="text-[11px] text-muted-foreground">{entry.year}</span>
      </div>
      <h3 className="text-base font-semibold leading-snug text-foreground">{entry.headline}</h3>
      <p className="text-sm font-medium text-foreground/90">{entry.institution}</p>
      <p className="text-xs text-muted-foreground">{entry.location}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{entry.detail}</p>
      <CitationChip sourceIds={entry.sourceIds} className="mt-auto pt-1" />
    </motion.article>
  );
};

export default CaseStudyCard;
