/**
 * 360 Video — equirectangular VR360 video tours (krpano).
 * Play for everyone; teachers / partners / staff can Launch in class.
 * Distinct from AirPano still panoramas at /lessons/360.
 */

import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { Play, Users, Video } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../Components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Components/ui/select';
import { db } from '../config/firebase';
import { VR360_TOUR_CHAPTER_ID, topicIdForVr360TourId, VR360_TOURS } from '../config/vr360Tours';
import { useAuth } from '../contexts/AuthContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import { launchPartnerDemoLesson } from '../services/partnerService';
import { isAdminOnly, isSuperadmin } from '../utils/rbac';

function readPartnerDemoSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('learnxr_partner_demo_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return {
      id: String(parsed.id),
      code: typeof parsed.code === 'string' ? parsed.code : null,
      schoolId: typeof parsed.schoolId === 'string' ? parsed.schoolId : null,
      classId: typeof parsed.classId === 'string' ? parsed.classId : null,
    };
  } catch {
    return null;
  }
}

const LessonsVr360 = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    activeSessionId,
    activeSession,
    startSession,
    endSession,
    launchLesson: launchLessonToClass,
    bindActiveSession,
    leaveSessionAsTeacher,
    sessionLoading: sessionJoinLoading,
  } = useClassSession();

  const [teacherClasses, setTeacherClasses] = useState([]);
  const [hostSessionClasses, setHostSessionClasses] = useState([]);
  const [vrHostClassId, setVrHostClassId] = useState('');
  const [partnerDemoSession, setPartnerDemoSession] = useState(() => readPartnerDemoSession());

  const isTeacher = profile?.role === 'teacher';
  const isPartner = profile?.role === 'partner';
  const isPrincipal = profile?.role === 'principal';
  const isSchoolStaff = profile?.role === 'school';
  const isHostVr =
    isTeacher || isPartner || isAdminOnly(profile) || isSuperadmin(profile) || isPrincipal || isSchoolStaff;
  const isGuest = !!(profile?.isGuest === true && profile?.role === 'student');

  const hostClassesForVr = useMemo(() => {
    if (isTeacher) return teacherClasses;
    if (isPartner) return []; // partners use demo sessions, not traditional class lists
    return hostSessionClasses;
  }, [isTeacher, isPartner, teacherClasses, hostSessionClasses]);

  // Keep partner demo session in sync (Partner Dashboard writes sessionStorage)
  useEffect(() => {
    if (!isPartner) {
      setPartnerDemoSession(null);
      return;
    }
    const sync = () => setPartnerDemoSession(readPartnerDemoSession());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, [isPartner]);

  // Bind partner demo session into ClassSessionContext so students/host overlays work
  useEffect(() => {
    if (!isPartner || !bindActiveSession || !partnerDemoSession?.id) return;
    if (partnerDemoSession.id !== activeSessionId) {
      bindActiveSession(partnerDemoSession.id);
    }
  }, [isPartner, partnerDemoSession?.id, activeSessionId, bindActiveSession]);

  // Teachers: load classes via teacher_ids (+ shared), same as TeacherDashboard.
  // managed_class_ids alone is often empty/stale even when the teacher can host.
  useEffect(() => {
    if (!isTeacher || !user?.uid || !db) {
      setTeacherClasses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const byIds = new Map();

        const managedQuery = profile?.school_id
          ? query(
              collection(db, 'classes'),
              where('school_id', '==', profile.school_id),
              where('teacher_ids', 'array-contains', user.uid)
            )
          : query(collection(db, 'classes'), where('teacher_ids', 'array-contains', user.uid));
        const managedSnap = await getDocs(managedQuery);
        managedSnap.docs.forEach((d) => byIds.set(d.id, { id: d.id, ...d.data() }));

        if (profile?.school_id) {
          try {
            const sharedQuery = query(
              collection(db, 'classes'),
              where('school_id', '==', profile.school_id),
              where('shared_with_teachers', 'array-contains', user.uid)
            );
            const sharedSnap = await getDocs(sharedQuery);
            sharedSnap.docs.forEach((d) => byIds.set(d.id, { id: d.id, ...d.data() }));
          } catch (err) {
            console.warn('LessonsVr360: shared classes', err);
          }
        }

        // Fallback: profile.managed_class_ids (legacy / Approvals path)
        if (byIds.size === 0 && Array.isArray(profile?.managed_class_ids)) {
          const fromProfile = (
            await Promise.all(
              profile.managed_class_ids.map(async (classId) => {
                try {
                  const classDoc = await getDoc(doc(db, 'classes', classId));
                  if (classDoc.exists()) return { id: classId, ...classDoc.data() };
                } catch (err) {
                  console.warn(`LessonsVr360: class ${classId}`, err);
                }
                return null;
              })
            )
          ).filter(Boolean);
          fromProfile.forEach((c) => byIds.set(c.id, c));
        }

        if (!cancelled) setTeacherClasses([...byIds.values()]);
      } catch (error) {
        console.error('LessonsVr360: teacher classes', error);
        if (!cancelled) setTeacherClasses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTeacher, user?.uid, profile?.school_id, profile?.managed_class_ids, db]);

  // Staff / admin: school-scoped class list for hosting
  useEffect(() => {
    if (!isHostVr || !db || !profile || isTeacher || isPartner) {
      setHostSessionClasses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const schoolId = profile.school_id || profile.managed_school_id;
        if (schoolId) {
          const q = query(collection(db, 'classes'), where('school_id', '==', schoolId), limit(200));
          const snap = await getDocs(q);
          if (!cancelled) setHostSessionClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } else if (profile.role === 'superadmin') {
          const q = query(collection(db, 'classes'), limit(200));
          const snap = await getDocs(q);
          if (!cancelled) setHostSessionClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } else {
          if (!cancelled) setHostSessionClasses([]);
        }
      } catch (e) {
        console.error('LessonsVr360: hostSessionClasses', e);
        if (!cancelled) setHostSessionClasses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHostVr, isTeacher, isPartner, db, profile?.uid, profile?.school_id, profile?.managed_school_id, profile?.role]);

  useEffect(() => {
    const list = hostClassesForVr;
    if (!list.length) {
      setVrHostClassId('');
      return;
    }
    setVrHostClassId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
  }, [hostClassesForVr]);

  const handlePlayVr360Tour = useCallback(
    (tour) => {
      const vr = {
        tourId: tour.id,
        title: tour.title,
        videoPath: tour.videoPath,
        videoStoragePath: tour.videoStoragePath,
        player: tour.player,
        fromClassSession: false,
      };
      try {
        sessionStorage.setItem('learnxr_vr360_tour', JSON.stringify(vr));
      } catch (e) {
        console.warn(e);
      }
      navigate('/vr360-videotour', { state: { vr360: vr } });
    },
    [navigate]
  );

  const handleStartVrClassSession = useCallback(async () => {
    if (!vrHostClassId || !startSession) return;
    const id = await startSession(vrHostClassId);
    if (id) toast.success('Class session started — share the code with students');
    else toast.error('Could not start session');
  }, [vrHostClassId, startSession]);

  const openTourAsHost = useCallback(
    (tour, sessionId) => {
      const vr = {
        tourId: tour.id,
        title: tour.title,
        videoPath: tour.videoPath,
        videoStoragePath: tour.videoStoragePath,
        player: tour.player,
        fromClassSession: true,
      };
      try {
        sessionStorage.setItem('learnxr_vr360_tour', JSON.stringify(vr));
        if (sessionId) sessionStorage.setItem('learnxr_class_session_id', sessionId);
      } catch (e) {
        console.warn(e);
      }
      navigate('/vr360-videotour', { state: { vr360: vr } });
    },
    [navigate]
  );

  const handleLaunchVr360ToClass = useCallback(
    async (tour) => {
      if (isGuest) return;

      const payload = {
        chapter_id: VR360_TOUR_CHAPTER_ID,
        topic_id: topicIdForVr360TourId(tour.id),
        lesson_type: 'vr360_video',
        vr360_tour_id: tour.id,
        curriculum: 'VR',
        class_name: '',
        subject: '360° Video Tour',
        lang: 'en',
      };

      // Partners: same path as Lessons.jsx — demo session + launchPartnerDemoLesson (quota)
      if (isPartner) {
        const partnerSession = partnerDemoSession || readPartnerDemoSession();
        if (!partnerSession?.id) {
          toast.error('Start a Channel Partner demo session from your Partner Dashboard first.');
          return;
        }
        try {
          await launchPartnerDemoLesson(partnerSession.id, {
            chapterId: payload.chapter_id,
            topicId: payload.topic_id,
            title: tour.title,
            lessonType: 'vr360_video',
            vr360TourId: tour.id,
          });
          sessionStorage.setItem('learnxr_class_session_id', partnerSession.id);
          bindActiveSession?.(partnerSession.id);
          toast.success('360° video tour sent to class');
          openTourAsHost(tour, partnerSession.id);
        } catch (error) {
          toast.error(error?.message || 'Could not launch the demo tour.');
        }
        return;
      }

      if (!launchLessonToClass) return;

      let sessionId = activeSessionId;
      if (sessionId && !activeSession) {
        leaveSessionAsTeacher?.();
        sessionId = null;
      }
      if (!sessionId && startSession && vrHostClassId) {
        const newId = await startSession(vrHostClassId);
        if (!newId) {
          toast.error('Could not start class session. Pick a class and try again.');
          return;
        }
        sessionId = newId;
      }
      if (!sessionId) {
        toast.error('Start a class session first (select class and Start session).');
        return;
      }
      const ok = await launchLessonToClass(payload, sessionId);
      if (ok) {
        toast.success('360° video tour sent to class');
        openTourAsHost(tour, sessionId);
      } else {
        toast.error('Failed to launch tour to class');
      }
    },
    [
      isGuest,
      isPartner,
      partnerDemoSession,
      launchLessonToClass,
      bindActiveSession,
      openTourAsHost,
      activeSessionId,
      activeSession,
      leaveSessionAsTeacher,
      startSession,
      vrHostClassId,
    ]
  );

  const partnerCanLaunch = isPartner && !isGuest && Boolean(partnerDemoSession?.id || activeSessionId);
  const staffCanLaunch =
    isHostVr &&
    !isPartner &&
    !isGuest &&
    hostClassesForVr.length > 0 &&
    (activeSessionId || vrHostClassId) &&
    !!launchLessonToClass;
  const canLaunchVr360ToClass = partnerCanLaunch || staffCanLaunch;

  const partnerSessionCode =
    partnerDemoSession?.code || activeSession?.session_code || null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">360 Video</h1>
              <p className="text-xs text-muted-foreground">
                Equirectangular 360° VR video tours. Students join with your session code like other live lessons.
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Video className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">360° video VR tours</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Play any tour, or launch one to a live class when you are hosting.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 space-y-4">
            {isPartner && !isGuest && (
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                {partnerDemoSession?.id || activeSessionId ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground shrink-0">Partner demo session</span>
                    <span className="text-sm font-mono font-semibold text-primary tracking-wider">
                      Code: {partnerSessionCode || '—'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="sm:ml-auto"
                      onClick={() => {
                        endSession?.();
                        sessionStorage.removeItem('learnxr_partner_demo_session');
                        setPartnerDemoSession(null);
                      }}
                    >
                      End demo
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Start a demo session from your{' '}
                    <Link to="/dashboard/partner" className="text-primary underline underline-offset-2">
                      Partner Dashboard
                    </Link>{' '}
                    (select school + class), then return here to Launch in class.
                  </p>
                )}
              </div>
            )}

            {!isPartner && isHostVr && !isGuest && hostClassesForVr.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground shrink-0">Class for live session</span>
                  <Select value={vrHostClassId || ''} onValueChange={setVrHostClassId}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-background border-border text-foreground">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {hostClassesForVr.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.class_name || c.name || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!activeSessionId ? (
                  <Button size="sm" onClick={handleStartVrClassSession} disabled={sessionJoinLoading || !vrHostClassId}>
                    Start class session
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto">
                    <span className="text-sm font-mono font-semibold text-primary tracking-wider">
                      Code: {activeSession?.session_code || '—'}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => endSession?.()}>
                      End session
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!isPartner && isHostVr && !isGuest && !hostClassesForVr.length && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No class found to host. Ask your admin to assign classes to your account.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {VR360_TOURS.map((tour) => (
                <div
                  key={tour.id}
                  className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Video className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tour.title}</p>
                      {tour.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tour.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Button size="sm" className="gap-1" onClick={() => handlePlayVr360Tour(tour)}>
                      <Play className="h-3.5 w-3.5" />
                      Play
                    </Button>
                    {isHostVr && !isGuest && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => handleLaunchVr360ToClass(tour)}
                        disabled={!canLaunchVr360ToClass}
                        title={
                          !canLaunchVr360ToClass
                            ? isPartner
                              ? 'Start a demo session from Partner Dashboard first'
                              : 'Start a class session, then launch'
                            : 'Send this tour to joined students'
                        }
                      >
                        <Users className="h-3.5 w-3.5" />
                        Launch in class
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isGuest && (
              <p className="text-xs text-muted-foreground">
                Guests can play tours here. Sign up for a full account to host live class sessions.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LessonsVr360;
