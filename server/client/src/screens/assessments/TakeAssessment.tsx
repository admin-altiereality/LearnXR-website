/**
 * Take an assessment – student submits answers and gets auto-graded
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssessment, submitAttempt, type Assessment, type AssessmentQuestion, type QuestionResult } from '../../services/assessmentService';
import { FaCheckCircle, FaArrowLeft, FaTimesCircle } from 'react-icons/fa';
import { learnXRFontStyle } from '../../Components/LearnXRTypography';

const TakeAssessment = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; percentage: number } | null>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    getAssessment(id)
      .then(setAssessment)
      .catch(() => setAssessment(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!id || !assessment) return;
    setSubmitting(true);
    try {
      const attempt = await submitAttempt(id, answers);
      if (attempt.score) {
        setResult({
          correct: attempt.score.correct,
          total: attempt.score.total,
          percentage: attempt.score.percentage,
        });
        setQuestionResults(attempt.questionResults ?? []);
      }
    } catch {
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">{loading ? 'Loading…' : 'Assessment not found.'}</div>
      </div>
    );
  }

  if (result !== null) {
    const passed = result.percentage >= (assessment.passingPercentage ?? 70);
    const questions = assessment.questions || [];
    const resultByQ = new Map(questionResults.map((r) => [r.questionId, r]));
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              <FaCheckCircle className="text-3xl" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={learnXRFontStyle}>
              {passed ? 'You passed!' : 'Keep practicing'}
            </h1>
            <p className="text-white/80 mb-6">
              Score: {result.correct}/{result.total} ({result.percentage}%)
            </p>
            <button
              type="button"
              onClick={() => navigate('/assessments')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
            >
              <FaArrowLeft /> Back to assessments
            </button>
          </div>
          {questions.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold text-white mb-4" style={learnXRFontStyle}>
                Review answers
              </h2>
              <ul className="space-y-4">
                {questions.map((q: AssessmentQuestion, idx: number) => {
                  const qr = resultByQ.get(q.id);
                  const correct = qr?.correct ?? false;
                  const correctAnswer = qr?.correctAnswer;
                  return (
                    <li key={q.id} className="border-b border-white/10 last:border-0 pb-4 last:pb-0">
                      <p className="text-white font-medium mb-2">
                        {idx + 1}. {q.question}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        {correct ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <FaCheckCircle /> Correct
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400">
                            <FaTimesCircle /> Incorrect
                          </span>
                        )}
                        {correctAnswer !== undefined && correctAnswer !== '' && (
                          <span className="text-white/70">
                            Correct answer:{' '}
                            {q.type === 'true_false' && (correctAnswer === 0 || correctAnswer === '0')
                              ? 'True'
                              : q.type === 'true_false' && (correctAnswer === 1 || correctAnswer === '1')
                                ? 'False'
                                : typeof correctAnswer === 'number'
                                  ? correctAnswer
                                  : String(correctAnswer)}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  const questions = assessment.questions || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/assessments')}
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm"
          >
            <FaArrowLeft /> Back
          </button>
          <span className="text-white/50 text-sm">
            {assessment.title} • {questions.length} questions
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2" style={learnXRFontStyle}>
          {assessment.title}
        </h1>
        {assessment.description && (
          <p className="text-white/60 text-sm mb-6">{assessment.description}</p>
        )}

        <div className="space-y-6">
          {questions.map((q: AssessmentQuestion, idx: number) => (
            <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white font-medium mb-3">
                {idx + 1}. {q.question}
              </p>
              {q.type === 'mcq' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === oi}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        className="text-cyan-500"
                      />
                      <span className="text-white/80">{opt || `Option ${oi + 1}`}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'true_false' && (
                <div className="space-y-2">
                  {[0, 1].map((oi) => (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === oi}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        className="text-cyan-500"
                      />
                      <span className="text-white/80">{oi === 0 ? 'True' : 'False'}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'short_answer' && (
                <input
                  type="text"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30"
                  placeholder="Your answer"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TakeAssessment;
