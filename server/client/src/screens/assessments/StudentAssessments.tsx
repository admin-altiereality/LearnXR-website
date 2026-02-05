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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading assessments…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <FaClipboardList className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                <span className="text-white">Learn</span>
                <span className="text-purple-700">XR</span>
                <TrademarkSymbol />
              </h1>
              <h2 className="text-xl font-semibold text-white">My Assessments</h2>
              <p className="text-white/50 text-sm mt-0.5">Take quizzes and see your results</p>
            </div>
          </div>
        </div>

        <h3 className="text-white font-medium mb-3">Available</h3>
        {assessments.length === 0 ? (
          <p className="text-white/50">No assessments assigned yet.</p>
        ) : (
          <div className="space-y-3 mb-8">
            {assessments.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-white font-medium">{a.title}</h4>
                  {a.description && <p className="text-white/50 text-sm mt-1">{a.description}</p>}
                  <p className="text-white/40 text-xs mt-1">
                    {a.questions?.length ?? 0} questions • {a.totalPoints} pts
                  </p>
                </div>
                <Link
                  to={`/assessments/take/${a.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
                >
                  <FaPlay /> Take
                </Link>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-white font-medium mb-3">My attempts</h3>
        {attempts.length === 0 ? (
          <p className="text-white/50">You haven’t completed any assessments yet.</p>
        ) : (
          <div className="space-y-2">
            {attempts.slice(0, 20).map((att) => (
              <div
                key={att.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between"
              >
                <span className="text-white/80">Assessment attempt</span>
                {att.score && (
                  <span className="text-cyan-400 font-medium">
                    {att.score.correct}/{att.score.total} ({att.score.percentage}%)
                  </span>
                )}
                <span className="text-white/40 text-sm">
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
