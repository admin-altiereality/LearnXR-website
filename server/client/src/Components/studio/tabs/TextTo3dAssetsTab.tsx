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
  status?: string;
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
      await updateDoc(assetRef, {
        approval_status: approve,
        approved_at: approve ? serverTimestamp() : null,
        approved_by: approve ? user?.email : null,
        updated_at: serverTimestamp(),
      });

      // Update local state
      setAssets(prev =>
        prev.map(asset =>
          asset.id === assetId
            ? { ...asset, approval_status: approve, approved_at: approve ? new Date().toISOString() : null, approved_by: approve ? user?.email : null }
            : asset
        )
      );

      if (selectedAsset?.id === assetId) {
        setSelectedAsset(prev => (prev ? { ...prev, approval_status: approve } : null));
      }

      toast.success(`Asset ${approve ? 'approved' : 'unapproved'} successfully`);
    } catch (error) {
      console.error('Error updating approval status:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingApproval(null);
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
                        <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                          {asset.status}
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
                    <div className="flex items-center gap-2">
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
                        <span className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/30">
                          {selectedAsset.status}
                        </span>
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
