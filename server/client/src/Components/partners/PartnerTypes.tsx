import { motion } from 'framer-motion';
import {
  School,
  Building2,
  Truck,
  Cpu,
  Globe2,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { PARTNER_TYPES } from '../../data/partners';

const ICONS: Record<string, LucideIcon> = {
  School,
  Building2,
  Truck,
  Cpu,
  Globe2,
  Landmark,
};

export const PartnerTypes = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PARTNER_TYPES.map((type, index) => {
        const Icon = ICONS[type.icon] ?? School;
        return (
          <motion.div
            key={type.id}
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: [0.25, 0.4, 0.25, 1] }}
            className="flex items-start gap-4 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-card-hover"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{type.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{type.description}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PartnerTypes;
