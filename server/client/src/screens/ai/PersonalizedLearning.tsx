/**
 * Personalized Learning (AI)
 * Student-only: AI recommendations, strengths, areas to improve, study tips, and analytics.
 * Design aligned with site theme: shadcn Card/Button, PrismFluxLoader, theme tokens.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ListChecks,
  ArrowRight,
  RefreshCw,
  ClipboardList,
  Target,
  ChevronRight,
} from 'lucide-react';
import { getPersonalizedRecommendations, type LearningRecommendation, type StudentAnalytics, type LearningSummary } from '../../services/personalizedLearningService';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../Components/ui/button';
import { Card, CardContent } from '../../Components/ui/card';
import { PrismFluxLoader } from '../../Components/ui/prism-flux-loader';

const DEMO_RECOMMENDATION: LearningRecommendation = {
  recommendedTopicIds: [],
  recommendedChapterIds: [],
  strengths: ['Curiosity and willingness to explore', 'Engagement with immersive content'],
  areasToImprove: ['Complete your first lesson to get real recommendations', 'Try the quiz after the lesson'],
  studyTips: [
    'Watch the full lesson before taking the quiz.',
    'Use the 360° view to explore the topic from all angles.',
    'Sign up for a free account to unlock all lessons and get personalized insights.',
  ],
  nextBestAction: 'Try your one free lesson on the Lessons page, then create an account to unlock more.',
  reasoning: 'As a guest we don’t have your progress yet. Complete the demo lesson and sign up to get AI recommendations based on your performance.',
};

const PersonalizedLearning = () => {
  const { user, profile } = useAuth();
  const isGuest = profile?.isGuest === true && profile?.role === 'student';
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
    if (isGuest) {
      setData(DEMO_RECOMMENDATION);
      setAnalytics({ subjectsLearned: [], totalMcqsAnswered: 0 });
      setLearningSummary({
        subjectsWithLowScores: [],
        subjectsWithHighScores: [],
        topicsWithLowScores: [],
        topicsWithHighScores: [],
        incompleteLessons: [],
      });
      setLoading(false);
      return;
    }
    fetchRecommendations();
  }, [user, isGuest, fetchRecommendations]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-24">
        <Card className="max-w-md w-full rounded-xl border-border">
          <CardContent className="p-8 text-center">
            <p className="text-foreground mb-6">Sign in to see your personalized learning recommendations.</p>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-24">
        <Card className="max-w-md w-full rounded-xl border-border">
          <CardContent className="py-16">
            <PrismFluxLoader statuses={['Loading recommendations…', 'Analyzing your progress…', 'Preparing insights…']} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-24">
        <Card className="max-w-md w-full rounded-xl border-border border-destructive/50">
          <CardContent className="p-8 text-center">
            <p className="text-foreground font-medium mb-1">Something went wrong</p>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => fetchRecommendations()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rec = data!;
  const hasGlance =
    learningSummary &&
    (learningSummary.subjectsWithLowScores.length > 0 ||
      learningSummary.subjectsWithHighScores.length > 0 ||
      (learningSummary.topicsWithLowScores?.length ?? 0) > 0 ||
      (learningSummary.topicsWithHighScores?.length ?? 0) > 0 ||
      learningSummary.incompleteLessons.length > 0);

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Guest notice */}
        {isGuest && (
          <Card className="mb-6 rounded-xl border-border border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-foreground">
                You’re exploring with <strong>demo recommendations</strong>. Sign up to get personalized insights based on your progress.
              </p>
              <Button asChild size="sm" className="shrink-0">
                <Link to="/signup">Create free account</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Page header */}
        <header className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center shrink-0">
              <Lightbulb className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Personalized Learning</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isGuest ? 'Demo recommendations — sign up for AI-powered insights' : 'AI-powered recommendations based on your progress'}
              </p>
            </div>
          </div>
        </header>

        {/* Your learning at a glance */}
        {hasGlance && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              Your learning at a glance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {learningSummary!.subjectsWithLowScores.length > 0 && (
                <Card className="rounded-xl border-border border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Subjects to improve
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">Focus on these for better scores (below 70% average)</p>
                    <ul className="space-y-2 mb-4">
                      {learningSummary!.subjectsWithLowScores.map((s, i) => (
                        <li key={i} className="text-sm text-foreground flex justify-between items-center">
                          <span>{s.subject}</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">{s.averageScore}%</span>
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" asChild>
                      <Link to="/lessons" className="gap-2">
                        Practice these <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {learningSummary!.subjectsWithHighScores.length > 0 && (
                <Card className="rounded-xl border-border border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Your stronger subjects
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">Keep it up (70%+ average)</p>
                    <ul className="space-y-2">
                      {learningSummary!.subjectsWithHighScores.map((s, i) => (
                        <li key={i} className="text-sm text-foreground flex justify-between items-center">
                          <span>{s.subject}</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{s.averageScore}%</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {learningSummary!.incompleteLessons.length > 0 && (
                <Card className="rounded-xl border-border border-primary/30 bg-primary/5">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <ListChecks className="w-4 h-4 text-primary" />
                      Complete these lessons
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">You started but didn’t finish — complete them to stay on track</p>
                    <ul className="space-y-2 mb-4">
                      {learningSummary!.incompleteLessons.slice(0, 5).map((l, i) => (
                        <li key={i} className="text-sm">
                          <Link
                            to="/lessons"
                            state={{ highlightChapterId: l.chapterId, highlightTopicId: l.topicId }}
                            className="text-primary hover:underline font-medium"
                          >
                            {l.subject || 'Lesson'}: {l.chapterId} → {l.topicId}
                          </Link>
                          <span className="text-muted-foreground text-xs ml-1">({l.status.replace('_', ' ')})</span>
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="gap-2" asChild>
                      <Link to="/lessons">Go to Lessons <ArrowRight className="w-3.5 h-3.5" /></Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {((learningSummary!.topicsWithLowScores?.length ?? 0) > 0 || (learningSummary!.topicsWithHighScores?.length ?? 0) > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {(learningSummary!.topicsWithLowScores?.length ?? 0) > 0 && (
                  <Card className="rounded-xl border-border border-amber-500/25 bg-amber-500/5">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Topics to improve (by chapter)
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">Chapter • Topic — score below 70%</p>
                      <ul className="space-y-2 max-h-48 overflow-y-auto mb-4">
                        {(learningSummary!.topicsWithLowScores ?? []).slice(0, 10).map((t, i) => (
                          <li key={i} className="text-sm text-foreground flex justify-between items-center gap-2">
                            <Link
                              to="/lessons"
                              state={{ highlightChapterId: t.chapterId, highlightTopicId: t.topicId }}
                              className="text-primary hover:underline truncate flex-1 min-w-0"
                              title={`${t.chapterId} • ${t.topicId}`}
                            >
                              {t.chapterId} • {t.topicId}
                              {t.subject ? ` (${t.subject})` : ''}
                            </Link>
                            <span className="font-medium text-amber-600 dark:text-amber-400 shrink-0">{t.averageScore}%</span>
                          </li>
                        ))}
                      </ul>
                      <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-2" asChild>
                        <Link to="/lessons">Practice these topics <ArrowRight className="w-3.5 h-3.5" /></Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {(learningSummary!.topicsWithHighScores?.length ?? 0) > 0 && (
                  <Card className="rounded-xl border-border border-emerald-500/25 bg-emerald-500/5">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Topics you’re strong in (by chapter)
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">Chapter • Topic — 70%+ average</p>
                      <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {(learningSummary!.topicsWithHighScores ?? []).slice(0, 10).map((t, i) => (
                          <li key={i} className="text-sm text-foreground flex justify-between items-center gap-2">
                            <span className="truncate flex-1 min-w-0" title={`${t.chapterId} • ${t.topicId}`}>
                              {t.chapterId} • {t.topicId}
                              {t.subject ? ` (${t.subject})` : ''}
                            </span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400 shrink-0">{t.averageScore}%</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </section>
        )}

        {/* What you can do */}
        <Card className="mb-6 rounded-xl border-border">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-foreground mb-3">What you can do</h3>
            <ul className="text-sm text-muted-foreground space-y-2 mb-5">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                Use the <span className="font-medium text-foreground">next step</span> below to jump straight to your next lesson.
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                Work on the <span className="font-medium text-foreground">areas to improve</span> by doing more lessons and quizzes in those topics.
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                Follow the <span className="font-medium text-foreground">study tips</span> to build better habits.
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="gap-2">
                <Link to="/lessons">Browse lessons <ArrowRight className="w-3.5 h-3.5" /></Link>
              </Button>
              <Button variant="outline" className="gap-2 border-border" onClick={() => fetchRecommendations()}>
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh recommendations
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Student analytics */}
        {analytics && (
          <Card className="mb-6 rounded-xl border-border">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                Student analytics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Subjects learned</p>
                  {analytics.subjectsLearned.length > 0 ? (
                    <ul className="text-sm text-foreground space-y-1.5">
                      {analytics.subjectsLearned.map((s, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No subject data from quizzes yet</p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">MCQs answered</p>
                  <p className="text-xl font-bold text-foreground flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    {analytics.totalMcqsAnswered}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">total questions answered</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next best action */}
        {rec.nextBestAction && (
          <Card className="mb-6 rounded-xl border-border border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary shrink-0" />
                {rec.nextBestAction}
              </p>
              <Button size="sm" className="mt-3 gap-2" asChild>
                <Link to="/lessons">Go to Lessons <ArrowRight className="w-3.5 h-3.5" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isFallback && (
          <Card className="mb-6 rounded-xl border-border border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-3 px-4">
              <p className="text-sm text-foreground">
                Showing general recommendations. Complete more lessons and quizzes to get personalized tips.
              </p>
            </CardContent>
          </Card>
        )}

        {rec.reasoning && <p className="text-sm text-muted-foreground mb-6">{rec.reasoning}</p>}

        {/* Strengths & Areas to improve */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {rec.strengths.length > 0 && (
            <Card className="rounded-xl border-border border-emerald-500/25 bg-emerald-500/5">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {rec.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {rec.areasToImprove.length > 0 && (
            <Card className="rounded-xl border-border border-amber-500/25 bg-amber-500/5">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  Areas to improve
                </h3>
                <ul className="space-y-2">
                  {rec.areasToImprove.map((a, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Study tips */}
        {rec.studyTips.length > 0 && (
          <Card className="mb-6 rounded-xl border-border border-primary/25 bg-primary/5">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-primary" />
                Study tips
              </h3>
              <ul className="space-y-2">
                {rec.studyTips.map((t, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                    {t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommended next */}
        {(rec.recommendedTopicIds.length > 0 || rec.recommendedChapterIds.length > 0) && (
          <Card className="rounded-xl border-border">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-foreground mb-2">Recommended next</h3>
              <p className="text-sm text-muted-foreground mb-4">Focus on these in your Lessons to improve faster:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {rec.recommendedChapterIds.slice(0, 5).map((id) => (
                  <Button key={id} variant="secondary" size="sm" className="font-mono border-border" asChild>
                    <Link to="/lessons" state={{ highlightChapterId: id }}>
                      Ch: {id}
                    </Link>
                  </Button>
                ))}
                {rec.recommendedTopicIds.slice(0, 5).map((id) => (
                  <Button key={id} variant="outline" size="sm" className="font-mono border-primary/40 text-primary" asChild>
                    <Link to="/lessons" state={{ highlightTopicId: id }}>Topic: {id}</Link>
                  </Button>
                ))}
              </div>
              <Button size="sm" className="gap-2" asChild>
                <Link to="/lessons">Open Lessons and find these <ArrowRight className="w-3.5 h-3.5" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PersonalizedLearning;
