/**
 * Automated Assessments – Teacher view
 * List assessments by class, create assessment, view attempts
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/axios';
import {
  listAssessmentsByClass,
  createAssessment,
  getAttemptsForAssessment,
  type Assessment,
  type AssessmentQuestion,
  type AssessmentAttempt,
} from '../../services/assessmentService';
import type { Class } from '../../types/lms';
import { FaClipboardList, FaPlus, FaUsers, FaChartBar } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { toast } from 'react-toastify';

const TeacherAssessments = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuestions, setNewQuestions] = useState<AssessmentQuestion[]>([
    { id: 'q1', type: 'mcq', question: '', options: ['', '', ''], correctAnswer: 0, points: 10 },
  ]);

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get<{ success: boolean; data: Class[] }>(`/lms/teachers/${profile.uid}/classes`)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setClasses(res.data.data);
          if (res.data.data.length > 0 && !selectedClassId) {
            setSelectedClassId(res.data.data[0].id);
          }
        }
      })
      .catch(() => toast.error('Failed to load classes'))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  useEffect(() => {
    if (!selectedClassId) {
      setAssessments([]);
      return;
    }
    setLoading(true);
    listAssessmentsByClass(selectedClassId)
      .then(setAssessments)
      .catch(() => toast.error('Failed to load assessments'))
      .finally(() => setLoading(false));
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedAssessmentId) {
      setAttempts([]);
      return;
    }
    getAttemptsForAssessment(selectedAssessmentId)
      .then(setAttempts)
      .catch(() => toast.error('Failed to load attempts'));
  }, [selectedAssessmentId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const schoolId = selectedClass?.school_id || profile?.school_id || '';

  const handleCreate = async () => {
    if (!newTitle.trim() || !selectedClassId || !schoolId) {
      toast.error('Title and class are required');
      return;
    }
    const validQuestions = newQuestions.filter((q) => q.question.trim());
    if (validQuestions.length === 0) {
      toast.error('Add at least one question');
      return;
    }
    setSubmitting(true);
    try {
      await createAssessment({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        classId: selectedClassId,
        schoolId,
        questions: validQuestions.map((q, i) => ({
          ...q,
          id: q.id || `q${i + 1}`,
          options: q.type === 'mcq' || q.type === 'true_false' ? q.options : undefined,
        })),
        passingPercentage: 70,
      });
      toast.success('Assessment created');
      setShowCreate(false);
      setNewTitle('');
      setNewDescription('');
      setNewQuestions([{ id: 'q1', type: 'mcq', question: '', options: ['', '', ''], correctAnswer: 0, points: 10 }]);
      listAssessmentsByClass(selectedClassId).then(setAssessments);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const addQuestion = () => {
    setNewQuestions((prev) => [
      ...prev,
      {
        id: `q${prev.length + 1}`,
        type: 'mcq' as const,
        question: '',
        options: ['', '', ''],
        correctAnswer: 0,
        points: 10,
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <FaClipboardList className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1 text-foreground" style={learnXRFontStyle}>
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol />
              </h1>
              <h2 className="text-xl font-semibold text-foreground">Assessments</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Create and manage quizzes with auto-grading</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center mb-6">
          <div>
            <label className="block text-muted-foreground text-sm mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-card/50 border border-border text-foreground min-w-[180px]"
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} {c.curriculum && `(${c.curriculum})`}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={!selectedClassId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 mt-6 sm:mt-0"
          >
            <FaPlus /> Create assessment
          </button>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            {assessments.length === 0 ? (
              <p className="text-muted-foreground">No assessments for this class yet. Create one above.</p>
            ) : (
              assessments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-card/50 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="text-foreground font-medium">{a.title}</h3>
                    {a.description && <p className="text-muted-foreground text-sm mt-1">{a.description}</p>}
                    <p className="text-muted-foreground/80 text-xs mt-1">
                      {a.questions?.length ?? 0} questions • {a.totalPoints} pts • Pass: {a.passingPercentage}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAssessmentId(selectedAssessmentId === a.id ? null : a.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground/80 hover:bg-muted text-sm"
                    >
                      <FaChartBar /> View attempts
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedAssessmentId && attempts.length > 0 && (
          <div className="mt-8 p-4 rounded-xl border border-border bg-card/50">
            <h3 className="text-foreground font-medium mb-3">Attempts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-foreground/80">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2">Student</th>
                    <th className="py-2">Score</th>
                    <th className="py-2">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((att) => (
                    <tr key={att.id} className="border-b border-border/50">
                      <td className="py-2">{att.studentId}</td>
                      <td className="py-2">
                        {att.score
                          ? `${att.score.correct}/${att.score.total} (${att.score.percentage}%)`
                          : '-'}
                      </td>
                      <td className="py-2">
                        {att.completedAt
                          ? new Date(att.completedAt).toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Create assessment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-muted-foreground text-sm mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
                    placeholder="e.g. Chapter 2 Quiz"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground text-sm mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground text-sm">Questions</span>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="text-primary text-sm hover:underline"
                    >
                      + Add question
                    </button>
                  </div>
                  {newQuestions.map((q, idx) => (
                    <div key={q.id} className="mb-4 p-3 rounded-lg bg-background border border-border">
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) =>
                          setNewQuestions((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], question: e.target.value };
                            return next;
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm mb-2"
                        placeholder="Question text"
                      />
                      {q.options?.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2 mb-1">
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={q.correctAnswer === oi}
                            onChange={() =>
                              setNewQuestions((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], correctAnswer: oi };
                                return next;
                              })
                            }
                            className="text-primary"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...(q.options || [])];
                              next[oi] = e.target.value;
                              setNewQuestions((prev) => {
                                const p = [...prev];
                                p[idx] = { ...p[idx], options: next };
                                return p;
                              });
                            }}
                            className="flex-1 px-2 py-1 rounded bg-background border border-border text-foreground text-sm"
                            placeholder={`Option ${oi + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherAssessments;
