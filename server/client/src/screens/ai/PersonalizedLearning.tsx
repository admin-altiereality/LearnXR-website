/**
 * Personalized Learning (AI)
 * Student-only: AI recommendations, strengths, areas to improve, study tips, and analytics.
 */

import { useState, useEffect, useCallback } from 'react';
import { FaLightbulb, FaChartLine, FaThumbsUp, FaTools, FaArrowRight, FaBook, FaClipboardList, FaExclamationTriangle, FaCheckCircle, FaListUl } from 'react-icons/fa';
import { getPersonalizedRecommendations, type LearningRecommendation, type StudentAnalytics, type LearningSummary } from '../../services/personalizedLearningService';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PersonalizedLearning = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LearningRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [learningSummary, setLearningSummary] = useState<LearningSummary | null>(null);

  const fetchRecommendations = useCallback(() => {
    setLoading(true);
    setError(null);
    setIsFallback(false);
    getPersonalizedRecommendations()
      .then((res) => {
        setData(res.data);
        setIsFallback(res.meta?.fallback === true);
        setAnalytics(res.meta?.analytics ?? null);
        setLearningSummary(res.meta?.learningSummary ?? null);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load recommendations');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    fetchRecommendations();
  }, [user, fetchRecommendations]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-white/80 mb-4">Sign in to see your personalized learning recommendations.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-white/60">Getting your personalized recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => fetchRecommendations()}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const rec = data!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <FaLightbulb className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                <span className="text-white">Learn</span>
                <span className="text-purple-700">XR</span>
                <TrademarkSymbol />
              </h1>
              <h2 className="text-xl font-semibold text-white">Personalized Learning</h2>
              <p className="text-white/50 text-sm mt-0.5">
                AI-powered recommendations based on your progress
              </p>
            </div>
          </div>
        </div>

        {/* Personalized learning dashboard: low/high scores (subject + chapter/topic), incomplete lessons */}
        {learningSummary && (learningSummary.subjectsWithLowScores.length > 0 || learningSummary.subjectsWithHighScores.length > 0 || (learningSummary.topicsWithLowScores?.length ?? 0) > 0 || (learningSummary.topicsWithHighScores?.length ?? 0) > 0 || learningSummary.incompleteLessons.length > 0) && (
          <div className="mb-8 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2" style={learnXRFontStyle}>
              <FaChartLine /> Your learning at a glance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {learningSummary.subjectsWithLowScores.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                  <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-3">
                    <FaExclamationTriangle /> Subjects to improve
                  </h3>
                  <p className="text-white/60 text-xs mb-3">Focus on these for better scores (below 70% average)</p>
                  <ul className="space-y-2">
                    {learningSummary.subjectsWithLowScores.map((s, i) => (
                      <li key={i} className="text-white/90 text-sm flex justify-between items-center">
                        <span>{s.subject}</span>
                        <span className="text-amber-400 font-medium">{s.averageScore}%</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/lessons"
                    className="inline-flex items-center gap-2 mt-3 text-amber-400 hover:text-amber-300 text-sm font-medium"
                  >
                    Practice these <FaArrowRight />
                  </Link>
                </div>
              )}

              {learningSummary.subjectsWithHighScores.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <h3 className="text-emerald-400 font-semibold flex items-center gap-2 mb-3">
                    <FaCheckCircle /> Your stronger subjects
                  </h3>
                  <p className="text-white/60 text-xs mb-3">Keep it up (70%+ average)</p>
                  <ul className="space-y-2">
                    {learningSummary.subjectsWithHighScores.map((s, i) => (
                      <li key={i} className="text-white/90 text-sm flex justify-between items-center">
                        <span>{s.subject}</span>
                        <span className="text-emerald-400 font-medium">{s.averageScore}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {learningSummary.incompleteLessons.length > 0 && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5">
                  <h3 className="text-cyan-400 font-semibold flex items-center gap-2 mb-3">
                    <FaListUl /> Complete these lessons
                  </h3>
                  <p className="text-white/60 text-xs mb-3">You started but didn’t finish — complete them to stay on track</p>
                  <ul className="space-y-2">
                    {learningSummary.incompleteLessons.slice(0, 5).map((l, i) => (
                      <li key={i} className="text-white/90 text-sm">
                        <Link
                          to="/lessons"
                          state={{ highlightChapterId: l.chapterId, highlightTopicId: l.topicId }}
                          className="text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          {l.subject || 'Lesson'}: {l.chapterId} → {l.topicId}
                        </Link>
                        <span className="text-white/50 text-xs ml-1">({l.status.replace('_', ' ')})</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/lessons"
                    className="inline-flex items-center gap-2 mt-3 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                  >
                    Go to Lessons <FaArrowRight />
                  </Link>
                </div>
              )}
            </div>

            {/* Chapter/topic level: which chapter which topic is low or high */}
            {((learningSummary.topicsWithLowScores?.length ?? 0) > 0 || (learningSummary.topicsWithHighScores?.length ?? 0) > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {(learningSummary.topicsWithLowScores?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-3">
                      <FaExclamationTriangle /> Topics to improve (by chapter)
                    </h3>
                    <p className="text-white/60 text-xs mb-3">Chapter • Topic — score below 70%</p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {(learningSummary.topicsWithLowScores ?? []).slice(0, 10).map((t, i) => (
                        <li key={i} className="text-white/90 text-sm flex justify-between items-center gap-2">
                          <Link
                            to="/lessons"
                            state={{ highlightChapterId: t.chapterId, highlightTopicId: t.topicId }}
                            className="text-amber-400 hover:text-amber-300 truncate flex-1 min-w-0"
                            title={`${t.chapterId} • ${t.topicId}`}
                          >
                            {t.chapterId} • {t.topicId}
                            {t.subject ? ` (${t.subject})` : ''}
                          </Link>
                          <span className="text-amber-400 font-medium flex-shrink-0">{t.averageScore}%</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/lessons"
                      className="inline-flex items-center gap-2 mt-3 text-amber-400 hover:text-amber-300 text-sm font-medium"
                    >
                      Practice these topics <FaArrowRight />
                    </Link>
                  </div>
                )}
                {(learningSummary.topicsWithHighScores?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <h3 className="text-emerald-400 font-semibold flex items-center gap-2 mb-3">
                      <FaCheckCircle /> Topics you&apos;re strong in (by chapter)
                    </h3>
                    <p className="text-white/60 text-xs mb-3">Chapter • Topic — 70%+ average</p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {(learningSummary.topicsWithHighScores ?? []).slice(0, 10).map((t, i) => (
                        <li key={i} className="text-white/90 text-sm flex justify-between items-center gap-2">
                          <span className="truncate flex-1 min-w-0" title={`${t.chapterId} • ${t.topicId}`}>
                            {t.chapterId} • {t.topicId}
                            {t.subject ? ` (${t.subject})` : ''}
                          </span>
                          <span className="text-emerald-400 font-medium flex-shrink-0">{t.averageScore}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* What you can do - quick actions */}
        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-white/80 font-semibold mb-2">What you can do</h3>
          <ul className="text-white/70 text-sm space-y-1.5 mb-4">
            <li>• Use the <strong className="text-white/90">next step</strong> below to jump straight to your next lesson.</li>
            <li>• Work on the <strong className="text-white/90">areas to improve</strong> by doing more lessons and quizzes in those topics.</li>
            <li>• Follow the <strong className="text-white/90">study tips</strong> to build better habits.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/lessons"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm font-medium"
            >
              Browse lessons <FaArrowRight className="w-3 h-3" />
            </Link>
            <button
              type="button"
onClick={() => fetchRecommendations()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/80 border border-white/20 hover:bg-white/15 transition-colors text-sm"
          >
            Refresh recommendations
          </button>
          </div>
        </div>

        {analytics && (
          <div className="mb-6 p-5 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-white/90 font-semibold mb-4 flex items-center gap-2">
              <FaChartLine /> Student analytics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-white/5 p-4 border border-white/10">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Subjects learned</p>
                {analytics.subjectsLearned.length > 0 ? (
                  <ul className="text-white/90 text-sm space-y-1">
                    {analytics.subjectsLearned.map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <FaBook className="text-cyan-400 w-3.5 h-3.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/50 text-sm">No subject data from quizzes yet</p>
                )}
              </div>
              <div className="rounded-lg bg-white/5 p-4 border border-white/10">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">MCQs answered</p>
                <p className="text-white text-xl font-semibold flex items-center gap-2">
                  <FaClipboardList className="text-violet-400" />
                  {analytics.totalMcqsAnswered}
                </p>
                <p className="text-white/50 text-xs mt-1">total questions across all assessments</p>
              </div>
              <div className="rounded-lg bg-white/5 p-4 border border-white/10">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Assessments taken</p>
                <p className="text-white text-xl font-semibold">{analytics.assessmentAttemptsCount}</p>
                <p className="text-white/50 text-xs mt-1">quiz/assessment attempts</p>
              </div>
            </div>
          </div>
        )}

        {rec.nextBestAction && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-cyan-200 font-medium flex items-center gap-2">
              <FaArrowRight className="text-cyan-400 flex-shrink-0" />
              {rec.nextBestAction}
            </p>
            <Link
              to="/lessons"
              className="inline-flex items-center gap-2 mt-3 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
              Go to Lessons <FaArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {isFallback && (
          <p className="text-amber-400/90 text-sm mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            Showing general recommendations. Complete more lessons and quizzes to get personalized tips.
          </p>
        )}

        {rec.reasoning && (
          <p className="text-white/60 text-sm mb-6">{rec.reasoning}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rec.strengths.length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="text-emerald-400 font-semibold flex items-center gap-2 mb-3">
                <FaThumbsUp /> Strengths
              </h3>
              <ul className="space-y-2">
                {rec.strengths.map((s, i) => (
                  <li key={i} className="text-white/90 text-sm flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.areasToImprove.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-3">
                <FaChartLine /> Areas to improve
              </h3>
              <ul className="space-y-2">
                {rec.areasToImprove.map((a, i) => (
                  <li key={i} className="text-white/90 text-sm flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {rec.studyTips.length > 0 && (
          <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
            <h3 className="text-violet-400 font-semibold flex items-center gap-2 mb-3">
              <FaTools /> Study tips
            </h3>
            <ul className="space-y-2">
              {rec.studyTips.map((t, i) => (
                <li key={i} className="text-white/90 text-sm flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(rec.recommendedTopicIds.length > 0 || rec.recommendedChapterIds.length > 0) && (
          <div className="mt-6 p-5 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-white/80 font-semibold mb-2">Recommended next</h3>
            <p className="text-white/50 text-sm mb-3">
              Focus on these in your Lessons to improve faster:
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {rec.recommendedChapterIds.slice(0, 5).map((id) => (
                <Link
                  key={id}
                  to="/lessons"
                  state={{ highlightChapterId: id }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 text-sm font-mono"
                >
                  Chapter: {id}
                </Link>
              ))}
              {rec.recommendedTopicIds.slice(0, 5).map((id) => (
                <Link
                  key={id}
                  to="/lessons"
                  state={{ highlightTopicId: id }}
                  className="px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 text-sm font-mono"
                >
                  Topic: {id}
                </Link>
              ))}
            </div>
            <Link
              to="/lessons"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
              Open Lessons and find these <FaArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalizedLearning;
