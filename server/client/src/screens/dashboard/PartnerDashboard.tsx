import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { FaHandshake, FaSchool, FaCopy, FaChalkboardTeacher, FaPlay, FaLocationArrow, FaUsers, FaUserTimes, FaEye } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { useLesson } from '../../contexts/LessonContext';
import { db } from '../../config/firebase';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { removeStudentFromSession } from '../../services/classSessionService';
import { StudentScreen360Preview } from '../../Components/StudentScreen360Preview';
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
  launchPartnerDemoLesson,
  listPartnerSchools,
  recordPartnerLaunchTelemetry,
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

type DemoLesson = {
  id: string;
  chapterId: string;
  topicId: string;
  title: string;
  sceneId?: string;
};

const PartnerDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { startLesson: startLessonInPlayer } = useLesson();
  const {
    activeSession: liveSession,
    activeSessionId,
    progressList,
    bindActiveSession,
    endSession,
    leaveSessionAsTeacher,
    sessionLoading,
  } = useClassSession();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [trialActive, setTrialActive] = useState(true);
  const [trialBlockReason, setTrialBlockReason] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<TeacherRow[]>([]);
  const [classesBySchool, setClassesBySchool] = useState<Record<string, ClassRow[]>>({});
  const [selectedClassBySchool, setSelectedClassBySchool] = useState<Record<string, string>>({});
  const [demoLessons, setDemoLessons] = useState<DemoLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [activeSession, setActiveSession] = useState<{ id: string; code: string; schoolId: string; classId: string } | null>(null);
  const [telemetryConsent, setTelemetryConsent] = useState(false);
  const [removingStudentUid, setRemovingStudentUid] = useState<string | null>(null);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [studentSkyboxUrl, setStudentSkyboxUrl] = useState<string | null>(null);
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

      const chapterSnap = await getDocs(collection(db, 'curriculum_chapters'));
      const lessons = chapterSnap.docs.flatMap((chapterDoc) => {
        const chapter = chapterDoc.data();
        const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
        return topics
          .filter((topic: Record<string, unknown>) => topic.isDemo === true && (topic.approval as { approved?: boolean } | undefined)?.approved !== false)
          .map((topic: Record<string, unknown>) => ({
            id: `${chapterDoc.id}:${String(topic.topic_id || topic.id || '')}`,
            chapterId: chapterDoc.id,
            topicId: String(topic.topic_id || topic.id || ''),
            title: String(topic.title || topic.topic_name || chapter.chapter_name || chapter.title || 'Demo lesson'),
            sceneId: typeof topic.scene_id === 'string' ? topic.scene_id : undefined,
          }))
          .filter((topic: DemoLesson) => Boolean(topic.topicId));
      });
      setDemoLessons(lessons);

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

  useEffect(() => {
    const session = activeSession ?? liveSession;
    if (!session?.id || session.status === 'ended') return;
    bindActiveSession(session.id);
  }, [activeSession, liveSession?.id, liveSession?.status, bindActiveSession]);

  useEffect(() => {
    const launched = liveSession?.launched_lesson;
    if (!launched || !progressList.length) {
      setStudentSkyboxUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getLessonBundle } = await import('../../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({ chapterId: launched.chapter_id, topicId: launched.topic_id, lang: 'en' });
        const topic = bundle.chapter?.topics?.find((item: any) => item.topic_id === launched.topic_id) || bundle.chapter?.topics?.[0];
        const url = (bundle.skybox as any)?.imageUrl || (bundle.skybox as any)?.file_url || topic?.skybox_url || null;
        if (!cancelled) setStudentSkyboxUrl(url);
      } catch {
        if (!cancelled) setStudentSkyboxUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [liveSession?.launched_lesson, progressList.length]);

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
      setActiveSession({ id: result.sessionId, code: result.sessionCode, schoolId, classId });
      bindActiveSession(result.sessionId);
      sessionStorage.setItem(
        'learnxr_partner_demo_session',
        JSON.stringify({ id: result.sessionId, code: result.sessionCode, schoolId, classId })
      );
      if (telemetryConsent && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async ({ coords }) => {
            try {
              const location = await recordPartnerLaunchTelemetry(result.sessionId, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
              toast.info(`Launch telemetry recorded${location.city ? ` for ${location.city}` : ''}.`);
            } catch {
              toast.info('Demo started. Location telemetry could not be recorded.');
            }
          },
          () => toast.info('Demo started without location telemetry.'),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      }
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start demo');
    } finally {
      setBusy(false);
    }
  };

  const handleLaunchLesson = async () => {
    const lesson = demoLessons.find((item) => item.id === selectedLessonId);
    if (!activeSession || !lesson) {
      toast.error('Start a demo session and select an approved demo lesson first.');
      return;
    }
    setBusy(true);
    try {
      const result = await launchPartnerDemoLesson(activeSession.id, lesson);
      toast.success(`Lesson launched. ${result.lessonLaunchesRemaining} demo lesson launches remaining.`);
      await refresh();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to launch lesson');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveStudent = async (studentUid: string) => {
    if (!activeSessionId || !profile?.uid) return;
    setRemovingStudentUid(studentUid);
    try {
      const ok = await removeStudentFromSession(activeSessionId, profile.uid, studentUid);
      if (ok) toast.success('Student removed from the demo session.');
      else toast.error('Could not remove student.');
    } finally {
      setRemovingStudentUid(null);
    }
  };

  const handleEndDemo = async () => {
    const ok = await endSession();
    if (ok) {
      setActiveSession(null);
      sessionStorage.removeItem('learnxr_partner_demo_session');
      toast.success('Demo session ended.');
    } else {
      toast.error('Could not end the demo session.');
    }
  };

  const handleControlClassView = async () => {
    const launched = liveSession?.launched_lesson;
    if (!launched || !activeSessionId) {
      toast.error('Launch a demo lesson before opening class view controls.');
      return;
    }
    setBusy(true);
    try {
      const { getLessonBundle } = await import('../../services/firestore/getLessonBundle');
      const bundle = await getLessonBundle({
        chapterId: launched.chapter_id,
        topicId: launched.topic_id,
        lang: 'en',
      });
      const sourceChapter = bundle.chapter;
      const sourceTopic = sourceChapter.topics?.find((item: any) => item.topic_id === launched.topic_id) || sourceChapter.topics?.[0];
      if (!sourceTopic) throw new Error('The launched lesson is no longer available.');
      startLessonInPlayer(
        {
          chapter_id: String(launched.chapter_id),
          chapter_name: String(sourceChapter.chapter_name || 'Demo lesson'),
          chapter_number: Number(sourceChapter.chapter_number) || 1,
          curriculum: String(sourceChapter.curriculum || ''),
          class_name: String(sourceChapter.class_name || ''),
          subject: String(sourceChapter.subject || ''),
        },
        {
          ...sourceTopic,
          topic_id: String(sourceTopic.topic_id || launched.topic_id),
          topic_name: String(sourceTopic.topic_name || 'Demo lesson'),
          topic_priority: Number(sourceTopic.topic_priority) || 1,
          learning_objective: String(sourceTopic.learning_objective || ''),
          in3d_prompt: String(sourceTopic.in3d_prompt || ''),
          mcqs: Array.isArray(bundle.mcqs) ? bundle.mcqs : sourceTopic.mcqs,
          ttsAudio: Array.isArray(bundle.tts) ? bundle.tts : sourceTopic.ttsAudio,
        }
      );
      sessionStorage.setItem('learnxr_class_session_id', activeSessionId);
      navigate('/vrlessonplayer-krpano');
    } catch (error: any) {
      toast.error(error?.message || 'Could not open the class view controls.');
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
              200 class launches and 200 approved demo lesson launches for six months. Each partner receives an isolated Altie Reality demo class.
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
              <span className="text-muted-foreground">Classes </span>
              <span className="font-semibold">
                {partner.trial?.classLaunchesRemaining ?? 0}/{partner.trial?.classLaunchesLimit ?? 200}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Lessons </span>
              <span className="font-semibold">
                {partner.trial?.lessonLaunchesRemaining ?? 0}/{partner.trial?.lessonLaunchesLimit ?? 200}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Days left </span>
              <span className="font-semibold">{daysLeft ?? '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-teal-400/30">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 font-medium">
            <FaPlay className="text-teal-400" /> Live demo classroom
          </div>
          {!activeSession ? (
            <p className="text-sm text-muted-foreground">
              Choose your isolated demo class below, then start a session to receive a student join code.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-lg border border-teal-400/20 bg-teal-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Session code</p>
                  <code className="mt-1 inline-block rounded bg-background px-2 py-1 font-mono text-lg tracking-widest">
                    {activeSession.code}
                  </code>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyText(activeSession.code, 'Session code')}>
                  <FaCopy className="mr-2 h-3 w-3" /> Copy code
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={selectedLessonId}
                  onChange={(event) => setSelectedLessonId(event.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select an approved demo lesson</option>
                  {demoLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                  ))}
                </select>
                <Button disabled={busy || !selectedLessonId} onClick={handleLaunchLesson}>
                  <FaPlay className="mr-2 h-3 w-3" /> Launch lesson
                </Button>
              </div>
              {demoLessons.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No approved demo lessons are available. Ask a Super Admin to mark lessons as demo-ready.
                </p>
              )}
            </>
          )}
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={telemetryConsent}
              onChange={(event) => setTelemetryConsent(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="flex items-center gap-2 font-medium"><FaLocationArrow className="text-teal-400" /> Share coarse launch location</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                With consent, LearnXR records city and country for this demo launch. Precise coordinates are discarded and launch telemetry is retained for 90 days.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {liveSession && liveSession.status !== 'ended' && (
        <Card className="border-primary/30">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium"><FaUsers className="text-primary" /> Live class controls</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Session {liveSession.session_code} · {liveSession.status} · {progressList.length} connected student{progressList.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyText(liveSession.session_code, 'Session code')}><FaCopy className="mr-2 h-3 w-3" /> Copy code</Button>
                {liveSession.launched_lesson && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={handleControlClassView}>
                    <FaEye className="mr-2 h-3 w-3" /> Control class view
                  </Button>
                )}
                <Button size="sm" variant="destructive" disabled={sessionLoading} onClick={handleEndDemo}>End session</Button>
              </div>
            </div>
            {!liveSession.launched_lesson ? (
              <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                Select an approved demo lesson above, or use Lessons → Launch in Class to begin live instruction.
              </p>
            ) : (
              <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                Live lesson: {liveSession.launched_lesson.title || liveSession.launched_lesson.topic_id}. Open the launched lesson in your player to broadcast your 360° view.
              </p>
            )}
            {progressList.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No students have joined yet. Share the session code with guests or students.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Student roster and progress</p>
                  {progressList.map((student) => (
                    <div key={student.student_uid} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <button className="min-w-0 text-left" onClick={() => setSelectedStudentUid(student.student_uid)}>
                        <p className="truncate text-sm font-medium">{student.display_name || student.email || `Student ${student.student_uid.slice(0, 6)}`}</p>
                        <p className="text-xs capitalize text-muted-foreground">{student.phase || 'connected'}</p>
                      </button>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelectedStudentUid(student.student_uid)} title="See this student's view"><FaEye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="destructive" disabled={removingStudentUid === student.student_uid} onClick={() => handleRemoveStudent(student.student_uid)} title="Remove student">
                          {removingStudentUid === student.student_uid ? <Loader2 className="h-3 w-3 animate-spin" /> : <FaUserTimes className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Student view</p>
                  {(() => {
                    const student = progressList.find((item) => item.student_uid === selectedStudentUid) || progressList[0];
                    const name = student?.display_name || student?.email || 'Student';
                    return student?.student_view && studentSkyboxUrl ? (
                      <StudentScreen360Preview
                        skyboxUrl={studentSkyboxUrl}
                        view={student.student_view}
                        studentName={name}
                        phaseLabel={student.phase || 'Connected'}
                        getApiBaseUrl={getApiBaseUrl}
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        {student ? `${name}'s 360° view appears once they enter the live lesson.` : 'Select a student to inspect their live view.'}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
