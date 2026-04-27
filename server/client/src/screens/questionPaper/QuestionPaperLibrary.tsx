import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Copy,
  Eye,
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '../../Components/ui/button';
import { Input } from '../../Components/ui/input';
import { Card, CardContent } from '../../Components/ui/card';
import {
  deleteQuestionPaper,
  duplicateQuestionPaper,
  listQuestionPapers,
} from '../../services/questionPaperService';
import type { QuestionPaperDoc } from '../../types/questionPaper';
import { useAuth } from '../../contexts/AuthContext';

const formatDate = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (typeof value === 'object' && value !== null && 'seconds' in (value as Record<string, unknown>)) {
    const seconds = (value as { seconds: number }).seconds;
    return new Date(seconds * 1000).toLocaleString();
  }
  try {
    return new Date(value as string | number | Date).toLocaleString();
  } catch {
    return '';
  }
};

const QuestionPaperLibrary = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [papers, setPapers] = useState<QuestionPaperDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const role = (profile?.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
  const isAdminView = role === 'admin' || role === 'superadmin';
  const isSchoolLead = role === 'principal' || role === 'school';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Admins/superadmins see every paper; school leads see all papers in their school;
      // teachers see only their own.
      const opts = isAdminView
        ? { all: true as const }
        : isSchoolLead && (profile?.school_id || profile?.managed_school_id)
          ? { all: true as const, schoolId: profile.school_id ?? profile.managed_school_id }
          : {};
      const res = await listQuestionPapers(opts);
      setPapers(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load papers.');
    } finally {
      setLoading(false);
    }
  }, [isAdminView, isSchoolLead, profile?.school_id, profile?.managed_school_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subjects = useMemo(
    () => Array.from(new Set(papers.map((p) => p.blueprint.subject).filter(Boolean))),
    [papers]
  );
  const classes = useMemo(
    () => Array.from(new Set(papers.map((p) => p.blueprint.class).filter(Boolean))),
    [papers]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return papers.filter((p) => {
      if (subjectFilter && p.blueprint.subject !== subjectFilter) return false;
      if (classFilter && p.blueprint.class !== classFilter) return false;
      if (!needle) return true;
      const hay = `${p.blueprint.title} ${p.blueprint.subject} ${p.blueprint.class} ${p.blueprint.school.name}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [papers, search, subjectFilter, classFilter]);

  const handleDuplicate = async (paper: QuestionPaperDoc) => {
    try {
      await duplicateQuestionPaper(paper);
      toast.success('Paper duplicated.');
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate.');
    }
  };

  const handleDelete = async (paperId: string) => {
    if (!window.confirm('Delete this question paper? This cannot be undone.')) return;
    try {
      await deleteQuestionPaper(paperId);
      toast.success('Paper deleted.');
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Question Paper Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All papers you have generated.
            </p>
          </div>
          <Button onClick={() => navigate('/question-paper/generate')}>
            <Plus className="w-4 h-4 mr-2" /> New Question Paper
          </Button>
        </header>

        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder="Search title / subject / school…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="w-3 h-3" />
            <select
              className="border border-border rounded-md px-2 py-1 bg-background text-sm"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="border border-border rounded-md px-2 py-1 bg-background text-sm"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No question papers yet. Click <strong>New Question Paper</strong> to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((paper) => (
              <Card key={paper.id} className="hover:border-primary transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{paper.blueprint.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {paper.blueprint.subject} · Class {paper.blueprint.class}
                        {paper.blueprint.curriculum ? ` · ${paper.blueprint.curriculum}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        paper.status === 'final'
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-amber-500 text-amber-600'
                      }`}
                    >
                      {paper.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {paper.blueprint.school.name || 'No school set'} ·{' '}
                    {paper.blueprint.max_marks} marks · {paper.questions.length} questions
                    <div>Saved {formatDate(paper.updated_at)}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/question-paper/view/${paper.id}`)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Open
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(paper)}>
                      <Copy className="w-3 h-3 mr-1" /> Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(paper.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionPaperLibrary;
