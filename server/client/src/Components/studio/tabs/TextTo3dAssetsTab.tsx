/**
 * TextTo3dAssetsTab - Text-to-3D Assets Management
 * 
 * Features:
 * - Display all text_to_3d_assets with all fields
 * - Show approval_status and allow admin/superadmin to approve
 * - Display prompt, model_urls, status, and other metadata
 * - Preview 3D models
 * - Filter by approval status
 * 
 * Data Source: text_to_3d_assets collection (via lesson bundle)
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import { canDeleteAsset, canEditLesson, isSuperadmin } from '../../../utils/rbac';
import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { textTo3dGenerationService } from '../../../services/textTo3dGenerationService';
import type { GenerationProgress } from '../../../services/textTo3dGenerationService';
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
} from 'lucide-react';

interface TextTo3dAssetsTabProps {
  chapterId: string;
  topicId: string;
  bundle?: any; // Lesson bundle containing textTo3dAssets
}

interface TextTo3dAsset {
  id: string;
  chapter_id?: string;
  topic_id?: string;
  prompt?: string;
  approval_status?: boolean;
  status?: 'pending' | 'approved' | 'generating' | 'uploaded' | 'ready' | 'failed';
  generation_progress?: number; // 0-100
  generation_message?: string;
  generation_error?: string;
  meshy_asset_id?: string; // ID of the generated meshy_asset
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
  // Core asset protection - prevents accidental deletion
  isCore?: boolean; // If true, only superadmin can delete
  assetTier?: 'core' | 'optional'; // Alternative to isCore
  [key: string]: any; // Allow other fields
}

export const TextTo3dAssetsTab = ({ chapterId, topicId, bundle }: TextTo3dAssetsTabProps) => {
  const { user, profile } = useAuth();
  const [assets, setAssets] = useState<TextTo3dAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<TextTo3dAsset | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ [assetId: string]: GenerationProgress }>({});

  const canEdit = canEditLesson(profile);
  const isSuperAdmin = isSuperadmin(profile);

  // Load assets from bundle or fetch directly
  useEffect(() => {
    const loadAssets = async () => {
      if (!chapterId || !topicId) return;

      setLoading(true);
      try {
        if (bundle?.textTo3dAssets && Array.isArray(bundle.textTo3dAssets)) {
          // Use bundle data if available
          setAssets(bundle.textTo3dAssets);
          console.log(`✅ Loaded ${bundle.textTo3dAssets.length} text_to_3d_assets from bundle`);
        } else {
          // Fallback: Fetch directly from Firestore
          const { getLessonBundle } = await import('../../../services/firestore/getLessonBundle');
          const bundleData = await getLessonBundle({
            chapterId,
            lang: 'en', // Default language
            topicId,
          });
          setAssets(bundleData.textTo3dAssets || []);
          console.log(`✅ Loaded ${bundleData.textTo3dAssets?.length || 0} text_to_3d_assets from bundle fetch`);
        }

        if (assets.length > 0 && !selectedAsset) {
          setSelectedAsset(assets[0]);
        }
      } catch (error) {
        console.error('Error loading text_to_3d_assets:', error);
        toast.error('Failed to load text-to-3D assets');
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [chapterId, topicId, bundle]);

  // Update assets when bundle changes
  useEffect(() => {
    if (bundle?.textTo3dAssets && Array.isArray(bundle.textTo3dAssets)) {
      setAssets(bundle.textTo3dAssets);
      if (bundle.textTo3dAssets.length > 0 && !selectedAsset) {
        setSelectedAsset(bundle.textTo3dAssets[0]);
      }
    }
  }, [bundle]);

  const handleApproveAsset = async (assetId: string, approve: boolean) => {
    if (!canEdit) {
      toast.error('Only admins can approve assets');
      return;
    }

    setUpdatingApproval(assetId);
    try {
      const assetRef = doc(db, 'text_to_3d_assets', assetId);
      const asset = assets.find(a => a.id === assetId);
      
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Update approval status
      await updateDoc(assetRef, {
        approval_status: approve,
        approved_at: approve ? serverTimestamp() : null,
        approved_by: approve ? user?.email : null,
        updated_at: serverTimestamp(),
        // If approving, set status to 'generating'
        ...(approve && !asset.meshy_asset_id ? { status: 'generating' } : {}),
      });

      // Update local state
      setAssets(prev =>
        prev.map(a =>
          a.id === assetId
            ? { 
                ...a, 
                approval_status: approve, 
                approved_at: approve ? new Date().toISOString() : null, 
                approved_by: approve ? user?.email : null,
                ...(approve && !a.meshy_asset_id ? { status: 'generating' } : {})
              }
            : a
        )
      );

      if (selectedAsset?.id === assetId) {
        setSelectedAsset(prev => prev ? { 
          ...prev, 
          approval_status: approve,
          ...(approve && !prev.meshy_asset_id ? { status: 'generating' } : {})
        } : null);
      }

      toast.success(`Asset ${approve ? 'approved' : 'unapproved'} successfully`);

      // If approving and no meshy_asset_id exists, trigger generation
      if (approve && !asset.meshy_asset_id && asset.prompt) {
        await handleGenerate3DAsset(assetId, asset);
      }
    } catch (error) {
      console.error('Error updating approval status:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingApproval(null);
    }
  };

  const handleGenerate3DAsset = async (assetId: string, asset: TextTo3dAsset) => {
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
      const assetRef = doc(db, 'text_to_3d_assets', assetId);
      await updateDoc(assetRef, {
        status: 'generating',
        updated_at: serverTimestamp(),
      });

      // Generate 3D asset
      let generatedMeshyAssetId: string | undefined;
      const result = await textTo3dGenerationService.generateFromApprovedAsset(
        {
          textTo3dAssetId: assetId,
          prompt: asset.prompt,
          chapterId,
          topicId,
          userId: user.uid,
          artStyle: 'realistic',
          aiModel: 'meshy-4'
        },
        (progress) => {
          setGenerationProgress(prev => ({
            ...prev,
            [assetId]: progress
          }));

          // Update asset status in Firestore
          // Only include fields that are not undefined (Firestore doesn't accept undefined)
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
      const assetRef = doc(db, 'text_to_3d_assets', assetId);
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

  const getAssetModelUrl = (asset: TextTo3dAsset, format: 'glb' | 'fbx' | 'usdz'): string | null => {
    // Check model_urls object first
    if (asset.model_urls?.[format]) {
      return asset.model_urls[format];
    }
    // Check direct URL fields
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
          <span className="text-sm text-slate-400">Loading text-to-3D assets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Text-to-3D Assets</h2>
            <p className="text-xs text-slate-400">
              {assets.length} total • {assets.filter(a => a.approval_status === true).length} approved
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
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

      {filteredAssets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Box className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No text-to-3D assets found</p>
            <p className="text-xs text-slate-500 mt-1">
              {filterStatus !== 'all' ? `No ${filterStatus} assets` : 'Assets will appear here when available'}
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
                        {asset.prompt || asset.name || `Asset ${asset.id.substring(0, 8)}`}
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
                      {selectedAsset.prompt || selectedAsset.name || 'Text-to-3D Asset'}
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

                {/* Asset Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Asset ID</p>
                    <p className="text-sm text-white font-mono">{selectedAsset.id}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Chapter ID</p>
                    <p className="text-sm text-white">{selectedAsset.chapter_id || chapterId}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Topic ID</p>
                    <p className="text-sm text-white">{selectedAsset.topic_id || topicId}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Created</p>
                    <p className="text-sm text-white">
                      {selectedAsset.created_at
                        ? new Date(selectedAsset.created_at?.toDate?.() || selectedAsset.created_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
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
                    <p className="text-xs text-blue-300">{generationProgress[selectedAsset.id].message}</p>
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

                {/* Prompt */}
                {selectedAsset.prompt && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Prompt</p>
                    <p className="text-sm text-white bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      {selectedAsset.prompt}
                    </p>
                  </div>
                )}

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
                          No model URLs available
                        </p>
                      )}
                  </div>
                </div>

                {/* Thumbnail */}
                {selectedAsset.thumbnail_url && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Thumbnail</p>
                    <img
                      src={selectedAsset.thumbnail_url}
                      alt="Asset thumbnail"
                      className="w-full h-48 object-cover rounded-lg border border-slate-700/50"
                    />
                  </div>
                )}

                {/* Additional Fields */}
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-2">Additional Metadata</p>
                  <div className="space-y-1 text-xs text-slate-400 font-mono">
                    {Object.entries(selectedAsset)
                      .filter(([key]) => !['id', 'prompt', 'chapter_id', 'topic_id', 'created_at', 'updated_at', 'model_urls', 'glb_url', 'fbx_url', 'usdz_url', 'thumbnail_url', 'approval_status', 'status', 'name'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-500">{key}:</span>
                          <span className="text-slate-300">{String(value).substring(0, 50)}</span>
                        </div>
                      ))}
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
