import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
  id?: string;
}

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
  id,
}: SectionHeadingProps) => (
  <div
    className={cn(
      'max-w-3xl space-y-3',
      align === 'center' ? 'mx-auto text-center' : 'text-left',
      className,
    )}
  >
    {eyebrow ? (
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
    ) : null}
    <h2 id={id} className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
      {title}
    </h2>
    {description ? (
      <p className="text-base leading-relaxed text-white/70 sm:text-lg">{description}</p>
    ) : null}
  </div>
);
