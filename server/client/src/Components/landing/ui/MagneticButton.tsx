import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  useRef,
  useState,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export const MagneticButton = ({
  children,
  className,
  variant = 'primary',
  onMouseMove,
  onMouseLeave,
  type = 'button',
  ...props
}: MagneticButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMove = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseMove?.(event);
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * 0.18;
    const y = (event.clientY - rect.top - rect.height / 2) * 0.18;
    setOffset({ x, y });
  };

  const handleLeave = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(event);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      animate={reduceMotion ? undefined : { x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 280, damping: 18, mass: 0.4 }}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-medium transition-colors touch-manipulation sm:text-base',
        variant === 'primary' && 'bg-purple-700 text-white hover:bg-purple-600',
        variant === 'ghost' &&
          'border border-white/30 bg-white/5 text-white hover:bg-white/10',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};
