/**
 * PerformanceSections – the performance panels, shared by everyone who needs them.
 *
 * These lived only in TeacherDashboard, so a principal and a school admin had no
 * view of how their school was doing at all, and a super admin had none either.
 * Rebuilding them per screen would guarantee three subtly different answers to
 * "what is this class averaging"; the aggregation is shared
 * (`lib/dashboard/performance`) and so is the markup.
 *
 * Scope is the only difference between audiences: a teacher passes their own
 * classes, a principal passes every class in the school. The arithmetic and the
 * layout do not change with who is looking.
 *
 * The empty and error states are deliberate. "No student activity yet" used to
 * be shown whatever the reason, including a query that had been rejected
 * outright — which is how a broken dashboard looked exactly like a quiet one for
 * as long as it did.
 */

import { useMemo } from 'react';
import { FaChartLine, FaExclamationTriangle } from 'react-icons/fa';

import { Card, CardContent } from '../ui/card';
import {
  summarisePerformance,
  type ClassRecord,
  type LaunchRecord,
  type ScoreRecord,
  type StudentRecord,
} from '../../lib/dashboard/performance';

interface PerformanceSectionsProps {
  classes: ClassRecord[];
  students: (StudentRecord & { name?: string; displayName?: string })[];
  scores: ScoreRecord[];
  launches: LaunchRecord[];
  /** Set when a subscription failed, so an empty page can say why. */
  loadError?: string | null;
  loading?: boolean;
  /** "your classes" / "this school" — used in the empty-state wording. */
  scopeLabel?: string;
}

const meterColour = (value: number) =>
  value >= 70 ? 'text-primary' : value >= 50 ? 'text-amber-500' : 'text-destructive';

export const PerformanceSections = ({
  classes,
  students,
  scores,
  launches,
  loadError = null,
  loading = false,
  scopeLabel = 'this school',
}: PerformanceSectionsProps) => {
  const summary = useMemo(
    () => summarisePerformance(classes, students, scores, launches),
    [classes, students, scores, launches]
  );

  if (loadError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">Performance data could not be loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              <p className="mt-2 text-xs text-muted-foreground/80">
                This is a failure to read, not an absence of results — the marks may well be
                there. Nothing below is a true zero.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress Snapshot */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Progress Snapshot</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Students', value: String(summary.totalStudents), tone: 'text-foreground' },
            { label: 'Quizzes taken', value: String(summary.totalQuizzes), tone: 'text-foreground' },
            {
              label: 'Average score',
              value: `${summary.averageScore}%`,
              tone: meterColour(summary.averageScore),
            },
            {
              label: 'Lessons completed',
              value: `${summary.completionRate}%`,
              tone: meterColour(summary.completionRate),
            },
          ].map((meter) => (
            <Card key={meter.label} className="border-border bg-card">
              <CardContent className="p-4">
                <p className={`text-2xl font-bold tabular-nums ${meter.tone}`}>{meter.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{meter.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/*
          Marks that exist but belong to no class in view. Worth saying: this is
          the difference between "nobody has taken a quiz" and "results are being
          filed against a class nobody is looking at", and the two look identical
          without it.
        */}
        {summary.orphanedScores > 0 && (
          <p className="mt-3 text-xs text-amber-500">
            {summary.orphanedScores} result{summary.orphanedScores === 1 ? '' : 's'} could not be
            matched to a class in {scopeLabel} and are not counted above.
          </p>
        )}
      </div>

      {/* Performance by Subject */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Performance by Subject</h2>
        {summary.subjects.length === 0 ? (
          <EmptyNote loading={loading} scopeLabel={scopeLabel} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summary.subjects.map((subject) => (
              <Card key={subject.subject} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-foreground">{subject.subject}</h3>
                    <span className={`text-xl font-bold tabular-nums ${meterColour(subject.averageScore)}`}>
                      {subject.averageScore}%
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <dt>Students</dt>
                      <dd className="tabular-nums">{subject.totalStudents}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Quizzes taken</dt>
                      <dd className="tabular-nums">{subject.totalQuizzes}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Lessons completed</dt>
                      <dd className="tabular-nums">
                        {subject.completedLessons}/{subject.totalLessons} ({subject.completionRate}%)
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Class Evaluation */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Class Evaluation</h2>
        {summary.insights.length === 0 ? (
          <EmptyNote loading={loading} scopeLabel={scopeLabel} />
        ) : (
          <div className="space-y-3">
            {summary.insights.map((insight) => (
              <Card key={insight.classId} className="border-border bg-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-foreground">
                      {insight.className}
                      {insight.subject ? ` · ${insight.subject}` : ''}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {insight.studentCount} student{insight.studentCount === 1 ? '' : 's'} ·{' '}
                      {insight.totalQuizzes} quiz{insight.totalQuizzes === 1 ? '' : 'zes'} taken
                      {insight.partialQuizzes > 0 && (
                        <span className="text-amber-500">
                          {' '}
                          ({insight.partialQuizzes} unfinished)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <p className={`text-2xl font-bold tabular-nums ${meterColour(insight.averageScore)}`}>
                      {insight.averageScore}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {insight.completionRate}% completed
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Student Activity */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Recent Student Activity</h2>
        {scores.length === 0 ? (
          <EmptyNote loading={loading} scopeLabel={scopeLabel} />
        ) : (
          <div className="space-y-3">
            {scores.slice(0, 10).map((score, index) => {
              const student = students.find((s) => s.uid === score.student_id);
              const percentage = score.score?.percentage ?? 0;
              return (
                <Card
                  key={score.id || `${score.student_id}_${score.topic_id}_${index}`}
                  className="border-border bg-card transition-colors hover:bg-accent/30"
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-foreground">
                        {student?.name || student?.displayName || 'Unknown student'}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {score.subject || 'Lesson'} · Chapter {score.chapter_id || '—'}
                      </p>
                      {score.completed === false && (
                        <p className="mt-1 text-xs text-amber-500">
                          Unfinished — answered {score.questions_attempted ?? 0} of{' '}
                          {score.score?.total ?? 0} before the class moved on
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className={`text-2xl font-bold tabular-nums ${meterColour(percentage)}`}>
                        {percentage}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {score.score?.correct ?? 0}/{score.score?.total ?? 0}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/** Says which kind of nothing this is. */
const EmptyNote = ({ loading, scopeLabel }: { loading: boolean; scopeLabel: string }) => (
  <Card className="border-border bg-card">
    <CardContent className="p-8 text-center">
      <FaChartLine className="mx-auto mb-4 text-4xl text-muted-foreground" />
      <p className="text-muted-foreground">
        {loading ? 'Loading results…' : `No quiz results recorded for ${scopeLabel} yet.`}
      </p>
    </CardContent>
  </Card>
);
