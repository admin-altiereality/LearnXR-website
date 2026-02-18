/**
 * ScriptTo3dTab - Script to 3D Conversion Tool
 * 
 * Features:
 * - Analyze avatar explanation scripts to detect 3D objects
 * - Manually add 3D object prompts
 * - Display detected/manual objects for admin approval
 * - Automatic 3D generation on approval (same as Text-to-3D)
 * - Show full lifecycle: Detection → Pending → Approved → Generating → Ready
 * - Beautiful UI with step-by-step generation progress
 * 
 * Data Source: avatar_to_3d_assets collection
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import { canEditLesson } from '../../../utils/rbac';
import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { avatarTo3dService } from '../../../services/avatarTo3dService';
import { textTo3dGenerationService } from '../../../services/textTo3dGenerationService';
import type { GenerationProgress } from '../../../services/textTo3dGenerationService';
import { getLessonBundle } from '../../../services/firestore/getLessonBundle';
import type { LanguageCode } from '../../../types/curriculum';
import {
  Box,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  ExternalLink,
  Filter,
  CheckCircle2,
  AlertCircle,
  Package,
  Sparkles,
  RefreshCw,
  Zap,
  Brain,
  Search,
  FileText,
  Play,
  Pause,
} from 'lucide-react';

interface AvatarTo3dTabProps {
  chapterId: string;
  topicId: string;
  language?: LanguageCode;
  bundle?: any;
}

interface AvatarTo3dAsset {
  id: string;
  chapter_id: string;
  topic_id: string;
  language: string;
  prompt: string;
  source_script: string;
  source_script_type: 'explanation' | 'intro' | 'outro';
  approval_status?: boolean;
  status?: 'pending' | 'approved' | 'generating' | 'ready' | 'failed';
  generation_progress?: number;
  generation_message?: string;
  generation_error?: string;
  meshy_asset_id?: string;
  model_urls?: {
    glb?: string;
    fbx?: string;
    usdz?: string;
  };
  glb_url?: string;
  fbx_url?: string;
  usdz_url?: string;
  thumbnail_url?: string;
  created_at?: any;
  updated_at?: any;
  created_by?: string;
  detected_at?: any;
  confidence?: number;
}

export const AvatarTo3dTab = ({ chapterId, topicId, language = 'en', bundle }: AvatarTo3dTabProps) => {
  const { user, profile } = useAuth();
  const [assets, setAssets] = useState<AvatarTo3dAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<AvatarTo3dAsset | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ [assetId: string]: GenerationProgress }>({});
  
  // Detection state
  const [detecting, setDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [detectionMessage, setDetectionMessage] = useState('');
  const [explanationScript, setExplanationScript] = useState('');
  const [showDetectionResults, setShowDetectionResults] = useState(false);
  const [newlyDetectedAssets, setNewlyDetectedAssets] = useState<AvatarTo3dAsset[]>([]);
  
  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  const canEdit = canEditLesson(profile);

  // Load avatar scripts and existing assets
  useEffect(() => {
    const loadData = async () => {
      if (!chapterId || !topicId) return;

      setLoading(true);
      try {
        // Load avatar scripts from bundle
        const bundleData = bundle || await getLessonBundle({
          chapterId,
          lang: language,
          topicId,
        });

        const avatarScripts = bundleData.avatarScripts || {};
        const explanation = avatarScripts.explanation || '';
        setExplanationScript(explanation);

        // Load existing avatar_to_3d_assets
        const existingAssets = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
        setAssets(existingAssets);

        if (existingAssets.length > 0 && !selectedAsset) {
          setSelectedAsset(existingAssets[0]);
        }
      } catch (error) {
        console.error('Error loading script-to-3D data:', error);
        toast.error('Failed to load script data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [chapterId, topicId, language, bundle]);

  // Detect 3D objects from avatar explanation script
  const handleDetectObjects = async () => {
    if (!explanationScript || !explanationScript.trim()) {
      toast.error('Please provide an avatar explanation script');
      return;
    }

    if (!canEdit) {
      toast.error('Only admins can detect 3D objects');
      return;
    }

    setDetecting(true);
    setDetectionProgress(0);
    setDetectionMessage('Analyzing avatar script...');
    setShowDetectionResults(false);
    setNewlyDetectedAssets([]);

    try {
      // Step 1: Analyzing script
      setDetectionProgress(20);
      setDetectionMessage('Extracting 3D objects from script...');

      const detectionResult = await avatarTo3dService.detect3DObjects(
        chapterId,
        topicId,
        language,
        explanationScript
      );

      setDetectionProgress(60);

      if (!detectionResult.success) {
        throw new Error(detectionResult.error || 'Detection failed');
      }

      if (detectionResult.assets.length === 0) {
        setDetectionProgress(100);
        setDetectionMessage('No 3D objects detected in the script');
        toast.info('No 3D objects were found in the script. You can add them manually using the "Add Manually" button.');
        setDetecting(false);
        return;
      }

      // Step 2: Saving detected assets
      setDetectionProgress(80);
      setDetectionMessage(`Saving ${detectionResult.assets.length} detected object(s)...`);

      const savedIds = await avatarTo3dService.saveDetectedAssets(detectionResult.assets);

      setDetectionProgress(100);
      setDetectionMessage(`Successfully detected ${savedIds.length} 3D object(s)!`);

      // Reload assets
      const updatedAssets = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
      setAssets(updatedAssets);
      setNewlyDetectedAssets(detectionResult.assets.map((asset, idx) => ({
        ...asset,
        id: savedIds[idx]
      })));
      setShowDetectionResults(true);

      toast.success(`Detected ${savedIds.length} 3D object(s) from avatar script`);
    } catch (error) {
      console.error('Error detecting 3D objects:', error);
      const errorMessage = error instanceof Error ? error.message : 'Detection failed';
      setDetectionMessage(`Error: ${errorMessage}`);
      toast.error(`Failed to detect 3D objects: ${errorMessage}. You can add objects manually using the "Add Manually" button.`);
    } finally {
      setDetecting(false);
      setTimeout(() => {
        setDetectionProgress(0);
        setDetectionMessage('');
      }, 3000);
    }
  };

  const handleApproveAsset = async (assetId: string, approve: boolean) => {
    if (!canEdit) {
      toast.error('Only admins can approve assets');
      return;
    }

    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    const asset = assets.find(a => a.id === assetId);
    if (!asset) {
      toast.error('Asset not found');
      return;
    }

    setUpdatingApproval(assetId);
    try {
      if (approve && !asset.meshy_asset_id && asset.prompt) {
        // Use same strategy as "Add manually": create new asset with auto-approval, then generate
        // This avoids "Invalid input provided" from updateDoc on detected assets (Firestore validation)
        let newAssetId: string;
        try {
          await avatarTo3dService.deleteAsset(assetId);
          newAssetId = await avatarTo3dService.createManualAsset(
            chapterId,
            topicId,
            language,
            asset.prompt.trim(),
            asset.source_script || undefined,
            user.uid
          );
        } catch (deleteErr) {
          // Associate may not have delete permission - fall back to updateApprovalStatus
          await avatarTo3dService.updateApprovalStatus(assetId, true, user.uid);
          newAssetId = assetId;
          setAssets(prev =>
            prev.map(a =>
              a.id === assetId
                ? { ...a, approval_status: true, status: 'generating' as const }
                : a
            )
          );
          if (selectedAsset?.id === assetId) {
            setSelectedAsset(prev => prev ? { ...prev, approval_status: true, status: 'generating' } : null);
          }
        }

        const updatedAssets = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
        setAssets(updatedAssets);

        const newAsset = updatedAssets.find(a => a.id === newAssetId);
        if (newAsset) {
          setSelectedAsset(newAsset);
          setNewlyDetectedAssets(prev => prev.filter(a => a.id !== assetId));
          toast.success('Asset approved. Starting 3D generation...');
          await handleGenerate3DAsset(newAssetId, newAsset);
        } else {
          toast.success('Asset approved and generation started');
        }
      } else if (!approve) {
        await avatarTo3dService.updateApprovalStatus(assetId, false, user.uid);
        setAssets(prev =>
          prev.map(a =>
            a.id === assetId ? { ...a, approval_status: false, approved_at: null, approved_by: null } : a
          )
        );
        if (selectedAsset?.id === assetId) {
          setSelectedAsset(prev => prev ? { ...prev, approval_status: false } : null);
        }
        toast.success('Asset unapproved');
      } else {
        toast.success('Asset already has generated 3D model');
      }
    } catch (error) {
      console.error('Error updating approval status:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingApproval(null);
    }
  };

  const handleGenerate3DAsset = async (assetId: string, asset: AvatarTo3dAsset) => {
    if (!asset.prompt || !chapterId || !topicId || !user?.uid) {
      toast.error('Missing required information for generation');
      return;
    }

    setGeneratingAssetId(assetId);
    setGenerationProgress(prev => ({
      ...prev,
      [assetId]: {
        stage: 'generating',
        progress: 0,
        message: 'Starting generation...'
      }
    }));

    try {
      // Update status to generating
      const assetRef = doc(db, 'avatar_to_3d_assets', assetId);
      await updateDoc(assetRef, {
        status: 'generating',
        updated_at: serverTimestamp(),
      });

      // Generate 3D asset using the same service as Text-to-3D
      let generatedMeshyAssetId: string | undefined;
      const result = await textTo3dGenerationService.generateFromApprovedAsset(
        {
          textTo3dAssetId: assetId,
          prompt: asset.prompt,
          chapterId,
          topicId,
          userId: user.uid,
          artStyle: 'realistic',
          aiModel: 'meshy-4',
          collectionName: 'avatar_to_3d_assets' // Use avatar_to_3d_assets collection
        },
        (progress) => {
          setGenerationProgress(prev => ({
            ...prev,
            [assetId]: progress
          }));

          // Update asset status in Firestore
          const updateData: any = {
            status: progress.stage === 'completed' ? 'ready' : 
                    progress.stage === 'failed' ? 'failed' : 'generating',
            generation_progress: progress.progress,
            generation_message: progress.message,
            updated_at: serverTimestamp(),
          };
          
          // Only include error if it exists (not undefined)
          if (progress.error !== undefined) {
            updateData.generation_error = progress.error;
          }
          
          updateDoc(assetRef, updateData).catch(err => console.error('Error updating generation progress:', err));
        }
      );

      // Store the meshy asset ID if generation was successful
      if (result.success && result.meshyAssetId) {
        generatedMeshyAssetId = result.meshyAssetId;
        
        // Update Firestore with the meshy asset ID
        await updateDoc(assetRef, {
          meshy_asset_id: result.meshyAssetId,
          status: 'ready',
          updated_at: serverTimestamp(),
        }).catch(err => console.error('Error updating meshy asset ID:', err));
      }

      if (result.success && result.meshyAssetId) {
        // Update local state
        setAssets(prev =>
          prev.map(a =>
            a.id === assetId
              ? { 
                  ...a, 
                  status: 'ready',
                  meshy_asset_id: result.meshyAssetId!,
                  generation_progress: 100,
                  generation_message: 'Asset generated and ready!'
                }
              : a
          )
        );

        if (selectedAsset?.id === assetId) {
          setSelectedAsset(prev => prev ? {
            ...prev,
            status: 'ready',
            meshy_asset_id: result.meshyAssetId!,
            generation_progress: 100,
            generation_message: 'Asset generated and ready!'
          } : null);
        }

        toast.success('3D asset generated successfully! It is now available in the 3D Assets section.');
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error generating 3D asset:', error);

      // Update status to failed
      const assetRef = doc(db, 'avatar_to_3d_assets', assetId);
      await updateDoc(assetRef, {
        status: 'failed',
        generation_error: errorMessage,
        updated_at: serverTimestamp(),
      }).catch(err => console.error('Error updating failed status:', err));

      // Update local state
      setAssets(prev =>
        prev.map(a =>
          a.id === assetId
            ? { 
                ...a, 
                status: 'failed',
                generation_error: errorMessage
              }
            : a
        )
      );

      if (selectedAsset?.id === assetId) {
        setSelectedAsset(prev => prev ? {
          ...prev,
          status: 'failed',
          generation_error: errorMessage
        } : null);
      }

      toast.error(`Failed to generate 3D asset: ${errorMessage}`);
    } finally {
      setGeneratingAssetId(null);
    }
  };

  const handleRetryGeneration = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      await handleGenerate3DAsset(assetId, asset);
    }
  };

  const handleAddManualAsset = async () => {
    if (!manualPrompt || !manualPrompt.trim()) {
      toast.error('Please enter a 3D object prompt');
      return;
    }

    if (!canEdit) {
      toast.error('Only admins can add 3D objects');
      return;
    }

    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    setAddingManual(true);
    try {
      // Step 1: Create asset with auto-approval (status: 'generating')
      // This automatically approves and sets status to 'generating' so Meshy can process it
      const assetId = await avatarTo3dService.createManualAsset(
        chapterId,
        topicId,
        language,
        manualPrompt.trim(),
        explanationScript || undefined,
        user.uid
      );

      // Step 2: Reload assets to get the newly created asset
      const updatedAssets = await avatarTo3dService.getAssetsForTopic(chapterId, topicId, language);
      setAssets(updatedAssets);
      
      // Step 3: Select the newly added asset
      const newAsset = updatedAssets.find(a => a.id === assetId);
      if (newAsset) {
        setSelectedAsset(newAsset);
        
        // Step 4: Automatically trigger Meshy 3D generation (with textures)
        // This will:
        // - Generate 3D model using Meshy API
        // - Download GLB, FBX, USDZ files with textures
        // - Upload to Firebase Storage
        // - Create meshy_asset document
        // - Link to topic (makes it available in 3D Assets section)
        if (newAsset.approval_status && !newAsset.meshy_asset_id) {
          toast.info('Starting 3D generation with Meshy (this may take a few minutes)...');
          await handleGenerate3DAsset(assetId, newAsset);
        } else if (newAsset.meshy_asset_id) {
          toast.success('3D asset already generated!');
        }
      }

      // Reset form
      setManualPrompt('');
      setShowManualEntry(false);
    } catch (error: any) {
      console.error('Error adding manual asset:', error);
      
      // Check for Firestore permission errors
      if (error?.code === 'permission-denied' || 
          error?.message?.includes('permission') || 
          error?.message?.includes('Permission') ||
          error?.code === 7) {
        toast.error('Permission denied. Staff (Admin, Super Admin, or Associate) role required.');
        console.error('Permission error details:', {
          code: error?.code,
          message: error?.message,
          userId: user?.uid,
          email: user?.email
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to add 3D object';
        toast.error(`Failed to add 3D object: ${errorMessage}`);
      }
    } finally {
      setAddingManual(false);
    }
  };

  const getAssetModelUrl = (asset: AvatarTo3dAsset, format: 'glb' | 'fbx' | 'usdz'): string | null => {
    if (asset.model_urls?.[format]) {
      return asset.model_urls[format];
    }
    if (format === 'glb' && asset.glb_url) return asset.glb_url;
    if (format === 'fbx' && asset.fbx_url) return asset.fbx_url;
    if (format === 'usdz' && asset.usdz_url) return asset.usdz_url;
    return null;
  };

  const filteredAssets = assets.filter(asset => {
    if (filterStatus === 'approved') return asset.approval_status === true;
    if (filterStatus === 'pending') return asset.approval_status !== true;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading script-to-3D data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Script-to-3D Conversion</h2>
            <p className="text-xs text-slate-400">
              {assets.length} object{assets.length !== 1 ? 's' : ''} • {assets.filter(a => a.approval_status === true).length} approved
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'approved' | 'pending')}
            className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="all">All Assets</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Approval</option>
          </select>
        </div>
      </div>

      {/* Detection Section */}
      <div className="mb-6 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-400" />
              Detect 3D Objects from Script
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Analyze the avatar explanation script to automatically detect 3D objects that can be converted to 3D assets.
            </p>
            
            {/* Script Preview */}
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1 block">Avatar Explanation Script</label>
              <div className="relative">
                <textarea
                  value={explanationScript}
                  onChange={(e) => setExplanationScript(e.target.value)}
                  placeholder="Paste or type the avatar explanation script here..."
                  className="w-full h-32 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  disabled={!canEdit || detecting}
                />
                {explanationScript && (
                  <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                    {explanationScript.split(/\s+/).filter(Boolean).length} words
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detection Progress */}
        {detecting && (
          <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-400">{detectionMessage}</span>
              <span className="text-xs text-purple-300">{detectionProgress}%</span>
            </div>
            <div className="w-full bg-slate-900/50 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${detectionProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Detection Results */}
        {showDetectionResults && newlyDetectedAssets.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">
                Detected {newlyDetectedAssets.length} 3D object(s)
              </span>
            </div>
            <div className="space-y-1">
              {newlyDetectedAssets.map((asset, idx) => (
                <div key={idx} className="text-xs text-emerald-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    {idx + 1}
                  </span>
                  <span>{asset.prompt}</span>
                  {asset.confidence && (
                    <span className="text-slate-400">({Math.round(asset.confidence * 100)}% confidence)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleDetectObjects}
            disabled={!canEdit || detecting || !explanationScript.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            disabled={!canEdit}
            className="px-4 py-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4" />
            <span>{showManualEntry ? 'Cancel' : 'Add Manually'}</span>
          </button>
        </div>

        {/* Manual Entry Form */}
        {showManualEntry && (
          <div className="mt-4 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              Manually Add 3D Object
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Enter a 3D object prompt that you want to convert to a 3D asset.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">3D Object Prompt</label>
                <input
                  type="text"
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  placeholder="e.g., A detailed wooden table, A vintage red car, A crystal vase"
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  disabled={addingManual}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !addingManual && manualPrompt.trim()) {
                      handleAddManualAsset();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleAddManualAsset}
                disabled={!canEdit || addingManual || !manualPrompt.trim()}
                className="w-full px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addingManual ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Add 3D Object</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assets List */}
      {filteredAssets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Box className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No 3D objects found</p>
            <p className="text-xs text-slate-500 mt-1">
              {filterStatus !== 'all' 
                ? `No ${filterStatus} assets` 
                : 'Click "Detect Objects" to analyze the script or "Add Manually" to enter a 3D object prompt'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset List */}
          <div className="lg:col-span-1 space-y-3 overflow-y-auto">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedAsset?.id === asset.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                    : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {asset.approval_status === true ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-white truncate">
                        {asset.prompt || `Asset ${asset.id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className={`px-2 py-0.5 rounded ${
                        asset.approval_status === true
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {asset.approval_status === true ? 'Approved' : 'Pending'}
                      </span>
                      {asset.status && (
                        <span className={`px-2 py-0.5 rounded ${
                          asset.status === 'ready' || asset.status === 'uploaded'
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : asset.status === 'generating'
                            ? 'bg-blue-500/10 text-blue-400'
                            : asset.status === 'failed'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}>
                          {asset.status === 'ready' ? 'Ready' :
                           asset.status === 'uploaded' ? 'Uploaded' :
                           asset.status === 'generating' ? 'Generating...' :
                           asset.status === 'failed' ? 'Failed' :
                           asset.status}
                        </span>
                      )}
                      {generatingAssetId === asset.id && generationProgress[asset.id] && (
                        <span className="text-xs text-blue-400">
                          {Math.round(generationProgress[asset.id].progress)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Asset Details */}
          {selectedAsset && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {selectedAsset.prompt || 'Detected 3D Object'}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAsset.approval_status === true ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg text-amber-400 bg-amber-500/10 border border-amber-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Approval
                        </span>
                      )}
                      {selectedAsset.status && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border ${
                          selectedAsset.status === 'ready' || selectedAsset.status === 'uploaded'
                            ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                            : selectedAsset.status === 'generating'
                            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                            : selectedAsset.status === 'failed'
                            ? 'text-red-400 bg-red-500/10 border-red-500/20'
                            : 'text-slate-300 bg-slate-700/50 border-slate-600/30'
                        }`}>
                          {selectedAsset.status === 'generating' && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          {selectedAsset.status === 'failed' && (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          {selectedAsset.status === 'ready' && (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {selectedAsset.status === 'ready' ? 'Ready' :
                           selectedAsset.status === 'uploaded' ? 'Uploaded' :
                           selectedAsset.status === 'generating' ? 'Generating...' :
                           selectedAsset.status === 'failed' ? 'Failed' :
                           selectedAsset.status}
                          {selectedAsset.status === 'generating' && generationProgress[selectedAsset.id] && (
                            <span className="ml-1">({Math.round(generationProgress[selectedAsset.id].progress)}%)</span>
                          )}
                        </span>
                      )}
                      {selectedAsset.status === 'failed' && canEdit && (
                        <button
                          onClick={() => handleRetryGeneration(selectedAsset.id)}
                          disabled={generatingAssetId === selectedAsset.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                        >
                          {generatingAssetId === selectedAsset.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleApproveAsset(selectedAsset.id, !selectedAsset.approval_status)}
                      disabled={updatingApproval === selectedAsset.id}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedAsset.approval_status === true
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                      } disabled:opacity-50`}
                    >
                      {updatingApproval === selectedAsset.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : selectedAsset.approval_status === true ? (
                        'Unapprove'
                      ) : (
                        'Approve'
                      )}
                    </button>
                  )}
                </div>

                {/* Generation Progress */}
                {selectedAsset.status === 'generating' && generationProgress[selectedAsset.id] && (
                  <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-400">Generation Progress</span>
                      <span className="text-xs text-blue-300">{Math.round(generationProgress[selectedAsset.id].progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-900/50 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${generationProgress[selectedAsset.id].progress}%` }}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-blue-300 font-medium">{generationProgress[selectedAsset.id].message}</p>
                      
                      {/* Step indicators */}
                      <div className="flex items-center gap-2 text-xs">
                        <div className={`flex items-center gap-1 ${
                          generationProgress[selectedAsset.id].stage === 'generating' || 
                          generationProgress[selectedAsset.id].stage === 'downloading' ||
                          generationProgress[selectedAsset.id].stage === 'uploading' ||
                          generationProgress[selectedAsset.id].stage === 'linking' ||
                          generationProgress[selectedAsset.id].stage === 'completed'
                            ? 'text-blue-400' : 'text-slate-500'
                        }`}>
                          {generationProgress[selectedAsset.id].stage === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          <span>Generating 3D Model</span>
                        </div>
                        
                        {generationProgress[selectedAsset.id].stage !== 'generating' && (
                          <>
                            <span className="text-slate-600">→</span>
                            <div className={`flex items-center gap-1 ${
                              generationProgress[selectedAsset.id].stage === 'downloading' ||
                              generationProgress[selectedAsset.id].stage === 'uploading' ||
                              generationProgress[selectedAsset.id].stage === 'linking' ||
                              generationProgress[selectedAsset.id].stage === 'completed'
                                ? 'text-blue-400' : 'text-slate-500'
                            }`}>
                              {generationProgress[selectedAsset.id].stage === 'completed' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : generationProgress[selectedAsset.id].stage === 'downloading' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>Downloading Files</span>
                            </div>
                          </>
                        )}
                        
                        {(generationProgress[selectedAsset.id].stage === 'uploading' ||
                          generationProgress[selectedAsset.id].stage === 'linking' ||
                          generationProgress[selectedAsset.id].stage === 'completed') && (
                          <>
                            <span className="text-slate-600">→</span>
                            <div className={`flex items-center gap-1 ${
                              generationProgress[selectedAsset.id].stage === 'uploading' ||
                              generationProgress[selectedAsset.id].stage === 'linking' ||
                              generationProgress[selectedAsset.id].stage === 'completed'
                                ? 'text-blue-400' : 'text-slate-500'
                            }`}>
                              {generationProgress[selectedAsset.id].stage === 'completed' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : generationProgress[selectedAsset.id].stage === 'uploading' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>Uploading to Storage</span>
                            </div>
                          </>
                        )}
                        
                        {(generationProgress[selectedAsset.id].stage === 'linking' ||
                          generationProgress[selectedAsset.id].stage === 'completed') && (
                          <>
                            <span className="text-slate-600">→</span>
                            <div className={`flex items-center gap-1 ${
                              generationProgress[selectedAsset.id].stage === 'completed'
                                ? 'text-cyan-400' : 'text-blue-400'
                            }`}>
                              {generationProgress[selectedAsset.id].stage === 'completed' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              <span>Linking to Lesson</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Generation Error */}
                {selectedAsset.status === 'failed' && selectedAsset.generation_error && (
                  <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">Generation Failed</span>
                    </div>
                    <p className="text-xs text-red-300 mb-3">{selectedAsset.generation_error}</p>
                    {canEdit && (
                      <button
                        onClick={() => handleRetryGeneration(selectedAsset.id)}
                        disabled={generatingAssetId === selectedAsset.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
                      >
                        {generatingAssetId === selectedAsset.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Retry Generation
                      </button>
                    )}
                  </div>
                )}

                {/* Success Message */}
                {selectedAsset.status === 'ready' && selectedAsset.meshy_asset_id && (
                  <div className="mb-4 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium text-cyan-400">Asset Generated Successfully</span>
                    </div>
                    <p className="text-xs text-cyan-300">
                      The 3D asset is now available in the <strong>3D Assets</strong> section of this lesson.
                    </p>
                    {selectedAsset.meshy_asset_id && (
                      <p className="text-xs text-slate-400 mt-2 font-mono">
                        Meshy Asset ID: {selectedAsset.meshy_asset_id}
                      </p>
                    )}
                  </div>
                )}

                {/* Asset Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Detected Prompt</p>
                    <p className="text-sm text-white font-medium">{selectedAsset.prompt}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Confidence</p>
                    <p className="text-sm text-white">
                      {selectedAsset.confidence ? `${Math.round(selectedAsset.confidence * 100)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Source</p>
                    <p className="text-sm text-white capitalize">{selectedAsset.source_script_type}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Language</p>
                    <p className="text-sm text-white uppercase">{selectedAsset.language}</p>
                  </div>
                </div>

                {/* Source Script Preview */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Source Script (Excerpt)</p>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-sm text-slate-300 italic line-clamp-3">
                      {selectedAsset.source_script.substring(0, 200)}
                      {selectedAsset.source_script.length > 200 ? '...' : ''}
                    </p>
                  </div>
                </div>

                {/* Model URLs */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">3D Model Files</p>
                  <div className="space-y-2">
                    {getAssetModelUrl(selectedAsset, 'glb') && (
                      <a
                        href={getAssetModelUrl(selectedAsset, 'glb')!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm text-white">GLB Model</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
                      </a>
                    )}
                    {getAssetModelUrl(selectedAsset, 'fbx') && (
                      <a
                        href={getAssetModelUrl(selectedAsset, 'fbx')!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-violet-400" />
                          <span className="text-sm text-white">FBX Model</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-violet-400" />
                      </a>
                    )}
                    {getAssetModelUrl(selectedAsset, 'usdz') && (
                      <a
                        href={getAssetModelUrl(selectedAsset, 'usdz')!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-indigo-400" />
                          <span className="text-sm text-white">USDZ Model</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
                      </a>
                    )}
                    {!getAssetModelUrl(selectedAsset, 'glb') &&
                      !getAssetModelUrl(selectedAsset, 'fbx') &&
                      !getAssetModelUrl(selectedAsset, 'usdz') && (
                        <p className="text-sm text-slate-500 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                          No model URLs available {selectedAsset.status === 'generating' ? '(generating...)' : ''}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
