/**
 * TextTo3DUnified - Unified Text-to-3D and Script-to-3D Component
 * 
 * Combines both Text-to-3D and Script-to-3D workflows in a single component
 * with shared UI and permissions
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { textTo3dGenerationService } from '../../../services/textTo3dGenerationService';
import { avatarTo3dService } from '../../../services/avatarTo3dService';
import type { GenerationProgress } from '../../../services/textTo3dGenerationService';
import { getLessonBundle } from '../../../services/firestore/getLessonBundle';
import type { LanguageCode } from '../../../types/curriculum';
import { usePermissions } from '../../../hooks/usePermissions';
import { PermissionGate } from '../../PermissionGate';
import { ErrorDisplay } from '../../ErrorDisplay';
import { retryOperation } from '../../../hooks/useRetry';
import { classifyError, logError } from '../../../utils/errorHandler';
import { PermissionService } from '../../../services/permissionService';
import type { PermissionContext } from '../../../types/permissions';
import { isSuperadmin } from '../../../utils/rbac';
import {
  meshyRegenerationService,
  type MeshyRegenerationItem,
  type MeshyRegenerationJob,
} from '../../../services/meshyRegenerationService';
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Brain,
  Sparkles,
  Search,
  Package,
  CheckCircle,
  Trash2,
  Activity,
} from 'lucide-react';
import { meshyRiggingAnimationService, MESHY_ANIMATION_LIBRARY } from '../../../services/meshyRiggingAnimationService';

interface TextTo3DUnifiedProps {
  chapterId: string;
  topicId: string;
  language?: LanguageCode;
  bundle?: any;
  onAssetGenerated?: () => void; // Callback to refresh assets list
}

interface TextTo3dAsset {
  id: string;
  chapter_id?: string;
  topic_id?: string;
  prompt?: string;
  approval_status?: boolean;
  status?: 'pending' | 'approved' | 'generating' | 'uploaded' | 'ready' | 'failed';
  generation_progress?: number;
  generation_message?: string;
  generation_error?: string;
  meshy_asset_id?: string;
  source?: 'text_to_3d' | 'avatar_to_3d';
  [key: string]: any;
}

type ManualPromptStatus = 'idle' | 'creating' | 'queued' | 'generating' | 'success' | 'error' | 'existing';

interface ManualPromptRow {
  id: string;
  prompt: string;
  status: ManualPromptStatus;
  error?: string;
  assetId?: string;
}

const createManualPromptRow = (prompt = ''): ManualPromptRow => ({
  id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  prompt,
  status: 'idle',
});

const regenerationItemKey = (item: MeshyRegenerationItem): string =>
  `${item.source_collection}:${item.source_asset_id}`;

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export const TextTo3DUnified = ({ 
  chapterId, 
  topicId, 
  language = 'en', 
  bundle,
  onAssetGenerated 
}: TextTo3DUnifiedProps) => {
  const { user, profile } = useAuth();
  const permissions = usePermissions('avatar_to_3d_assets');
  const isSuperAdmin = isSuperadmin(profile);
  const [activeSection, setActiveSection] = useState<'text-to-3d' | 'script-to-3d'>('text-to-3d');
  const [error, setError] = useState<any>(null);
  
  // Text-to-3D state
  const [textTo3dAssets, setTextTo3dAssets] = useState<TextTo3dAsset[]>([]);
  const [textTo3dLoading, setTextTo3dLoading] = useState(true);
  const [selectedTextTo3d, setSelectedTextTo3d] = useState<TextTo3dAsset | null>(null);
  
  // Script-to-3D state
  const [scriptTo3dAssets, setScriptTo3dAssets] = useState<TextTo3dAsset[]>([]);
  const [scriptTo3dLoading, setScriptTo3dLoading] = useState(true);
  const [selectedScriptTo3d, setSelectedScriptTo3d] = useState<TextTo3dAsset | null>(null);
  const [explanationScript, setExplanationScript] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [detectionMessage, setDetectionMessage] = useState('');
  const [manualPromptRows, setManualPromptRows] = useState<ManualPromptRow[]>(() => [
    createManualPromptRow(),
  ]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBatchRunning, setManualBatchRunning] = useState(false);
  
  // Generation state (shared)
  const [generatingAssetIds, setGeneratingAssetIds] = useState<Record<string, boolean>>({});
  const [generationProgress, setGenerationProgress] = useState<{ [assetId: string]: GenerationProgress }>({});
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [regenerationJob, setRegenerationJob] = useState<MeshyRegenerationJob | null>(null);
  const [regenerationItems, setRegenerationItems] = useState<MeshyRegenerationItem[]>([]);
  const [regenerationLoading, setRegenerationLoading] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [selectedRegenerationKeys, setSelectedRegenerationKeys] = useState<Set<string>>(new Set());
  const [showReplacedAssets, setShowReplacedAssets] = useState(false);

  // Rig & Animate state (Meshy v1)
  const [animatingAssetId, setAnimatingAssetId] = useState<string | null>(null);
  const [animateProgress, setAnimateProgress] = useState<{ stage: string; progress: number; message: string } | null>(null);
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<number>(0);

  // Load Text-to-3D assets
  useEffect(() => {
    const loadTextTo3d = async () => {
      if (!chapterId || !topicId) return;
      setTextTo3dLoading(true);
      try {
        const bundleData = bundle || await getLessonBundle({ chapterId, lang: language, topicId });
        if (bundleData?.textTo3dAssets) {
          const assets = bundleData.textTo3dAssets.map((a: any) => ({ ...a, source: 'text_to_3d' }));
          setTextTo3dAssets(assets);
          if (assets.length > 0 && !selectedTextTo3d) setSelectedTextTo3d(assets[0]);
        }
      } catch (error) {
        console.error('Error loading text-to-3D assets:', error);
      } finally {
        setTextTo3dLoading(false);
      }
    };
    loadTextTo3d();
  }, [chapterId, topicId, language, bundle]);

  // Load Script-to-3D assets and script
  useEffect(() => {
    const loadScriptTo3d = async () => {
      if (!chapterId || !topicId) return;
      setScriptTo3dLoading(true);
      setError(null); // Clear previous errors
      try {
        const bundleData = bundle || await getLessonBundle({ chapterId, lang: language, topicId });
        const avatarScripts = bundleData?.avatarScripts || {};
        setExplanationScript(avatarScripts.explanation || '');
        
        try {
          const assets = await retryOperation(
            () => avatarTo3dService.getAssetsForTopic(chapterId, topicId, language),
            {
              maxAttempts: 3,
              initialDelay: 1000,
            }
          );
          const assetsWithSource = assets.map(a => ({ ...a, source: 'avatar_to_3d' }));
          setScriptTo3dAssets(assetsWithSource);
          if (assetsWithSource.length > 0 && !selectedScriptTo3d) setSelectedScriptTo3d(assetsWithSource[0]);
        } catch (fetchError: any) {
          // Handle permission errors gracefully - don't block UI
          logError(fetchError, 'TextTo3DUnified.loadScriptTo3d.fetchAssets');
          const classification = classifyError(fetchError);
          if (classification.type === 'permission') {
            console.warn('Permission error loading assets (user may not have admin role):', classification.userMessage);
            // Set empty array but don't block UI
            setScriptTo3dAssets([]);
            // Show toast but don't set error state (allows UI to render)
            toast.warn('Could not load assets. Staff (Admin, Super Admin, or Associate) role required.');
          } else {
            // For other errors, set error state
            setError(fetchError);
            toast.error(classification.userMessage);
          }
        }
      } catch (error: any) {
        logError(error, 'TextTo3DUnified.loadScriptTo3d');
        const classification = classifyError(error);
        if (classification.type === 'permission') {
          // Don't block UI for permission errors - just show warning
          console.warn('Permission error:', classification.userMessage);
          toast.warn(classification.userMessage);
        } else {
          setError(error);
          toast.error(classification.userMessage);
        }
      } finally {
        setScriptTo3dLoading(false);
      }
    };
    loadScriptTo3d();
  }, [chapterId, topicId, language, bundle]);

  // Handle approval (shared logic) with permission check and retry
  const handleApproveAsset = async (assetId: string, approve: boolean, source: 'text_to_3d' | 'avatar_to_3d') => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    const asset = source === 'text_to_3d' 
      ? textTo3dAssets.find(a => a.id === assetId)
      : scriptTo3dAssets.find(a => a.id === assetId);
    
    if (!asset) {
      toast.error('Asset not found');
      return;
    }

    setUpdatingApproval(assetId);

    try {
      if (source === 'avatar_to_3d' && approve && !asset.meshy_asset_id && asset.prompt) {
        // Use same strategy as "Add manually" for avatar_to_3d (avoids "Invalid input provided")
        try {
          await avatarTo3dService.deleteAsset(assetId);
        } catch {
          // Fallback for associate (no delete): use updateApprovalStatus
          await avatarTo3dService.updateApprovalStatus(assetId, true, user.uid);
          const updated = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
          setScriptTo3dAssets(updated.map(a => ({ ...a, source: 'avatar_to_3d' })));
          toast.success('Asset approved');
          if (approve && !asset.meshy_asset_id && asset.prompt) {
            await handleGenerate3DAsset(assetId, asset, source);
          }
          return;
        }

        const newAssetId = await avatarTo3dService.createManualAsset(
          chapterId,
          topicId,
          language,
          asset.prompt.trim(),
          (asset as any).source_script || undefined,
          user.uid
        );

        const updated = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
        setScriptTo3dAssets(updated.map(a => ({ ...a, source: 'avatar_to_3d' })));
        const newAsset = updated.find(a => a.id === newAssetId);
        if (newAsset) {
          setSelectedScriptTo3d({ ...newAsset, source: 'avatar_to_3d' });
        }
        toast.success('Asset approved');
        await handleGenerate3DAsset(newAssetId, newAsset as TextTo3dAsset, source);
      } else if (source === 'avatar_to_3d') {
        // avatar_to_3d: already has meshy_asset_id (approve toggle) or unapprove
        await avatarTo3dService.updateApprovalStatus(assetId, approve, user.uid);
        setScriptTo3dAssets(prev => prev.map(a => 
          a.id === assetId ? { ...a, approval_status: approve, status: approve && !a.meshy_asset_id ? 'generating' : a.status } : a
        ));
        toast.success(`Asset ${approve ? 'approved' : 'unapproved'}`);
        if (approve && !asset.meshy_asset_id && asset.prompt) {
          await handleGenerate3DAsset(assetId, asset, source);
        }
      } else {
        // text_to_3d: use direct updateDoc
        const assetRef = doc(db, 'text_to_3d_assets', assetId);
        setTextTo3dAssets(prev => prev.map(a => 
          a.id === assetId ? { ...a, approval_status: approve, status: approve && !a.meshy_asset_id ? 'generating' : a.status } : a
        ));

        await retryOperation(
          async () => {
            await updateDoc(assetRef, {
              approval_status: approve,
              approved_at: approve ? serverTimestamp() : null,
              approved_by: approve ? (user.email || user.uid) : null,
              updated_at: serverTimestamp(),
              ...(approve && !asset.meshy_asset_id ? { status: 'generating' } : {}),
            });
            return asset;
          },
          { maxAttempts: 3 }
        );

        toast.success(`Asset ${approve ? 'approved' : 'unapproved'}`);
        if (approve && !asset.meshy_asset_id && asset.prompt) {
          await handleGenerate3DAsset(assetId, asset, source);
        }
      }
    } catch (error: any) {
      logError(error, 'TextTo3DUnified.handleApproveAsset');
      const classification = classifyError(error);
      
      // Show user-friendly error message
      if (classification.type === 'permission') {
        toast.error('Permission denied. Staff (Admin, Super Admin, or Associate) role required.');
      } else {
        toast.error(classification.userMessage || 'Failed to update approval');
      }
      
      // Rollback optimistic update - reload assets
      try {
        if (source === 'text_to_3d') {
          const bundleData = bundle || await getLessonBundle({ chapterId, lang: language, topicId });
          if (bundleData?.textTo3dAssets) {
            const assets = bundleData.textTo3dAssets.map((a: any) => ({ ...a, source: 'text_to_3d' }));
            setTextTo3dAssets(assets);
          }
        } else {
          const updated = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
          setScriptTo3dAssets(updated.map(a => ({ ...a, source: 'avatar_to_3d' })));
        }
      } catch (reloadError) {
        console.error('Failed to reload assets after error:', reloadError);
      }
    } finally {
      setUpdatingApproval(null);
    }
  };

  // Handle generation (shared logic)
  const handleGenerate3DAsset = async (
    assetId: string, 
    asset: TextTo3dAsset, 
    source: 'text_to_3d' | 'avatar_to_3d',
    options?: {
      suppressSuccessToast?: boolean;
      suppressErrorToast?: boolean;
    }
  ) => {
    if (!asset.prompt || !chapterId || !topicId || !user?.uid) {
      if (!options?.suppressErrorToast) {
        toast.error('Missing required information');
      }
      return { success: false, error: 'Missing required information' };
    }

    setGeneratingAssetIds(prev => ({ ...prev, [assetId]: true }));
    setGenerationProgress(prev => ({
      ...prev,
      [assetId]: { stage: 'generating', progress: 0, message: 'Starting...' }
    }));

    try {
      const collectionName = source === 'text_to_3d' ? 'text_to_3d_assets' : 'avatar_to_3d_assets';
      const assetRef = doc(db, collectionName, assetId);
      await updateDoc(assetRef, { status: 'generating', updated_at: serverTimestamp() });

      const result = await textTo3dGenerationService.generateFromApprovedAsset(
        {
          textTo3dAssetId: assetId,
          prompt: asset.prompt,
          chapterId,
          topicId,
          userId: user.uid,
          artStyle: 'realistic',
          aiModel: 'meshy-6',
          collectionName
        },
        (progress) => {
          setGenerationProgress(prev => ({ ...prev, [assetId]: progress }));
          
          const updateData: any = {
            status: progress.stage === 'completed' ? 'ready' : 
                    progress.stage === 'failed' ? 'failed' : 'generating',
            generation_progress: progress.progress,
            generation_message: progress.message,
            updated_at: serverTimestamp(),
          };
          if (progress.error !== undefined) updateData.generation_error = progress.error;
          updateDoc(assetRef, updateData).catch(console.error);
        }
      );

      if (result.success && result.meshyAssetId) {
        await updateDoc(assetRef, {
          meshy_asset_id: result.meshyAssetId,
          status: 'ready',
          updated_at: serverTimestamp(),
        });

        // Update local state
        if (source === 'text_to_3d') {
          setTextTo3dAssets(prev => prev.map(a => 
            a.id === assetId ? { ...a, status: 'ready', meshy_asset_id: result.meshyAssetId } : a
          ));
        } else {
          setScriptTo3dAssets(prev => prev.map(a => 
            a.id === assetId ? { ...a, status: 'ready', meshy_asset_id: result.meshyAssetId } : a
          ));
        }

        // Refresh assets list in parent
        if (onAssetGenerated) {
          setTimeout(() => onAssetGenerated(), 1000);
        }

        if (!options?.suppressSuccessToast) {
          toast.success('3D asset generated! Check the 3D Assets section above.');
        }
      } else {
        throw new Error(result.error || 'Generation failed');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const assetRef = doc(db, source === 'text_to_3d' ? 'text_to_3d_assets' : 'avatar_to_3d_assets', assetId);
      await updateDoc(assetRef, {
        status: 'failed',
        generation_error: errorMessage,
        updated_at: serverTimestamp(),
      }).catch(console.error);

      if (source === 'text_to_3d') {
        setTextTo3dAssets(prev => prev.map(a => 
          a.id === assetId ? { ...a, status: 'failed', generation_error: errorMessage } : a
        ));
      } else {
        setScriptTo3dAssets(prev => prev.map(a => 
          a.id === assetId ? { ...a, status: 'failed', generation_error: errorMessage } : a
        ));
      }

      if (!options?.suppressErrorToast) {
        toast.error(`Generation failed: ${errorMessage}`);
      }
      return { success: false, error: errorMessage };
    } finally {
      setGeneratingAssetIds(prev => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
    }
  };

  // Script-to-3D: Detect objects
  const handleDetectObjects = async () => {
    if (!explanationScript?.trim()) {
      toast.error('Please provide a script');
      return;
    }

    setDetecting(true);
    setDetectionProgress(20);
    setDetectionMessage('Analyzing script...');

    try {
      const result = await avatarTo3dService.detect3DObjects(chapterId, topicId, language, explanationScript);
      setDetectionProgress(60);

      if (!result.success || result.assets.length === 0) {
        setDetectionProgress(100);
        setDetectionMessage('No 3D objects detected');
        toast.info('No 3D objects found. You can add them manually.');
        return;
      }

      setDetectionProgress(80);
      setDetectionMessage(`Saving ${result.assets.length} object(s)...`);
      const savedIds = await avatarTo3dService.saveDetectedAssets(result.assets);
      
      setDetectionProgress(100);
      setDetectionMessage(`Detected ${savedIds.length} object(s)!`);

      const updated = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
      setScriptTo3dAssets(updated.map(a => ({ ...a, source: 'avatar_to_3d' })));
      toast.success(`Detected ${savedIds.length} 3D object(s)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Detection failed';
      setDetectionMessage(`Error: ${errorMessage}`);
      toast.error(`Detection failed: ${errorMessage}`);
    } finally {
      setDetecting(false);
      setTimeout(() => {
        setDetectionProgress(0);
        setDetectionMessage('');
      }, 3000);
    }
  };

  // Handle delete asset
  const handleDeleteAsset = async (assetId: string, source: 'text_to_3d' | 'avatar_to_3d') => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    if (!confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return;
    }

    setDeletingAssetId(assetId);
    try {
      if (source === 'avatar_to_3d') {
        await retryOperation(
          () => avatarTo3dService.deleteAsset(assetId),
          { maxAttempts: 3 }
        );
        
        // Remove from local state
        setScriptTo3dAssets(prev => prev.filter(a => a.id !== assetId));
        if (selectedScriptTo3d?.id === assetId) {
          setSelectedScriptTo3d(null);
        }
      } else {
        // For text_to_3d, we'd need a similar delete method
        toast.error('Delete not yet implemented for Text-to-3D assets');
      }
      
      toast.success('Asset deleted successfully');
    } catch (error: any) {
      logError(error, 'TextTo3DUnified.handleDeleteAsset');
      const classification = classifyError(error);
      toast.error(classification.userMessage || 'Failed to delete asset');
    } finally {
      setDeletingAssetId(null);
    }
  };

  /** Get GLB URL from asset (for rig & animate). Best for humanoid textured models. */
  const getGlbUrl = (asset: TextTo3dAsset): string | null => {
    const url = asset.glb_url || asset.model_urls?.glb;
    return (url && typeof url === 'string' && url.trim()) ? url.trim() : null;
  };

  /** Run rig + animate workflow and update Firestore. */
  const handleApplyAnimation = async (asset: TextTo3dAsset, source: 'text_to_3d' | 'avatar_to_3d') => {
    const glbUrl = getGlbUrl(asset);
    if (!glbUrl) {
      toast.error('No GLB URL available for this asset');
      return;
    }
    setAnimatingAssetId(asset.id);
    setAnimateProgress({ stage: 'rigging', progress: 0, message: 'Starting...' });
    setShowAnimationPicker(false);
    try {
      const collectionName = source === 'text_to_3d' ? 'text_to_3d_assets' : 'avatar_to_3d_assets';
      const result = await meshyRiggingAnimationService.rigAndAnimateAsset({
        assetId: asset.id,
        glbUrl,
        actionId: selectedActionId,
        collectionName,
        meshyAssetId: asset.meshy_asset_id,
        onProgress: (stage, progress, message) => setAnimateProgress({ stage, progress, message }),
      });
      if (result.success) {
        toast.success('Animation applied. Asset will show animated in lessons.');
        setAnimateProgress(null);
        const bundleData = await getLessonBundle({ chapterId, lang: language, topicId });
        if (activeSection === 'text-to-3d' && bundleData?.textTo3dAssets) {
          setTextTo3dAssets(bundleData.textTo3dAssets.map((a: any) => ({ ...a, source: 'text_to_3d' })));
          const updated = bundleData.textTo3dAssets.find((a: any) => a.id === asset.id);
          if (updated) setSelectedTextTo3d({ ...updated, source: 'text_to_3d' });
        }
        if (activeSection === 'script-to-3d' && bundleData?.textTo3dAssets) {
          const avatarAssets = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
          setScriptTo3dAssets(avatarAssets.map(a => ({ ...a, source: 'avatar_to_3d' })));
          const updated = avatarAssets.find(a => a.id === asset.id);
          if (updated) setSelectedScriptTo3d({ ...updated, source: 'avatar_to_3d' });
        }
        onAssetGenerated?.();
      } else {
        toast.error(result.error || 'Animation failed');
        setAnimateProgress(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Animation failed');
      setAnimateProgress(null);
    } finally {
      setAnimatingAssetId(null);
    }
  };

  const updateManualPromptRow = (rowId: string, updates: Partial<ManualPromptRow>) => {
    setManualPromptRows(prev =>
      prev.map(row => (row.id === rowId ? { ...row, ...updates } : row))
    );
  };

  const handleAddManualPromptRow = () => {
    setManualPromptRows(prev => [...prev, createManualPromptRow()]);
  };

  const handleRemoveManualPromptRow = (rowId: string) => {
    setManualPromptRows(prev => {
      if (prev.length === 1) {
        return [{ ...prev[0], prompt: '', status: 'idle', error: undefined, assetId: undefined }];
      }
      return prev.filter(row => row.id !== rowId);
    });
  };

  // Script-to-3D: Add multiple manual assets with a concurrency limit of 3
  const handleAddManual = async () => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    const validRows = manualPromptRows
      .map(row => ({ ...row, prompt: row.prompt.trim() }))
      .filter(row => row.prompt);

    if (validRows.length === 0) {
      toast.error('Please add at least one prompt');
      return;
    }

    setManualBatchRunning(true);
    setManualPromptRows(prev =>
      prev.map(row =>
        row.prompt.trim()
          ? { ...row, status: 'queued', error: undefined, assetId: undefined }
          : row
      )
    );

    let generatedCount = 0;
    let existingCount = 0;
    let failedCount = 0;

    try {
      const createdRows: Array<{ rowId: string; assetId: string }> = [];

      for (const row of validRows) {
        updateManualPromptRow(row.id, { status: 'creating', error: undefined });
        try {
          const assetId = await retryOperation(
            () =>
              avatarTo3dService.createManualAsset(
                chapterId,
                topicId,
                language,
                row.prompt,
                explanationScript || undefined,
                user.uid
              ),
            { maxAttempts: 3 }
          );

          createdRows.push({ rowId: row.id, assetId });
          updateManualPromptRow(row.id, { assetId, status: 'queued' });
        } catch (error: any) {
          failedCount += 1;
          logError(error, 'TextTo3DUnified.handleAddManual.createManualAsset');
          const classification = classifyError(error);
          updateManualPromptRow(row.id, {
            status: 'error',
            error:
              classification.type === 'permission'
                ? 'Permission denied. Staff role required.'
                : classification.userMessage || 'Failed to create asset',
          });
        }
      }

      if (createdRows.length === 0) {
        throw new Error('No manual assets could be created.');
      }

      const updated = await retryOperation(
        () => avatarTo3dService.getAssetsForTopic(chapterId, topicId, language),
        { maxAttempts: 3 }
      );
      const updatedWithSource = updated.map(a => ({ ...a, source: 'avatar_to_3d' as const }));
      setScriptTo3dAssets(updatedWithSource);

      const firstCreatedAsset = createdRows
        .map(({ assetId }) => updatedWithSource.find(asset => asset.id === assetId))
        .find(Boolean);
      if (firstCreatedAsset) {
        setSelectedScriptTo3d(firstCreatedAsset);
      }

      const tasks = createdRows.map(({ rowId, assetId }) => async () => {
        const asset = updatedWithSource.find(item => item.id === assetId);
        if (!asset) {
          failedCount += 1;
          updateManualPromptRow(rowId, {
            status: 'error',
            error: 'Created asset could not be reloaded.',
          });
          return;
        }

        if (asset.meshy_asset_id) {
          existingCount += 1;
          updateManualPromptRow(rowId, { status: 'existing', assetId });
          return;
        }

        if (!asset.approval_status) {
          failedCount += 1;
          updateManualPromptRow(rowId, {
            status: 'error',
            assetId,
            error: 'Asset was created but not approved for generation.',
          });
          return;
        }

        updateManualPromptRow(rowId, { status: 'generating', assetId, error: undefined });
        const result = await handleGenerate3DAsset(assetId, asset, 'avatar_to_3d', {
          suppressSuccessToast: true,
          suppressErrorToast: true,
        });

        if (result?.success) {
          generatedCount += 1;
          updateManualPromptRow(rowId, { status: 'success', assetId, error: undefined });
        } else {
          failedCount += 1;
          updateManualPromptRow(rowId, {
            status: 'error',
            assetId,
            error: result?.error || 'Generation failed',
          });
        }
      });

      toast.info(
        `Starting ${tasks.length} manual Meshy generation${tasks.length > 1 ? 's' : ''} with up to 3 running at once...`
      );

      await runWithConcurrency(tasks, 3);

      const refreshedAssets = await retryOperation(
        () => avatarTo3dService.getAssetsForTopic(chapterId, topicId, language),
        { maxAttempts: 3 }
      );
      setScriptTo3dAssets(refreshedAssets.map(a => ({ ...a, source: 'avatar_to_3d' })));

      const summaryParts = [
        generatedCount > 0 ? `${generatedCount} generated` : '',
        existingCount > 0 ? `${existingCount} already ready` : '',
        failedCount > 0 ? `${failedCount} failed` : '',
      ].filter(Boolean);

      toast.success(
        summaryParts.length > 0
          ? `Manual Meshy batch complete: ${summaryParts.join(', ')}.`
          : 'Manual Meshy batch complete.'
      );
    } catch (error: any) {
      logError(error, 'TextTo3DUnified.handleAddManual');
      const classification = classifyError(error);
      if (classification.type === 'permission') {
        toast.error('Permission denied. Staff (Admin, Super Admin, or Associate) role required.');
      } else {
        toast.error(classification.userMessage || 'Failed to generate 3D assets');
      }
    } finally {
      setManualBatchRunning(false);
    }
  };

  const applyRegenerationJob = (job: MeshyRegenerationJob) => {
    const items = job.items || [];
    setRegenerationJob(job);
    setRegenerationItems(items);
    if (job.dry_run) {
      setSelectedRegenerationKeys(new Set(items.map(regenerationItemKey)));
    }
  };

  const regenerationSettings = {
    aiModel: 'meshy-6',
    concurrency: 2,
    targetFormats: ['glb'],
    hdTexture: true,
    enablePbr: true,
    removeLighting: true,
    autoSize: true,
    originAt: 'bottom',
    moderation: true,
  };

  const handleScanBrokenAssets = async () => {
    setRegenerationLoading(true);
    setRegenerationError(null);
    try {
      const job = await meshyRegenerationService.createJob({
        dryRun: true,
        scope: {
          chapterId,
          topicId,
          limit: 100,
          healthCheck: true,
          sourceCollections: ['text_to_3d_assets', 'avatar_to_3d_assets'],
        },
        settings: regenerationSettings,
      });
      applyRegenerationJob(job);
      if ((job.items || []).length === 0) {
        toast.info('No broken approved prompt-based 3D assets found for this topic.');
      } else {
        toast.success(`Found ${(job.items || []).length} broken approved asset(s).`);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to scan broken 3D assets';
      setRegenerationError(message);
      toast.error(message);
    } finally {
      setRegenerationLoading(false);
    }
  };

  const handleStartRegeneration = async () => {
    const selectedItems = regenerationItems
      .filter((item) => selectedRegenerationKeys.has(regenerationItemKey(item)))
      .map((item) => ({
        sourceCollection: item.source_collection,
        sourceAssetId: item.source_asset_id,
      }));

    if (selectedItems.length === 0) {
      toast.info('Select at least one scanned asset to regenerate.');
      return;
    }

    setRegenerationLoading(true);
    setRegenerationError(null);
    try {
      const job = await meshyRegenerationService.createJob({
        dryRun: false,
        scope: {
          chapterId,
          topicId,
          limit: 100,
          healthCheck: false,
          sourceCollections: ['text_to_3d_assets', 'avatar_to_3d_assets'],
        },
        selectedItems,
        settings: regenerationSettings,
      });
      applyRegenerationJob(job);
      toast.success('Regeneration job queued.');
    } catch (err: any) {
      const message = err?.message || 'Failed to start regeneration';
      setRegenerationError(message);
      toast.error(message);
    } finally {
      setRegenerationLoading(false);
    }
  };

  const handleCancelRegeneration = async () => {
    if (!regenerationJob?.id) return;
    setRegenerationLoading(true);
    setRegenerationError(null);
    try {
      const job = await meshyRegenerationService.cancelJob(regenerationJob.id);
      applyRegenerationJob(job);
      toast.success('Pending regeneration items cancelled.');
    } catch (err: any) {
      const message = err?.message || 'Failed to cancel regeneration job';
      setRegenerationError(message);
      toast.error(message);
    } finally {
      setRegenerationLoading(false);
    }
  };

  const handleRetryFailedRegeneration = async () => {
    if (!regenerationJob?.id) return;
    setRegenerationLoading(true);
    setRegenerationError(null);
    try {
      const job = await meshyRegenerationService.retryFailed(regenerationJob.id);
      applyRegenerationJob(job);
      toast.success('Failed items queued for retry.');
    } catch (err: any) {
      const message = err?.message || 'Failed to retry regeneration items';
      setRegenerationError(message);
      toast.error(message);
    } finally {
      setRegenerationLoading(false);
    }
  };

  useEffect(() => {
    if (!regenerationJob?.id || !['queued', 'running'].includes(regenerationJob.status)) return;
    const timer = window.setInterval(() => {
      meshyRegenerationService.getJob(regenerationJob.id)
        .then(applyRegenerationJob)
        .catch((err) => setRegenerationError(err?.message || 'Failed to refresh regeneration job'));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [regenerationJob?.id, regenerationJob?.status]);

  const currentAssets = activeSection === 'text-to-3d' ? textTo3dAssets : scriptTo3dAssets;
  const currentSelected = activeSection === 'text-to-3d' ? selectedTextTo3d : selectedScriptTo3d;
  const isLoading = activeSection === 'text-to-3d' ? textTo3dLoading : scriptTo3dLoading;
  const visibleRegenerationItems = showReplacedAssets
    ? regenerationItems
    : regenerationItems.filter((item) => item.status !== 'replaced' && item.status !== 'cancelled');
  const selectedRegenerationCount = regenerationItems.filter((item) => selectedRegenerationKeys.has(regenerationItemKey(item))).length;
  const regenerationCounts = regenerationJob?.counts || {};

  // Don't block UI for errors - show inline instead
  // if (error) {
  //   return (
  //     <div className="p-4">
  //       <ErrorDisplay
  //         error={error}
  //         onRetry={() => {
  //           setError(null);
  //           // Reload data
  //           if (activeSection === 'text-to-3d') {
  //             // Reload text-to-3d
  //           } else {
  //             // Reload script-to-3d
  //           }
  //         }}
  //         onDismiss={() => setError(null)}
  //       />
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      {/* Show error inline if present */}
      {error && (
        <div className="mb-4">
          <ErrorDisplay
            error={error}
            onRetry={() => {
              setError(null);
              // Trigger reload
              if (activeSection === 'script-to-3d') {
                // Reload script-to-3d
                const loadScriptTo3d = async () => {
                  try {
                    const updated = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
                    setScriptTo3dAssets(updated.map(a => ({ ...a, source: 'avatar_to_3d' })));
                  } catch (err) {
                    console.error('Failed to reload:', err);
                  }
                };
                loadScriptTo3d();
              }
            }}
            onDismiss={() => setError(null)}
          />
        </div>
      )}
      
      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveSection('text-to-3d')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'text-to-3d'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Text-to-3D
          </div>
        </button>
        <button
          onClick={() => setActiveSection('script-to-3d')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'script-to-3d'
              ? 'text-purple-400 border-purple-500'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Script-to-3D
          </div>
        </button>
      </div>

      {isSuperAdmin && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Regenerate Broken 3D Assets</h3>
                {regenerationJob?.status && (
                  <span className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                    {regenerationJob.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Meshy 6 preview + HD texture refine for approved prompt assets in this topic.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleScanBrokenAssets}
                disabled={regenerationLoading}
                className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {regenerationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Scan broken assets
              </button>
              <button
                onClick={handleStartRegeneration}
                disabled={regenerationLoading || !regenerationJob?.dry_run || selectedRegenerationCount === 0}
                className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Start regeneration
              </button>
              <button
                onClick={handleCancelRegeneration}
                disabled={regenerationLoading || !regenerationJob?.id || !['queued', 'running'].includes(regenerationJob.status)}
                className="px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 text-sm"
              >
                Cancel pending
              </button>
              <button
                onClick={handleRetryFailedRegeneration}
                disabled={regenerationLoading || !regenerationJob?.id || Number(regenerationCounts.failed || 0) === 0}
                className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-50 text-sm"
              >
                Retry failed
              </button>
              <button
                onClick={() => setShowReplacedAssets((value) => !value)}
                className="px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 text-sm"
              >
                {showReplacedAssets ? 'Hide archived/replaced' : 'Show archived/replaced'}
              </button>
            </div>
          </div>

          {regenerationError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{regenerationError}</span>
            </div>
          )}

          {regenerationJob && (
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                ['pending', 'Pending'],
                ['generating_preview', 'Preview'],
                ['refining_texture', 'Refining'],
                ['finalizing', 'Finalizing'],
                ['replaced', 'Replaced'],
                ['failed', 'Failed'],
                ['cancelled', 'Cancelled'],
              ].map(([key, label]) => (
                <span key={key} className="px-2 py-1 rounded bg-muted text-muted-foreground">
                  {label}: {Number(regenerationCounts[key] || 0)}
                </span>
              ))}
              {regenerationJob.dry_run && (
                <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300">
                  Selected: {selectedRegenerationCount}
                </span>
              )}
            </div>
          )}

          {visibleRegenerationItems.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {visibleRegenerationItems.map((item) => {
                const key = regenerationItemKey(item);
                const selected = selectedRegenerationKeys.has(key);
                return (
                  <div key={item.id} className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="flex items-start gap-3">
                      {regenerationJob?.dry_run && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            setSelectedRegenerationKeys((previous) => {
                              const next = new Set(previous);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            });
                          }}
                          className="mt-1"
                          aria-label={`Select ${item.prompt || item.source_asset_id}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate max-w-full">
                            {item.prompt || item.source_asset_id}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-background text-xs text-muted-foreground">
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          {typeof item.progress === 'number' && item.progress > 0 && (
                            <span className="text-xs text-blue-300">{Math.round(item.progress)}%</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>Source: {item.source_collection}</div>
                          <div>Chapter/topic: {item.chapter_id || chapterId} / {item.topic_id || topicId}</div>
                          <div>Current asset: {item.old_meshy_asset_id || 'missing'}</div>
                          <div>Old URL type: {item.old_url_type || 'unknown'}</div>
                          <div>Meshy tasks: {item.estimated_meshy_task_count || 2}</div>
                          {item.new_meshy_asset_id && <div>New asset: {item.new_meshy_asset_id}</div>}
                        </div>
                        {item.broken_reasons?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.broken_reasons.map((reason) => (
                              <span key={reason} className="px-2 py-0.5 rounded bg-red-500/10 text-red-300 text-xs">
                                {reason.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {item.error && (
                          <p className="mt-2 text-xs text-red-300">{item.error}</p>
                        )}
                        {item.render_url && (
                          <a
                            href={item.render_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Package className="w-3 h-3" />
                            Firebase render URL
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {activeSection === 'text-to-3d' ? (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : currentAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No Text-to-3D assets found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-2 max-h-96 overflow-y-auto">
                {currentAssets.map(asset => (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedTextTo3d(asset)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      currentSelected?.id === asset.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-muted/50 border-border hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {asset.approval_status ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-sm font-medium text-foreground truncate">
                        {asset.prompt?.substring(0, 40)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded ${
                        asset.approval_status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {asset.approval_status ? 'Approved' : 'Pending'}
                      </span>
                      {asset.status === 'generating' && generationProgress[asset.id] && (
                        <span className="text-blue-400">
                          {Math.round(generationProgress[asset.id].progress)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {currentSelected && (
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-muted/50 rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{currentSelected.prompt}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            currentSelected.approval_status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {currentSelected.approval_status ? 'Approved' : 'Pending'}
                          </span>
                          {currentSelected.status && (
                            <span className={`px-2 py-1 text-xs rounded ${
                              currentSelected.status === 'ready' ? 'bg-primary/10 text-primary' :
                              currentSelected.status === 'generating' ? 'bg-blue-500/10 text-blue-400' :
                              currentSelected.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {currentSelected.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <PermissionGate
                        resource="text_to_3d_assets"
                        operation="update"
                        showMessage={false}
                      >
                        <button
                          onClick={() => handleApproveAsset(currentSelected.id, !currentSelected.approval_status, 'text_to_3d')}
                          disabled={updatingApproval === currentSelected.id}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            currentSelected.approval_status
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          } disabled:opacity-50`}
                        >
                          {updatingApproval === currentSelected.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : currentSelected.approval_status ? (
                            'Unapprove'
                          ) : (
                            'Approve'
                          )}
                        </button>
                      </PermissionGate>
                    </div>

                    {currentSelected.status === 'generating' && generationProgress[currentSelected.id] && (
                      <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-blue-400">{generationProgress[currentSelected.id].message}</span>
                          <span className="text-xs text-blue-300">{Math.round(generationProgress[currentSelected.id].progress)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${generationProgress[currentSelected.id].progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {currentSelected.status === 'failed' && currentSelected.generation_error && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-red-400">Generation Failed</span>
                        </div>
                        <p className="text-xs text-red-300 mb-2">{currentSelected.generation_error}</p>
                        <button
                          onClick={() => handleGenerate3DAsset(currentSelected.id, currentSelected, 'text_to_3d')}
                          disabled={Boolean(generatingAssetIds[currentSelected.id])}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-foreground border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {generatingAssetIds[currentSelected.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Retry'
                          )}
                        </button>
                      </div>
                    )}

                    {currentSelected.status === 'ready' && currentSelected.meshy_asset_id && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">Asset Generated</span>
                        </div>
                        <p className="text-xs text-primary">Available in 3D Assets section above</p>
                      </div>
                    )}

                    {/* Rig & Animate (Meshy v1): only for approved assets with GLB. Best for humanoid models. */}
                    {currentSelected.approval_status && getGlbUrl(currentSelected) && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-foreground" />
                          <span className="text-sm font-medium text-foreground">Animate</span>
                          {currentSelected.animated_glb_url && (
                            <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400">Animated</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Best for humanoid characters. Non-humanoid or untextured models may fail.</p>
                        {animatingAssetId === currentSelected.id && animateProgress ? (
                          <div className="space-y-2">
                            <p className="text-xs text-foreground">{animateProgress.message}</p>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${animateProgress.progress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <>
                            {showAnimationPicker ? (
                              <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Animation</label>
                                <select
                                  value={selectedActionId}
                                  onChange={(e) => setSelectedActionId(Number(e.target.value))}
                                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                                >
                                  {MESHY_ANIMATION_LIBRARY.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApplyAnimation(currentSelected, 'text_to_3d')}
                                    disabled={animatingAssetId !== null}
                                    className="flex-1 px-3 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {animatingAssetId === currentSelected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Apply animation
                                  </button>
                                  <button
                                    onClick={() => setShowAnimationPicker(false)}
                                    className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowAnimationPicker(true)}
                                disabled={animatingAssetId !== null}
                                className="px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50 flex items-center gap-2"
                              >
                                <Activity className="w-4 h-4" />
                                {currentSelected.animated_glb_url ? 'Change animation' : 'Rig & Animate'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Script Input */}
          <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/5">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-400" />
              Detect 3D Objects from Script
            </h3>
            <textarea
              value={explanationScript}
              onChange={(e) => setExplanationScript(e.target.value)}
              placeholder="Paste avatar explanation script here..."
              className="w-full h-24 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none mb-3"
              disabled={detecting}
            />
            <div className="flex gap-2">
              <PermissionGate
                resource="avatar_to_3d_assets"
                operation="create"
                showMessage={false}
              >
                <button
                  onClick={handleDetectObjects}
                  disabled={detecting || !explanationScript.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {detecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span>Detect Objects</span>
                    </>
                  )}
                </button>
              </PermissionGate>
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                disabled={manualBatchRunning}
                className="px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                {showManualEntry ? 'Cancel' : 'Add Manually'}
              </button>
            </div>

            {detecting && (
              <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-400">{detectionMessage}</span>
                  <span className="text-xs text-purple-300">{detectionProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${detectionProgress}%` }}
                  />
                </div>
              </div>
            )}

            {showManualEntry && (
              <div className="mt-3 p-3 rounded-lg bg-cyan-500/5 border border-primary/20">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Manual Meshy prompts</p>
                    <p className="text-xs text-muted-foreground">
                      Add multiple prompt rows. Up to 3 will generate simultaneously.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualPromptRow}
                    disabled={manualBatchRunning}
                    className="px-3 py-1.5 rounded-lg bg-muted text-foreground border border-border hover:bg-muted/80 disabled:opacity-50 text-xs font-medium"
                  >
                    Add prompt row
                  </button>
                </div>
                <div className="space-y-2 mb-3">
                  {manualPromptRows.map((row, index) => (
                    <div key={row.id} className="rounded-lg border border-border bg-background/40 p-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={row.prompt}
                            onChange={(e) =>
                              updateManualPromptRow(row.id, {
                                prompt: e.target.value,
                                status: row.status === 'error' ? 'idle' : row.status,
                                error: undefined,
                              })
                            }
                            placeholder={`Prompt ${index + 1} (e.g., A detailed wooden table)`}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            disabled={manualBatchRunning}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' &&
                                !manualBatchRunning &&
                                manualPromptRows.some(item => item.prompt.trim())
                              ) {
                                handleAddManual();
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualPromptRow(row.id)}
                          disabled={manualBatchRunning || manualPromptRows.length === 1}
                          className="px-2.5 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                          aria-label={`Remove prompt ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {(row.status !== 'idle' || row.error) && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span
                            className={`rounded px-2 py-1 ${
                              row.status === 'success' || row.status === 'existing'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : row.status === 'error'
                                ? 'bg-red-500/10 text-red-400'
                                : row.status === 'generating'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {row.status === 'creating' && 'Creating asset'}
                            {row.status === 'queued' && 'Queued'}
                            {row.status === 'generating' && 'Generating'}
                            {row.status === 'success' && 'Generated'}
                            {row.status === 'existing' && 'Already ready'}
                            {row.status === 'error' && 'Failed'}
                          </span>
                          {row.error && <span className="text-red-300 text-right">{row.error}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <PermissionGate
                  resource="avatar_to_3d_assets"
                  operation="create"
                  showMessage={false}
                >
                  <button
                    onClick={handleAddManual}
                    disabled={manualBatchRunning || !manualPromptRows.some(row => row.prompt.trim())}
                    className="w-full px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {manualBatchRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating assets...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Generate 3D Assets</span>
                      </>
                    )}
                  </button>
                </PermissionGate>
              </div>
            )}
          </div>

          {/* Script-to-3D Assets List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : scriptTo3dAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No Script-to-3D assets found</p>
              <p className="text-xs text-muted-foreground mt-1">Detect objects or add manually</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-2 max-h-96 overflow-y-auto">
                {scriptTo3dAssets.map(asset => (
                  <div
                    key={asset.id}
                    className={`p-3 rounded-lg border transition-all ${
                      currentSelected?.id === asset.id
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-muted/50 border-border hover:border-border'
                    }`}
                  >
                    <div 
                      onClick={() => setSelectedScriptTo3d(asset)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {asset.approval_status ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-sm font-medium text-foreground truncate flex-1">
                          {asset.prompt?.substring(0, 40)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded ${
                          asset.approval_status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {asset.approval_status ? 'Approved' : 'Pending'}
                        </span>
                        {asset.status === 'generating' && generationProgress[asset.id] && (
                          <span className="text-blue-400">
                            {Math.round(generationProgress[asset.id].progress)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Delete button for manually added assets */}
                    {asset.created_by && asset.created_by === user?.uid && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAsset(asset.id, 'avatar_to_3d');
                          }}
                          disabled={deletingAssetId === asset.id}
                          className="w-full px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {deletingAssetId === asset.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {currentSelected && (
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-muted/50 rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{currentSelected.prompt}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            currentSelected.approval_status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {currentSelected.approval_status ? 'Approved' : 'Pending'}
                          </span>
                          {currentSelected.status && (
                            <span className={`px-2 py-1 text-xs rounded ${
                              currentSelected.status === 'ready' ? 'bg-primary/10 text-primary' :
                              currentSelected.status === 'generating' ? 'bg-blue-500/10 text-blue-400' :
                              currentSelected.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {currentSelected.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PermissionGate
                          resource="avatar_to_3d_assets"
                          operation="update"
                          showMessage={false}
                        >
                          <button
                            onClick={() => handleApproveAsset(currentSelected.id, !currentSelected.approval_status, 'avatar_to_3d')}
                            disabled={updatingApproval === currentSelected.id}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              currentSelected.approval_status
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            } disabled:opacity-50`}
                          >
                            {updatingApproval === currentSelected.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : currentSelected.approval_status ? (
                              'Unapprove'
                            ) : (
                              'Approve'
                            )}
                          </button>
                        </PermissionGate>
                        {/* Delete button for manually added assets */}
                        {currentSelected.created_by && currentSelected.created_by === user?.uid && (
                          <PermissionGate
                            resource="avatar_to_3d_assets"
                            operation="delete"
                            showMessage={false}
                          >
                            <button
                              onClick={() => handleDeleteAsset(currentSelected.id, 'avatar_to_3d')}
                              disabled={deletingAssetId === currentSelected.id}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              {deletingAssetId === currentSelected.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>

                    {currentSelected.status === 'generating' && generationProgress[currentSelected.id] && (
                      <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-blue-400">{generationProgress[currentSelected.id].message}</span>
                          <span className="text-xs text-blue-300">{Math.round(generationProgress[currentSelected.id].progress)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${generationProgress[currentSelected.id].progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {currentSelected.status === 'failed' && currentSelected.generation_error && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-red-400">Generation Failed</span>
                        </div>
                        <p className="text-xs text-red-300 mb-2">{currentSelected.generation_error}</p>
                        <button
                          onClick={() => handleGenerate3DAsset(currentSelected.id, currentSelected, 'avatar_to_3d')}
                          disabled={Boolean(generatingAssetIds[currentSelected.id])}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-foreground border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {generatingAssetIds[currentSelected.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Retry'
                          )}
                        </button>
                      </div>
                    )}

                    {currentSelected.status === 'ready' && currentSelected.meshy_asset_id && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">Asset Generated</span>
                        </div>
                        <p className="text-xs text-primary">Available in 3D Assets section above</p>
                      </div>
                    )}

                    {/* Rig & Animate for Script-to-3D */}
                    {currentSelected.approval_status && getGlbUrl(currentSelected) && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-foreground" />
                          <span className="text-sm font-medium text-foreground">Animate</span>
                          {currentSelected.animated_glb_url && (
                            <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400">Animated</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Best for humanoid characters. Non-humanoid or untextured models may fail.</p>
                        {animatingAssetId === currentSelected.id && animateProgress ? (
                          <div className="space-y-2">
                            <p className="text-xs text-foreground">{animateProgress.message}</p>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${animateProgress.progress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <>
                            {showAnimationPicker ? (
                              <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Animation</label>
                                <select
                                  value={selectedActionId}
                                  onChange={(e) => setSelectedActionId(Number(e.target.value))}
                                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                                >
                                  {MESHY_ANIMATION_LIBRARY.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApplyAnimation(currentSelected, 'avatar_to_3d')}
                                    disabled={animatingAssetId !== null}
                                    className="flex-1 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {animatingAssetId === currentSelected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Apply animation
                                  </button>
                                  <button
                                    onClick={() => setShowAnimationPicker(false)}
                                    className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowAnimationPicker(true)}
                                disabled={animatingAssetId !== null}
                                className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                              >
                                <Activity className="w-4 h-4" />
                                {currentSelected.animated_glb_url ? 'Change animation' : 'Rig & Animate'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
