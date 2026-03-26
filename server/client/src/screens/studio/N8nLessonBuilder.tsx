import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canPollExecution,
  fetchExecutionDetail,
  getExecutionStatus,
  listExecutions,
  N8nExecution,
  N8nExecutionListItem,
  PIPELINE_STEPS,
  type PipelineStepId,
} from '../../services/n8nService';
import {
  cancelLessonBuilderQueueJob,
  enqueueLessonBuilderJobs,
  LessonBuilderQueueJob,
  refreshLessonBuilderQueue,
  stopLessonBuilderQueueJob,
} from '../../services/n8nLessonBuilderQueueService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../n8n-ui/components/ui/card';
import { Button } from '../../n8n-ui/components/ui/button';
import { Textarea } from '../../n8n-ui/components/ui/textarea';
import { Select } from '../../n8n-ui/components/ui/select';
import { Label } from '../../n8n-ui/components/ui/label';
import { JsonView } from '../../n8n-ui/components/JsonView';
import { useProductionLogger } from '../../hooks/useProductionLogger';

type StepState = 'pending' | 'running' | 'done' | 'error';
type NodeLogStatus = 'pending' | 'running' | 'done' | 'error';

type ExecutionNodeRun = {
  startTime: number;
  executionTime?: number;
  data?: {
    main?: unknown[][];
    input?: unknown;
  };
  error?: {
    message?: string;
    stack?: string;
    description?: string;
  };
};

type NodeEntry = {
  name: string;
  startedAt?: string;
  durationMs?: number;
  status: NodeLogStatus;
  raw?: ExecutionNodeRun['data'];
  error?: ExecutionNodeRun['error'];
};

type DraftState = {
  prompt: string;
  language: string;
  curriculum: string;
  classLevel: string;
  subject: string;
};

const POLL_INTERVAL_MS = 2500;
const QUEUE_REFRESH_MS = 15_000;
const EXECUTIONS_REFRESH_MS = 30_000;
const DRAFT_STORAGE_KEY = 'n8nLessonBuilderDraft:v2';

function sortJobsFifo(jobs: LessonBuilderQueueJob[]) {
  return [...jobs].sort((a, b) => {
    if (a.queueOrder !== b.queueOrder) return a.queueOrder - b.queueOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function buildFifoPositionMap(jobs: LessonBuilderQueueJob[]): Map<string, { pos: number; total: number }> {
  const fifo = sortJobsFifo(jobs);
  const map = new Map<string, { pos: number; total: number }>();
  fifo.forEach((j, i) => map.set(j.id, { pos: i + 1, total: fifo.length }));
  return map;
}

function pickProcessingJob(jobs: LessonBuilderQueueJob[]): LessonBuilderQueueJob | null {
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'starting');
  if (!active.length) return null;
  return active.reduce((a, b) => (a.queueOrder <= b.queueOrder ? a : b));
}

function pickNextQueuedJob(jobs: LessonBuilderQueueJob[]): LessonBuilderQueueJob | null {
  const q = jobs.filter((j) => j.status === 'queued');
  if (!q.length) return null;
  return q.reduce((a, b) => (a.queueOrder <= b.queueOrder ? a : b));
}

function parsePipelineNodeLabelOverrides(): Record<string, string> {
  const raw = import.meta.env.VITE_N8N_PIPELINE_NODE_LABELS as string | undefined;
  if (!raw || !raw.trim()) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(o).filter(([, v]) => typeof v === 'string') as [string, string][],
    );
  } catch {
    return {};
  }
}

/** Map n8n node display names to canonical pipeline step ids (fallback ladder before/with sparse runData). */
const DEFAULT_NODE_TO_STEP: Partial<Record<string, PipelineStepId>> = {
  'Receive PDF & prompt': 'receive',
  'Extract text from PDF': 'extract',
  'Generate lesson (OpenAI)': 'ai',
  'Parse & split topics': 'topics',
  'Generate skyboxes': 'skybox',
  'Save to Firebase & Sheets': 'save',
};

const PIPELINE_STEP_IDS = new Set<PipelineStepId>(PIPELINE_STEPS.map((s) => s.id));

function parseNodeToStepOverrides(): Partial<Record<string, PipelineStepId>> {
  const raw = import.meta.env.VITE_N8N_NODE_TO_STEP as string | undefined;
  if (!raw || !raw.trim()) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<string, PipelineStepId>> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && PIPELINE_STEP_IDS.has(v as PipelineStepId)) {
        out[k] = v as PipelineStepId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function buildNodeToStepMap(): Partial<Record<string, PipelineStepId>> {
  return { ...DEFAULT_NODE_TO_STEP, ...parseNodeToStepOverrides() };
}

const getRunDataTimeline = (runData: Record<string, ExecutionNodeRun[]>) => {
  const timeline: Array<{ name: string; firstStart: number }> = [];
  Object.entries(runData).forEach(([nodeName, runs]) => {
    if (!Array.isArray(runs) || runs.length === 0) return;
    const first = runs[0];
    if (!first || typeof first.startTime !== 'number') return;
    timeline.push({ name: nodeName, firstStart: first.startTime });
  });
  timeline.sort((a, b) => a.firstStart - b.firstStart);
  return timeline;
};

const getLatestNodeName = (runData: Record<string, ExecutionNodeRun[]>) => {
  let latestNode: string | null = null;
  let latestStart = -Infinity;
  Object.entries(runData).forEach(([nodeName, runs]) => {
    if (!Array.isArray(runs) || runs.length === 0) return;
    const last = runs[runs.length - 1];
    if (!last || typeof last.startTime !== 'number') return;
    if (last.startTime > latestStart) {
      latestStart = last.startTime;
      latestNode = nodeName;
    }
  });
  return latestNode;
};

const buildNodeEntries = (
  runData: Record<string, ExecutionNodeRun[]>,
  executionStatus: N8nExecution['status'],
): NodeEntry[] => {
  const timeline = getRunDataTimeline(runData);
  const latestNode = getLatestNodeName(runData);
  return timeline.map(({ name }) => {
    const runs = runData[name] || [];
    const last = runs[runs.length - 1];
    const status: NodeLogStatus =
      last?.error || (executionStatus === 'error' && name === latestNode)
        ? 'error'
        : executionStatus === 'running' && name === latestNode
        ? 'running'
        : 'done';

    return {
      name,
      startedAt:
        last && typeof last.startTime === 'number'
          ? new Date(last.startTime).toLocaleString()
          : undefined,
      durationMs:
        last && typeof last.executionTime === 'number'
          ? Math.round(last.executionTime)
          : undefined,
      status,
      raw: last?.data,
      error: last?.error,
    };
  });
};

const getDraftState = (): DraftState => {
  if (typeof window === 'undefined') {
    return { prompt: '', language: '', curriculum: '', classLevel: '', subject: '' };
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return { prompt: '', language: '', curriculum: '', classLevel: '', subject: '' };
    }
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    return {
      prompt: parsed.prompt ?? '',
      language: parsed.language ?? '',
      curriculum: parsed.curriculum ?? '',
      classLevel: parsed.classLevel ?? '',
      subject: parsed.subject ?? '',
    };
  } catch {
    return { prompt: '', language: '', curriculum: '', classLevel: '', subject: '' };
  }
};

const N8nLessonBuilder: React.FC = () => {
  const initialDraft = useMemo(() => getDraftState(), []);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState<string>(initialDraft.prompt);
  const [language, setLanguage] = useState<string>(initialDraft.language);
  const [curriculum, setCurriculum] = useState<string>(initialDraft.curriculum);
  const [classLevel, setClassLevel] = useState<string>(initialDraft.classLevel);
  const [subject, setSubject] = useState<string>(initialDraft.subject);
  const [formError, setFormError] = useState<string | null>(null);
  const [queueSyncError, setQueueSyncError] = useState<string | null>(null);
  const [queueJobs, setQueueJobs] = useState<LessonBuilderQueueJob[]>([]);
  const [enqueueing, setEnqueueing] = useState(false);
  const [refreshingQueue, setRefreshingQueue] = useState(false);
  const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);
  const [stopConfirmJobId, setStopConfirmJobId] = useState<string | null>(null);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );
  const [recentExecutions, setRecentExecutions] = useState<N8nExecutionListItem[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [executionDetails, setExecutionDetails] = useState<Record<string, N8nExecution>>({});
  const [loadingExecId, setLoadingExecId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentNodeName, setCurrentNodeName] = useState<string | null>(null);
  const [dynamicNodes, setDynamicNodes] = useState<string[]>([]);
  const [nodeLogs, setNodeLogs] = useState<NodeEntry[]>([]);
  const [currentExecutionStatus, setCurrentExecutionStatus] = useState<N8nExecution['status'] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const executionsRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshGenRef = useRef(0);
  const { info: logInfo, error: logError } = useProductionLogger();

  const n8nConfigured = useMemo(() => Boolean(import.meta.env.VITE_N8N_WEBHOOK_URL), []);

  const pipelineNodeLabels = useMemo(() => parsePipelineNodeLabelOverrides(), []);
  const nodeToStepMap = useMemo(() => buildNodeToStepMap(), []);

  const fifoMeta = useMemo(() => buildFifoPositionMap(queueJobs), [queueJobs]);

  /** Last completed or terminal queue events (webhook finished), newest first. */
  const recentActivity = useMemo(() => {
    const terminal = queueJobs.filter((j) =>
      ['success', 'error', 'cancelled'].includes(j.status),
    );
    return [...terminal]
      .sort((a, b) => {
        const ta = new Date(a.finishedAt ?? a.updatedAt).getTime();
        const tb = new Date(b.finishedAt ?? b.updatedAt).getTime();
        return tb - ta;
      })
      .slice(0, 8);
  }, [queueJobs]);

  const processingJob = useMemo(() => pickProcessingJob(queueJobs), [queueJobs]);

  const nextQueuedJob = useMemo(() => pickNextQueuedJob(queueJobs), [queueJobs]);

  /** Progress + pipeline card: currently processing, else next in line when only queued jobs exist */
  const activeJobForPipeline = processingJob ?? nextQueuedJob;

  const builderStatus = useMemo(() => {
    if (!queueJobs.length) return 'idle';
    if (queueJobs.some((job) => job.status === 'running' || job.status === 'starting')) return 'running';
    if (queueJobs.some((job) => job.status === 'queued')) return 'queued';
    return queueJobs[0]?.status ?? 'idle';
  }, [queueJobs]);

  const activeExecutionId =
    processingJob && processingJob.status === 'running' && processingJob.executionId
      ? processingJob.executionId
      : null;

  const queueCounts = useMemo(
    () => ({
      queued: queueJobs.filter((job) => job.status === 'queued').length,
      running: queueJobs.filter((job) => job.status === 'running' || job.status === 'starting').length,
      success: queueJobs.filter((job) => job.status === 'success').length,
      error: queueJobs.filter((job) => job.status === 'error').length,
    }),
    [queueJobs],
  );

  const refreshQueue = useCallback(
    async (showBusy = false) => {
      const gen = ++refreshGenRef.current;
      if (showBusy) setRefreshingQueue(true);
      try {
        const jobs = await refreshLessonBuilderQueue();
        if (gen === refreshGenRef.current) {
          setQueueJobs(jobs);
          setQueueSyncError(null);
        }
      } catch (error) {
        logError('Failed to refresh n8n builder queue', 'n8n-lesson-builder', error);
        if (gen === refreshGenRef.current) {
          setQueueSyncError(
            error instanceof Error ? error.message : 'Failed to sync queue with the server.',
          );
        }
      } finally {
        if (showBusy) setRefreshingQueue(false);
      }
    },
    [logError],
  );

  const loadExecutions = useCallback(async () => {
    const list = await listExecutions(20);
    if (list && Array.isArray(list)) {
      setRecentExecutions(list);
      logInfo('Loaded recent n8n executions', 'n8n-lesson-builder', {
        count: list.length,
      });
    }
  }, [logInfo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft: DraftState = { prompt, language, curriculum, classLevel, subject };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [prompt, language, curriculum, classLevel, subject]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    // Background sync only; avoid toggling refreshingQueue on every effect run / user re-render
    refreshQueue(false);
    loadExecutions();
    queueRefreshRef.current = setInterval(() => refreshQueue(false), QUEUE_REFRESH_MS);
    executionsRefreshRef.current = setInterval(loadExecutions, EXECUTIONS_REFRESH_MS);
    return () => {
      if (queueRefreshRef.current) clearInterval(queueRefreshRef.current);
      if (executionsRefreshRef.current) clearInterval(executionsRefreshRef.current);
    };
  }, [refreshQueue, loadExecutions]);

  useEffect(() => {
    if (!activeExecutionId || !canPollExecution) {
      setCurrentNodeName(null);
      setDynamicNodes([]);
      setNodeLogs([]);
      setCurrentExecutionStatus(null);
      return;
    }

    if (!tabVisible) {
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      };
    }

    const poll = async () => {
      const exec = await getExecutionStatus(activeExecutionId);
      if (!exec) return;
      setCurrentExecutionStatus(exec.status);

      const runData = exec.data?.resultData?.runData as Record<string, ExecutionNodeRun[]> | undefined;
      const latestNode = runData ? getLatestNodeName(runData) : null;
      const orderedNames = runData ? getRunDataTimeline(runData).map((item) => item.name) : [];

      if (orderedNames.length > 0) {
        setDynamicNodes(orderedNames);
        setNodeLogs(buildNodeEntries(runData!, exec.status));
      }

      if (latestNode) {
        setCurrentNodeName(latestNode);
      }

      if (exec.finished) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setCurrentExecutionStatus(exec.status);
        setCurrentNodeName(latestNode);
        await refreshQueue(false);
        await loadExecutions();
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeExecutionId, refreshQueue, loadExecutions, tabVisible]);

  const handleSelectExecution = useCallback(
    async (id: string) => {
      if (selectedExecId === id) {
        setSelectedExecId(null);
        setSelectedNodeId(null);
        return;
      }

      setSelectedExecId(id);
      setSelectedNodeId(null);
      if (executionDetails[id]) return;

      setLoadingExecId(id);
      const detail = await fetchExecutionDetail(id);
      setLoadingExecId(null);
      if (detail) {
        setExecutionDetails((prev) => ({ ...prev, [id]: detail }));
      }
    },
    [selectedExecId, executionDetails],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const pdfs = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    setSelectedFiles(pdfs);
  };

  const handleEnqueue = async () => {
    setFormError(null);

    if (!selectedFiles.length) {
      setFormError('Please choose at least one chapter PDF before queueing.');
      return;
    }

    if (!language) {
      setFormError('Please select a language before queueing.');
      return;
    }

    if (!n8nConfigured) {
      setFormError('Set VITE_N8N_WEBHOOK_URL in the client environment before queueing.');
      return;
    }

    setEnqueueing(true);
    try {
      const jobs = await enqueueLessonBuilderJobs({
        files: selectedFiles,
        webhookUrl: String(import.meta.env.VITE_N8N_WEBHOOK_URL),
        prompt,
        language,
        curriculum,
        classLevel,
        subject,
      });
      setQueueJobs(jobs);
      setQueueSyncError(null);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      logInfo('Queued n8n lesson builder files', 'n8n-lesson-builder', {
        fileCount: selectedFiles.length,
        language,
        curriculum,
        classLevel,
        subject,
      });
      await loadExecutions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to queue PDFs.';
      setFormError(message);
      logError('Failed to queue n8n lesson builder files', 'n8n-lesson-builder', error, {
        fileCount: selectedFiles.length,
      });
    } finally {
      setEnqueueing(false);
    }
  };

  const handleCancelQueuedJob = async (jobId: string) => {
    try {
      const jobs = await cancelLessonBuilderQueueJob(jobId);
      setQueueJobs(jobs);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to cancel queue item.');
    }
  };

  const handleStopProcessingJob = async (jobId: string) => {
    setStopConfirmJobId(null);
    setStoppingJobId(jobId);
    try {
      const jobs = await stopLessonBuilderQueueJob(jobId);
      setQueueJobs(jobs);
      setQueueSyncError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to stop the current run.');
    } finally {
      setStoppingJobId(null);
    }
  };

  const totalSteps = dynamicNodes.length || PIPELINE_STEPS.length;
  const currentNodeIndex =
    currentNodeName && dynamicNodes.length ? dynamicNodes.indexOf(currentNodeName) : -1;
  const mappedPipelineIndex =
    dynamicNodes.length === 0 && currentNodeName
      ? (() => {
          const stepId = nodeToStepMap[currentNodeName];
          if (!stepId) return -1;
          return PIPELINE_STEPS.findIndex((s) => s.id === stepId);
        })()
      : -1;
  const activeIndex =
    builderStatus === 'running' && currentNodeIndex >= 0
      ? currentNodeIndex
      : builderStatus === 'running' && mappedPipelineIndex >= 0
      ? mappedPipelineIndex
      : activeJobForPipeline?.status === 'success'
      ? totalSteps - 1
      : activeJobForPipeline?.status === 'error' && mappedPipelineIndex >= 0
      ? mappedPipelineIndex
      : activeJobForPipeline?.status === 'starting'
      ? 0
      : 0;

  const progressPercent =
    activeJobForPipeline?.status === 'success'
      ? 100
      : activeJobForPipeline?.status === 'error'
      ? Math.max(10, Math.round(((activeIndex + 1) / totalSteps) * 100))
      : activeJobForPipeline?.status === 'queued'
      ? 0
      : activeJobForPipeline?.status === 'starting'
      ? 5
      : Math.max(0, Math.min(100, Math.round(((activeIndex + 1) / totalSteps) * 100)));

  const renderedSteps =
    dynamicNodes.length > 0
      ? dynamicNodes.map((name, index) => {
          const state: StepState =
            currentExecutionStatus === 'error' && currentNodeName === name
              ? 'error'
              : currentNodeName === name
              ? 'running'
              : currentNodeIndex >= 0 && index < currentNodeIndex
              ? 'done'
              : activeJobForPipeline?.status === 'success'
              ? 'done'
              : 'pending';

          return {
            key: name,
            label: pipelineNodeLabels[name] ?? name,
            state,
          };
        })
      : PIPELINE_STEPS.map((step, index) => {
          const state: StepState =
            activeJobForPipeline?.status === 'error' && index === activeIndex
              ? 'error'
              : activeJobForPipeline?.status === 'success'
              ? 'done'
              : activeJobForPipeline?.status === 'running' && index === activeIndex
              ? 'running'
              : activeJobForPipeline?.status === 'starting' && index === 0
              ? 'running'
              : index < activeIndex
              ? 'done'
              : 'pending';
          return { key: step.id, label: step.label, state };
        });

  return (
    <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/90 px-5 py-5 shadow-xl lg:px-6 lg:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
              LearnXR n8n Lesson Builder
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-[13px]">
              Queue multiple chapter PDFs, let the backend process them sequentially through n8n,
              and return later without losing queue state or workflow progress. Form sections below
              (PDF upload, prompt, metadata) are workflow steps—not your position in the processing queue.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/80 px-3.5 py-1.5 text-[11px] text-slate-200 shadow-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  builderStatus === 'idle'
                    ? 'bg-slate-500'
                    : builderStatus === 'running'
                    ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                    : builderStatus === 'queued'
                    ? 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]'
                    : builderStatus === 'success'
                    ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                    : 'bg-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]'
                }`}
              />
              <span className="font-medium tracking-tight">
                {builderStatus === 'idle' && 'Idle'}
                {builderStatus === 'queued' && 'Queued'}
                {builderStatus === 'running' && 'Processing queue'}
                {builderStatus === 'success' && 'Latest job: success'}
                {builderStatus === 'error' && 'Latest job: error'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Queue: <span className="font-semibold text-slate-100">{queueJobs.length}</span> item(s)
            </span>
            {processingJob && (
              <span className="max-w-xs text-right text-[10px] text-slate-400">
                Now processing (FIFO):{' '}
                <span className="font-medium text-slate-100">{processingJob.file.fileName}</span>
              </span>
            )}
          </div>
        </div>
        {queueSyncError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
            Queue sync failed: {queueSyncError}. Use Refresh queue or check your connection.
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>
            This screen is available to studio roles only. Queued PDFs keep processing through the
            backend even if you leave and come back later.
          </span>
          {!n8nConfigured && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-medium text-amber-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Set <code className="font-mono text-[10px]">VITE_N8N_WEBHOOK_URL</code> in the client
              environment to enable queueing.
            </span>
          )}
        </div>
      </header>

      <main className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)] lg:gap-6">
        <section className="space-y-5">
          <Card className="border-slate-800/70 bg-slate-900">
            <CardHeader>
              <CardTitle>PDF queue upload</CardTitle>
              <CardDescription>
                Choose one or more PDFs. They are uploaded to durable storage first, then processed
                sequentially by the backend queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/70 px-5 py-5 text-xs text-slate-200 transition-colors hover:border-slate-400 hover:bg-slate-900/80">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileChange}
                  disabled={enqueueing}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span className="rounded-full bg-slate-900/80 px-3 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-slate-700/70">
                  {selectedFiles.length > 0 ? `${selectedFiles.length} PDF(s) selected` : 'Choose PDF files'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedFiles.length > 0
                    ? 'These files will be uploaded and added to the durable queue.'
                    : 'Click to browse one or more chapter PDFs (PDF only)'}
                </span>
              </label>

              {selectedFiles.length > 0 && (
                <ul className="space-y-2 text-[11px]">
                  {selectedFiles.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-2 text-slate-200"
                    >
                      <span className="truncate pr-3">{file.name}</span>
                      <span className="text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800/70 bg-slate-900">
            <CardHeader>
              <CardTitle>OpenAI prompt</CardTitle>
              <CardDescription>
                Override or extend the system prompt for the{' '}
                <code className="rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                  Message a model
                </code>{' '}
                node in n8n (for example{' '}
                <code className="rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                  {'{{$json["prompt"]}}'}
                </code>
                ). This draft is preserved locally so you can leave the page and return without
                retyping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste or edit the OpenAI prompt. It will be sent as `prompt` to each queued n8n run."
                rows={10}
                disabled={enqueueing}
                className="min-h-[170px] text-xs leading-relaxed"
              />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <Card className="border-slate-800/70 bg-slate-900">
            <CardHeader>
              <CardTitle>Lesson metadata</CardTitle>
              <CardDescription>
                Configure language, curriculum, class, and subject. Values are stored with each
                queued PDF and forwarded to n8n with the file and prompt when that job runs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="language" className="text-[11px] text-slate-400">
                    Language
                  </Label>
                  <Select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={enqueueing}
                  >
                    <option value="">Select language…</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="de">German</option>
                    <option value="es">Spanish</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="curriculum" className="text-[11px] text-slate-400">
                    Curriculum
                  </Label>
                  <Select
                    id="curriculum"
                    value={curriculum}
                    onChange={(e) => setCurriculum(e.target.value)}
                    disabled={enqueueing}
                  >
                    <option value="">Not set (optional)</option>
                    <option value="CBSE">CBSE</option>
                    <option value="RBSE">RBSE</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="classLevel" className="text-[11px] text-slate-400">
                    Class
                  </Label>
                  <Select
                    id="classLevel"
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    disabled={enqueueing}
                  >
                    <option value="">Not set (optional)</option>
                    <option value="1">Class 1</option>
                    <option value="2">Class 2</option>
                    <option value="3">Class 3</option>
                    <option value="4">Class 4</option>
                    <option value="5">Class 5</option>
                    <option value="6">Class 6</option>
                    <option value="7">Class 7</option>
                    <option value="8">Class 8</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-[11px] text-slate-400">
                    Subject
                  </Label>
                  <Select
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={enqueueing}
                  >
                    <option value="">Not set (optional)</option>
                    <option value="EVS">EVS</option>
                    <option value="English">English</option>
                    <option value="Maths">Maths</option>
                    <option value="Science">Science</option>
                    <option value="Social Science">Social Science</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800/70 bg-slate-900">
            <CardHeader>
              <CardTitle>Queue actions</CardTitle>
              <CardDescription>
                Upload the selected PDFs into the durable queue or refresh the backend state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    onClick={handleEnqueue}
                    disabled={enqueueing || !n8nConfigured || selectedFiles.length === 0}
                    className="px-4 text-xs"
                  >
                    {enqueueing ? 'Uploading & queueing…' : 'Queue PDFs'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => refreshQueue(true)}
                    disabled={refreshingQueue}
                    className="px-3 text-[11px]"
                  >
                    {refreshingQueue ? 'Refreshing…' : 'Refresh queue'}
                  </Button>
                </div>
                {formError && (
                  <p className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-100">
                    {formError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2">
                    <div className="text-slate-400">Queued</div>
                    <div className="text-base font-semibold text-slate-50">{queueCounts.queued}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2">
                    <div className="text-slate-400">Running</div>
                    <div className="text-base font-semibold text-slate-50">{queueCounts.running}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2">
                    <div className="text-slate-400">Success</div>
                    <div className="text-base font-semibold text-slate-50">{queueCounts.success}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2">
                    <div className="text-slate-400">Errors</div>
                    <div className="text-base font-semibold text-slate-50">{queueCounts.error}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800/70 bg-slate-900">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Latest finished webhook runs from your queue (newest first). Open queue items below for
                full detail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/50 px-4 py-3 text-[11px] text-slate-400">
                  No completed runs yet. Successful, failed, or cancelled jobs will appear here.
                </div>
              ) : (
                <ul className="space-y-2 text-[11px]">
                  {recentActivity.map((job) => (
                    <li
                      key={job.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-slate-200"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="truncate font-medium text-slate-50">{job.file.fileName}</div>
                        <div className="text-[10px] text-slate-500">
                          {job.finishedAt
                            ? new Date(job.finishedAt).toLocaleString()
                            : new Date(job.updatedAt).toLocaleString()}
                          {typeof job.httpStatus === 'number' ? ` • HTTP ${job.httpStatus}` : ''}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${
                          job.status === 'success'
                            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                            : job.status === 'cancelled'
                            ? 'border-slate-600/60 bg-slate-600/10 text-slate-300'
                            : 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                        }`}
                      >
                        {job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <section className="space-y-4 pb-6">
        <Card className="border-slate-800/80 bg-slate-900/80">
          <CardHeader>
            <CardTitle>Queue items</CardTitle>
            <CardDescription>
              Files remain here after navigation or refresh because the queue is persisted in the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queueJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/50 px-4 py-3 text-[11px] text-slate-400">
                No queued files yet. Add one or more PDFs to start the durable n8n queue.
              </div>
            ) : (
              <ul className="space-y-2 text-[11px]">
                {queueJobs.map((job) => (
                  <li
                    key={job.id}
                    className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-50">{job.file.fileName}</span>
                          {fifoMeta.has(job.id) && (
                            <span className="rounded-full border border-slate-600/70 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300">
                              Queue #{fifoMeta.get(job.id)!.pos} of {fifoMeta.get(job.id)!.total}{' '}
                              <span className="text-slate-500">(FIFO)</span>
                            </span>
                          )}
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              job.status === 'success'
                                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                                : job.status === 'running' || job.status === 'starting'
                                ? 'border-sky-400/60 bg-sky-500/10 text-sky-300'
                                : job.status === 'queued'
                                ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                                : job.status === 'cancelled'
                                ? 'border-slate-600/60 bg-slate-600/10 text-slate-300'
                                : 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          Added {new Date(job.createdAt).toLocaleString()}
                          {job.startedAt ? ` • Started ${new Date(job.startedAt).toLocaleString()}` : ''}
                          {job.finishedAt ? ` • Finished ${new Date(job.finishedAt).toLocaleString()}` : ''}
                        </p>
                        <p className="text-slate-400">
                          Language: {job.language || 'n/a'} • Curriculum: {job.curriculum || 'n/a'} • Class:{' '}
                          {job.classLevel || 'n/a'} • Subject: {job.subject || 'n/a'}
                        </p>
                        <p className="font-mono text-[10px] text-slate-600">Job ID: {job.id}</p>
                        {job.executionId && (
                          <p className="font-mono text-[10px] text-slate-500">
                            Execution ID: {job.executionId}
                          </p>
                        )}
                        {job.errorMessage && (
                          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-rose-100">
                            {job.errorMessage}
                          </p>
                        )}
                        {job.responsePreview && (
                          <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-900/80 px-2.5 py-2 text-[10px] text-slate-300">
                            {job.responsePreview}
                          </pre>
                        )}
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        {job.status === 'queued' && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCancelQueuedJob(job.id)}
                            className="px-3 text-[11px]"
                          >
                            Remove from queue
                          </Button>
                        )}
                        {(job.status === 'running' || job.status === 'starting') && (
                          <>
                            {stopConfirmJobId === job.id ? (
                              <div className="flex flex-col gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 p-2">
                                <p className="text-[10px] text-rose-100">
                                  Stop this run? n8n will be asked to stop the execution (if supported), the
                                  job will be marked cancelled, and the queue can advance.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={stoppingJobId === job.id}
                                    onClick={() => handleStopProcessingJob(job.id)}
                                    className="border-rose-500/60 bg-rose-600/20 px-3 text-[11px] text-rose-50 hover:bg-rose-600/35"
                                  >
                                    {stoppingJobId === job.id ? 'Stopping…' : 'Confirm stop'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={stoppingJobId === job.id}
                                    onClick={() => setStopConfirmJobId(null)}
                                    className="px-3 text-[11px]"
                                  >
                                    Back
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={Boolean(stoppingJobId)}
                                onClick={() => setStopConfirmJobId(job.id)}
                                className="px-3 text-[11px]"
                              >
                                Stop current run
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/80">
          <CardHeader>
            <CardTitle>Pipeline progress</CardTitle>
            <CardDescription>
              Progress for the job currently processing (or the next in line if nothing is running yet).
              When n8n returns live node data, steps reflect your workflow; otherwise the template ladder is
              shown until the first poll. Optional friendly labels: set{' '}
              <code className="font-mono text-[10px]">VITE_N8N_PIPELINE_NODE_LABELS</code> (JSON map of
              node name → label). Optional:{' '}
              <code className="font-mono text-[10px]">VITE_N8N_NODE_TO_STEP</code> maps n8n node names to
              step ids (<code className="font-mono text-[10px]">receive</code>, <code className="font-mono text-[10px]">extract</code>, etc.) for the template ladder when runData is sparse.
            </CardDescription>
            {currentNodeName && (
              <p className="mt-1 text-[11px] text-slate-400">
                Current n8n node: <span className="font-medium text-slate-100">{currentNodeName}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Overall progress</span>
                <span className="font-medium text-slate-100">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                <div
                  className="h-full rounded-full bg-sky-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <ol className="flex flex-wrap gap-2 text-[11px] text-slate-300">
              {renderedSteps.map((step) => (
                <li
                  key={step.key}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-1.5 ${
                    step.state === 'pending'
                      ? 'border-slate-700/70 bg-slate-950/60 text-slate-400'
                      : step.state === 'running'
                      ? 'border-sky-400/80 bg-sky-500/10 text-sky-200'
                      : step.state === 'done'
                      ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/70 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                    {step.state === 'done' && '✓'}
                    {step.state === 'error' && '!'}
                    {step.state === 'pending' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500/80" />
                    )}
                    {step.state === 'running' && (
                      <span className="h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-sky-400" />
                    )}
                  </span>
                  <span className="font-medium">{step.label}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/80">
          <CardHeader>
            <CardTitle>Execution & logs</CardTitle>
            <CardDescription>
              Live node activity for the current execution plus recent execution inspection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nodeLogs.length > 0 && (
              <div className="mb-4 space-y-1.5 text-[11px]">
                <p className="font-medium text-slate-400">Current execution</p>
                <ul className="space-y-1.5">
                  {nodeLogs.map((node) => (
                    <li
                      key={node.name}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{node.startedAt ?? '—'}</span>
                          {typeof node.durationMs === 'number' && (
                            <span className="text-[10px] text-slate-500">• {Math.round(node.durationMs)} ms</span>
                          )}
                        </div>
                        <div className="font-medium text-slate-50">{node.name}</div>
                      </div>
                      <span
                        className={`mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-[9px] font-semibold uppercase ${
                          node.status === 'running'
                            ? 'border border-sky-400/60 bg-sky-500/15 text-sky-300'
                            : node.status === 'error'
                            ? 'border border-rose-500/60 bg-rose-500/15 text-rose-200'
                            : 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        }`}
                      >
                        {node.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recentExecutions.length > 0 ? (
              <div className="space-y-1.5 text-[11px]">
                <p className="font-medium text-slate-400">Recent executions</p>
                <ul className="space-y-1">
                  {recentExecutions.map((exec) => {
                    const isSelected = selectedExecId === exec.id;
                    const isLoading = loadingExecId === exec.id;
                    const detail = executionDetails[exec.id];
                    const detailNodes = detail?.data?.resultData?.runData
                      ? buildNodeEntries(
                          detail.data.resultData.runData as Record<string, ExecutionNodeRun[]>,
                          exec.status,
                        )
                      : [];

                    return (
                      <li
                        key={exec.id}
                        className="overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/60"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectExecution(exec.id)}
                          className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-slate-800/50"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-mono text-[10px] text-slate-300">
                                {exec.id}
                              </span>
                              <span className="whitespace-nowrap text-[10px] text-slate-500">
                                {new Date(exec.startedAt).toLocaleString()}
                              </span>
                            </div>
                            {exec.stoppedAt && (
                              <span className="text-[10px] text-slate-500">
                                Finished: {new Date(exec.stoppedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-5 items-center rounded-full border px-2 text-[9px] font-semibold uppercase ${
                                exec.status === 'success'
                                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                                  : exec.status === 'running'
                                  ? 'border-sky-400/60 bg-sky-500/15 text-sky-300'
                                  : exec.status === 'error'
                                  ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                                  : 'border-slate-500/60 bg-slate-600/20 text-slate-200'
                              }`}
                            >
                              {exec.status}
                            </span>
                            <span className="text-[10px] text-slate-500">{isSelected ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {isSelected && (
                          <div className="border-t border-slate-700/60 px-2.5 py-2">
                            {isLoading ? (
                              <div className="flex items-center gap-2 py-1 text-[10px] text-slate-400">
                                <span className="h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-sky-400" />
                                Loading node logs…
                              </div>
                            ) : detailNodes.length > 0 ? (
                              <div className="space-y-3">
                                <ul className="space-y-1">
                                  {detailNodes.map((node) => {
                                    const nodeKey = `${exec.id}-${node.name}`;
                                    const isNodeSelected = selectedNodeId === nodeKey;
                                    return (
                                      <li key={node.name} className="space-y-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSelectedNodeId(isNodeSelected ? null : nodeKey)
                                          }
                                          className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                                            isNodeSelected
                                              ? 'border-sky-500/50 bg-sky-500/10'
                                              : 'border-slate-700/40 bg-slate-900/70 hover:bg-slate-800/80'
                                          }`}
                                        >
                                          <div className="space-y-0 text-left">
                                            <span className="text-[10px] font-medium text-slate-100">
                                              {node.name}
                                            </span>
                                            <div className="flex items-center gap-2 text-[9px] text-slate-500">
                                              {node.startedAt && <span>{node.startedAt}</span>}
                                              {typeof node.durationMs === 'number' && (
                                                <span>• {node.durationMs} ms</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`inline-flex h-4 items-center rounded-full border px-1.5 text-[9px] font-semibold uppercase ${
                                                node.status === 'running'
                                                  ? 'border-sky-400/60 bg-sky-500/15 text-sky-300'
                                                  : node.status === 'error'
                                                  ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                                                  : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                                              }`}
                                            >
                                              {node.status}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                              {isNodeSelected ? '▲' : '▼'}
                                            </span>
                                          </div>
                                        </button>

                                        {isNodeSelected && (
                                          <div className="ml-1 space-y-3 rounded-lg border border-slate-800/60 bg-slate-950/40 p-2">
                                            {node.error && (
                                              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2">
                                                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-400">
                                                  Execution Error
                                                </p>
                                                <p className="text-[10px] leading-tight text-rose-200">
                                                  {node.error.message}
                                                </p>
                                                {node.error.description && (
                                                  <p className="mt-1 text-[9px] italic text-rose-300/70">
                                                    {node.error.description}
                                                  </p>
                                                )}
                                              </div>
                                            )}
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                              <JsonView title="Output Data (main)" data={node.raw?.main} />
                                              <JsonView title="Input Data" data={node.raw?.input} />
                                            </div>
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ) : (
                              <p className="py-1 text-[10px] text-slate-500">
                                No node data available for this execution.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/50 px-4 py-3 text-[11px] text-slate-400">
                No recent executions found. Ensure the n8n API is configured.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default N8nLessonBuilder;

