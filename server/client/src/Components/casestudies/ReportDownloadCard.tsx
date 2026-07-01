import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Loader2, Check } from 'lucide-react';
import { downloadReport, type ReportId } from '../../lib/pdf/generateReport';
import { hasCapturedReportLead } from '../../services/reportLeadService';
import ReportLeadGateModal from './ReportLeadGateModal';

interface ReportDownloadCardProps {
  reportId: ReportId;
  title: string;
  description: string;
  highlights: string[];
  index?: number;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

export const ReportDownloadCard = ({
  reportId,
  title,
  description,
  highlights,
  index = 0,
}: ReportDownloadCardProps) => {
  const [status, setStatus] = useState<Status>('idle');
  const [gateOpen, setGateOpen] = useState(false);

  const runDownload = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      await downloadReport(reportId);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('Report generation failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3500);
    }
  };

  const handleDownload = () => {
    if (status === 'loading') return;
    if (hasCapturedReportLead()) {
      void runDownload();
    } else {
      setGateOpen(true);
    }
  };

  const handleGateComplete = () => {
    setGateOpen(false);
    void runDownload();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.4, 0.25, 1] }}
      className="flex h-full flex-col gap-4 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-card-hover"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FileDown className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ul className="space-y-1.5">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === 'loading'}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === 'done' && <Check className="h-4 w-4" />}
        {(status === 'idle' || status === 'error') && <FileDown className="h-4 w-4" />}
        {status === 'loading'
          ? 'Generating PDF…'
          : status === 'done'
          ? 'Downloaded'
          : status === 'error'
          ? 'Retry download'
          : 'Download PDF report'}
      </button>
      {status === 'error' && (
        <p role="alert" className="text-xs text-destructive">
          Something went wrong generating the report. Please try again.
        </p>
      )}

      <ReportLeadGateModal
        open={gateOpen}
        reportId={reportId}
        reportTitle={title}
        onClose={() => setGateOpen(false)}
        onComplete={handleGateComplete}
      />
    </motion.div>
  );
};

export default ReportDownloadCard;
