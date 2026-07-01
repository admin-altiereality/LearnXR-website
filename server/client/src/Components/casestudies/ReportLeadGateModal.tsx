import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, FileDown, ShieldCheck } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  submitReportLead,
  markReportLeadCaptured,
  type ReportLeadPayload,
} from '../../services/reportLeadService';

interface ReportLeadGateModalProps {
  open: boolean;
  reportId: string;
  reportTitle: string;
  onClose: () => void;
  /** Called once the visitor is captured (or soft-failed) and the download may proceed. */
  onComplete: () => void;
}

type FormState = {
  name: string;
  email: string;
  organization: string;
  role: string;
  country: string;
  consent: boolean;
  companyFax: string; // honeypot
};

const INITIAL: FormState = {
  name: '',
  email: '',
  organization: '',
  role: '',
  country: '',
  consent: false,
  companyFax: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<keyof FormState, string>>;

export const ReportLeadGateModal = ({
  open,
  reportId,
  reportTitle,
  onClose,
  onComplete,
}: ReportLeadGateModalProps) => {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const utm = useMemo(() => {
    if (typeof window === 'undefined') return {} as Record<string, string>;
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmTerm: params.get('utm_term') || '',
      utmContent: params.get('utm_content') || '',
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(INITIAL);
    setErrors({});
    setSubmitting(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!form.email.trim()) next.email = 'Please enter your email.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (!form.consent) next.consent = 'Please accept to continue.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);

    const payload: ReportLeadPayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      organization: form.organization.trim(),
      role: form.role.trim(),
      country: form.country.trim(),
      consent: form.consent,
      reportId,
      reportTitle,
      source: 'case-studies-report',
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      ...utm,
      companyFax: form.companyFax,
    };

    // Soft gate: record the lead, but always allow the download to proceed.
    try {
      await submitReportLead(payload);
    } catch (err) {
      console.error('Report lead capture failed (continuing to download):', err);
    } finally {
      markReportLeadCaptured({ name: payload.name, email: payload.email });
      setSubmitting(false);
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-gate-title"
        >
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => !submitting && onClose()}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileDown className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id="report-gate-title" className="mt-4 text-lg font-bold text-foreground">
              Get the {reportTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us where to send it. Your PDF downloads instantly after you submit.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              {/* Honeypot */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.companyFax}
                onChange={(e) => update('companyFax', e.target.value)}
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />

              <div className="space-y-1.5">
                <Label htmlFor="rl-name">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rl-name"
                  ref={firstFieldRef}
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  aria-invalid={!!errors.name}
                  placeholder="Jane Doe"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rl-email">
                  Work email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rl-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  aria-invalid={!!errors.email}
                  placeholder="you@school.edu"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rl-org">Organization</Label>
                  <Input
                    id="rl-org"
                    value={form.organization}
                    onChange={(e) => update('organization', e.target.value)}
                    placeholder="School / company"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rl-country">Country</Label>
                  <Input
                    id="rl-country"
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                    placeholder="India"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rl-role">Role</Label>
                <Input
                  id="rl-role"
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  placeholder="Principal, Director, Teacher…"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update('consent', e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span>
                  I agree to receive the report and occasional updates from LearnXR. I can
                  unsubscribe anytime.
                </span>
              </label>
              {errors.consent && <p className="text-xs text-destructive">{errors.consent}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing your report…
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" /> Download the report
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> We respect your privacy. No spam.
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReportLeadGateModal;
