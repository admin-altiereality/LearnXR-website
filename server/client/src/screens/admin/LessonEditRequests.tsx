/**
 * Lesson Edit Requests - Admin/Super Admin approve or reject Associate's lesson changes.
 * Lists pending chapter_edit_requests; Preview (launch lesson with associate's draft), Approve, or Reject.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Loader2,
  X,
  FileEdit,
  Clock,
  User,
  Play,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLesson } from '../../contexts/LessonContext';
import { canApproveLessonEdits } from '../../utils/rbac';
import {
  fetchPendingEditRequests,
  approveEditRequest,
  rejectEditRequest,
  type ChapterEditRequest,
} from '../../services/chapterEditRequestService';
import { getLessonBundle } from '../../services/firestore/getLessonBundle';
import { buildLessonPayloadFromBundle } from '../../services/launchLessonFromBundle';
import { Button } from '../../Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../Components/ui/card';

const LessonEditRequests = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { startLesson } = useLesson();
  const [requests, setRequests] = useState<ChapterEditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewLaunchingId, setPreviewLaunchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile || !canApproveLessonEdits(profile)) return;
    setLoading(true);
    try {
      const list = await fetchPendingEditRequests();
      setRequests(list);
    } catch (error) {
      console.error('Failed to load edit requests:', error);
      toast.error('Failed to load edit requests');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile && !canApproveLessonEdits(profile)) {
      toast.error('You do not have permission to access this page');
      navigate('/lessons');
      return;
    }
    load();
  }, [profile, navigate, load]);

  const handleApprove = async (req: ChapterEditRequest) => {
    if (!profile?.uid) return;
    setProcessingId(req.id);
    try {
      await approveEditRequest(req.id, profile.uid);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success('Edit approved. Changes merged, topic(s) and chapter approved for Lessons page.');
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: ChapterEditRequest) => {
    if (!profile?.uid) return;
    setProcessingId(req.id);
    try {
      await rejectEditRequest(req.id, profile.uid);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success('Edit request rejected.');
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenChapter = (chapterId: string) => {
    navigate(`/studio/content/${chapterId}`);
  };

  /** Launch lesson player with the Associate's draft so Super Admin can preview changes before approving. */
  const handlePreviewInLesson = useCallback(
    async (req: ChapterEditRequest) => {
      setPreviewLaunchingId(req.id);
      try {
        const bundle = await getLessonBundle({
          chapterId: req.chapterId,
          lang: 'en',
          userId: req.requestedBy,
          userRole: 'associate',
        });
        
        // Log bundle state before building payload
        const firstTopic = bundle.chapter?.topics?.[0];
        console.log('[Preview] Bundle state:', {
          has_chapter: !!bundle.chapter,
          topics_count: bundle.chapter?.topics?.length || 0,
          first_topic_id: firstTopic?.topic_id,
          first_topic_skybox_url: firstTopic?.skybox_url,
          first_topic_skybox_id: firstTopic?.skybox_id,
          bundle_skybox: bundle.skybox ? {
            id: bundle.skybox.id,
            imageUrl: bundle.skybox.imageUrl,
            file_url: bundle.skybox.file_url,
            skybox_url: bundle.skybox.skybox_url,
          } : null,
        });
        
        const { chapter, topic } = buildLessonPayloadFromBundle(bundle);
        
        // Log final payload skybox info
        console.log('[Preview] Final payload skybox:', {
          skybox_url: topic.skybox_url,
          skybox_id: topic.skybox_id,
        });
        
        // Check if there's any viewable content (skybox URL or ID, scripts, or MCQs)
        const hasContent =
          topic.skybox_url || 
          topic.skybox_id || 
          topic.avatar_intro || 
          topic.avatar_explanation || 
          (topic.mcqs && topic.mcqs.length > 0);
        if (!hasContent) {
          toast.warning('This draft has no viewable content yet (no skybox or scripts).');
          return;
        }
        
        // Warn if skybox_id exists but no URL (player will fetch it)
        if (topic.skybox_id && !topic.skybox_url) {
          console.log('[Preview] Skybox ID found but no URL - player will fetch from Firestore');
        }
        startLesson(chapter, topic);
        const fullLessonData = {
          chapter,
          topic,
          startedAt: new Date().toISOString(),
        };
        sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
        toast.success('Opening lesson preview. You can approve or reject after viewing.');
        navigate('/vrlessonplayer');
      } catch (error) {
        console.error('Preview launch error:', error);
        toast.error('Failed to open lesson preview. The chapter or draft may be missing.');
      } finally {
        setPreviewLaunchingId(null);
      }
    },
    [startLesson, navigate]
  );

  if (!profile) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading edit requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <FileEdit className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Lesson Edit Requests</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Associate-refined lessons waiting for your approval
            </p>
          </div>
        </div>

        {requests.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">No pending edit requests</p>
              <p className="text-muted-foreground text-sm mt-1">
                When an Associate submits changes for approval, they will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-4">
            {requests.map((req) => {
              const isProcessing = processingId === req.id;
              const requestedAt = req.requestedAt?.toMillis?.()
                ? new Date(req.requestedAt.toMillis()).toLocaleString()
                : '—';
              return (
                <Card key={req.id} className="border-border">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {req.chapterName || `Chapter ${req.chapterNumber ?? req.chapterId}`}
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {req.requestedByEmail || req.requestedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {requestedAt}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handlePreviewInLesson(req)}
                          disabled={isProcessing || previewLaunchingId === req.id}
                          title="Preview the lesson with the Associate's changes before approving"
                        >
                          {previewLaunchingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Play className="w-4 h-4 mr-1" />
                          )}
                          Preview in lesson
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenChapter(req.chapterId)}
                        >
                          Open chapter
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(req)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(req)}
                          disabled={isProcessing}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LessonEditRequests;
