/**
 * AssetsTab - Professional 3D Asset Management
 * 
 * Features:
 * - Grid view with thumbnails
 * - Add multiple assets
 * - Delete existing assets
 * - Replace assets
 * - 3D preview viewer
 * - Download links for all formats
 * - Permission-aware UI
 * - Optimistic updates
 * - Retry mechanisms
 * - Caching
 * 
 * Data Source: meshy_assets collection (NEW Firestore schema)
 * This component now fetches from the meshy_assets collection instead of legacy locations.
 */

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { toast } from 'react-toastify';
import { MeshyAsset } from '../../../types/curriculum';
import { useAuth } from '../../../contexts/AuthContext';
import { TextTo3DUnified } from './TextTo3DUnified';
import { AssetManager } from '../../../services/assets/assetManager';
import { usePermissions } from '../../../hooks/usePermissions';
import { PermissionGate } from '../../PermissionGate';
import { useAssetCache } from '../../../hooks/useAssetCache';
import { useOptimisticUpdate } from '../../../hooks/useOptimisticUpdate';
import { ErrorDisplay } from '../../ErrorDisplay';
import { ErrorBoundary } from '../../ErrorBoundary';
import { AssetGridSkeleton, AssetListSkeleton, FullPageLoading, EmptyState } from '../../LoadingStates';
import { ProgressIndicator } from '../../ProgressIndicator';
import { validateFile } from '../../../services/assets/validators';
import { classifyError, logError } from '../../../utils/errorHandler';
import type { MeshyAssetExtended } from '../../../types/assets';
import {
  Box,
  ExternalLink,
  Loader2,
  Download,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Package,
  Upload,
  Trash2,
  X,
  FileUp,
  Check,
  Plus,
  MoreVertical,
  Grid3X3,
  List,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AssetsTabProps {
  chapterId: string;
  topicId: string;
  bundle?: any;
  language?: string;
}

// Lazy load the 3D viewer
const Lazy3DViewer = lazy(() => import('../../AssetViewerWithSkybox').then(m => ({ default: m.AssetViewerWithSkybox })));

export const AssetsTab = ({ chapterId, topicId, bundle, language = 'en' }: AssetsTabProps) => {
  const { user, profile } = useAuth();
  
  // Permissions
  const permissions = usePermissions('meshy_assets');
  
  // Cache
  const { getCached, setCached, invalidate } = useAssetCache(chapterId, topicId, language);
  
  // Using MeshyAssetExtended type
  const [assets, setAssets] = useState<MeshyAssetExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedAsset, setSelectedAsset] = useState<MeshyAssetExtended | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [assetNames, setAssetNames] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Delete state
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<MeshyAssetExtended | null>(null);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ asset: MeshyAssetExtended; x: number; y: number } | null>(null);
  
  // Text-to-3D section
  const [showTextTo3D, setShowTextTo3D] = useState(false);

  // Load assets with caching and error handling
  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cached = getCached();
      if (cached && cached.length > 0) {
        setAssets(cached);
        if (cached.length > 0 && !selectedAsset) {
          setSelectedAsset(cached[0]);
        }
        setLoading(false);
      }

      // Fetch from service layer
      const result = await AssetManager.queryAssets({
        chapterId,
        topicId,
        language,
        includeInvalid: false,
      });
      
      // Update cache
      setCached(result.assets);
      
      setAssets(result.assets);
      if (result.assets.length > 0 && !selectedAsset) {
        setSelectedAsset(result.assets[0]);
      }
      
      if (result.invalid > 0) {
        toast.warn(`${result.invalid} asset(s) skipped - missing or invalid GLB URL`);
      }
    } catch (error: any) {
      logError(error, 'AssetsTab.loadAssets');
      setError(error);
      const classification = classifyError(error);
      toast.error(classification.userMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chapterId && topicId) {
      loadAssets();
    }
  }, [chapterId, topicId]);
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleRefresh = async () => {
    invalidate(); // Clear cache
    await loadAssets();
  };

  // File handling
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddFiles(files);
  };

  const validateAndAddFiles = async (files: File[]) => {
    const validFiles: File[] = [];
    const newNames: { [key: string]: string } = { ...assetNames };
    
    for (const file of files) {
      // Use service layer validator
      const validation = await validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error || `${file.name}: Invalid file`);
        continue;
      }
      
      validFiles.push(file);
      newNames[file.name] = file.name.replace(/\.[^/.]+$/, '');
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setAssetNames(newNames);
  };
  
  const removeFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    const newNames = { ...assetNames };
    delete newNames[fileName];
    setAssetNames(newNames);
  };

  // Note: Optimistic updates handled inline in handleUploadAll and handleDeleteAsset

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const totalFiles = selectedFiles.length;
    let uploadedCount = 0;
    const newAssets: MeshyAssetExtended[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const name = assetNames[file.name] || file.name.replace(/\.[^/.]+$/, '');

        // Use AssetManager for upload
        const result = await AssetManager.uploadAsset({
          file,
          name,
          chapterId,
          topicId,
          language,
          userId: user.uid,
          onProgress: (progress) => {
            const fileProgress = ((i / totalFiles) * 100) + (progress / totalFiles);
            setUploadProgress(fileProgress);
          },
        });

        if (result.success && result.asset) {
          newAssets.push(result.asset);
          uploadedCount++;

          // Optimistically add to list
          setAssets(prev => [...prev, result.asset!]);
        } else {
          toast.error(`${file.name}: ${result.error || 'Upload failed'}`);
        }
      }

      // Invalidate cache and refresh
      invalidate();
      await loadAssets();

      if (uploadedCount > 0) {
        if (newAssets.length > 0) {
          setSelectedAsset(newAssets[0]);
        }
        toast.success(`${uploadedCount} asset${uploadedCount > 1 ? 's' : ''} uploaded successfully!`);
      }

      // Reset and close
      setShowUploadModal(false);
      setSelectedFiles([]);
      setAssetNames({});
      setUploadProgress(0);
    } catch (error: any) {
      logError(error, 'AssetsTab.handleUploadAll');
      setUploadError(error);
      const classification = classifyError(error);
      toast.error(classification.userMessage);
    } finally {
      setUploading(false);
    }
  };
  
  // Delete asset with optimistic update
  const handleDeleteAsset = async () => {
    if (!assetToDelete || !user?.uid) return;

    setDeletingAssetId(assetToDelete.id);

    // Optimistically remove from list
    const previousAssets = assets;
    setAssets(prev => prev.filter(a => a.id !== assetToDelete.id));

    // If this was selected, select another
    if (selectedAsset?.id === assetToDelete.id) {
      const remaining = assets.filter(a => a.id !== assetToDelete.id);
      setSelectedAsset(remaining[0] || null);
    }

    try {
      // Use AssetManager for delete
      const result = await AssetManager.deleteAsset(
        {
          assetId: assetToDelete.id,
          chapterId,
          topicId,
          userId: user.uid,
        },
        profile,
        {
          isCore: assetToDelete.isCore,
          assetTier: assetToDelete.assetTier,
          glb_url: assetToDelete.glb_url,
        }
      );

      if (result.success) {
        // Invalidate cache
        invalidate();
        toast.success('Asset deleted');
      } else {
        // Rollback on error
        setAssets(previousAssets);
        toast.error(result.error || 'Failed to delete asset');
      }
    } catch (error: any) {
      // Rollback on error
      setAssets(previousAssets);
      logError(error, 'AssetsTab.handleDeleteAsset');
      const classification = classifyError(error);
      toast.error(classification.userMessage);
    } finally {
      setDeletingAssetId(null);
      setShowDeleteConfirm(false);
      setAssetToDelete(null);
    }
  };
  
  const openDeleteConfirm = (asset: MeshyAssetExtended) => {
    setAssetToDelete(asset);
    setShowDeleteConfirm(true);
    setContextMenu(null);
  };
  
  const handleContextMenu = (e: React.MouseEvent, asset: MeshyAssetExtended) => {
    // Only show context menu if user can perform actions
    if (!permissions.canUpdate && !permissions.canDelete(asset)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ asset, x: e.clientX, y: e.clientY });
  };

  if (loading) {
    return <FullPageLoading message="Loading 3D assets..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorDisplay
          error={error}
          onRetry={handleRefresh}
          onDismiss={() => setError(null)}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-full flex flex-col bg-[#0a0f1a]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/30">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            3D Assets
            <span className="ml-2 px-2 py-0.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full border border-cyan-500/20">
              {assets.length}
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your 3D models and assets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-800/50 rounded-lg border border-slate-700/50 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <PermissionGate
            resource="meshy_assets"
            operation="create"
            showMessage={false}
          >
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-white bg-gradient-to-r from-cyan-500 to-blue-600
                       hover:from-cyan-400 hover:to-blue-500
                       rounded-lg shadow-lg shadow-cyan-500/20
                       transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Add Assets
            </button>
          </PermissionGate>
          <button
            onClick={handleRefresh}
            className="p-2 text-slate-400 hover:text-white
                     bg-slate-800/50 hover:bg-slate-700/50
                     rounded-lg border border-slate-600/50
                     transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Text-to-3D Unified Section */}
      <div className="border-b border-slate-700/50">
        <button
          onClick={() => setShowTextTo3D(!showTextTo3D)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Generate 3D Assets (Text-to-3D & Script-to-3D)</span>
          </div>
          {showTextTo3D ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {showTextTo3D && (
          <div className="px-4 py-4 bg-slate-900/50">
            <TextTo3DUnified
              chapterId={chapterId}
              topicId={topicId}
              language={language}
              bundle={bundle}
              onAssetGenerated={handleRefresh}
            />
          </div>
        )}
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<Box className="w-12 h-12 text-slate-500" />}
          title="No 3D Assets Yet"
          message="Upload your 3D models (GLB, GLTF, FBX, OBJ) to include them in your learning experience."
          action={
            <PermissionGate
              resource="meshy_assets"
              operation="create"
              showMessage={false}
            >
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-8 py-3.5 text-sm font-semibold
                         text-white bg-gradient-to-r from-cyan-500 to-blue-600
                         hover:from-cyan-400 hover:to-blue-500
                         rounded-xl shadow-lg shadow-cyan-500/25
                         transition-all duration-200 hover:-translate-y-0.5"
              >
                <Upload className="w-5 h-5" />
                Upload Your First Asset
              </button>
            </PermissionGate>
          }
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Asset Grid/List - Left */}
          <div className={`${selectedAsset && showViewer ? 'w-80' : 'flex-1'} border-r border-slate-700/50 overflow-y-auto p-4 bg-slate-900/30 transition-all`}>
            {loading ? (
              viewMode === 'grid' ? (
                <AssetGridSkeleton count={6} />
              ) : (
                <AssetListSkeleton count={5} />
              )
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => {
                      setSelectedAsset(asset);
                      setViewerError(null);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, asset)}
                    className={`relative p-3 rounded-xl border transition-all duration-200 cursor-pointer group
                              ${selectedAsset?.id === asset.id
                                ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-800/50'
                              }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-slate-900/50 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
                      {asset.thumbnail_url ? (
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Box className="w-10 h-10 text-slate-600" />
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(asset);
                            setShowViewer(true);
                          }}
                          className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/30"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <PermissionGate
                          resource="meshy_assets"
                          operation="delete"
                          assetData={asset}
                          showMessage={false}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteConfirm(asset);
                            }}
                            className="p-2 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30"
                            title={asset.isCore || asset.assetTier === 'core' ? 'Core asset - Superadmin only' : 'Delete asset'}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </PermissionGate>
                        {!permissions.canDelete(asset) && (asset.isCore || asset.assetTier === 'core') && (
                          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400" title="Core asset - Cannot delete (Superadmin only)">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Info */}
                    <p className="text-xs text-white font-medium truncate">{asset.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] ${asset.status === 'complete' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {asset.status === 'complete' ? '✓ Ready' : asset.status}
                      </span>
                      <button
                        onClick={(e) => handleContextMenu(e, asset)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-all"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Deleting indicator */}
                    {deletingAssetId === asset.id && (
                      <div className="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* List View */
              <div className="space-y-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => {
                      setSelectedAsset(asset);
                      setViewerError(null);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, asset)}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 cursor-pointer group
                              ${selectedAsset?.id === asset.id
                                ? 'bg-cyan-500/10 border-cyan-500/30'
                                : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-800/50'
                              }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 bg-slate-900/50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {asset.thumbnail_url ? (
                        <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-7 h-7 text-slate-600" />
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{asset.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {asset.meshy_id ? `Meshy: ${asset.meshy_id.substring(0, 8)}...` : 'Manual Upload'}
                      </p>
                    </div>
                    
                    {/* Status & Actions */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-md ${asset.status === 'complete' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                        {asset.status === 'complete' ? 'Ready' : asset.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAsset(asset);
                          setShowViewer(true);
                        }}
                        className="p-2 text-slate-400 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <PermissionGate
                        resource="meshy_assets"
                        operation="delete"
                        assetData={asset}
                        showMessage={false}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(asset);
                          }}
                          className="p-2 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          title={asset.isCore || asset.assetTier === 'core' ? 'Core asset - Superadmin only' : 'Delete asset'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </PermissionGate>
                      {!permissions.canDelete(asset) && (asset.isCore || asset.assetTier === 'core') && (
                        <div className="p-2 opacity-0 group-hover:opacity-100 transition-all" title="Core asset - Cannot delete (Superadmin only)">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Deleting indicator */}
                    {deletingAssetId === asset.id && (
                      <div className="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asset Viewer / Details - Right */}
          {selectedAsset && (
            <div className={`flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
              {/* Viewer */}
              <div className="flex-1 relative bg-slate-900/50">
                {showViewer && selectedAsset.glb_url ? (
                  <Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                    </div>
                  }>
                    {viewerError ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-6">
                          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                          <p className="text-white font-medium">Failed to load 3D model</p>
                          <p className="text-sm text-slate-400 mt-1">{viewerError}</p>
                          <button
                            onClick={() => {
                              setViewerError(null);
                              setShowViewer(false);
                            }}
                            className="mt-4 px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                          >
                            Close Viewer
                          </button>
                        </div>
                      </div>
                    ) : (() => {
                      // SAFEGUARD: Ensure we're using glb_url, not thumbnail_url
                      const modelUrl = selectedAsset.glb_url;
                      const thumbnailUrl = selectedAsset.thumbnail_url;
                      
                      // Validate that we're not accidentally using thumbnail URL
                      if (thumbnailUrl && modelUrl === thumbnailUrl) {
                        console.error('❌ CRITICAL: glb_url matches thumbnail_url - this is wrong!');
                        console.error('   Asset ID:', selectedAsset.id);
                        console.error('   Asset Name:', selectedAsset.name);
                        console.error('   URL:', modelUrl.substring(0, 150));
                        return (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center p-6">
                              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                              <p className="text-white font-medium">Invalid Asset Configuration</p>
                              <p className="text-sm text-slate-400 mt-1">
                                The 3D model URL is incorrectly pointing to a thumbnail image. Please check the asset configuration.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      
                      // Additional validation: check if URL looks like an image
                      const urlLower = modelUrl.toLowerCase();
                      if (urlLower.includes('thumbnail') || urlLower.includes('preview') || 
                          urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png')) {
                        console.warn('⚠️ WARNING: glb_url may be pointing to an image file:', modelUrl.substring(0, 150));
                      }
                      
                      return (
                        <Lazy3DViewer
                          assetUrl={modelUrl}
                          skyboxImageUrl=""
                          className="w-full h-full"
                          autoRotate={true}
                          onError={(err) => setViewerError(err.message)}
                        />
                      );
                    })()}
                  </Suspense>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      {selectedAsset.thumbnail_url ? (
                        <img
                          src={selectedAsset.thumbnail_url}
                          alt={selectedAsset.name}
                          className="w-48 h-48 object-cover rounded-2xl mx-auto mb-6 border border-slate-700/50 shadow-2xl"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
                          <Box className="w-16 h-16 text-slate-600" />
                        </div>
                      )}
                      <p className="text-lg text-white font-medium mb-6">{selectedAsset.name}</p>
                      {selectedAsset.glb_url && (
                        <button
                          onClick={() => setShowViewer(true)}
                          className="flex items-center gap-2 px-8 py-3.5 mx-auto
                                   text-sm font-medium text-white
                                   bg-gradient-to-r from-cyan-500 to-blue-600
                                   hover:from-cyan-400 hover:to-blue-500
                                   rounded-xl shadow-lg shadow-cyan-500/25
                                   transition-all duration-200 hover:-translate-y-0.5"
                        >
                          <Eye className="w-5 h-5" />
                          View in 3D
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Viewer Controls */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {showViewer && (
                    <>
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm border border-white/10 text-white/80 transition-all"
                      >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => setShowViewer(false)}
                        className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm border border-white/10 text-white/80 transition-all"
                      >
                        <EyeOff className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Asset Details Panel */}
              <div className="p-5 border-t border-slate-700/50 bg-slate-800/30">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedAsset.name}</h3>
                    {selectedAsset.prompt && (
                      <p className="text-sm text-slate-400 mt-1 max-w-md line-clamp-2">
                        {selectedAsset.prompt}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg
                                   ${selectedAsset.status === 'complete'
                                     ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                     : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                   }`}>
                      {selectedAsset.status === 'complete' ? '✓ Ready' : selectedAsset.status}
                    </span>
                    <PermissionGate
                      resource="meshy_assets"
                      operation="delete"
                      assetData={selectedAsset}
                      showMessage={false}
                    >
                      <button
                        onClick={() => openDeleteConfirm(selectedAsset)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                                 text-red-400 bg-red-500/10 hover:bg-red-500/20
                                 rounded-lg border border-red-500/30
                                 transition-all duration-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </PermissionGate>
                    {!permissions.canDelete(selectedAsset) && (selectedAsset.isCore || selectedAsset.assetTier === 'core') && (
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                                   text-amber-400 bg-amber-500/10
                                   rounded-lg border border-amber-500/30"
                           title="Core asset - Only superadmin can delete">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Core Asset
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Links */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {selectedAsset.glb_url && (
                    <a
                      href={selectedAsset.glb_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                               text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20
                               rounded-lg border border-cyan-500/30
                               transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      GLB
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {selectedAsset.fbx_url && (
                    <a
                      href={selectedAsset.fbx_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                               text-violet-400 bg-violet-500/10 hover:bg-violet-500/20
                               rounded-lg border border-violet-500/30
                               transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      FBX
                    </a>
                  )}
                  {selectedAsset.usdz_url && (
                    <a
                      href={selectedAsset.usdz_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                               text-amber-400 bg-amber-500/10 hover:bg-amber-500/20
                               rounded-lg border border-amber-500/30
                               transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      USDZ
                    </a>
                  )}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700/30">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Asset ID</p>
                    <p className="text-xs text-slate-300 font-mono truncate">{selectedAsset.id}</p>
                  </div>
                  {selectedAsset.meshy_id && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Meshy ID</p>
                      <p className="text-xs text-slate-300 font-mono truncate">{selectedAsset.meshy_id}</p>
                    </div>
                  )}
                  {selectedAsset.created_at && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Created</p>
                      <p className="text-xs text-slate-300">
                        {new Date(selectedAsset.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-slate-900 rounded-xl border border-slate-700/50 shadow-2xl py-2 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setSelectedAsset(contextMenu.asset);
              setShowViewer(true);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-4 h-4" />
            View in 3D
          </button>
          {contextMenu.asset.glb_url && (
            <a
              href={contextMenu.asset.glb_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-slate-800 transition-colors"
              onClick={() => setContextMenu(null)}
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
          <div className="my-1 border-t border-slate-700/50" />
          <PermissionGate
            resource="meshy_assets"
            operation="delete"
            assetData={contextMenu.asset}
            showMessage={false}
          >
            <button
              onClick={() => openDeleteConfirm(contextMenu.asset)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </PermissionGate>
          {!permissions.canDelete(contextMenu.asset) && (
            <div className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Core Asset (Superadmin only)
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                Upload 3D Assets
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setAssetNames({});
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                          transition-all duration-200
                          ${dragActive 
                            ? 'border-cyan-500 bg-cyan-500/10' 
                            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
                          }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf,.fbx,.obj"
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                />
                
                <div className="w-16 h-16 rounded-xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                  <FileUp className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-white font-medium mb-1">
                  Drop your 3D models here
                </p>
                <p className="text-sm text-slate-400">
                  or click to browse (GLB, GLTF, FBX, OBJ • Max 100MB each)
                </p>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
                    >
                      <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Box className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={assetNames[file.name] || ''}
                          onChange={(e) => setAssetNames(prev => ({ ...prev, [file.name]: e.target.value }))}
                          placeholder="Asset name..."
                          className="w-full bg-transparent text-white text-sm font-medium outline-none placeholder:text-slate-500"
                        />
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.name.split('.').pop()?.toUpperCase()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(file.name)}
                        className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="mt-4">
                  <ProgressIndicator
                    progress={uploadProgress}
                    message={`Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`}
                    error={uploadError ? classifyError(uploadError).userMessage : undefined}
                  />
                </div>
              )}

              {/* Upload Error */}
              {uploadError && !uploading && (
                <div className="mt-4">
                  <ErrorDisplay
                    error={uploadError}
                    onRetry={handleUploadAll}
                    onDismiss={() => setUploadError(null)}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                    setAssetNames({});
                  }}
                  disabled={uploading}
                  className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white
                           bg-slate-800 hover:bg-slate-700 rounded-lg
                           transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadAll}
                  disabled={selectedFiles.length === 0 || uploading}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium
                           text-white bg-gradient-to-r from-cyan-500 to-blue-600
                           hover:from-cyan-400 hover:to-blue-500
                           rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && assetToDelete && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {assetToDelete.isCore || assetToDelete.assetTier === 'core' ? 'Delete Core Asset?' : 'Delete Asset?'}
              </h3>
              <p className="text-slate-400 mb-2">
                Are you sure you want to delete "{assetToDelete.name}"? This action cannot be undone.
              </p>
              {(assetToDelete.isCore || assetToDelete.assetTier === 'core') && (
                <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>This is a <strong>core asset</strong>. Deleting it may break lesson rendering.</span>
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setAssetToDelete(null);
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white
                           bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAsset}
                  disabled={deletingAssetId !== null}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium
                           text-white bg-red-600 hover:bg-red-500
                           rounded-lg transition-all disabled:opacity-50"
                >
                  {deletingAssetId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
};
