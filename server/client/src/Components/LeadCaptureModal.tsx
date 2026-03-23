import { type FormEvent, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { submitLead } from '../services/leadService';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface LeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_FORM = {
  name: '',
  email: '',
  phone: '',
  organization: '',
  role: 'school-admin',
  interest: 'demo',
  message: '',
  companyWebsite: '',
};

const DEMO_BOOKING_URL = 'https://cal.com/altie-reality/30min';

const LeadCaptureModal = ({ open, onOpenChange }: LeadCaptureModalProps) => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const utmParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        utmSource: '',
        utmMedium: '',
        utmCampaign: '',
        utmTerm: '',
        utmContent: '',
        pageUrl: '',
      };
    }

    const searchParams = new URLSearchParams(window.location.search);
    return {
      utmSource: searchParams.get('utm_source') || '',
      utmMedium: searchParams.get('utm_medium') || '',
      utmCampaign: searchParams.get('utm_campaign') || '',
      utmTerm: searchParams.get('utm_term') || '',
      utmContent: searchParams.get('utm_content') || '',
      pageUrl: window.location.href,
    };
  }, []);

  const updateField = (field: keyof typeof DEFAULT_FORM, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      try {
        sessionStorage.setItem('learnxr-lead-popup-dismissed', '1');
      } catch {
        // Ignore storage issues in restricted browsers.
      }
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Please enter your name and email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLead({
        ...utmParams,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        organization: form.organization.trim(),
        role: form.role,
        interest: form.interest,
        message: form.message.trim(),
        source: 'landing-page-popup',
        companyWebsite: form.companyWebsite.trim(),
      });

      setIsSubmitted(true);
      setForm(DEFAULT_FORM);
      try {
        sessionStorage.setItem('learnxr-lead-captured', '1');
      } catch {
        // Ignore storage issues in restricted browsers.
      }
      toast.success('Thanks! Our team will reach out shortly.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit your request.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookDemo = () => {
    if (typeof window !== 'undefined') {
      window.open(DEMO_BOOKING_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl rounded-2xl border-white/10 bg-slate-950 text-white">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl text-white">Get your LearnXR demo</DialogTitle>
          <DialogDescription className="text-slate-300">
            Share a few details and we will send pricing, product details, and the best next step for your team.
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-lg font-semibold text-white">Thanks, you're all set.</p>
              <p className="mt-1 text-sm text-slate-300">
                We have your details and our team will reach out soon. If you'd like to speak with us right away, you can book a demo now.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="bg-purple-700 text-white hover:bg-purple-600"
                onClick={handleBookDemo}
              >
                Book a Demo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => handleClose(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-name" className="text-slate-100">
                  Full name
                </Label>
                <Input
                  id="lead-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Your name"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-email" className="text-slate-100">
                  Email
                </Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="name@school.com"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-phone" className="text-slate-100">
                  Phone
                </Label>
                <Input
                  id="lead-phone"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="+91 98765 43210"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-organization" className="text-slate-100">
                  School / organization
                </Label>
                <Input
                  id="lead-organization"
                  value={form.organization}
                  onChange={(event) => updateField('organization', event.target.value)}
                  placeholder="Name of your school"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                  autoComplete="organization"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-role" className="text-slate-100">
                  Role
                </Label>
                <select
                  id="lead-role"
                  value={form.role}
                  onChange={(event) => updateField('role', event.target.value)}
                  className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="school-admin">School admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                  <option value="student">Student</option>
                  <option value="enterprise">Enterprise buyer</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-interest" className="text-slate-100">
                  Primary interest
                </Label>
                <select
                  id="lead-interest"
                  value={form.interest}
                  onChange={(event) => updateField('interest', event.target.value)}
                  className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="demo">Book a demo</option>
                  <option value="pricing">Pricing</option>
                  <option value="content">Curriculum content</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-message" className="text-slate-100">
                What are you looking for?
              </Label>
              <Textarea
                id="lead-message"
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
                placeholder="Tell us about your class size, use case, or timeline."
                className="min-h-[96px] border-white/10 bg-white/5 text-white placeholder:text-slate-400"
              />
            </div>

            <div className="hidden" aria-hidden="true">
              <Label htmlFor="lead-company-website">Website</Label>
              <Input
                id="lead-company-website"
                tabIndex={-1}
                autoComplete="off"
                value={form.companyWebsite}
                onChange={(event) => updateField('companyWebsite', event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                By submitting, you agree to be contacted by the LearnXR team.
              </p>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-purple-700 text-white hover:bg-purple-600"
              >
                {isSubmitting ? 'Submitting...' : 'Request details'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeadCaptureModal;
