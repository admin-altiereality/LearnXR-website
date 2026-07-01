import { motion } from 'framer-motion';
import {
  TrendingUp,
  MapPinned,
  GraduationCap,
  Megaphone,
  MonitorPlay,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { PARTNER_BENEFITS } from '../../data/partners';

const ICONS: Record<string, LucideIcon> = {
  TrendingUp,
  MapPinned,
  GraduationCap,
  Megaphone,
  MonitorPlay,
  BadgeCheck,
};

export const PartnerBenefits = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PARTNER_BENEFITS.map((benefit, index) => {
        const Icon = ICONS[benefit.icon] ?? BadgeCheck;
        return (
          <motion.div
            key={benefit.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: index * 0.06, ease: [0.25, 0.4, 0.25, 1] }}
            className="group flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-card-hover"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold text-foreground">{benefit.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PartnerBenefits;
