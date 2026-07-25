import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  durationSeconds?: number;
}

export const Marquee = ({ children, className, durationSeconds = 36 }: MarqueeProps) => (
  <div className={cn('landing-marquee group relative overflow-hidden', className)} aria-hidden={false}>
    <div
      className="landing-marquee-track flex w-max items-center gap-10 py-2 group-hover:[animation-play-state:paused]"
      style={{ animationDuration: `${durationSeconds}s` }}
    >
      <div className="flex items-center gap-10">{children}</div>
      <div className="flex items-center gap-10" aria-hidden>
        {children}
      </div>
    </div>
  </div>
);
