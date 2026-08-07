import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  FaChartLine,
  FaClock,
  FaMapMarkerAlt,
  FaPlay,
  FaSchool,
  FaSignInAlt,
  FaSyncAlt,
  FaUsers,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { Button } from '../../Components/ui/button';
import { Card, CardContent } from '../../Components/ui/card';
import {
  extendPartnerTrial,
  fetchPartnerActivity,
  fetchPartnerTelemetry,
  listPartnerOversight,
  provisionPartnerDemoClass,
  type PartnerOversightSummary,
  updatePartnerQuota,
} from '../../services/partnerService';
import type { PartnerEvent, PartnerEventType } from '../../types/partner';

const EVENT_LABELS: Partial<Record<PartnerEventType | string, string>> = {
  partner_login: 'Login',
  partner_approved: 'Approved',
  partner_suspended: 'Suspended',
  partner_reactivated: 'Reactivated',
  school_created: 'School created',
  school_invite_sent: 'School invite sent',
  teacher_approved: 'Teacher approved',
  teacher_rejected: 'Teacher rejected',
  demo_started: 'Class launch',
  lesson_launched: 'Lesson launch',
  demo_ended: 'Demo ended',
  quota_exhausted: 'Quota exhausted',
  trial_extended: 'Trial extended',
  quota_adjusted: 'Quota adjusted',
};

function formatWhen(value: unknown): string {
  if (!value) return '—';
  try {
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      const seconds = Number((value as { seconds?: number }).seconds);
      if (!Number.isFinite(seconds)) return '—';
      return new Date(seconds * 1000).toLocaleString();
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const d = (value as { toDate: () => Date }).toDate();
      return d.toLocaleString();
    }
  } catch {
    return '—';
  }
  return '—';
}

function relativeWhen(value?: string | null): string {
  if (!value) return 'Never';
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return 'Never';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(value).toLocaleDateString();
}

const PartnerOversight = () => {
  const [partners, setPartners] = useState<PartnerOversightSummary[]>([]);
  const [selected, setSelected] = useState<PartnerOversightSummary | null>(null);
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [locations, setLocations] = useState<Array<{ label: string; launches: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (selectedId?: string | null) => {
    setLoading(true);
    try {
      const result = await listPartnerOversight();
      const nextPartners = result.partners || [];
      setPartners(nextPartners);
      if (selectedId) {
        const refreshed = nextPartners.find((partner) => partner.id === selectedId) || null;
        setSelected(refreshed);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load partner oversight');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPartner = async (partner: PartnerOversightSummary) => {
    setSelected(partner);
    try {
      const [activity, telemetry] = await Promise.all([
        fetchPartnerActivity(partner.id),
        fetchPartnerTelemetry(partner.id),
      ]);
      setEvents(activity.events || []);
      setLocations(telemetry.locations || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load partner activity');
    }
  };

  const resetQuota = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await updatePartnerQuota(selected.id, {
        classLaunchesLimit: 200,
        lessonLaunchesLimit: 200,
        reason: 'Demo entitlement (200 class launches / 200 lesson launches)',
      });
      toast.success('Partner quotas set to 200 classes and 200 lessons.');
      await load(selected.id);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update quotas');
    } finally {
      setBusy(false);
    }
  };

  const extendTrial = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await extendPartnerTrial(selected.id, 6);
      toast.success('Trial extended by six months.');
      await load(selected.id);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to extend trial');
    } finally {
      setBusy(false);
    }
  };

  const provisionDemo = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await provisionPartnerDemoClass(selected.id);
      toast.success('Isolated Altie Reality demo class is ready.');
      await load(selected.id);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to provision demo class');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"><FaChartLine className="text-teal-400" /> Channel Partner Oversight</h2>
          <p className="mt-1 text-sm text-muted-foreground">Logins, launches, last active, schools/sessions, and full activity history.</p>
        </div>
        <Button variant="outline" onClick={() => load(selected?.id)}><FaSyncAlt className="mr-2 h-3 w-3" /> Refresh</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 text-sm font-medium">Partner portfolio ({partners.length})</div>
            <div className="space-y-2">
              {partners.map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => openPartner(partner)}
                  className={`w-full rounded-lg border p-3 text-left transition hover:border-teal-400/50 hover:bg-teal-400/5 ${
                    selected?.id === partner.id ? 'border-teal-400/60 bg-teal-400/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{partner.organizationName}</span>
                    <span className="text-xs capitalize text-muted-foreground">{partner.status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Classes {partner.trial?.classLaunchesUsed ?? partner.classLaunchesUsed ?? 0}/{partner.trial?.classLaunchesLimit ?? 200}</span>
                    <span>Lessons {partner.trial?.lessonLaunchesUsed ?? partner.lessonLaunchesUsed ?? 0}/{partner.trial?.lessonLaunchesLimit ?? 200}</span>
                    <span>Logins {partner.loginCount ?? 0}</span>
                    <span>Active {relativeWhen(partner.lastActiveAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            {!selected ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Select a partner to review activity, launch geography, and entitlements.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="font-semibold">{selected.organizationName}</p>
                  <p className="text-xs text-muted-foreground">{selected.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.contactName}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/70 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><FaClock className="text-teal-400" /> Last active</p>
                    <p className="mt-1 text-sm font-medium">{relativeWhen(selected.lastActiveAt)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatWhen(selected.lastActiveAt)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><FaSignInAlt className="text-teal-400" /> Logins</p>
                    <p className="mt-1 text-sm font-medium">{selected.loginCount ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Last {relativeWhen(selected.lastLoginAt)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><FaPlay className="text-teal-400" /> Launches</p>
                    <p className="mt-1 text-sm font-medium">
                      {(selected.trial?.classLaunchesUsed ?? selected.classLaunchesUsed ?? 0)} class · {(selected.trial?.lessonLaunchesUsed ?? selected.lessonLaunchesUsed ?? 0)} lesson
                    </p>
                    <p className="text-[10px] text-muted-foreground">{selected.daysRemaining} trial days left</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><FaSchool className="text-teal-400" /> Reach</p>
                    <p className="mt-1 text-sm font-medium">{selected.schoolCount ?? 0} schools</p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><FaUsers /> {selected.sessionCount ?? 0} sessions</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={resetQuota}>Set 200/200 quotas</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={extendTrial}>Extend 6 months</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={provisionDemo}>Provision demo class</Button>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FaMapMarkerAlt className="text-teal-400" /> Consent-based launch locations</p>
                  {locations.length === 0 ? <p className="text-xs text-muted-foreground">No consented launch locations yet.</p> : (
                    <ul className="space-y-1 text-sm">{locations.map((location) => <li key={location.label} className="flex justify-between"><span>{location.label}</span><span className="text-muted-foreground">{location.launches}</span></li>)}</ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Activity timeline</p>
                  {events.length === 0 ? <p className="text-xs text-muted-foreground">No activity recorded yet.</p> : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
                      {events.map((event) => (
                        <li key={event.id} className="rounded border border-border/70 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{EVENT_LABELS[event.type] || event.type}</span>
                            <span className="shrink-0 text-muted-foreground">{formatWhen(event.createdAt)}</span>
                          </div>
                          {event.meta && Object.keys(event.meta).length > 0 ? (
                            <p className="mt-1 break-all text-muted-foreground">
                              {Object.entries(event.meta)
                                .slice(0, 4)
                                .map(([key, value]) => `${key}: ${typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value)}`)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerOversight;
