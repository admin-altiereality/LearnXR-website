/**
 * Super Admin review queue for teacher/partner-authored lessons (Street View,
 * Create-page scenes, Spiral scenes). Approve promotes the draft into
 * curriculum_chapters as a new topic (optionally marked as a demo lesson);
 * reject records a reason visible to the creator.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Check, Clock, Image as ImageIcon, Loader2, MapPin, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../Components/ui/button';
import { Badge } from '../../Components/ui/badge';
import { Card, CardContent } from '../../Components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../Components/ui/dialog';
import {
  listLessonsForReview,
  reviewLesson,
  type UserGeneratedLesson,
  type UserGeneratedLessonStatus,
} from '../../services/userLessonService';

type Tab = UserGeneratedLessonStatus | 'all';

const TABS: Tab[] = ['submitted', 'approved', 'rejected', 'draft', 'all'];

const sourceLabels: Record<string, string> = {
  street_view: 'Street View',
  create_scene: 'Create page',
  spiral_scene: 'Spiral',
};

const statusBadgeStyles: Record<UserGeneratedLessonStatus, string> = {
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  submitted: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const formatDate = (value: unknown): string => {
  if (!value) return '—';
  const millis = (value as { toMillis?: () => number })?.toMillis?.();
  if (millis) return new Date(millis).toLocaleString();
  try {
    return new Date(value as string).toLocaleString();
  } catch {
    return '—';
  }
};

const UserGeneratedLessons = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<UserGeneratedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('submitted');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ lesson: UserGeneratedLesson; reason: string } | null>(null);
  const [markAsDemo, setMarkAsDemo] = useState(true);

  const load = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      const res = await listLessonsForReview(tab);
      setLessons(res.lessons || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load lessons for review');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'superadmin') {
      toast.error('You do not have permission to access this page');
      navigate('/dashboard');
      return;
    }
    load(activeTab);
  }, [profile, navigate, load, activeTab]);

  const counts = useMemo(() => {
    const byStatus = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
    lessons.forEach((l) => {
      if (l.moderation?.status in byStatus) byStatus[l.moderation.status as keyof typeof byStatus] += 1;
    });
    return byStatus;
  }, [lessons]);

  const handleApprove = async (lesson: UserGeneratedLesson) => {
    setProcessingId(lesson.id);
    try {
      await reviewLesson(lesson.id, { approve: true, markAsDemo });
      toast.success('Lesson approved and promoted to the curriculum.');
      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve lesson');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    setProcessingId(rejectModal.lesson.id);
    try {
      await reviewLesson(rejectModal.lesson.id, { approve: false, rejectionReason: rejectModal.reason.trim() });
      toast.success('Lesson rejected.');
      setLessons((prev) => prev.filter((l) => l.id !== rejectModal.lesson.id));
      setRejectModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject lesson');
    } finally {
      setProcessingId(null);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Community Lessons Review</h1>
            <p className="text-muted-foreground mt-1">
              Review Street View, Create page, and Spiral lessons submitted by teachers and partners.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={markAsDemo}
              onChange={(e) => setMarkAsDemo(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Mark approved lessons as demo lessons
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading lessons…
          </div>
        ) : lessons.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground font-medium">No lessons in this tab</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => {
              const isProcessing = processingId === lesson.id;
              const status = lesson.moderation?.status || 'draft';
              return (
                <Card key={lesson.id} className="border-border overflow-hidden">
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-40 h-28 rounded-lg bg-muted overflow-hidden shrink-0">
                      {lesson.skybox_url ? (
                        <img src={lesson.skybox_url} alt={lesson.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusBadgeStyles[status]}>
                          {status}
                        </Badge>
                        <Badge variant="outline">{sourceLabels[lesson.source] || lesson.source}</Badge>
                        <span className="text-sm font-medium text-foreground">{lesson.title}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Submitted {formatDate(lesson.moderation?.submittedAt)}
                        </span>
                        <span>Owner role: {lesson.ownerRole}</span>
                        <span>{(lesson.asset_ids || []).length} asset(s) attached</span>
                      </div>
                      {status === 'rejected' && lesson.moderation?.rejectionReason && (
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                          <span className="font-medium">Rejection reason:</span> {lesson.moderation.rejectionReason}
                        </div>
                      )}
                      {status === 'submitted' && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => handleApprove(lesson)} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejectModal({ lesson, reason: '' })}
                            disabled={isProcessing}
                          >
                            <X className="w-4 h-4" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!rejectModal} onOpenChange={(open) => !open && setRejectModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject lesson</DialogTitle>
            <DialogDescription>Optionally add a reason. The creator will see it on their draft.</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full min-h-[100px] px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. The skybox is too dark, please regenerate."
            value={rejectModal?.reason ?? ''}
            onChange={(e) => setRejectModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={!!processingId}>
              {processingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserGeneratedLessons;
