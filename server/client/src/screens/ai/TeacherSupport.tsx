/**
 * AI-Enabled Teacher Support
 * Lesson plan generator, content suggestions, rubric generator
 */

import { useState } from 'react';
import { FaChalkboardTeacher, FaListUl, FaMagic, FaGraduationCap } from 'react-icons/fa';
import {
  generateLessonPlan,
  getContentSuggestions,
  generateRubric,
  type LessonPlanResponse,
  type RubricResponse,
} from '../../services/teacherSupportService';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';

type Tab = 'lesson-plan' | 'content' | 'rubric';

const CONTENT_TYPES: Array<{ value: 'examples' | 'activities' | 'discussion_questions' | 'real_world_connections'; label: string }> = [
  { value: 'examples', label: 'Examples' },
  { value: 'activities', label: 'Activities' },
  { value: 'discussion_questions', label: 'Discussion questions' },
  { value: 'real_world_connections', label: 'Real-world connections' },
];

const TeacherSupport = () => {
  const [activeTab, setActiveTab] = useState<Tab>('lesson-plan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('Mathematics');
  const [classLevel, setClassLevel] = useState('8');
  const [curriculum, setCurriculum] = useState('CBSE');
  const [topic, setTopic] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [contentType, setContentType] = useState<'examples' | 'activities' | 'discussion_questions' | 'real_world_connections'>('examples');
  const [assignmentType, setAssignmentType] = useState('');

  const [lessonPlan, setLessonPlan] = useState<LessonPlanResponse | null>(null);
  const [contentItems, setContentItems] = useState<string[]>([]);
  const [rubric, setRubric] = useState<RubricResponse | null>(null);

  const handleLessonPlan = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    setError(null);
    setLoading(true);
    setLessonPlan(null);
    try {
      const plan = await generateLessonPlan({
        subject,
        classLevel,
        curriculum,
        topic: topic.trim(),
        durationMinutes,
      });
      setLessonPlan(plan);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Failed to generate lesson plan'));
    } finally {
      setLoading(false);
    }
  };

  const handleContentSuggestions = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    setError(null);
    setLoading(true);
    setContentItems([]);
    try {
      const result = await getContentSuggestions({
        subject,
        classLevel,
        topic: topic.trim(),
        type: contentType,
      });
      setContentItems(result.items);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Failed to get suggestions'));
    } finally {
      setLoading(false);
    }
  };

  const handleRubric = async () => {
    if (!assignmentType.trim()) {
      setError('Please enter assignment type (e.g. Essay, Lab Report)');
      return;
    }
    setError(null);
    setLoading(true);
    setRubric(null);
    try {
      const result = await generateRubric({
        subject,
        classLevel,
        assignmentType: assignmentType.trim(),
      });
      setRubric(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Failed to generate rubric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FaChalkboardTeacher className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                <span className="text-white">Learn</span>
                <span className="text-purple-700">XR</span>
                <TrademarkSymbol />
              </h1>
              <h2 className="text-xl font-semibold text-white">AI Teacher Support</h2>
              <p className="text-white/50 text-sm mt-0.5">Lesson plans, content ideas, and grading rubrics</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
          {(
            [
              { id: 'lesson-plan' as Tab, label: 'Lesson plan', icon: FaListUl },
              { id: 'content' as Tab, label: 'Content ideas', icon: FaMagic },
              { id: 'rubric' as Tab, label: 'Rubric', icon: FaGraduationCap },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {activeTab === 'lesson-plan' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">Class</label>
                <input
                  type="text"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Linear equations, Photosynthesis"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div className="flex gap-4 items-end">
              <div className="w-32">
                <label className="block text-white/70 text-sm mb-1">Duration (min)</label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleLessonPlan}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {loading ? 'Generating…' : 'Generate lesson plan'}
              </button>
            </div>
            {lessonPlan && (
              <div className="mt-6 p-5 rounded-xl border border-white/10 bg-white/5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{lessonPlan.title}</h3>
                <div>
                  <h4 className="text-cyan-400 text-sm font-medium mb-2">Objectives</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
                    {lessonPlan.objectives.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-cyan-400 text-sm font-medium mb-2">Materials</h4>
                  <p className="text-white/80 text-sm">{lessonPlan.materials.join(', ')}</p>
                </div>
                <div>
                  <h4 className="text-cyan-400 text-sm font-medium mb-2">Steps</h4>
                  <ol className="space-y-2 text-sm text-white/80">
                    {lessonPlan.steps.map((s) => (
                      <li key={s.step}>
                        <span className="text-cyan-400 font-medium">Step {s.step}</span>
                        {s.duration && <span className="text-white/50 ml-2">({s.duration})</span>}
                        <span className="ml-2">{s.description}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4 className="text-cyan-400 text-sm font-medium mb-2">Assessment ideas</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
                    {lessonPlan.assessmentIdeas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-cyan-400 text-sm font-medium mb-2">Differentiation</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
                    {lessonPlan.differentiationTips.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">Class</label>
                <input
                  type="text"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quadratic equations"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as typeof contentType)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleContentSuggestions}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Get suggestions'}
            </button>
            {contentItems.length > 0 && (
              <ul className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 space-y-2 text-white/80 text-sm">
                {contentItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'rubric' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">Class</label>
                <input
                  type="text"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Assignment type</label>
              <input
                type="text"
                value={assignmentType}
                onChange={(e) => setAssignmentType(e.target.value)}
                placeholder="e.g. Essay, Lab report, Project"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30"
              />
            </div>
            <button
              type="button"
              onClick={handleRubric}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate rubric'}
            </button>
            {rubric && (
              <div className="mt-6 p-5 rounded-xl border border-white/10 bg-white/5 space-y-4">
                <p className="text-white/60 text-sm">Max score: {rubric.maxScore}</p>
                {rubric.criteria.map((c, i) => (
                  <div key={i}>
                    <h4 className="text-cyan-400 font-medium mb-2">{c.name}</h4>
                    <ul className="space-y-1 text-sm text-white/80">
                      {c.levels.map((l, j) => (
                        <li key={j}>
                          <span className="text-white/50">{l.level}:</span> {l.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherSupport;
