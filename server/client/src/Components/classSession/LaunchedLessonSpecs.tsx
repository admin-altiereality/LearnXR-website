/**
 * LaunchedLessonSpecs
 * -------------------
 * Stats for one launch of a lesson to a class: attendance, scores, engagement
 * and a per-student breakdown.
 *
 * Everything comes from the session's `progress` subcollection, which survives
 * the session ending — so a teacher can reopen a past launch and still see how
 * the class did.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { subscribeSessionProgress } from '../../services/classSessionService';
import type { SessionStudentProgress } from '../../types/lms';
import { resolveStudentDisplayName } from '../../utils/displayName';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FaTimes, FaDownload } from 'react-icons/fa';

interface LaunchedLessonSpecsProps {
  sessionId: string;
  classId?: string | null;
  lessonTitle?: string | null;
  onClose: () => void;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const PHASE_ORDER = ['idle', 'loading', 'intro', 'explanation', 'exploration', 'outro', 'quiz', 'completed'];

export const LaunchedLessonSpecs = ({
  sessionId,
  classId,
  lessonTitle,
  onClose,
}: LaunchedLessonSpecsProps) => {
  const [progress, setProgress] = useState<SessionStudentProgress[]>([]);
  const [enrolled, setEnrolled] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeSessionProgress(
      sessionId,
      (list) => {
        setProgress(list);
        setLoaded(true);
      },
      () => {
        setError('You do not have permission to view these results.');
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'classes', classId));
        if (cancelled || !snap.exists()) return;
        const ids = snap.data()?.student_ids;
        setEnrolled(Array.isArray(ids) ? ids.length : null);
      } catch {
        /* enrolment count is cosmetic */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const rows = useMemo(
    () =>
      progress
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
            score,
            total,
            percentage: total > 0 && score !== null ? Math.round((score / total) * 100) : null,
            phase: p.phase || 'connected',
            duration: p.duration_seconds ?? null,
            handRaises: p.hand_raise_count ?? 0,
            joinedAt: toDate(p.joined_at),
            removed: p.removed === true,
            answers: p.quiz_answers ?? [],
          };
        })
        .sort((a, b) => {
          if (a.removed !== b.removed) return a.removed ? 1 : -1;
          if (a.percentage === null && b.percentage === null) return a.name.localeCompare(b.name);
          if (a.percentage === null) return 1;
          if (b.percentage === null) return -1;
          return b.percentage - a.percentage;
        }),
    [progress]
  );

  const stats = useMemo(() => {
    const active = rows.filter((r) => !r.removed);
    const scored = active.filter((r) => r.percentage !== null);
    const percentages = scored.map((r) => r.percentage as number);
    const durations = active.map((r) => r.duration).filter((d): d is number => typeof d === 'number');
    const completed = active.filter((r) => r.phase === 'completed').length;

    // Per-question accuracy across everyone who answered.
    const questionTotals = new Map<number, { correct: number; answered: number }>();
    active.forEach((r) => {
      r.answers.forEach((a) => {
        const cur = questionTotals.get(a.question_index) ?? { correct: 0, answered: 0 };
        cur.answered += 1;
        if (a.correct) cur.correct += 1;
        questionTotals.set(a.question_index, cur);
      });
    });

    return {
      attended: active.length,
      enrolled,
      completed,
      completionRate: active.length ? Math.round((completed / active.length) * 100) : 0,
      highest: percentages.length ? Math.max(...percentages) : null,
      lowest: percentages.length ? Math.min(...percentages) : null,
      average: percentages.length
        ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
        : null,
      scoredCount: scored.length,
      avgDuration: durations.length
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : null,
      handRaises: active.reduce((s, r) => s + r.handRaises, 0),
      droppedEarly: active.filter((r) => r.phase !== 'completed' && r.phase !== 'quiz').length,
      questions: [...questionTotals.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([index, v]) => ({
          index,
          accuracy: v.answered ? Math.round((v.correct / v.answered) * 100) : 0,
          answered: v.answered,
        })),
    };
  }, [rows, enrolled]);

  const exportCsv = () => {
    const header = ['Student', 'Score', 'Total', 'Percent', 'Phase', 'Duration (s)', 'Hand raises', 'Removed'];
    const lines = rows.map((r) =>
      [r.name, r.score ?? '', r.total || '', r.percentage ?? '', r.phase, r.duration ?? '', r.handRaises, r.removed ? 'yes' : 'no']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesson-specs-${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiles = [
    {
      label: 'Attended',
      value: stats.enrolled ? `${stats.attended}/${stats.enrolled}` : String(stats.attended),
      hint: stats.enrolled ? 'joined of enrolled' : 'students joined',
    },
    { label: 'Completed', value: `${stats.completionRate}%`, hint: `${stats.completed} finished` },
    { label: 'Highest score', value: stats.highest === null ? '—' : `${stats.highest}%`, hint: `${stats.scoredCount} took the quiz` },
    { label: 'Class average', value: stats.average === null ? '—' : `${stats.average}%`, hint: stats.lowest === null ? '' : `low ${stats.lowest}%` },
    { label: 'Avg time', value: formatDuration(stats.avgDuration), hint: 'in the lesson' },
    { label: 'Hand raises', value: String(stats.handRaises), hint: `${stats.droppedEarly} dropped early` },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Launched lesson specs
            </p>
            <h2 className="truncate text-lg font-bold text-foreground">
              {lessonTitle || 'Lesson'}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
                <FaDownload className="h-3 w-3" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

          {!loaded ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading stats…</p>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium text-foreground">No students joined this launch</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Attendance and scores appear once students join the session.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tiles.map((t) => (
                  <div key={t.label} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t.label}
                    </p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{t.value}</p>
                    {t.hint && <p className="text-[11px] text-muted-foreground">{t.hint}</p>}
                  </div>
                ))}
              </div>

              {stats.questions.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Question accuracy</h3>
                  <div className="space-y-1.5">
                    {stats.questions.map((q) => (
                      <div key={q.index} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs text-muted-foreground">
                          Q{q.index + 1}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${
                              q.accuracy >= 70
                                ? 'bg-emerald-500'
                                : q.accuracy >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-destructive'
                            }`}
                            style={{ width: `${q.accuracy}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {q.accuracy}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Students</h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">Student</th>
                        <th className="px-3 py-2 font-semibold">Score</th>
                        <th className="px-3 py-2 font-semibold">Reached</th>
                        <th className="px-3 py-2 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.uid}
                          className={`border-b border-border/60 last:border-0 ${r.removed ? 'opacity-50' : ''}`}
                        >
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2 font-medium text-foreground">
                              {r.name}
                              {r.removed && (
                                <Badge variant="outline" className="text-[10px]">removed</Badge>
                              )}
                              {r.handRaises > 0 && (
                                <span className="text-[10px] text-amber-500">✋{r.handRaises}</span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {r.percentage === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="font-semibold text-foreground">
                                {r.score}/{r.total}
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  {r.percentage}%
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">
                            {r.phase}
                            {PHASE_ORDER.indexOf(r.phase) >= 0 && r.phase !== 'completed' && (
                              <span className="ml-1 text-[10px] text-muted-foreground/70">
                                ({Math.round(
                                  (PHASE_ORDER.indexOf(r.phase) / (PHASE_ORDER.length - 1)) * 100
                                )}%)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {formatDuration(r.duration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
