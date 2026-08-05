import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { toast } from 'react-toastify';
import { AlertCircle, CheckCircle2, Image, Loader2, Upload, Wand2, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  type TrellisGeneration,
  type TrellisGenerationStatus,
} from '../../../services/trellisImageTo3dService';
import {
  studioGenerationJobManager,
  studioGenerationKeys,
  trellisGenerationToUi,
  type TrellisJobSnapshot,
  type TrellisPhase,
} from '../../../services/studioGenerationJobStore';
import { classifyError, logError } from '../../../utils/errorHandler';

interface ImageTo3DPanelProps {
  chapterId: string;
  topicId: string;
  onAssetGenerated?: () => void;
}

const DEFAULT_DECIMATION_TARGET = 300000;
const DEFAULT_TEXTURE_SIZE = 1024;

function statusLabel(status?: TrellisGenerationStatus, phase?: TrellisPhase | 'idle'): string {
  if (phase === 'finalizing') return 'Saving asset';
  if (phase === 'uploading') return 'Uploading';
  if (!status) return 'Ready';
  if (status === 'queued') return 'Queued';
  if (status === 'running') return 'Generating';
  if (status === 'succeeded') return 'Succeeded';
  return 'Failed';
}

function progressForState(state: TrellisPhase | 'idle', generation?: TrellisGeneration | null): number {
  if (state === 'uploading') return 10;
  if (generation?.status === 'queued' || state === 'queued') return 25;
  if (generation?.status === 'running' || state === 'running') return 65;
  if (state === 'finalizing') return 85;
  if (state === 'success') return 100;
  return 0;
}

function validateImage(file: File): string | null {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';

  if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(extension)) {
    return 'Upload a PNG, JPG, JPEG, or WebP image.';
  }
  if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
    return 'Image must be smaller than 12 MB.';
  }
  return null;
}

export const ImageTo3DPanel = ({ chapterId, topicId, onAssetGenerated }: ImageTo3DPanelProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const notifiedSuccessRef = useRef<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [decimationTarget, setDecimationTarget] = useState(DEFAULT_DECIMATION_TARGET);
  const [textureSize, setTextureSize] = useState(DEFAULT_TEXTURE_SIZE);
  const [dragActive, setDragActive] = useState(false);
  const [runState, setRunState] = useState<TrellisPhase | 'idle'>('idle');
  const [currentJob, setCurrentJob] = useState<TrellisGeneration | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState('');

  const jobKey = studioGenerationKeys.trellis(chapterId, topicId);
  const isRunning = ['uploading', 'queued', 'running', 'finalizing'].includes(runState);
  const progress = progressForState(runState, currentJob);
  const previewUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!chapterId || !topicId) return;

    let previousPhase: TrellisPhase | 'idle' | null = null;

    const applyJob = (job: TrellisJobSnapshot | null) => {
      const ui = trellisGenerationToUi(job);
      setRunState(ui.runState);
      setCurrentJob(ui.currentJob);
      setErrorMessage(ui.errorMessage);
      if (ui.assetName) setAssetName(ui.assetName);
      if (ui.sourceFileName) setSourceFileName(ui.sourceFileName);
      if (ui.decimationTarget) setDecimationTarget(ui.decimationTarget);
      if (ui.textureSize) setTextureSize(ui.textureSize);

      if (
        job?.phase === 'success' &&
        previousPhase &&
        previousPhase !== 'success' &&
        job.jobId &&
        notifiedSuccessRef.current !== job.jobId
      ) {
        notifiedSuccessRef.current = job.jobId;
        toast.success(`Trellis 2 asset ready${job.assetName ? `: ${job.assetName}` : ''}`);
        onAssetGenerated?.();
      }
      previousPhase = job?.phase || 'idle';
    };

    studioGenerationJobManager.ensureTrellisResumed(chapterId, topicId);
    return studioGenerationJobManager.subscribe(jobKey, (job) => {
      applyJob(job?.provider === 'trellis' ? job : null);
    });
  }, [chapterId, topicId, jobKey, onAssetGenerated]);

  const applySelectedFile = (file?: File) => {
    if (!file) return;
    if (isRunning) {
      toast.info('A Trellis job is already running for this topic.');
      return;
    }
    const validationError = validateImage(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setImageFile(file);
    setSourceFileName(file.name);
    setAssetName(file.name.replace(/\.[^/.]+$/, ''));
    setErrorMessage(null);
    if (runState === 'success' || runState === 'error') {
      studioGenerationJobManager.clearJob(jobKey);
      setRunState('idle');
      setCurrentJob(null);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    applySelectedFile(event.target.files?.[0]);
  };

  const handleDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    applySelectedFile(event.dataTransfer.files?.[0]);
  };

  const resetSelection = () => {
    if (isRunning) return;
    setImageFile(null);
    setAssetName('');
    setSourceFileName('');
    setCurrentJob(null);
    setErrorMessage(null);
    setRunState('idle');
    studioGenerationJobManager.clearJob(jobKey);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }
    if (!imageFile) {
      toast.error('Select an image first');
      return;
    }
    if (!chapterId || !topicId) {
      toast.error('Select a lesson topic before generating');
      return;
    }

    try {
      setErrorMessage(null);
      await studioGenerationJobManager.startTrellisJob({
        chapterId,
        topicId,
        userId: user.uid,
        image: imageFile,
        assetName: assetName.trim() || imageFile.name.replace(/\.[^/.]+$/, ''),
        sourceFileName: imageFile.name,
        decimationTarget,
        textureSize,
      });
    } catch (error: any) {
      logError(error, 'ImageTo3DPanel.handleGenerate');
      const classification = classifyError(error);
      toast.error(classification.userMessage || 'Trellis 2 generation failed');
    }
  };

  const canGenerate = Boolean(imageFile) && !isRunning;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          Trellis 2 Image-to-3D
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate a model from a reference image and save it to the same 3D asset library.
          Progress stays active if you leave this tab and come back.
        </p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`rounded-lg border border-dashed p-5 transition-all ${
          dragActive ? 'border-primary bg-primary/10' : 'border-border bg-background/70'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        {imageFile ? (
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
              {previewUrl && <img src={previewUrl} alt={imageFile.name} className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{imageFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={resetSelection}
              disabled={isRunning}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isRunning}
            className="w-full flex flex-col items-center justify-center gap-3 text-center disabled:opacity-50"
          >
            <span className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Image className="w-6 h-6" />
            </span>
            <span className="text-sm font-medium text-foreground">
              {isRunning ? (sourceFileName || 'Generation in progress') : 'Upload Reference Image'}
            </span>
            <span className="text-xs text-muted-foreground">
              {isRunning
                ? 'Job continues in the background'
                : 'PNG, JPG, JPEG, or WebP up to 12 MB'}
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Asset Name</span>
          <input
            value={assetName}
            onChange={(event) => setAssetName(event.target.value)}
            placeholder="Generated asset"
            disabled={isRunning}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground disabled:opacity-50"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Decimation Target</span>
          <input
            type="number"
            min={10000}
            step={10000}
            value={decimationTarget}
            disabled={isRunning}
            onChange={(event) => setDecimationTarget(Math.max(1, Number(event.target.value) || DEFAULT_DECIMATION_TARGET))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground disabled:opacity-50"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Texture Size</span>
          <input
            type="number"
            min={256}
            step={256}
            value={textureSize}
            disabled={isRunning}
            onChange={(event) => setTextureSize(Math.max(1, Number(event.target.value) || DEFAULT_TEXTURE_SIZE))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground disabled:opacity-50"
          />
        </label>
      </div>

      {(isRunning || runState === 'success' || runState === 'error') && (
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              {runState === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : runState === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              )}
              <span>{statusLabel(currentJob?.status, runState)}</span>
            </div>
            {currentJob?.id && <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">{currentJob.id}</span>}
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          {errorMessage && <p className="text-xs text-red-400 mt-2">{errorMessage}</p>}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          Select Image
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Generate with Trellis 2
        </button>
      </div>
    </div>
  );
};
