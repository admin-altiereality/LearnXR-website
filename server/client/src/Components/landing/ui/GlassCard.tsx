import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li';
}

export const GlassCard = ({ children, className, as: Tag = 'div' }: GlassCardProps) => (
  <Tag
    className={cn(
      'rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl',
      'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)]',
      className,
    )}
  >
    {children}
  </Tag>
);
