/**
 * QuestionPaperTab
 *
 * Embeds a streamlined version of the Question Paper Generator inside the Studio
 * chapter editor. The source is pinned to the current chapter, and the blueprint
 * is pre-filled from chapter metadata and the user's profile.
 *
 * Generated papers are persisted in the separate `question_papers` collection
 * (not the lesson draft), mirroring how `SourceTab` / `HistoryTab` behave.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ClipboardList,
  ExternalLink,
  Eye,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { HeaderForm } from '../../questionPaper/HeaderForm';
import { BlueprintBuilder } from '../../questionPaper/BlueprintBuilder';
import { PaperPreview } from '../../questionPaper/PaperPreview';
import {
  buildEmptyBlueprint,
  validateBlueprint,
  type AnswerKeyEntry,
  type GeneratedQuestion,
  type PaperBlueprint,
  type PaperSource,
} from '../../../types/questionPaper';
import {
  createQuestionPaper,
  generateQuestionPaper,
  listQuestionPapers,
  sourceFromChapter,
} from '../../../services/questionPaperService';
import { getQuestionPaperAutofill } from '../../../services/questionPaperAutofill';
import { useAuth } from '../../../contexts/AuthContext';
import type { QuestionPaperDoc } from '../../../types/questionPaper';

interface QuestionPaperTabProps {
  chapterId: string;
  bundle?: {
    chapter?: {
      chapter_name?: string;
      subject?: string;
      class?: number | string;
      curriculum?: string;
      pdf_storage_url?: string;
    };
  } | null;
  subject?: string;
  classLevel?: string;
  curriculum?: string;
}

export const QuestionPaperTab = ({
  chapterId,
  bundle,
  subject,
  classLevel,
  curriculum,
}: QuestionPaperTabProps) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const chapter = bundle?.chapter;

  const [blueprint, setBlueprint] = useState<PaperBlueprint>(() => buildEmptyBlueprint());
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKeyEntry[]>([]);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [existingPapers, setExistingPapers] = useState<QuestionPaperDoc[]>([]);
  const [autofilled, setAutofilled] = useState(false);

  const source: PaperSource = useMemo(
    () => sourceFromChapter(chapterId, { pdf_storage_url: chapter?.pdf_storage_url }),
    [chapterId, chapter?.pdf_storage_url]
  );

  // Refresh existing papers for this chapter on mount
  useEffect(() => {
    (async () => {
      try {
        const all = await listQuestionPapers({ limit: 100 });
        setExistingPapers(all.filter((p) => (p.blueprint.chapter_ids ?? []).includes(chapterId)));
      } catch (err) {
        console.warn('[QuestionPaperTab] list papers failed', err);
      }
    })();
  }, [chapterId]);

  // Prefill blueprint from chapter/profile on mount
  useEffect(() => {
    if (autofilled) return;
    (async () => {
      try {
        const data = await getQuestionPaperAutofill({
          subject: chapter?.subject ?? subject,
          curriculum: chapter?.curriculum ?? curriculum,
          className: chapter?.class != null ? String(chapter.class) : classLevel,
        });
        setBlueprint((prev) => ({
          ...prev,
          teacher_name: prev.teacher_name ?? data.teacher_name,
          class: prev.class || data.class_name || String(chapter?.class ?? classLevel ?? ''),
          subject: prev.subject || data.subject || chapter?.subject || subject || '',
          curriculum: prev.curriculum || data.curriculum || chapter?.curriculum || curriculum,
          chapter_ids: [chapterId],
          school: {
            ...prev.school,
            name: prev.school.name || data.school.name,
            address: prev.school.address || data.school.address,
            board: prev.school.board || data.school.board,
          },
        }));
      } catch (err) {
        console.warn('[QuestionPaperTab] autofill failed', err);
      } finally {
        setAutofilled(true);
      }
    })();
  }, [autofilled, chapter, chapterId, subject, classLevel, curriculum]);

  const errors = useMemo(() => validateBlueprint(blueprint), [blueprint]);
  const hasSource = Boolean(chapter?.pdf_storage_url);

  const handleGenerate = useCallback(async () => {
    if (errors.length > 0) {
      toast.error('Please fix blueprint errors before generating.');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateQuestionPaper({ source, blueprint });
      setQuestions(res.questions);
      setAnswerKey(res.answer_key);
      setGeneratedModel(res.model);
      toast.success(`Generated ${res.questions.length} questions.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate paper.');
    } finally {
      setGenerating(false);
    }
  }, [errors, source, blueprint]);

  const handleSave = useCallback(
    async (status: 'draft' | 'final') => {
      if (questions.length === 0) {
        toast.error('Generate the paper before saving.');
        return;
      }
      setSaving(true);
      try {
        const paper = await createQuestionPaper({
          blueprint,
          source,
          questions,
          answer_key: answerKey,
          model: generatedModel,
          status,
          school_id: profile?.school_id ?? undefined,
        });
        toast.success('Question paper saved.');
        navigate(`/question-paper/view/${paper.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save paper.');
      } finally {
        setSaving(false);
      }
    },
    [blueprint, source, questions, answerKey, generatedModel, profile?.school_id, navigate]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Question Paper (AI)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate CBSE/RBSE-style practice papers directly from this chapter's source PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/question-paper/library">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-3 h-3 mr-1" /> All papers
            </Button>
          </Link>
          <Link to={`/question-paper/generate?chapterId=${chapterId}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-3 h-3 mr-1" /> Open in full wizard
            </Button>
          </Link>
        </div>
      </div>

      {!hasSource && (
        <Card>
          <CardContent className="p-4 text-sm text-amber-600 flex items-start gap-2">
            <Sparkles className="w-4 h-4 mt-0.5" />
            <div>
              This chapter has no attached source PDF. The AI will use the blueprint and chapter metadata,
              but results are sharper with a source PDF. Upload one from the <strong>Source</strong> tab
              or paste text via the full wizard.
            </div>
          </CardContent>
        </Card>
      )}

      {existingPapers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Papers already generated for this chapter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingPapers.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.blueprint.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.blueprint.max_marks} marks · {p.questions.length} questions ·{' '}
                    <span
                      className={`inline-block px-1.5 rounded border text-[10px] uppercase ${
                        p.status === 'final'
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-amber-500 text-amber-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/question-paper/view/${p.id}`)}
                >
                  <Eye className="w-3 h-3 mr-1" /> Open
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <HeaderForm
        blueprint={blueprint}
        onChange={setBlueprint}
        autofillHints={{
          subject: chapter?.subject ?? subject,
          curriculum: chapter?.curriculum ?? curriculum,
          className: chapter?.class != null ? String(chapter.class) : classLevel,
        }}
      />

      <BlueprintBuilder blueprint={blueprint} onChange={setBlueprint} />

      <div className="flex flex-wrap gap-2 justify-end">
        <Button onClick={handleGenerate} disabled={generating || errors.length > 0}>
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" /> Generate paper
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving || questions.length === 0}>
          Save as draft
        </Button>
        <Button onClick={() => handleSave('final')} disabled={saving || questions.length === 0}>
          Save paper
        </Button>
      </div>

      {questions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Preview</h3>
          <PaperPreview
            blueprint={blueprint}
            questions={questions}
            answer_key={answerKey}
            draft
          />
        </div>
      )}
    </div>
  );
};

export default QuestionPaperTab;
