import { ExternalLink } from 'lucide-react';
import { getSource } from '../../data/caseStudies/sources';

interface CitationChipProps {
  sourceIds: string[];
  className?: string;
}

/**
 * Renders small, accessible citation links for one or more source ids.
 * Every statistic on the Case Studies page is accompanied by these chips so
 * claims remain attributable to their original publisher.
 */
export const CitationChip = ({ sourceIds, className = '' }: CitationChipProps) => {
  const sources = sourceIds.map(getSource).filter(Boolean);
  if (sources.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {sources.map((source) => (
        <a
          key={source!.id}
          href={source!.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${source!.title} — ${source!.publisher} (${source!.year})`}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="max-w-[120px] truncate">{source!.publisher}</span>
          <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
};

export default CitationChip;
