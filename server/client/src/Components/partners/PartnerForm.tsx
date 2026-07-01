import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  submitPartnerRegistration,
  type PartnerRegistrationPayload,
} from '../../services/partnerService';
import {
  PARTNER_TYPE_OPTIONS,
  ORG_TYPE_OPTIONS,
  REACH_OPTIONS,
  EXPERIENCE_OPTIONS,
} from '../../data/partners';

type FormState = {
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  website: string;
  partnerType: string;
  orgType: string;
  yearsInBusiness: string;
  schoolsReach: string;
  currentPortfolio: string;
  message: string;
  consent: boolean;
  companyFax: string; // honeypot
};

const INITIAL: FormState = {
  organizationName: '',
  contactName: '',
  email: '',
  phone: '',
  country: '',
  region: '',
  website: '',
  partnerType: '',
  orgType: '',
  yearsInBusiness: '',
  schoolsReach: '',
  currentPortfolio: '',
  message: '',
  consent: false,
  companyFax: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;

type Errors = Partial<Record<keyof FormState, string>>;

const selectClasses =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const PartnerForm = () => {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverMessage, setServerMessage] = useState<string>('');

  const utm = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      pageUrl: window.location.href,
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      utmContent: params.get('utm_content') || undefined,
    };
  }, []);

  useEffect(() => {
    if (status === 'success') {
      const el = document.getElementById('partner-form-status');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [status]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.organizationName.trim()) next.organizationName = 'Organization name is required.';
    if (!form.contactName.trim()) next.contactName = 'Contact name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Phone number is required.';
    else if (!PHONE_RE.test(form.phone.trim())) next.phone = 'Enter a valid phone number.';
    if (!form.country.trim()) next.country = 'Country is required.';
    if (!form.partnerType) next.partnerType = 'Select a partner type.';
    if (!form.orgType) next.orgType = 'Select your organization type.';
    if (form.website.trim() && !/^https?:\/\/.+\..+/.test(form.website.trim())) {
      next.website = 'Enter a valid URL (including http:// or https://).';
    }
    if (!form.consent) next.consent = 'Please accept the privacy terms to continue.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    if (!validate()) {
      const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement | null;
      firstError?.focus();
      return;
    }

    setStatus('submitting');
    setServerMessage('');

    const payload: PartnerRegistrationPayload = {
      organizationName: form.organizationName.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      region: form.region.trim() || undefined,
      website: form.website.trim() || undefined,
      partnerType: form.partnerType,
      orgType: form.orgType,
      yearsInBusiness: form.yearsInBusiness || undefined,
      schoolsReach: form.schoolsReach || undefined,
      currentPortfolio: form.currentPortfolio.trim() || undefined,
      message: form.message.trim() || undefined,
      consent: form.consent,
      source: 'channel-partners-page',
      companyFax: form.companyFax,
      ...utm,
    };

    try {
      const res = await submitPartnerRegistration(payload);
      setStatus('success');
      setServerMessage(res.message || '');
      setForm(INITIAL);
    } catch (err) {
      setStatus('error');
      setServerMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    }
  };

  if (status === 'success') {
    return (
      <motion.div
        id="partner-form-status"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-primary/40 bg-card/80 p-10 text-center shadow-card backdrop-blur-xl"
      >
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <h3 className="text-xl font-bold text-foreground">Application received</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {serverMessage ||
            'Thank you for your interest in partnering with LearnXR. Our partnerships team will review your application and be in touch shortly.'}
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-2 text-sm font-semibold text-primary hover:underline"
        >
          Submit another application
        </button>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-card backdrop-blur-xl sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Organization name" required error={errors.organizationName} htmlFor="organizationName">
          <Input
            id="organizationName"
            value={form.organizationName}
            onChange={(e) => update('organizationName', e.target.value)}
            aria-invalid={!!errors.organizationName}
            placeholder="Acme EdTech Pvt. Ltd."
            autoComplete="organization"
          />
        </Field>

        <Field label="Contact name" required error={errors.contactName} htmlFor="contactName">
          <Input
            id="contactName"
            value={form.contactName}
            onChange={(e) => update('contactName', e.target.value)}
            aria-invalid={!!errors.contactName}
            placeholder="Full name"
            autoComplete="name"
          />
        </Field>

        <Field label="Email" required error={errors.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            aria-invalid={!!errors.email}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </Field>

        <Field label="Phone" required error={errors.phone} htmlFor="phone">
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            aria-invalid={!!errors.phone}
            placeholder="+91 98765 43210"
            autoComplete="tel"
          />
        </Field>

        <Field label="Country" required error={errors.country} htmlFor="country">
          <Input
            id="country"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            aria-invalid={!!errors.country}
            placeholder="Country"
            autoComplete="country-name"
          />
        </Field>

        <Field label="State / Region" error={errors.region} htmlFor="region">
          <Input
            id="region"
            value={form.region}
            onChange={(e) => update('region', e.target.value)}
            placeholder="State or region"
          />
        </Field>

        <Field label="Partner type" required error={errors.partnerType} htmlFor="partnerType">
          <select
            id="partnerType"
            className={selectClasses}
            value={form.partnerType}
            onChange={(e) => update('partnerType', e.target.value)}
            aria-invalid={!!errors.partnerType}
          >
            <option value="">Select partner type</option>
            {PARTNER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Organization type" required error={errors.orgType} htmlFor="orgType">
          <select
            id="orgType"
            className={selectClasses}
            value={form.orgType}
            onChange={(e) => update('orgType', e.target.value)}
            aria-invalid={!!errors.orgType}
          >
            <option value="">Select organization type</option>
            {ORG_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Years in business" htmlFor="yearsInBusiness">
          <select
            id="yearsInBusiness"
            className={selectClasses}
            value={form.yearsInBusiness}
            onChange={(e) => update('yearsInBusiness', e.target.value)}
          >
            <option value="">Select experience</option>
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Schools / institutions you reach" htmlFor="schoolsReach">
          <select
            id="schoolsReach"
            className={selectClasses}
            value={form.schoolsReach}
            onChange={(e) => update('schoolsReach', e.target.value)}
          >
            <option value="">Select reach</option>
            {REACH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Website" error={errors.website} htmlFor="website">
        <Input
          id="website"
          type="url"
          value={form.website}
          onChange={(e) => update('website', e.target.value)}
          aria-invalid={!!errors.website}
          placeholder="https://yourcompany.com"
          autoComplete="url"
        />
      </Field>

      <Field label="Current products / portfolio" htmlFor="currentPortfolio">
        <Input
          id="currentPortfolio"
          value={form.currentPortfolio}
          onChange={(e) => update('currentPortfolio', e.target.value)}
          placeholder="e.g. smart classrooms, LMS, hardware distribution"
        />
      </Field>

      <Field label="Tell us about your goals" htmlFor="message">
        <Textarea
          id="message"
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          placeholder="What markets do you serve, and why do you want to partner with LearnXR?"
        />
      </Field>

      {/* Honeypot — visually hidden, ignored by users, filled by bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="companyFax">Company fax (leave empty)</label>
        <input
          id="companyFax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.companyFax}
          onChange={(e) => update('companyFax', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => update('consent', e.target.checked)}
            aria-invalid={!!errors.consent}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span>
            I agree to LearnXR processing my details to respond to this enquiry, in line with the{' '}
            <a href="/privacy-policy" className="text-primary hover:underline">
              privacy policy
            </a>
            .
          </span>
        </label>
        {errors.consent && (
          <p className="text-xs text-destructive" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      {status === 'error' && (
        <div
          id="partner-form-status"
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverMessage}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
      >
        {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === 'submitting' ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
};

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

const Field = ({ label, htmlFor, required, error, children }: FieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-foreground">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
    {children}
    {error && (
      <p className="text-xs text-destructive" role="alert">
        {error}
      </p>
    )}
  </div>
);

export default PartnerForm;
