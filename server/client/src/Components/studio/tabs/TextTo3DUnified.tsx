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
} from 'lucide-react';

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

export const TextTo3DUnified = ({ 
  chapterId, 
  topicId, 
  language = 'en', 
  bundle,
  onAssetGenerated 
}: TextTo3DUnifiedProps) => {
  const { user, profile } = useAuth();
  const permissions = usePermissions('avatar_to_3d_assets');
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
  const [manualPrompt, setManualPrompt] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  
  // Generation state (shared)
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ [assetId: string]: GenerationProgress }>({});
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

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
            toast.warn('Could not load assets. Please ensure you have admin or superadmin role.');
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

    setUpdatingApproval(assetId);

    try {
      const collectionName = source === 'text_to_3d' ? 'text_to_3d_assets' : 'avatar_to_3d_assets';
      const assetRef = doc(db, collectionName, assetId);
      const asset = source === 'text_to_3d' 
        ? textTo3dAssets.find(a => a.id === assetId)
        : scriptTo3dAssets.find(a => a.id === assetId);
      
      if (!asset) throw new Error('Asset not found');

      // Optimistically update UI
      if (source === 'text_to_3d') {
        setTextTo3dAssets(prev => prev.map(a => 
          a.id === assetId ? { ...a, approval_status: approve, status: approve && !a.meshy_asset_id ? 'generating' : a.status } : a
        ));
      } else {
        setScriptTo3dAssets(prev => prev.map(a => 
          a.id === assetId ? { ...a, approval_status: approve, status: approve && !a.meshy_asset_id ? 'generating' : a.status } : a
        ));
      }

      // Perform update with retry - Firestore rules handle permissions
      await retryOperation(
        async () => {
          await updateDoc(assetRef, {
            approval_status: approve,
            approved_at: approve ? serverTimestamp() : null,
            approved_by: approve ? user.email : null,
            updated_at: serverTimestamp(),
            ...(approve && !asset.meshy_asset_id ? { status: 'generating' } : {}),
          });
          return asset;
        },
        { maxAttempts: 3 }
      );

      toast.success(`Asset ${approve ? 'approved' : 'unapproved'}`);

      // Auto-generate if approving
      if (approve && !asset.meshy_asset_id && asset.prompt) {
        await handleGenerate3DAsset(assetId, asset, source);
      }
    } catch (error: any) {
      logError(error, 'TextTo3DUnified.handleApproveAsset');
      const classification = classifyError(error);
      
      // Show user-friendly error message
      if (classification.type === 'permission') {
        toast.error('Permission denied. Please ensure you have admin or superadmin role in your user profile.');
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
    source: 'text_to_3d' | 'avatar_to_3d'
  ) => {
    if (!asset.prompt || !chapterId || !topicId || !user?.uid) {
      toast.error('Missing required information');
      return;
    }

    setGeneratingAssetId(assetId);
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
          aiModel: 'meshy-4',
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

        toast.success('3D asset generated! Check the 3D Assets section above.');
      } else {
        throw new Error(result.error || 'Generation failed');
      }
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

      toast.error(`Generation failed: ${errorMessage}`);
    } finally {
      setGeneratingAssetId(null);
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

  // Script-to-3D: Add manual (Generate 3D Asset)
  const handleAddManual = async () => {
    if (!manualPrompt?.trim() || !user?.uid) {
      toast.error('Please enter a prompt');
      return;
    }

    setAddingManual(true);
    try {
      // Step 1: Create asset with auto-approval (status: 'generating')
      // This automatically approves and sets status to 'generating' so Meshy can process it
      // Firestore rules will handle permission checking
      const assetId = await retryOperation(
        () => avatarTo3dService.createManualAsset(
          chapterId, topicId, language, manualPrompt.trim(), explanationScript || undefined, user.uid
        ),
        { maxAttempts: 3 }
      );

      // Step 2: Reload assets to get the newly created asset
      const updated = await retryOperation(
        () => avatarTo3dService.getAssetsForTopic(chapterId, topicId, language),
        { maxAttempts: 3 }
      );
      setScriptTo3dAssets(updated.map(a => ({ ...a, source: 'avatar_to_3d' })));
      
      // Step 3: Select the newly added asset and trigger generation
      const newAsset = updated.find(a => a.id === assetId);
      if (newAsset) {
        setSelectedScriptTo3d({ ...newAsset, source: 'avatar_to_3d' });
        
        // Step 4: Automatically trigger Meshy 3D generation (with textures)
        // This will:
        // - Generate 3D model using Meshy API
        // - Download GLB, FBX, USDZ files with textures
        // - Upload to Firebase Storage
        // - Create meshy_asset document
        // - Link to topic (makes it available in 3D Assets section)
        if (newAsset.approval_status && !newAsset.meshy_asset_id) {
          toast.info('Starting 3D generation with Meshy (this may take a few minutes)...');
          await handleGenerate3DAsset(assetId, { ...newAsset, source: 'avatar_to_3d' }, 'avatar_to_3d');
        } else if (newAsset.meshy_asset_id) {
          toast.success('3D asset already generated!');
        }
      }

      // Reset form
      setManualPrompt('');
      setShowManualEntry(false);
      toast.success('3D asset generation started!');
    } catch (error: any) {
      logError(error, 'TextTo3DUnified.handleAddManual');
      const classification = classifyError(error);
      
      // Show user-friendly error message
      if (classification.type === 'permission') {
        toast.error('Permission denied. Please ensure you have admin or superadmin role in your user profile.');
      } else {
        toast.error(classification.userMessage || 'Failed to generate 3D asset');
      }
    } finally {
      setAddingManual(false);
    }
  };

  const currentAssets = activeSection === 'text-to-3d' ? textTo3dAssets : scriptTo3dAssets;
  const currentSelected = activeSection === 'text-to-3d' ? selectedTextTo3d : selectedScriptTo3d;
  const isLoading = activeSection === 'text-to-3d' ? textTo3dLoading : scriptTo3dLoading;

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
      <div className="flex gap-2 border-b border-slate-700/50">
        <button
          onClick={() => setActiveSection('text-to-3d')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'text-to-3d'
              ? 'text-cyan-400 border-cyan-500'
              : 'text-slate-400 border-transparent hover:text-white'
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
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Script-to-3D
          </div>
        </button>
      </div>

      {/* Content */}
      {activeSection === 'text-to-3d' ? (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : currentAssets.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
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
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {asset.approval_status ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-sm font-medium text-white truncate">
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
                  <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{currentSelected.prompt}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            currentSelected.approval_status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {currentSelected.approval_status ? 'Approved' : 'Pending'}
                          </span>
                          {currentSelected.status && (
                            <span className={`px-2 py-1 text-xs rounded ${
                              currentSelected.status === 'ready' ? 'bg-cyan-500/10 text-cyan-400' :
                              currentSelected.status === 'generating' ? 'bg-blue-500/10 text-blue-400' :
                              currentSelected.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-slate-700/50 text-slate-400'
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
                        <div className="w-full bg-slate-900/50 rounded-full h-2">
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
                          disabled={generatingAssetId === currentSelected.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-white border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {generatingAssetId === currentSelected.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Retry'
                          )}
                        </button>
                      </div>
                    )}

                    {currentSelected.status === 'ready' && currentSelected.meshy_asset_id && (
                      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm font-medium text-cyan-400">Asset Generated</span>
                        </div>
                        <p className="text-xs text-cyan-300">Available in 3D Assets section above</p>
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
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-400" />
              Detect 3D Objects from Script
            </h3>
            <textarea
              value={explanationScript}
              onChange={(e) => setExplanationScript(e.target.value)}
              placeholder="Paste avatar explanation script here..."
              className="w-full h-24 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none mb-3"
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
                className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
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
                <div className="w-full bg-slate-900/50 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${detectionProgress}%` }}
                  />
                </div>
              </div>
            )}

            {showManualEntry && (
              <div className="mt-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <input
                  type="text"
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  placeholder="e.g., A detailed wooden table"
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-2"
                  disabled={addingManual}
                  onKeyDown={(e) => e.key === 'Enter' && !addingManual && manualPrompt.trim() && handleAddManual()}
                />
                <PermissionGate
                  resource="avatar_to_3d_assets"
                  operation="create"
                  showMessage={false}
                >
                  <button
                    onClick={handleAddManual}
                    disabled={addingManual || !manualPrompt.trim()}
                    className="w-full px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {addingManual ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Generate 3D Asset</span>
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
            <div className="text-center py-12 text-slate-400">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No Script-to-3D assets found</p>
              <p className="text-xs text-slate-500 mt-1">Detect objects or add manually</p>
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
                        : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
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
                        <span className="text-sm font-medium text-white truncate flex-1">
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
                      <div className="mt-2 pt-2 border-t border-slate-700/30">
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
                  <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{currentSelected.prompt}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            currentSelected.approval_status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {currentSelected.approval_status ? 'Approved' : 'Pending'}
                          </span>
                          {currentSelected.status && (
                            <span className={`px-2 py-1 text-xs rounded ${
                              currentSelected.status === 'ready' ? 'bg-cyan-500/10 text-cyan-400' :
                              currentSelected.status === 'generating' ? 'bg-blue-500/10 text-blue-400' :
                              currentSelected.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-slate-700/50 text-slate-400'
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
                        <div className="w-full bg-slate-900/50 rounded-full h-2">
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
                          disabled={generatingAssetId === currentSelected.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-white border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {generatingAssetId === currentSelected.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Retry'
                          )}
                        </button>
                      </div>
                    )}

                    {currentSelected.status === 'ready' && currentSelected.meshy_asset_id && (
                      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm font-medium text-cyan-400">Asset Generated</span>
                        </div>
                        <p className="text-xs text-cyan-300">Available in 3D Assets section above</p>
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
