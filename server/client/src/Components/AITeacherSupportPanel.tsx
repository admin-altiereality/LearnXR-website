/**
 * AI Teacher Support Panel - Compact panel for the Create page top-right corner
 * Merges lesson plan, content ideas, and rubric generation into a collapsible panel
 */

import { useState } from 'react';
import { FaRobot, FaListUl, FaMagic, FaGraduationCap, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import {
  generateLessonPlan,
  getContentSuggestions,
  generateRubric,
  type LessonPlanResponse,
  type RubricResponse,
} from '../services/teacherSupportService';

type Tab = 'lesson-plan' | 'content' | 'rubric';

const CONTENT_TYPES: Array<{ value: 'examples' | 'activities' | 'discussion_questions' | 'real_world_connections'; label: string }> = [
  { value: 'examples', label: 'Examples' },
  { value: 'activities', label: 'Activities' },
  { value: 'discussion_questions', label: 'Discussion' },
  { value: 'real_world_connections', label: 'Real-world' },
];

export const AITeacherSupportPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
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
  const [expandPlan, setExpandPlan] = useState(false);
  const [contentItems, setContentItems] = useState<string[]>([]);
  const [expandContent, setExpandContent] = useState(false);
  const [rubric, setRubric] = useState<RubricResponse | null>(null);
  const [expandRubric, setExpandRubric] = useState(false);

  const handleLessonPlan = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    setError(null);
    setLoading(true);
    setLessonPlan(null);
    try {
      const plan = await generateLessonPlan({ subject, classLevel, curriculum, topic: topic.trim(), durationMinutes });
      setLessonPlan(plan);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Failed to generate'));
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
      const result = await getContentSuggestions({ subject, classLevel, topic: topic.trim(), type: contentType });
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
      setError('Please enter assignment type');
      return;
    }
    setError(null);
    setLoading(true);
    setRubric(null);
    try {
      const result = await generateRubric({ subject, classLevel, assignmentType: assignmentType.trim() });
      setRubric(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error ?? (e instanceof Error ? e.message : 'Failed to generate rubric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[320px] sm:w-[360px] max-h-[85vh] flex flex-col">
      <div className="bg-card/95 backdrop-blur-sm border border-indigo-500/30 rounded-lg shadow-lg overflow-hidden">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-indigo-500/20 border-b border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">
              <FaRobot className="text-indigo-400 text-lg" />
            </div>
            <div className="text-left">
              <span className="text-sm font-semibold text-foreground">AI Teacher Support</span>
              <p className="text-[10px] text-muted-foreground">Lesson plans • Content • Rubrics</p>
            </div>
          </div>
          {isExpanded ? <FaChevronUp className="text-indigo-400" /> : <FaChevronDown className="text-indigo-400" />}
        </button>

        {/* Expandable content */}
        {isExpanded && (
          <div className="overflow-y-auto max-h-[calc(85vh-56px)] p-2 space-y-2">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border pb-1">
              {[
                { id: 'lesson-plan' as Tab, label: 'Plan', icon: FaListUl },
                { id: 'content' as Tab, label: 'Content', icon: FaMagic },
                { id: 'rubric' as Tab, label: 'Rubric', icon: FaGraduationCap },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                    activeTab === id ? 'bg-indigo-500/30 text-indigo-300' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
            )}

            {/* Lesson Plan Tab */}
            {activeTab === 'lesson-plan' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Class</label>
                    <input
                      type="text"
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Linear equations"
                    className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">min</span>
                  <button
                    onClick={handleLessonPlan}
                    disabled={loading}
                    className="flex-1 px-2 py-1.5 rounded bg-indigo-500/30 text-indigo-200 text-xs font-medium hover:bg-indigo-500/40 disabled:opacity-50"
                  >
                    {loading ? 'Generating…' : 'Generate'}
                  </button>
                </div>
                {lessonPlan && (
                  <div className="p-2 rounded border border-border bg-muted/30 space-y-1.5 overflow-y-auto max-h-[300px]">
                    <p className="font-medium text-foreground text-xs">{lessonPlan.title}</p>
                    {expandPlan ? (
                      <>
                        <p className="text-[10px] text-indigo-300 font-medium">Objectives</p>
                        <ul className="list-disc list-inside text-[10px] text-foreground/80 space-y-0.5">
                          {lessonPlan.objectives.map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-indigo-300 font-medium">Materials</p>
                        <p className="text-[10px] text-foreground/80">{lessonPlan.materials.join(', ')}</p>
                        <p className="text-[10px] text-indigo-300 font-medium">Steps</p>
                        <ol className="space-y-1 text-[10px] text-foreground/80">
                          {lessonPlan.steps.map((s) => (
                            <li key={s.step}>
                              <span className="text-indigo-400">Step {s.step}</span>
                              {s.duration && <span className="text-muted-foreground ml-1">({s.duration})</span>}
                              <span className="ml-1">{s.description}</span>
                            </li>
                          ))}
                        </ol>
                        <button onClick={() => setExpandPlan(false)} className="text-[10px] text-indigo-400 hover:underline">
                          Show less
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          {lessonPlan.objectives.slice(0, 2).join(' • ')}...
                        </p>
                        <button onClick={() => setExpandPlan(true)} className="text-[10px] text-indigo-400 hover:underline">
                          View full plan
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Class</label>
                    <input
                      type="text"
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Quadratic equations"
                    className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                  />
                </div>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as typeof contentType)}
                  className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleContentSuggestions}
                  disabled={loading}
                  className="w-full px-2 py-1.5 rounded bg-indigo-500/30 text-indigo-200 text-xs font-medium hover:bg-indigo-500/40 disabled:opacity-50"
                >
                  {loading ? 'Loading…' : 'Get suggestions'}
                </button>
                {contentItems.length > 0 && (
                  <div>
                    <ul className={`space-y-1 overflow-y-auto text-[10px] text-foreground/80 ${expandContent ? 'max-h-48' : 'max-h-24'}`}>
                      {(expandContent ? contentItems : contentItems.slice(0, 4)).map((item, i) => (
                        <li key={i} className="flex gap-1">
                          <span className="text-indigo-400">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    {!expandContent && contentItems.length > 4 && (
                      <button onClick={() => setExpandContent(true)} className="text-[10px] text-indigo-400 hover:underline mt-1">
                        +{contentItems.length - 4} more
                      </button>
                    )}
                    {expandContent && (
                      <button onClick={() => setExpandContent(false)} className="text-[10px] text-indigo-400 hover:underline mt-1">
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rubric Tab */}
            {activeTab === 'rubric' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Class</label>
                    <input
                      type="text"
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Assignment type</label>
                  <input
                    type="text"
                    value={assignmentType}
                    onChange={(e) => setAssignmentType(e.target.value)}
                    placeholder="e.g. Essay, Lab report"
                    className="w-full px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                  />
                </div>
                <button
                  onClick={handleRubric}
                  disabled={loading}
                  className="w-full px-2 py-1.5 rounded bg-indigo-500/30 text-indigo-200 text-xs font-medium hover:bg-indigo-500/40 disabled:opacity-50"
                >
                  {loading ? 'Generating…' : 'Generate rubric'}
                </button>
                {rubric && (
                  <div className={`p-2 rounded border border-border bg-muted/30 space-y-1 overflow-y-auto ${expandRubric ? 'max-h-64' : 'max-h-28'}`}>
                    <p className="text-[10px] text-muted-foreground">Max: {rubric.maxScore} pts</p>
                    {(expandRubric ? rubric.criteria : rubric.criteria.slice(0, 2)).map((c, i) => (
                      <div key={i}>
                        <p className="font-medium text-indigo-300 text-[10px]">{c.name}</p>
                        {expandRubric && (
                          <ul className="space-y-0.5 text-[10px] text-foreground/80 ml-2">
                            {c.levels.map((l, j) => (
                              <li key={j}>
                                <span className="text-muted-foreground">{l.level}:</span> {l.description}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {!expandRubric && rubric.criteria.length > 2 ? (
                      <button onClick={() => setExpandRubric(true)} className="text-[10px] text-indigo-400 hover:underline">
                        +{rubric.criteria.length - 2} criteria — View full
                      </button>
                    ) : expandRubric ? (
                      <button onClick={() => setExpandRubric(false)} className="text-[10px] text-indigo-400 hover:underline">
                        Show less
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
