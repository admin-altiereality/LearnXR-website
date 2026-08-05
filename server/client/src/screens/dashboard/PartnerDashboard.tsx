import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { FaHandshake, FaSchool, FaCopy, FaChalkboardTeacher } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { Card, CardContent } from '../../Components/ui/card';
import { Button } from '../../Components/ui/button';
import { Badge } from '../../Components/ui/badge';
import type { Partner, PartnerEvent } from '../../types/partner';
import {
  approvePartnerTeacher,
  createPartnerSchool,
  createSchoolInvite,
  fetchPartnerActivity,
  fetchPartnerMe,
  listPartnerSchools,
  startPartnerDemoSession,
} from '../../services/partnerService';

type SchoolRow = {
  id: string;
  name?: string;
  schoolCode?: string;
  city?: string;
  state?: string;
  approvalStatus?: string;
};

type ClassRow = {
  id: string;
  class_name?: string;
  school_id?: string;
};

type TeacherRow = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  school_id?: string;
  approvalStatus?: string;
};

const PartnerDashboard = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [trialActive, setTrialActive] = useState(true);
  const [trialBlockReason, setTrialBlockReason] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<TeacherRow[]>([]);
  const [classesBySchool, setClassesBySchool] = useState<Record<string, ClassRow[]>>({});
  const [selectedClassBySchool, setSelectedClassBySchool] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [schoolForm, setSchoolForm] = useState({
    name: '',
    city: '',
    state: '',
    contactPerson: '',
    contactPhone: '',
    boardAffiliation: '',
    schoolType: '',
  });

  const schoolIds = useMemo(() => schools.map((s) => s.id), [schools]);

  const daysLeft = useMemo(() => {
    if (!partner?.trial?.endsAt) return null;
    const ms = new Date(partner.trial.endsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [partner?.trial?.endsAt]);

  const refresh = useCallback(async () => {
    if (profile?.role !== 'partner') return;
    setLoading(true);
    try {
      const me = await fetchPartnerMe();
      setPartner(me.partner);
      setTrialActive(me.trialActive);
      setTrialBlockReason(me.trialBlockReason);

      const schoolRes = await listPartnerSchools();
      const schoolList = (schoolRes.schools || []) as SchoolRow[];
      setSchools(schoolList);

      if (me.partner?.id) {
        const activity = await fetchPartnerActivity(me.partner.id);
        setEvents(activity.events || []);
      }

      // Load classes per school
      const classMap: Record<string, ClassRow[]> = {};
      for (const school of schoolList) {
        const classSnap = await getDocs(
          query(collection(db, 'classes'), where('school_id', '==', school.id))
        );
        classMap[school.id] = classSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as ClassRow[];
      }
      setClassesBySchool(classMap);

      // Pending teachers in partner schools
      if (schoolList.length > 0) {
        const teacherSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('approvalStatus', '==', 'pending')
          )
        );
        const ids = new Set(schoolList.map((s) => s.id));
        const teachers = teacherSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TeacherRow))
          .filter((t) => t.school_id && ids.has(t.school_id));
        setPendingTeachers(teachers);
      } else {
        setPendingTeachers([]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to load partner dashboard');
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleCreateSchool = async () => {
    if (!schoolForm.name.trim()) {
      toast.error('School name is required');
      return;
    }
    setBusy(true);
    try {
      const result = await createPartnerSchool(schoolForm);
      toast.success(`School created. Code: ${result.schoolCode}`);
      setSchoolForm({
        name: '',
        city: '',
        state: '',
        contactPerson: '',
        contactPhone: '',
        boardAffiliation: '',
        schoolType: '',
      });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create school');
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (schoolId: string) => {
    setBusy(true);
    try {
      const result = await createSchoolInvite(schoolId);
      await copyText(result.inviteUrl, 'Invite link');
      toast.info('Share this invite so the school admin can claim access (no shared password).');
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create invite');
    } finally {
      setBusy(false);
    }
  };

  const handleStartDemo = async (schoolId: string) => {
    const classId = selectedClassBySchool[schoolId];
    if (!classId) {
      toast.error('Select a class first (create classes under Class Management if needed)');
      return;
    }
    if (!trialActive) {
      toast.error(trialBlockReason || 'Trial inactive');
      return;
    }
    setBusy(true);
    try {
      const result = await startPartnerDemoSession(schoolId, classId);
      toast.success(`Demo session ready. Code: ${result.sessionCode}`);
      await copyText(result.sessionCode, 'Session code');
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start demo');
    } finally {
      setBusy(false);
    }
  };

  const handleTeacherDecision = async (teacherUid: string, approve: boolean) => {
    setBusy(true);
    try {
      await approvePartnerTeacher(teacherUid, approve);
      toast.success(approve ? 'Teacher approved' : 'Teacher rejected');
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update teacher');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-8 text-muted-foreground">
        Partner profile not found. Ask a superadmin to approve your application.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FaHandshake className="text-primary" />
          Partner Dashboard
        </h2>
        <p className="text-muted-foreground">
          {partner.organizationName} · onboard schools, approve teachers, run demos
        </p>
      </div>

      <Card className={!trialActive ? 'border-destructive/50' : ''}>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-medium">Trial entitlement</div>
            <p className="text-sm text-muted-foreground mt-1">
              100 class launches or 6 months — whichever comes first. Partner-hosted demos only;
              teachers at your schools keep their own logins after the trial.
            </p>
            {!trialActive && trialBlockReason && (
              <p className="text-sm text-destructive mt-2">{trialBlockReason}</p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <Badge variant={trialActive ? 'default' : 'destructive'} className="capitalize">
              {partner.status}
            </Badge>
            <div className="text-sm">
              <span className="text-muted-foreground">Launches left </span>
              <span className="font-semibold">
                {partner.trial?.classLaunchesRemaining ?? 0}/{partner.trial?.classLaunchesLimit ?? 100}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Days left </span>
              <span className="font-semibold">{daysLeft ?? '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 font-medium">
            <FaSchool /> Create school
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['name', 'School name *'],
                ['city', 'City'],
                ['state', 'State'],
                ['contactPerson', 'Contact person'],
                ['contactPhone', 'Contact phone'],
                ['boardAffiliation', 'Board'],
                ['schoolType', 'School type'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm space-y-1">
                <span className="text-muted-foreground">{label}</span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  value={schoolForm[key]}
                  onChange={(e) => setSchoolForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <Button disabled={busy || partner.status === 'suspended'} onClick={handleCreateSchool}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create school'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="font-medium">My schools ({schools.length})</div>
          {schools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schools yet. Create one above for your demo visit.</p>
          ) : (
            <div className="space-y-4">
              {schools.map((school) => {
                const classes = classesBySchool[school.id] || [];
                return (
                  <div key={school.id} className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{school.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[school.city, school.state].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {school.schoolCode || '—'}
                        </code>
                        {school.schoolCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyText(school.schoolCode!, 'School code')}
                          >
                            <FaCopy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share the school code so teachers/students can join during onboarding.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <select
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={selectedClassBySchool[school.id] || ''}
                        onChange={(e) =>
                          setSelectedClassBySchool((m) => ({ ...m, [school.id]: e.target.value }))
                        }
                      >
                        <option value="">Select class for demo</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.class_name || c.id}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={busy || !trialActive || partner.status === 'suspended'}
                        onClick={() => handleStartDemo(school.id)}
                      >
                        Start demo session
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => handleInvite(school.id)}
                      >
                        Copy school-admin invite
                      </Button>
                    </div>
                    {classes.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        No classes yet. Create classes via Class Management (or have the school admin do it)
                        before starting a session.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 font-medium">
            <FaChalkboardTeacher /> Pending teachers
          </div>
          {pendingTeachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending teachers in your schools.</p>
          ) : (
            <ul className="space-y-3">
              {pendingTeachers.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-md p-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">{t.displayName || t.name || t.email || t.id}</div>
                    <div className="text-muted-foreground">{t.email}</div>
                    <div className="text-xs text-muted-foreground">
                      School:{' '}
                      {schools.find((s) => s.id === t.school_id)?.name || t.school_id}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => handleTeacherDecision(t.id, true)}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => handleTeacherDecision(t.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="font-medium">Activity</div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="font-medium">{e.type}</span>
                  <span className="text-muted-foreground text-xs truncate">
                    {e.schoolId
                      ? schools.find((s) => s.id === e.schoolId)?.name || e.schoolId
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {schoolIds.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">
              Tracking {schoolIds.length} school(s) under your partner_id.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerDashboard;
