import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  Printer,
  Save,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { Button } from '../../Components/ui/button';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/ui/card';
import { Textarea } from '../../Components/ui/textarea';
import { HeaderForm } from '../../Components/questionPaper/HeaderForm';
import { BlueprintBuilder } from '../../Components/questionPaper/BlueprintBuilder';
import { PaperPreview } from '../../Components/questionPaper/PaperPreview';
import {
  buildEmptyBlueprint,
  validateBlueprint,
  type AnswerKeyEntry,
  type GeneratedQuestion,
  type PaperBlueprint,
  type PaperSource,
} from '../../types/questionPaper';
import {
  createQuestionPaper,
  generateQuestionPaper,
  uploadSourcePdf,
} from '../../services/questionPaperService';
import { getQuestionPaperAutofill } from '../../services/questionPaperAutofill';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

type Step = 'source' | 'blueprint' | 'preview';

interface ChapterLite {
  id: string;
  title?: string;
  subject?: string;
  class_level?: string | number;
  curriculum?: string;
  pdf_storage_url?: string;
  pdf_file_name?: string;
}

async function loadChapter(chapterId: string): Promise<ChapterLite | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'curriculum_chapters', chapterId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<ChapterLite, 'id'>) };
  } catch (err) {
    console.warn('[QuestionPaperGenerator] loadChapter failed', err);
    return null;
  }
}

const QuestionPaperGenerator = () => {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') ?? undefined;
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [step, setStep] = useState<Step>('source');
  const [blueprint, setBlueprint] = useState<PaperBlueprint>(() => buildEmptyBlueprint());
  const [source, setSource] = useState<PaperSource>(() =>
    chapterId ? { type: 'chapter', chapterId } : { type: 'upload' }
  );
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKeyEntry[]>([]);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [chapter, setChapter] = useState<ChapterLite | null>(null);
  const [autofilled, setAutofilled] = useState(false);

  // Load chapter if provided via ?chapterId
  useEffect(() => {
    if (!chapterId) return;
    (async () => {
      const ch = await loadChapter(chapterId);
      setChapter(ch);
      if (ch) {
        setBlueprint((prev) => ({
          ...prev,
          subject: prev.subject || ch.subject || '',
          class: prev.class || String(ch.class_level ?? ''),
          curriculum: prev.curriculum || ch.curriculum || prev.curriculum,
          chapter_ids: chapterId ? [chapterId] : prev.chapter_ids,
        }));
        setSource({ type: 'chapter', chapterId, pdfUrl: ch.pdf_storage_url });
        setSourceFileName(ch.pdf_file_name ?? 'Chapter PDF');
      }
    })();
  }, [chapterId]);

  // Autofill header on first mount (best-effort).
  useEffect(() => {
    if (autofilled) return;
    (async () => {
      try {
        const data = await getQuestionPaperAutofill({
          subject: chapter?.subject,
          curriculum: chapter?.curriculum,
          className: chapter?.class_level != null ? String(chapter.class_level) : undefined,
        });
        setBlueprint((prev) => ({
          ...prev,
          teacher_name: prev.teacher_name ?? data.teacher_name,
          class: prev.class || (data.class_name ?? ''),
          subject: prev.subject || (data.subject ?? ''),
          curriculum: prev.curriculum || data.curriculum,
          school: {
            ...prev.school,
            name: prev.school.name || data.school.name,
            address: prev.school.address || data.school.address,
            board: prev.school.board || data.school.board,
          },
        }));
      } catch (err) {
        console.warn('[QuestionPaperGenerator] autofill failed', err);
      } finally {
        setAutofilled(true);
      }
    })();
  }, [autofilled, chapter]);

  const blueprintErrors = useMemo(() => validateBlueprint(blueprint), [blueprint]);
  const canGenerate =
    blueprintErrors.length === 0 &&
    (source.type === 'chapter' || source.type === 'upload' || source.type === 'none') &&
    (source.pdfUrl || source.storagePath || source.rawText || source.type === 'none');

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadSourcePdf(file);
      setSource({
        type: 'upload',
        storagePath: res.storagePath,
        pdfUrl: res.pdfUrl,
      });
      setSourceFileName(res.fileName);
      toast.success('Source PDF uploaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload PDF.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      toast.error('Please fix blueprint errors before generating.');
      return;
    }
    setGenerating(true);
    try {
      const finalSource: PaperSource =
        rawText.trim().length > 0 ? { type: 'none', rawText: rawText.trim() } : source;
      const res = await generateQuestionPaper({ source: finalSource, blueprint });
      setQuestions(res.questions);
      setAnswerKey(res.answer_key);
      setGeneratedModel(res.model);
      setStep('preview');
      toast.success(`Generated ${res.questions.length} questions.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate paper.');
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, blueprint, source, rawText]);

  const handleSave = useCallback(
    async (status: 'draft' | 'final') => {
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

  const StepIndicator = () => (
    <div className="flex items-center gap-2 text-sm">
      {(['source', 'blueprint', 'preview'] as Step[]).map((s, idx) => {
        const active = step === s;
        const labels: Record<Step, string> = {
          source: '1. Source',
          blueprint: '2. Blueprint',
          preview: '3. Preview & Save',
        };
        return (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // Allow jumping back, and forward only if previous is valid.
                if (s === 'preview' && questions.length === 0) return;
                setStep(s);
              }}
              className={`px-3 py-1 rounded-full border transition ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {labels[s]}
            </button>
            {idx < 2 && <span className="text-muted-foreground">›</span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <button onClick={() => navigate(-1)} className="hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <span>/</span>
              <button onClick={() => navigate('/question-paper/library')} className="hover:text-foreground">
                Question Paper Library
              </button>
            </div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              AI Question Paper Generator
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build CBSE / RBSE-style question papers from chapter content or an uploaded PDF.
            </p>
          </div>
          <StepIndicator />
        </header>

        {step === 'source' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" /> Source content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {chapter ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                  <div className="text-sm font-medium">{chapter.title ?? 'Chapter'}</div>
                  <div className="text-xs text-muted-foreground">
                    {chapter.subject ?? ''} {chapter.class_level ? `· Class ${chapter.class_level}` : ''}{' '}
                    {chapter.curriculum ? `· ${chapter.curriculum}` : ''}
                  </div>
                  {chapter.pdf_storage_url ? (
                    <div className="text-xs text-muted-foreground">
                      Using chapter PDF: {chapter.pdf_file_name ?? 'source.pdf'}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-500">
                      This chapter does not have an attached PDF. Upload one below.
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <Label className="mb-2 block">Upload source PDF (optional)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="qp-source-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                    disabled={uploading}
                  />
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                {sourceFileName && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {sourceFileName}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="qp-raw-text" className="mb-2 block">
                  Or paste source text directly (fallback)
                </Label>
                <Textarea
                  id="qp-raw-text"
                  rows={6}
                  placeholder="Paste chapter text, notes, or syllabus extract…"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paper will be generated from this text instead of the uploaded PDF if both are provided.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep('blueprint')}>
                  Next: Blueprint <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'blueprint' && (
          <div className="space-y-6">
            <HeaderForm
              blueprint={blueprint}
              onChange={setBlueprint}
              autofillHints={{
                subject: chapter?.subject,
                curriculum: chapter?.curriculum,
                className: chapter?.class_level != null ? String(chapter.class_level) : undefined,
              }}
            />

            <BlueprintBuilder blueprint={blueprint} onChange={setBlueprint} />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('source')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
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
            </div>
            {blueprintErrors.length > 0 && (
              <div className="text-xs text-destructive">
                Please fix {blueprintErrors.length} blueprint issue{blueprintErrors.length === 1 ? '' : 's'} before
                generating.
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setStep('blueprint')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Edit Blueprint
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save as draft
                </Button>
                <Button onClick={() => handleSave('final')} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save paper
                </Button>
              </div>
            </div>
            <PaperPreview
              blueprint={blueprint}
              questions={questions}
              answer_key={answerKey}
              draft
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionPaperGenerator;
