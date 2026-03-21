/**
 * Lesson Edit Requests - Admin/Super Admin dashboard for reviewing lesson change requests.
 * Organizes requests by class, subject, and chapter while preserving preview/approve/reject actions.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  Check,
  CheckCircle2,
  Clock,
  FileEdit,
  FolderTree,
  Layers3,
  Loader2,
  Play,
  Search,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLesson } from '../../contexts/LessonContext';
import { canApproveLessonEdits } from '../../utils/rbac';
import {
  fetchEditRequests,
  approveAllPendingEditRequests,
  approveEditRequest,
  rejectEditRequest,
  type ChapterEditRequest,
  type EditRequestStatus,
} from '../../services/chapterEditRequestService';
import { getLessonBundle } from '../../services/firestore/getLessonBundle';
import { getTopicIdsWithUnapprovedVersionForUser } from '../../services/lessonVersionService';
import { buildLessonPayloadFromBundle } from '../../services/launchLessonFromBundle';
import { Button } from '../../Components/ui/button';
import { Badge } from '../../Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../Components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../Components/ui/dialog';
import { cn } from '@/lib/utils';

type RequestTab = 'all' | EditRequestStatus;

interface TopicSummary {
  topicId: string;
  topicName: string;
  topicPriority: number | null;
  isEdited: boolean;
}

interface RequestEnrichment {
  className: string;
  subjectName: string;
  chapterDisplayName: string;
  chapterDisplayNumber: number | null;
  topics: TopicSummary[];
  editedTopicCount: number;
}

interface EnrichedEditRequest extends ChapterEditRequest, RequestEnrichment {}

interface ChapterMetadata {
  className: string;
  subjectName: string;
  chapterDisplayName: string;
  chapterDisplayNumber: number | null;
  topics: Array<{
    topicId: string;
    topicName: string;
    topicPriority: number | null;
  }>;
}

interface ChapterGroup {
  chapterId: string;
  chapterName: string;
  chapterNumber: number | null;
  requests: EnrichedEditRequest[];
  topics: TopicSummary[];
}

interface SubjectGroup {
  subjectName: string;
  totalRequests: number;
  chapters: ChapterGroup[];
}

interface ClassGroup {
  className: string;
  totalRequests: number;
  subjects: SubjectGroup[];
}

const UNKNOWN_CLASS = 'Unassigned class';
const UNKNOWN_SUBJECT = 'Unassigned subject';

const statusBadgeStyles: Record<EditRequestStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const formatDateTime = (value?: { toMillis?: () => number } | null) => {
  const millis = value?.toMillis?.();
  return millis ? new Date(millis).toLocaleString() : '—';
};

const formatStatusLabel = (status: EditRequestStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const normalizeText = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const formatClassLabel = (value: unknown) => {
  if (value == null) return UNKNOWN_CLASS;
  const trimmed = String(value).trim();
  if (!trimmed) return UNKNOWN_CLASS;
  if (/^(class|grade|std|year)\b/i.test(trimmed)) return trimmed;
  return /^\d+$/.test(trimmed) ? `Class ${trimmed}` : trimmed;
};

const normalizeTopicPriority = (value: unknown) => {
  const priority = Number(value);
  return Number.isFinite(priority) ? priority : null;
};

const sortTopics = <T extends { topicName: string; topicPriority: number | null }>(topics: T[]) =>
  [...topics].sort((a, b) => {
    const priorityA = a.topicPriority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.topicPriority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.topicName.localeCompare(b.topicName);
  });

const fallbackEnrichment = (req: ChapterEditRequest): RequestEnrichment => ({
  className: UNKNOWN_CLASS,
  subjectName: UNKNOWN_SUBJECT,
  chapterDisplayName: req.chapterName || `Chapter ${req.chapterNumber ?? req.chapterId}`,
  chapterDisplayNumber: req.chapterNumber ?? null,
  topics: [],
  editedTopicCount: 0,
});

const LessonEditRequests = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { startLesson } = useLesson();
  const [requests, setRequests] = useState<ChapterEditRequest[]>([]);
  const [requestEnrichment, setRequestEnrichment] = useState<Record<string, RequestEnrichment>>({});
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [previewLaunchingId, setPreviewLaunchingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RequestTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectModal, setRejectModal] = useState<{ req: ChapterEditRequest; reason: string } | null>(null);
  const chapterMetaCacheRef = useRef<Map<string, Promise<ChapterMetadata>>>(new Map());

  const getChapterMetadata = useCallback(async (req: ChapterEditRequest): Promise<ChapterMetadata> => {
    const cached = chapterMetaCacheRef.current.get(req.chapterId);
    if (cached) {
      return cached;
    }

    const metadataPromise = (async () => {
      try {
        const bundle = await getLessonBundle({
          chapterId: req.chapterId,
          lang: 'en',
        });
        const chapter = bundle.chapter as any;
        const rawTopics = Array.isArray(chapter?.topics) ? chapter.topics : [];
        const topics = sortTopics(
          rawTopics.map((topic: any, index: number) => ({
            topicId: String(topic?.topic_id ?? `topic-${index}`),
            topicName: normalizeText(
              topic?.topic_name,
              `Topic ${normalizeTopicPriority(topic?.topic_priority) ?? index + 1}`
            ),
            topicPriority: normalizeTopicPriority(topic?.topic_priority),
          }))
        );

        return {
          className: formatClassLabel(chapter?.class_name ?? chapter?.class ?? chapter?.class_id),
          subjectName: normalizeText(chapter?.subject ?? chapter?.subject_name ?? chapter?.subject_id, UNKNOWN_SUBJECT),
          chapterDisplayName: normalizeText(chapter?.chapter_name ?? req.chapterName, req.chapterName || `Chapter ${req.chapterId}`),
          chapterDisplayNumber: Number.isFinite(Number(chapter?.chapter_number))
            ? Number(chapter.chapter_number)
            : req.chapterNumber ?? null,
          topics,
        };
      } catch (error) {
        console.warn('Failed to enrich chapter metadata for lesson edit request:', req.chapterId, error);
        return {
          className: UNKNOWN_CLASS,
          subjectName: UNKNOWN_SUBJECT,
          chapterDisplayName: req.chapterName || `Chapter ${req.chapterNumber ?? req.chapterId}`,
          chapterDisplayNumber: req.chapterNumber ?? null,
          topics: [],
        };
      }
    })();

    chapterMetaCacheRef.current.set(req.chapterId, metadataPromise);
    return metadataPromise;
  }, []);

  const enrichRequest = useCallback(
    async (req: ChapterEditRequest): Promise<RequestEnrichment> => {
      const chapterMetaPromise = getChapterMetadata(req);
      const editedTopicIdsPromise =
        req.status === 'approved'
          ? Promise.resolve<string[]>([])
          : getTopicIdsWithUnapprovedVersionForUser(req.chapterId, req.requestedBy).catch((error) => {
              console.warn('Failed to read edited topic IDs for request:', req.id, error);
              return [];
            });

      const [chapterMeta, editedTopicIds] = await Promise.all([chapterMetaPromise, editedTopicIdsPromise]);
      const editedTopicSet = new Set(editedTopicIds);
      const topics = chapterMeta.topics.map((topic) => ({
        ...topic,
        isEdited: editedTopicSet.has(topic.topicId),
      }));

      return {
        ...chapterMeta,
        topics,
        editedTopicCount: topics.filter((topic) => topic.isEdited).length,
      };
    },
    [getChapterMetadata]
  );

  const load = useCallback(async () => {
    if (!profile || !canApproveLessonEdits(profile)) return;

    setLoading(true);
    setDetailsLoading(false);
    try {
      const list = await fetchEditRequests({ status: 'all' });
      setRequests(list);

      if (list.length === 0) {
        setRequestEnrichment({});
        return;
      }

      setDetailsLoading(true);
      const enrichedEntries = await Promise.all(
        list.map(async (req) => [req.id, await enrichRequest(req)] as const)
      );
      setRequestEnrichment(Object.fromEntries(enrichedEntries));
    } catch (error) {
      console.error('Failed to load edit requests:', error);
      toast.error('Failed to load lesson edit requests');
    } finally {
      setLoading(false);
      setDetailsLoading(false);
    }
  }, [profile, enrichRequest]);

  useEffect(() => {
    if (profile && !canApproveLessonEdits(profile)) {
      toast.error('You do not have permission to access this page');
      navigate('/lessons');
      return;
    }
    load();
  }, [profile, navigate, load]);

  const enrichedRequests = useMemo<EnrichedEditRequest[]>(
    () => requests.map((req) => ({ ...req, ...(requestEnrichment[req.id] ?? fallbackEnrichment(req)) })),
    [requests, requestEnrichment]
  );

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((req) => req.status === 'pending').length,
      approved: requests.filter((req) => req.status === 'approved').length,
      rejected: requests.filter((req) => req.status === 'rejected').length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return enrichedRequests.filter((req) => {
      if (activeTab !== 'all' && req.status !== activeTab) {
        return false;
      }

      if (!query) return true;

      const searchFields = [
        req.requestedByEmail,
        req.requestedBy,
        req.className,
        req.subjectName,
        req.chapterDisplayName,
        req.chapterDisplayNumber ? `chapter ${req.chapterDisplayNumber}` : '',
        req.rejectionReason ?? '',
        ...req.topics.map((topic) => topic.topicName),
      ];

      return searchFields.some((field) => String(field ?? '').toLowerCase().includes(query));
    });
  }, [activeTab, enrichedRequests, searchQuery]);

  const groupedRequests = useMemo<ClassGroup[]>(() => {
    const classMap = new Map<string, Map<string, Map<string, ChapterGroup>>>();

    filteredRequests.forEach((req) => {
      const className = req.className || UNKNOWN_CLASS;
      const subjectName = req.subjectName || UNKNOWN_SUBJECT;
      const chapterKey = `${req.chapterId}:${req.chapterDisplayNumber ?? ''}:${req.chapterDisplayName}`;

      if (!classMap.has(className)) classMap.set(className, new Map());
      const subjectMap = classMap.get(className)!;
      if (!subjectMap.has(subjectName)) subjectMap.set(subjectName, new Map());
      const chapterMap = subjectMap.get(subjectName)!;

      if (!chapterMap.has(chapterKey)) {
        chapterMap.set(chapterKey, {
          chapterId: req.chapterId,
          chapterName: req.chapterDisplayName,
          chapterNumber: req.chapterDisplayNumber,
          requests: [],
          topics: req.topics,
        });
      }

      const chapterGroup = chapterMap.get(chapterKey)!;
      chapterGroup.requests.push(req);
      if (chapterGroup.topics.length === 0 && req.topics.length > 0) {
        chapterGroup.topics = req.topics;
      }
    });

    return [...classMap.entries()]
      .map(([className, subjectMap]) => {
        const subjects = [...subjectMap.entries()]
          .map(([subjectName, chapterMap]) => {
            const chapters = [...chapterMap.values()]
              .map((chapter) => ({
                ...chapter,
                requests: [...chapter.requests].sort((a, b) => {
                  const aTime = a.requestedAt?.toMillis?.() ?? 0;
                  const bTime = b.requestedAt?.toMillis?.() ?? 0;
                  return bTime - aTime;
                }),
                topics: sortTopics(chapter.topics),
              }))
              .sort((a, b) => {
                const numberA = a.chapterNumber ?? Number.MAX_SAFE_INTEGER;
                const numberB = b.chapterNumber ?? Number.MAX_SAFE_INTEGER;
                if (numberA !== numberB) return numberA - numberB;
                return a.chapterName.localeCompare(b.chapterName);
              });

            return {
              subjectName,
              totalRequests: chapters.reduce((sum, chapter) => sum + chapter.requests.length, 0),
              chapters,
            };
          })
          .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

        return {
          className,
          totalRequests: subjects.reduce((sum, subject) => sum + subject.totalRequests, 0),
          subjects,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [filteredRequests]);

  const handleApprove = async (req: ChapterEditRequest) => {
    if (!profile?.uid) return;

    setProcessingId(req.id);
    try {
      await approveEditRequest(req.id, profile.uid);
      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id
            ? {
                ...item,
                status: 'approved',
                reviewedBy: profile.uid,
                reviewedAt: Timestamp.now(),
                rejectionReason: null,
              }
            : item
        )
      );
      toast.success('Edit approved. Changes merged and the request moved to Approved.');
    } catch (error) {
      console.error('Approve error:', error);
      const message = error instanceof Error ? error.message : 'Failed to approve';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAllPending = async () => {
    if (!profile?.uid || counts.pending === 0 || bulkApproving) return;

    const confirmed = window.confirm(
      `Approve all ${counts.pending} pending lesson edit request(s)? This will merge every pending request currently in the system.`
    );
    if (!confirmed) return;

    setBulkApproving(true);
    try {
      const result = await approveAllPendingEditRequests(profile.uid);

      if (result.succeededIds.length > 0) {
        const succeeded = new Set(result.succeededIds);
        setRequests((prev) =>
          prev.map((item) =>
            succeeded.has(item.id)
              ? {
                  ...item,
                  status: 'approved',
                  reviewedBy: profile.uid,
                  reviewedAt: Timestamp.now(),
                  rejectionReason: null,
                }
              : item
          )
        );
      }

      if (result.failed.length === 0) {
        toast.success(`Approved ${result.succeededIds.length} pending request(s).`);
      } else if (result.succeededIds.length === 0) {
        toast.error(`Approve all failed for ${result.failed.length} request(s).`);
      } else {
        toast.warning(
          `Approved ${result.succeededIds.length} request(s), but ${result.failed.length} failed.`
        );
      }
    } catch (error) {
      console.error('Bulk approve error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve pending requests');
    } finally {
      setBulkApproving(false);
    }
  };

  const openRejectModal = (req: ChapterEditRequest) => {
    setRejectModal({ req, reason: req.rejectionReason ?? '' });
  };

  const handleRejectSubmit = async () => {
    if (!profile?.uid || !rejectModal) return;

    const { req, reason } = rejectModal;
    setProcessingId(req.id);
    try {
      await rejectEditRequest(req.id, profile.uid, { rejectionReason: reason.trim() || null });
      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id
            ? {
                ...item,
                status: 'rejected',
                reviewedBy: profile.uid,
                reviewedAt: Timestamp.now(),
                rejectionReason: reason.trim() || null,
              }
            : item
        )
      );
      setRejectModal(null);
      toast.success('Edit request rejected and moved to Rejected.');
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

  const handleViewDraft = (req: ChapterEditRequest) => {
    if (req.status !== 'pending') return;
    navigate(`/studio/content/${req.chapterId}`, {
      state: { viewDraftForUserId: req.requestedBy },
    });
  };

  const handlePreviewInLesson = useCallback(
    async (req: ChapterEditRequest) => {
      if (req.status !== 'pending') {
        toast.info('Draft preview is only available for pending requests.');
        return;
      }

      setPreviewLaunchingId(req.id);
      try {
        const topicIdsWithDraft = await getTopicIdsWithUnapprovedVersionForUser(req.chapterId, req.requestedBy);
        const previewTopicId = topicIdsWithDraft.length > 0 ? topicIdsWithDraft[0] : null;
        if (!previewTopicId) {
          toast.warning('No draft found for this request. The associate may not have saved any topic.');
          return;
        }

        const bundle = await getLessonBundle({
          chapterId: req.chapterId,
          lang: 'en',
          topicId: previewTopicId,
          userId: req.requestedBy,
          userRole: 'associate',
        });
        const { chapter, topic } = buildLessonPayloadFromBundle(bundle, previewTopicId);
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

        startLesson(chapter, topic);
        sessionStorage.setItem(
          'activeLesson',
          JSON.stringify({
            chapter,
            topic,
            startedAt: new Date().toISOString(),
          })
        );
        toast.success('Opening lesson preview. You can approve or reject after viewing.');
        navigate('/vrlessonplayer');
      } catch (error) {
        console.error('Preview launch error:', error);
        toast.error('Failed to open lesson preview. The chapter or draft may be missing.');
      } finally {
        setPreviewLaunchingId(null);
      }
    },
    [navigate, startLesson]
  );

  if (!profile) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading lesson edit requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30">
                <FileEdit className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Lesson Edit Request Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  Review lesson change requests with class, subject, chapter, and topic-level context.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/50 px-4 py-3">
              <FolderTree className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{filteredRequests.length} visible requests</p>
                <p className="text-xs text-muted-foreground">
                  Grouped class-wise, subject-wise, and chapter-wise
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border bg-card/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{counts.all}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <Layers3 className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{counts.pending}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{counts.approved}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-rose-500/20 bg-rose-500/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{counts.rejected}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <XCircle className="w-5 h-5 text-rose-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ['all', counts.all],
                ['pending', counts.pending],
                ['approved', counts.approved],
                ['rejected', counts.rejected],
              ] as Array<[RequestTab, number]>).map(([tab, count]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    activeTab === tab
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {tab === 'all' ? 'All Requests' : formatStatusLabel(tab)}
                  <span className="ml-2 text-xs opacity-80">({count})</span>
                </button>
              ))}
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
              <Button
                onClick={handleApproveAllPending}
                disabled={bulkApproving || counts.pending === 0}
                className="xl:min-w-[190px]"
              >
                {bulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve All Pending
              </Button>
              <div className="relative w-full xl:w-[22rem]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by chapter, topic, class, subject, or requester..."
                  className="w-full rounded-xl border border-border bg-card/40 pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {detailsLoading && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Organizing requests and topic details chapter-wise. Totals are ready; hierarchy details are still loading.
            </div>
          )}
        </div>

        {requests.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground font-medium">No lesson edit requests found</p>
              <p className="text-muted-foreground text-sm mt-1">
                Requests will appear here when associates submit lesson changes for review.
              </p>
            </CardContent>
          </Card>
        ) : groupedRequests.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground font-medium">No requests match your filters</p>
              <p className="text-muted-foreground text-sm mt-1">
                Try another search term or switch to a different status tab.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedRequests.map((classGroup) => (
              <Card key={classGroup.className} className="border-border overflow-hidden">
                <CardHeader className="pb-4 border-b border-border bg-muted/20">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Layers3 className="w-5 h-5 text-primary" />
                        {classGroup.className}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {classGroup.totalRequests} request{classGroup.totalRequests === 1 ? '' : 's'} across{' '}
                        {classGroup.subjects.length} subject{classGroup.subjects.length === 1 ? '' : 's'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      Total requests: {classGroup.totalRequests}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  {classGroup.subjects.map((subjectGroup) => (
                    <div key={subjectGroup.subjectName} className="rounded-2xl border border-border bg-card/30 p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BookOpenText className="w-4 h-4 text-primary" />
                          <h2 className="text-lg font-semibold text-foreground">{subjectGroup.subjectName}</h2>
                        </div>
                        <Badge variant="secondary" className="w-fit">
                          {subjectGroup.totalRequests} request{subjectGroup.totalRequests === 1 ? '' : 's'}
                        </Badge>
                      </div>

                      <div className="space-y-4">
                        {subjectGroup.chapters.map((chapterGroup) => (
                          <div key={`${chapterGroup.chapterId}-${chapterGroup.chapterName}`} className="rounded-2xl border border-border bg-background/70 p-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
                              <div>
                                <h3 className="text-base font-semibold text-foreground">
                                  {chapterGroup.chapterNumber != null
                                    ? `Chapter ${chapterGroup.chapterNumber}: ${chapterGroup.chapterName}`
                                    : chapterGroup.chapterName}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {chapterGroup.requests.length} request{chapterGroup.requests.length === 1 ? '' : 's'} in this chapter
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                  Topics: {chapterGroup.topics.length}
                                </Badge>
                                <Badge variant="outline">
                                  Pending: {chapterGroup.requests.filter((req) => req.status === 'pending').length}
                                </Badge>
                                <Badge variant="outline">
                                  Approved: {chapterGroup.requests.filter((req) => req.status === 'approved').length}
                                </Badge>
                                <Badge variant="outline">
                                  Rejected: {chapterGroup.requests.filter((req) => req.status === 'rejected').length}
                                </Badge>
                              </div>
                            </div>

                            {chapterGroup.topics.length > 0 && (
                              <div className="mb-5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Sorted topics
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {chapterGroup.topics.map((topic, index) => (
                                    <Badge
                                      key={topic.topicId}
                                      variant="outline"
                                      className={cn(
                                        'rounded-full px-3 py-1 text-xs',
                                        topic.isEdited && 'border-primary/40 bg-primary/10 text-primary'
                                      )}
                                    >
                                      {topic.topicPriority ?? index + 1}. {topic.topicName}
                                      {topic.isEdited ? ' • edited' : ''}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              {chapterGroup.requests.map((req) => {
                                const isProcessing = processingId === req.id;
                                const canReviewDraft = req.status === 'pending';

                                return (
                                  <div
                                    key={req.id}
                                    className="rounded-xl border border-border bg-card/60 p-4"
                                  >
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                      <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge
                                            variant="outline"
                                            className={statusBadgeStyles[req.status]}
                                          >
                                            {formatStatusLabel(req.status)}
                                          </Badge>
                                          <span className="text-sm font-medium text-foreground">
                                            {req.requestedByEmail || req.requestedBy}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                          <span className="flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" />
                                            Requested by {req.requestedByEmail || req.requestedBy}
                                          </span>
                                          <span className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            Requested {formatDateTime(req.requestedAt)}
                                          </span>
                                          {req.reviewedAt && (
                                            <span className="flex items-center gap-1.5">
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                              Reviewed {formatDateTime(req.reviewedAt)}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 text-xs">
                                          <Badge variant="outline">
                                            Total topics: {req.topics.length}
                                          </Badge>
                                          <Badge variant="outline">
                                            Edited topics: {req.editedTopicCount}
                                          </Badge>
                                        </div>

                                        {req.status === 'rejected' && req.rejectionReason && (
                                          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                                            <span className="font-medium">Rejection reason:</span> {req.rejectionReason}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 xl:max-w-[420px] xl:justify-end">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handlePreviewInLesson(req)}
                                          disabled={!canReviewDraft || isProcessing || previewLaunchingId === req.id}
                                          title={
                                            canReviewDraft
                                              ? "Preview the lesson with the associate's draft"
                                              : 'Preview is available only for pending requests'
                                          }
                                        >
                                          {previewLaunchingId === req.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Play className="w-4 h-4" />
                                          )}
                                          Preview in lesson
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleViewDraft(req)}
                                          disabled={!canReviewDraft}
                                          title={
                                            canReviewDraft
                                              ? "Open chapter editor with the associate's draft"
                                              : 'Draft view is available only for pending requests'
                                          }
                                        >
                                          View draft
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleOpenChapter(req.chapterId)}
                                          title="Open published chapter"
                                        >
                                          Open chapter
                                        </Button>

                                        {req.status === 'pending' && (
                                          <>
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
                                                  <Check className="w-4 h-4" />
                                                  Approve
                                                </>
                                              )}
                                            </Button>

                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => openRejectModal(req)}
                                              disabled={isProcessing}
                                            >
                                              <X className="w-4 h-4" />
                                              Reject
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!rejectModal} onOpenChange={(open) => !open && setRejectModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Edit Request</DialogTitle>
            <DialogDescription>
              Optionally add a reason for the associate. They will see it when they open this chapter.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full min-h-[100px] px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. Please fix the skybox image quality and re-submit."
            value={rejectModal?.reason ?? ''}
            onChange={(e) =>
              setRejectModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))
            }
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

export default LessonEditRequests;
