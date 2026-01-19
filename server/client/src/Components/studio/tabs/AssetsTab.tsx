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
 */

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { toast } from 'react-toastify';
import { Generated3DAsset, get3DAssets } from '../../../lib/firestore/queries';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../../../config/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
} from 'lucide-react';

interface AssetsTabProps {
  chapterId: string;
  topicId: string;
}

// Lazy load the 3D viewer
const Lazy3DViewer = lazy(() => import('../../AssetViewerWithSkybox').then(m => ({ default: m.AssetViewerWithSkybox })));

export const AssetsTab = ({ chapterId, topicId }: AssetsTabProps) => {
  const [assets, setAssets] = useState<Generated3DAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Generated3DAsset | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [assetNames, setAssetNames] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Delete state
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Generated3DAsset | null>(null);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ asset: Generated3DAsset; x: number; y: number } | null>(null);

  // Load assets
  useEffect(() => {
    const loadAssets = async () => {
      setLoading(true);
      try {
        const assetsData = await get3DAssets(chapterId, topicId);
        setAssets(assetsData);
        if (assetsData.length > 0 && !selectedAsset) {
          setSelectedAsset(assetsData[0]);
        }
      } catch (error) {
        console.error('Error loading 3D assets:', error);
      } finally {
        setLoading(false);
      }
    };

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
    setLoading(true);
    try {
      const assetsData = await get3DAssets(chapterId, topicId);
      setAssets(assetsData);
    } catch (error) {
      console.error('Error refreshing 3D assets:', error);
    } finally {
      setLoading(false);
    }
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

  const validateAndAddFiles = (files: File[]) => {
    const validExtensions = ['.glb', '.gltf', '.fbx', '.obj'];
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    const validFiles: File[] = [];
    const newNames: { [key: string]: string } = { ...assetNames };
    
    files.forEach(file => {
      const fileName = file.name.toLowerCase();
      const isValid = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValid) {
        toast.error(`${file.name}: Invalid format. Use GLB, GLTF, FBX, or OBJ`);
        return;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large (max 100MB)`);
        return;
      }
      
      validFiles.push(file);
      newNames[file.name] = file.name.replace(/\.[^/.]+$/, '');
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setAssetNames(newNames);
  };
  
  const removeFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    const newNames = { ...assetNames };
    delete newNames[fileName];
    setAssetNames(newNames);
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    const totalFiles = selectedFiles.length;
    let uploadedCount = 0;
    const newAssets: Generated3DAsset[] = [];
    
    try {
      for (const file of selectedFiles) {
        const name = assetNames[file.name] || file.name.replace(/\.[^/.]+$/, '');
        const timestamp = Date.now();
        const fileName = `${name.replace(/\s+/g, '_')}_${timestamp}${file.name.substring(file.name.lastIndexOf('.'))}`;
        const storagePath = `3d_assets/${chapterId}/${topicId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        const newAsset: Generated3DAsset = {
          id: `manual_${timestamp}_${uploadedCount}`,
          name,
          glb_url: downloadUrl,
          status: 'complete',
          created_at: new Date().toISOString(),
        };
        
        newAssets.push(newAsset);
        uploadedCount++;
        setUploadProgress((uploadedCount / totalFiles) * 100);
      }
      
      // Update local state
      setAssets(prev => [...prev, ...newAssets]);
      if (newAssets.length > 0) {
        setSelectedAsset(newAssets[0]);
      }
      
      toast.success(`${uploadedCount} asset${uploadedCount > 1 ? 's' : ''} uploaded successfully!`);
      
      // Reset and close
      setShowUploadModal(false);
      setSelectedFiles([]);
      setAssetNames({});
      setUploadProgress(0);
      
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload assets');
    } finally {
      setUploading(false);
    }
  };
  
  // Delete asset
  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;
    
    setDeletingAssetId(assetToDelete.id);
    
    try {
      // Try to delete from storage if it's a manual upload
      if (assetToDelete.glb_url?.includes('firebase')) {
        try {
          const storageRef = ref(storage, assetToDelete.glb_url);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn('Could not delete from storage:', storageError);
        }
      }
      
      // Remove from local state
      setAssets(prev => prev.filter(a => a.id !== assetToDelete.id));
      
      // If this was selected, select another
      if (selectedAsset?.id === assetToDelete.id) {
        const remaining = assets.filter(a => a.id !== assetToDelete.id);
        setSelectedAsset(remaining[0] || null);
      }
      
      toast.success('Asset deleted');
    } catch (error: unknown) {
      console.error('Delete error:', error);
      toast.error('Failed to delete asset');
    } finally {
      setDeletingAssetId(null);
      setShowDeleteConfirm(false);
      setAssetToDelete(null);
    }
  };
  
  const openDeleteConfirm = (asset: Generated3DAsset) => {
    setAssetToDelete(asset);
    setShowDeleteConfirm(true);
    setContextMenu(null);
  };
  
  const handleContextMenu = (e: React.MouseEvent, asset: Generated3DAsset) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ asset, x: e.clientX, y: e.clientY });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading 3D assets...</p>
        </div>
      </div>
    );
  }

  return (
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

      {assets.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center mb-6 border border-white/10">
            <Box className="w-12 h-12 text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No 3D Assets Yet</h3>
          <p className="text-sm text-slate-400 text-center max-w-md mb-8">
            Upload your 3D models (GLB, GLTF, FBX, OBJ) to include them in your learning experience.
          </p>
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
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Asset Grid/List - Left */}
          <div className={`${selectedAsset && showViewer ? 'w-80' : 'flex-1'} border-r border-slate-700/50 overflow-y-auto p-4 bg-slate-900/30 transition-all`}>
            {viewMode === 'grid' ? (
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(asset);
                          }}
                          className="p-2 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(asset);
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
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
                    ) : (
                      <Lazy3DViewer
                        assetUrl={selectedAsset.glb_url}
                        skyboxImageUrl=""
                        className="w-full h-full"
                        autoRotate={true}
                        onError={(err) => setViewerError(err.message)}
                      />
                    )}
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
          <button
            onClick={() => openDeleteConfirm(contextMenu.asset)}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
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
                  <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                    <span>Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
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
      {showDeleteConfirm && assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Delete Asset?</h3>
              <p className="text-slate-400 mb-6">
                Are you sure you want to delete "{assetToDelete.name}"? This action cannot be undone.
              </p>
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
  );
};
