import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Link2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getLicensedProviderConfig,
  updateLicensedProviderConfig,
} from '../../services/licensedContentService';
import type {
  LicensedLinkType,
  LicensedProviderConfigInput,
  LicensedProviderStatus,
} from '../../types/licensedContent';
import { Button } from '../ui/button';

const LINK_TYPES: Array<{ value: LicensedLinkType; label: string }> = [
  { value: 'permanent', label: 'Permanent links' },
  { value: 'student_access', label: 'Student access links' },
  { value: 'temporary', label: 'Temporary links' },
];

const EMPTY_FORM: LicensedProviderConfigInput = {
  licensing_approved: false,
  external_link_approved: false,
  status: 'active',
  license_starts_at: '',
  license_ends_at: '',
  licensed_seat_count: 1,
  permitted_link_types: ['permanent'],
  agreement_reference: '',
};

function toDateInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function toStartIso(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toEndIso(value: string): string {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

export function ProviderLicensePanel() {
  const [form, setForm] = useState<LicensedProviderConfigInput>(EMPTY_FORM);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getLicensedProviderConfig('corinth');
      if (config) {
        setForm({
          licensing_approved: config.licensing_approved,
          external_link_approved: config.external_link_approved,
          status: config.status,
          license_starts_at: config.license_starts_at,
          license_ends_at: config.license_ends_at,
          licensed_seat_count: config.licensed_seat_count,
          permitted_link_types: config.permitted_link_types,
          agreement_reference: config.agreement_reference || '',
        });
        setStartsAt(toDateInput(config.license_starts_at));
        setEndsAt(toDateInput(config.license_ends_at));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the Corinth license.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const daysRemaining = useMemo(() => {
    if (!endsAt) return null;
    const end = new Date(`${endsAt}T23:59:59.999Z`).getTime();
    return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
  }, [endsAt]);

  const toggleLinkType = (linkType: LicensedLinkType) => {
    setForm((current) => ({
      ...current,
      permitted_link_types: current.permitted_link_types.includes(linkType)
        ? current.permitted_link_types.filter((value) => value !== linkType)
        : [...current.permitted_link_types, linkType],
    }));
  };

  const submit = async () => {
    if (!startsAt || !endsAt || form.permitted_link_types.length === 0) {
      toast.error('License dates and at least one permitted link type are required.');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateLicensedProviderConfig('corinth', {
        ...form,
        license_starts_at: toStartIso(startsAt),
        license_ends_at: toEndIso(endsAt),
      });
      setForm((current) => ({ ...current, status: saved.status }));
      toast.success('Corinth license controls saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the Corinth license.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading provider license</div>;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 lg:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Corinth link license</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Controls launch eligibility for link-only content. Expiry suspends provider launches without deleting LearnXR lessons or curriculum mappings.</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
          <CalendarClock className="h-5 w-5 text-primary" />
          <div><div className="text-xs font-semibold uppercase text-muted-foreground">Time remaining</div><div className="text-sm font-semibold">{daysRemaining === null ? 'Dates required' : `${daysRemaining} days`}</div></div>
        </div>
      </div>

      <div className="mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="License starts"><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="field" /></Field>
        <Field label="License ends"><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="field" /></Field>
        <Field label="Lifecycle status"><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LicensedProviderStatus }))} className="field"><option value="active">Active</option><option value="expiring">Expiring</option><option value="expired">Expired</option></select></Field>
        <Field label="Licensed seats"><input type="number" min="1" max="100000" value={form.licensed_seat_count} onChange={(event) => setForm((current) => ({ ...current, licensed_seat_count: Number(event.target.value) }))} className="field" /></Field>
        <Field label="Agreement reference"><input value={form.agreement_reference || ''} onChange={(event) => setForm((current) => ({ ...current, agreement_reference: event.target.value }))} placeholder="Contract or invoice reference" className="field" /></Field>
      </div>

      <div className="mt-6 max-w-5xl border-t border-border pt-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-primary" /> Permitted provider links</div>
        <div className="flex flex-wrap gap-3">
          {LINK_TYPES.map((linkType) => (
            <label key={linkType.value} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <input type="checkbox" checked={form.permitted_link_types.includes(linkType.value)} onChange={() => toggleLinkType(linkType.value)} />
              {linkType.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 grid max-w-5xl gap-3 sm:grid-cols-2">
        <ApprovalToggle label="Licensing rights confirmed" checked={form.licensing_approved} onChange={(checked) => setForm((current) => ({ ...current, licensing_approved: checked }))} />
        <ApprovalToggle label="External link delivery approved" checked={form.external_link_approved} onChange={(checked) => setForm((current) => ({ ...current, external_link_approved: checked }))} />
      </div>

      {(!form.licensing_approved || !form.external_link_approved) && (
        <div className="mt-5 flex max-w-5xl items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-500">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Corinth items can remain staged, but users cannot launch them until both approvals are confirmed.
        </div>
      )}

      <Button type="button" onClick={() => void submit()} disabled={saving} className="mt-6">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save provider license
      </Button>
    </section>
  );
}

function ApprovalToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-muted-foreground [&_.field]:h-10 [&_.field]:rounded-lg [&_.field]:border [&_.field]:border-input [&_.field]:bg-background [&_.field]:px-3 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:normal-case [&_.field]:text-foreground [&_.field]:outline-none focus-within:[&_.field]:ring-2 focus-within:[&_.field]:ring-ring">{label}{children}</label>;
}
