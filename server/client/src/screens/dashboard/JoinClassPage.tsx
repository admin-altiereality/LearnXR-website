/**
 * Join a Class – Student page listing active sessions for their school.
 * Students can join directly without the teacher sharing the code.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { getActiveSessionsForSchool } from '../../services/classSessionService';
import type { ClassSession } from '../../types/lms';
import { Card, CardContent } from '../../Components/ui/card';
import { Button } from '../../Components/ui/button';
import { FaChalkboardTeacher, FaUsers, FaVideo, FaArrowRight } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { toast } from 'react-toastify';

interface SessionWithDetails extends ClassSession {
  className?: string;
  teacherName?: string;
}

const JoinClassPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { joinSession, sessionLoading, joinedSessionId } = useClassSession();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);

  const schoolId = profile?.school_id || (profile as { managed_school_id?: string })?.managed_school_id;
  const isStudent = profile?.role === 'student';

  const fetchSessions = useCallback(async () => {
    if (!schoolId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getActiveSessionsForSchool(schoolId);
      if (list.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }
      const classIds = [...new Set(list.map((s) => s.class_id))];
      const teacherUids = [...new Set(list.map((s) => s.teacher_uid))];
      const classesSnap = await Promise.all(
        classIds.map((id) => getDoc(doc(db, 'classes', id)))
      );
      const teachersSnap = await Promise.all(
        teacherUids.map((uid) => getDoc(doc(db, 'users', uid)))
      );
      const classNames: Record<string, string> = {};
      classesSnap.forEach((snap, i) => {
        if (snap.exists()) {
          const d = snap.data();
          classNames[classIds[i]] = d?.class_name || d?.name || classIds[i];
        }
      });
      const teacherNames: Record<string, string> = {};
      teachersSnap.forEach((snap, i) => {
        if (snap.exists()) {
          const d = snap.data();
          teacherNames[teacherUids[i]] = d?.name || d?.displayName || d?.email || teacherUids[i];
        }
      });
      const withDetails: SessionWithDetails[] = list.map((s) => ({
        ...s,
        className: classNames[s.class_id] || s.class_id,
        teacherName: teacherNames[s.teacher_uid] || 'Teacher',
      }));
      setSessions(withDetails);
    } catch (e) {
      console.error('JoinClassPage fetch sessions:', e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleJoin = async (sessionCode: string) => {
    setJoiningCode(sessionCode);
    try {
      const ok = await joinSession(sessionCode);
      if (ok) {
        toast.success('Joined class. Go to your dashboard to wait for the lesson.');
        navigate('/dashboard/student', { replace: true });
      }
    } finally {
      setJoiningCode(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-24">
        <Card className="max-w-md w-full rounded-xl border-border">
          <CardContent className="p-8 text-center">
            <p className="text-foreground mb-6">Sign in to see active classes and join.</p>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isStudent) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="rounded-xl border-border">
            <CardContent className="p-8 text-center">
              <p className="text-foreground">Only students can join a class from this page.</p>
              <Button asChild className="mt-4">
                <Link to="/">Go home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-foreground" style={learnXRFontStyle}>
              Join a class
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              See active classes from your school and join with one click.
            </p>
          </header>
          <Card className="rounded-xl border-border">
            <CardContent className="p-8 text-center">
              <p className="text-foreground">Sign in and join a school to see active classes.</p>
              <p className="text-sm text-muted-foreground mt-2">If you belong to a school, ask your teacher to add you to a class.</p>
              <Button asChild className="mt-4">
                <Link to="/dashboard/student">My dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" style={learnXRFontStyle}>
            <FaVideo className="text-primary" />
            Join a class
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Active classes from your school. Click Join to enter — no code needed.
          </p>
        </header>

        {loading ? (
          <Card className="rounded-xl border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading active classes…
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="rounded-xl border-border">
            <CardContent className="p-8 text-center">
              <FaChalkboardTeacher className="text-4xl text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">No active classes right now</p>
              <p className="text-sm text-muted-foreground mt-1">
                When a teacher starts a class session, it will appear here. You can also join with a code from your dashboard.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/dashboard/student">My dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isJoined = joinedSessionId === session.id;
              const isJoining = sessionLoading && joiningCode === session.session_code;
              return (
                <Card key={session.id} className="rounded-xl border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {session.className || session.class_id}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <FaChalkboardTeacher className="w-3.5 h-3.5 shrink-0" />
                        {session.teacherName}
                      </p>
                      {session.launched_lesson && (
                        <p className="text-xs text-primary mt-1">
                          Lesson: {session.launched_lesson.chapter_id} → {session.launched_lesson.topic_id}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                        Code: {session.session_code}
                      </span>
                      {isJoined ? (
                        <Button size="sm" variant="secondary" asChild>
                          <Link to="/dashboard/student">In class →</Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleJoin(session.session_code)}
                          disabled={isJoining}
                        >
                          {isJoining ? 'Joining…' : 'Join'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center mt-6">
          <Link to="/dashboard/student" className="text-sm text-primary hover:underline">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
};

export default JoinClassPage;
