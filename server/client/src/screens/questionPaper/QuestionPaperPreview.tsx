import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Copy,
  Edit,
  Loader2,
  Printer,
  RefreshCw,
  Share2,
  Trash2,
} from 'lucide-react';
import { Button } from '../../Components/ui/button';
import { PaperPreview } from '../../Components/questionPaper/PaperPreview';
import {
  deleteQuestionPaper,
  duplicateQuestionPaper,
  generateQuestionPaper,
  getQuestionPaper,
  replaceQuestion,
  updateQuestionPaper,
} from '../../services/questionPaperService';
import type { GeneratedQuestion, QuestionPaperDoc } from '../../types/questionPaper';

const QuestionPaperPreview = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<QuestionPaperDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!paperId) return;
    setLoading(true);
    try {
      const doc = await getQuestionPaper(paperId);
      if (!doc) {
        toast.error('Paper not found or you do not have access.');
        navigate('/question-paper/library');
        return;
      }
      setPaper(doc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load paper.');
    } finally {
      setLoading(false);
    }
  }, [paperId, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleMarkFinal = async () => {
    if (!paper) return;
    try {
      await updateQuestionPaper(paper.id, { status: 'final' });
      setPaper({ ...paper, status: 'final' });
      toast.success('Paper marked as final.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update paper.');
    }
  };

  const handleDuplicate = async () => {
    if (!paper) return;
    try {
      const copy = await duplicateQuestionPaper(paper);
      toast.success('Duplicated.');
      navigate(`/question-paper/view/${copy.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate.');
    }
  };

  const handleDelete = async () => {
    if (!paper) return;
    if (!window.confirm('Delete this paper permanently?')) return;
    try {
      await deleteQuestionPaper(paper.id);
      toast.success('Paper deleted.');
      navigate('/question-paper/library');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  const handleRegenerateOne = async (q: GeneratedQuestion) => {
    if (!paper) return;
    setRegeneratingId(q.id);
    try {
      const section = paper.blueprint.sections.find((s) => s.id === q.section_id);
      if (!section) throw new Error('Section not found.');
      const groupCandidates = section.groups.filter((g) => g.type === q.type);
      const syntheticBlueprint = {
        ...paper.blueprint,
        sections: [
          {
            ...section,
            groups:
              groupCandidates.length > 0
                ? [{ ...groupCandidates[0], count: 1 }]
                : [
                    {
                      id: `grp_${Math.random().toString(36).slice(2, 9)}`,
                      type: q.type,
                      count: 1,
                      marks_per_q: q.marks,
                      difficulty: q.difficulty ?? 'medium',
                      internal_choice: false,
                    },
                  ],
            max_marks: q.marks,
          },
        ],
        max_marks: q.marks,
        include_answer_key: paper.blueprint.include_answer_key,
      };
      const res = await generateQuestionPaper({
        source: paper.source,
        blueprint: syntheticBlueprint,
      });
      const replacement = res.questions[0];
      if (!replacement) throw new Error('No question returned.');
      const fresh: GeneratedQuestion = {
        ...replacement,
        id: q.id,
        section_id: q.section_id,
        number: q.number,
        sub_number: q.sub_number,
      };
      const newAnswer = res.answer_key[0];
      await replaceQuestion(
        paper.id,
        fresh,
        newAnswer ? { ...newAnswer, question_id: q.id } : undefined
      );
      toast.success('Question regenerated.');
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate.');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleShare = async () => {
    if (!paperId) return;
    const url = `${window.location.origin}/question-paper/view/${paperId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard.');
    } catch {
      toast.info(url);
    }
  };

  if (loading || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h1 className="text-2xl font-semibold truncate">{paper.blueprint.title}</h1>
            <p className="text-sm text-muted-foreground">
              {paper.blueprint.subject} · Class {paper.blueprint.class} · {paper.blueprint.max_marks} marks ·{' '}
              <span
                className={`inline-block px-2 py-0.5 rounded-full border text-xs ${
                  paper.status === 'final'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-amber-500 text-amber-600'
                }`}
              >
                {paper.status}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 qp-hide-on-print">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button variant="outline" onClick={handleDuplicate}>
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/question-paper/generate?paperId=${paper.id}`)}
            >
              <Edit className="w-4 h-4 mr-2" /> New from this
            </Button>
            {paper.status !== 'final' && <Button onClick={handleMarkFinal}>Mark final</Button>}
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
        </header>

        <div className="qp-hide-on-print rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground flex flex-wrap gap-3 items-center">
          <span className="font-medium text-foreground">Regenerate a single question:</span>
          {paper.questions.map((q) => (
            <button
              key={q.id}
              disabled={regeneratingId === q.id}
              onClick={() => handleRegenerateOne(q)}
              className={`px-2 py-0.5 rounded-md border transition ${
                regeneratingId === q.id
                  ? 'border-primary text-primary'
                  : 'border-border hover:bg-muted'
              }`}
              title={q.prompt.slice(0, 60)}
            >
              {regeneratingId === q.id ? (
                <Loader2 className="w-3 h-3 animate-spin inline" />
              ) : (
                <RefreshCw className="w-3 h-3 inline mr-1" />
              )}
              Q{q.number}
            </button>
          ))}
        </div>

        <PaperPreview
          blueprint={paper.blueprint}
          questions={paper.questions}
          answer_key={paper.answer_key}
          draft={paper.status === 'draft'}
        />
      </div>
    </div>
  );
};

export default QuestionPaperPreview;
