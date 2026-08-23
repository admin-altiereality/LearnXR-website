/**
 * Class Session Results
 * ---------------------
 * End-of-lesson marks for the teacher: every student, their score, attendance and
 * how far they got.
 *
 * Reads the session's `progress` subcollection by URL param rather than from
 * ClassSessionContext, because endSession() clears activeSessionId before this
 * screen mounts. The progress docs survive the session ending, and the host read
 * rule still passes as long as the parent session doc exists.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getSession, subscribeSessionProgress } from '../../services/classSessionService';
import type { ClassSession, SessionStudentProgress } from '../../types/lms';
import { resolveStudentDisplayName } from '../../utils/displayName';
import { Card, CardContent } from '../../Components/ui/card';
import { Button } from '../../Components/ui/button';
import { Badge } from '../../Components/ui/badge';
import { learnXRFontStyle } from '../../Components/LearnXRTypography';
import { FaDownload, FaUsers, FaClock, FaHandPaper, FaArrowLeft } from 'react-icons/fa';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate();
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const ClassSessionResults = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const [session, setSession] = useState<ClassSession | null>(null);
  const [progress, setProgress] = useState<SessionStudentProgress[]>([]);
  const [className, setClassName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const s = await getSession(sessionId);
      if (cancelled) return;
      if (!s) {
        setError('This class session could not be found.');
        setLoading(false);
        return;
      }
      setSession(s);
      if (s.class_id) {
        try {
          const snap = await getDoc(doc(db, 'classes', s.class_id));
          if (!cancelled && snap.exists()) {
            const d = snap.data();
            setClassName(d?.class_name || d?.name || s.class_id);
          }
        } catch {
          /* class name is cosmetic */
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeSessionProgress(
      sessionId,
      (list) => setProgress(list),
      () => setError('You do not have permission to view these results.')
    );
    return () => unsub();
  }, [sessionId]);

  const rows = useMemo(() => {
    return [...progress]
      .filter((p) => p?.student_uid)
      .map((p) => {
        const total = p.quiz_total ?? 0;
        const score = p.quiz_score ?? null;
        return {
          uid: p.student_uid,
          name: resolveStudentDisplayName(null, null, {
            uid: p.student_uid,
            displayName: p.display_name,
            email: p.email,
          }),
          email: p.email ?? '',
          phase: p.phase || 'connected',
          score,
          total,
          percentage: total > 0 && score !== null ? Math.round((score / total) * 100) : null,
          joinedAt: toDate(p.joined_at),
          duration: p.duration_seconds ?? null,
          handRaises: p.hand_raise_count ?? 0,
          removed: p.removed === true,
        };
      })
      .sort((a, b) => {
        // Highest score first, then unscored, then removed students last.
        if (a.removed !== b.removed) return a.removed ? 1 : -1;
        if (a.percentage === null && b.percentage === null) return a.name.localeCompare(b.name);
        if (a.percentage === null) return 1;
        if (b.percentage === null) return -1;
        return b.percentage - a.percentage;
      });
  }, [progress]);

  const stats = useMemo(() => {
    const scored = rows.filter((r) => r.percentage !== null && !r.removed);
    const avg = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / scored.length)
      : null;
    const completed = rows.filter((r) => r.phase === 'completed').length;
    return { attended: rows.length, scored: scored.length, avg, completed };
  }, [rows]);

  const exportCsv = () => {
    const header = ['Student', 'Email', 'Score', 'Total', 'Percent', 'Phase', 'Joined', 'Duration (s)', 'Hand raises', 'Removed'];
    const lines = rows.map((r) =>
      [
        r.name,
        r.email,
        r.score ?? '',
        r.total || '',
        r.percentage ?? '',
        r.phase,
        r.joinedAt ? r.joinedAt.toISOString() : '',
        r.duration ?? '',
        r.handRaises,
        r.removed ? 'yes' : 'no',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-results-${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const backTo =
    profile?.role === 'partner' ? '/dashboard/partner' : '/dashboard/teacher';

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-muted-foreground">Loading results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <header className="mb-6">
          <Link
            to={backTo}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <FaArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground" style={learnXRFontStyle}>
                Lesson results
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {className || session?.class_id}
                {session?.launched_lesson?.title ? ` · ${session.launched_lesson.title}` : ''}
              </p>
            </div>
            {rows.length > 0 && (
              <Button variant="outline" onClick={exportCsv} className="gap-2">
                <FaDownload className="h-3 w-3" /> Export CSV
              </Button>
            )}
          </div>
        </header>

        {error && (
          <Card className="mb-6 rounded-xl border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Attended', value: stats.attended, icon: FaUsers },
            { label: 'Completed', value: stats.completed, icon: FaClock },
            { label: 'Took quiz', value: stats.scored, icon: FaHandPaper },
            { label: 'Class average', value: stats.avg === null ? '—' : `${stats.avg}%`, icon: FaUsers },
          ].map((s) => (
            <Card key={s.label} className="rounded-xl border-border bg-card">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-xl border-border bg-card">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="p-10 text-center">
                <FaUsers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                <p className="font-medium text-foreground">No students joined this session</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Marks appear here once students join and complete the lesson.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Marks</th>
                      <th className="px-4 py-3 font-semibold">Progress</th>
                      <th className="px-4 py-3 font-semibold">Joined</th>
                      <th className="px-4 py-3 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.uid}
                        className={`border-b border-border/60 last:border-0 ${
                          r.removed ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-2 font-medium text-foreground">
                            {r.name}
                            {r.removed && (
                              <Badge variant="outline" className="text-[10px]">removed</Badge>
                            )}
                            {r.handRaises > 0 && (
                              <span
                                title={`${r.handRaises} hand raise(s)`}
                                className="text-[10px] text-amber-500"
                              >
                                ✋{r.handRaises}
                              </span>
                            )}
                          </p>
                          {r.email && (
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.percentage === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="font-semibold tabular-nums text-foreground">
                              {r.score}/{r.total}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {r.percentage}%
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{r.phase}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {r.joinedAt
                            ? r.joinedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatDuration(r.duration)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-xs text-muted-foreground">
          Marks are also saved to each student's own dashboard history. Students without a
          school account (guest / partner demo) are not written to the gradebook.
        </p>
      </div>
    </div>
  );
};

export default ClassSessionResults;
