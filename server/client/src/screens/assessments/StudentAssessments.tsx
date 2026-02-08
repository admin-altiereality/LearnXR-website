/**
 * Automated Assessments – Student view
 * List available assessments, take assessment, view my attempts
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  listAssessmentsForStudent,
  getMyAttempts,
  type Assessment,
  type AssessmentAttempt,
} from '../../services/assessmentService';
import { FaClipboardList, FaCheckCircle, FaPlay } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';

const StudentAssessments = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listAssessmentsForStudent(), getMyAttempts()])
      .then(([list, myAttempts]) => {
        setAssessments(list);
        setAttempts(myAttempts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-24">
        <div className="text-muted-foreground">Loading assessments…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <FaClipboardList className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol />
              </h1>
              <h2 className="text-xl font-semibold text-foreground">My Assessments</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Take quizzes and see your results</p>
            </div>
          </div>
        </div>

        <h3 className="text-foreground font-medium mb-3">Available</h3>
        {assessments.length === 0 ? (
          <p className="text-muted-foreground">No assessments assigned yet.</p>
        ) : (
          <div className="space-y-3 mb-8">
            {assessments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card/50 p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-foreground font-medium">{a.title}</h4>
                  {a.description && <p className="text-muted-foreground text-sm mt-1">{a.description}</p>}
                  <p className="text-muted-foreground/80 text-xs mt-1">
                    {a.questions?.length ?? 0} questions • {a.totalPoints} pts
                  </p>
                </div>
                <Link
                  to={`/assessments/take/${a.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                >
                  <FaPlay /> Take
                </Link>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-foreground font-medium mb-3">My attempts</h3>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground">You haven’t completed any assessments yet.</p>
        ) : (
          <div className="space-y-2">
            {attempts.slice(0, 20).map((att) => (
              <div
                key={att.id}
                className="rounded-lg border border-border bg-card/50 p-3 flex items-center justify-between"
              >
                <span className="text-foreground/80">Assessment attempt</span>
                {att.score && (
                  <span className="text-primary font-medium">
                    {att.score.correct}/{att.score.total} ({att.score.percentage}%)
                  </span>
                )}
                <span className="text-muted-foreground text-sm">
                  {att.completedAt ? new Date(att.completedAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAssessments;
