import { motion } from 'framer-motion';
import {
  Sparkles,
  Gauge,
  School,
  Globe,
  ClipboardCheck,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { IMPACT_FRAMEWORK, COMPARISON_ROWS } from '../../data/caseStudies/frameworks';

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Gauge,
  School,
  Globe,
  ClipboardCheck,
  Rocket,
};

export const ImpactFramework = () => {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IMPACT_FRAMEWORK.map((pillar, index) => {
          const Icon = ICONS[pillar.icon] ?? Sparkles;
          return (
            <motion.div
              key={pillar.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.06, ease: [0.25, 0.4, 0.25, 1] }}
              className="group flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-card-hover"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-foreground">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{pillar.description}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-px bg-border/60 text-sm">
          <div className="bg-card px-4 py-3 font-semibold text-foreground">Dimension</div>
          <div className="bg-card px-4 py-3 font-semibold text-muted-foreground">
            Traditional learning
          </div>
          <div className="bg-card px-4 py-3 font-semibold text-primary">LearnXR</div>
          {COMPARISON_ROWS.map((row) => (
            <FragmentRow key={row.dimension} dimension={row.dimension} traditional={row.traditional} learnxr={row.learnxr} />
          ))}
        </div>
      </div>
    </div>
  );
};

const FragmentRow = ({
  dimension,
  traditional,
  learnxr,
}: {
  dimension: string;
  traditional: string;
  learnxr: string;
}) => (
  <>
    <div className="bg-card px-4 py-3 font-medium text-foreground">{dimension}</div>
    <div className="bg-card px-4 py-3 text-muted-foreground">{traditional}</div>
    <div className="bg-card px-4 py-3 text-foreground">{learnxr}</div>
  </>
);

export default ImpactFramework;
