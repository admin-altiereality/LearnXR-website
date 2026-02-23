/**
 * ImagesTab - Educational Image Management for Chapter
 * 
 * Features:
 * - Grid view with image previews
 * - Upload new images
 * - Delete existing images
 * - Image type categorization (diagram, illustration, photo, etc.)
 * - Reorder images
 * 
 * Data Source: chapter_images collection (NEW Firestore schema)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-toastify';
import { getChapterImages } from '../../../lib/firestore/queries';
import { ChapterImage } from '../../../types/curriculum';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../../../config/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { canEditLesson, canDeleteAsset } from '../../../utils/rbac';
import { classifyError } from '../../../utils/errorHandler';
import { useLessonDraftStore } from '../../../stores/lessonDraftStore';
import {
  Image,
  Loader2,
  Plus,
  Trash2,
  X,
  Upload,
  FileUp,
  RefreshCw,
  ExternalLink,
  Grid3X3,
  List,
  Eye,
  MoreVertical,
  Tag,
  ImageIcon,
  Maximize2,
  AlertTriangle,
  Save,
} from 'lucide-react';

interface ImagesTabProps {
  chapterId: string;
  topicId: string;
  bundle?: any; // Lesson bundle containing images
}

const imageTypes = [
  { value: 'diagram', label: 'Diagram', color: 'text-primary bg-primary/10 border-primary/20' },
  { value: 'illustration', label: 'Illustration', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  { value: 'photo', label: 'Photo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'infographic', label: 'Infographic', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value: 'other', label: 'Other', color: 'text-muted-foreground bg-muted border-border' },
];

export const ImagesTab = ({ chapterId, topicId, bundle }: ImagesTabProps) => {
  const { user, profile } = useAuth();
  const [images, setImages] = useState<ChapterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ChapterImage | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showLightbox, setShowLightbox] = useState(false);
  
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageMetadata, setImageMetadata] = useState<{ [key: string]: { name: string; type: ChapterImage['type'] } }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Delete state
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ChapterImage | null>(null);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ image: ChapterImage; x: number; y: number } | null>(null);

  // Draft store (must be before any early returns to satisfy Rules of Hooks)
  const imagesDirty = useLessonDraftStore((s) => s.dirtyTabs.images === true);
  const draftSnapshot = useLessonDraftStore((s) => s.draftSnapshot);
  const pendingDeleteRequests = useLessonDraftStore((s) => s.pendingDeleteRequests);
  const hasDeleteRequest = useLessonDraftStore((s) => s.hasDeleteRequest);
  const pendingDeletes = useMemo(
    () => pendingDeleteRequests.filter((r) => r.tab === 'images'),
    [pendingDeleteRequests]
  );
  const pendingDeleteIds = useMemo(() => new Set(pendingDeletes.map((r) => r.itemId)), [pendingDeletes]);

  // Load images from bundle or fetch directly. When images tab is dirty, prefer draft store so uploads persist.
  useEffect(() => {
    const loadImages = async () => {
      if (!chapterId || !topicId) return;

      const store = useLessonDraftStore.getState();
      const isDraftForThisLesson =
        store.meta?.chapterId === chapterId && store.meta?.topicId === topicId && store.draftSnapshot?.images;

      if (imagesDirty && isDraftForThisLesson && store.draftSnapshot) {
        const draftImages = (store.draftSnapshot.images || [])
          .filter((img: { id?: string }) => !pendingDeleteIds.has(img.id || ''))
          .map((img: any, index: number) => ({
            id: img.id || '',
            chapter_id: chapterId,
            topic_id: topicId,
            name: img.name || 'Image',
            description: img.description,
            image_url: img.image_url || img.url || '',
            thumbnail_url: img.thumbnail_url,
            type: (img.type || 'other') as ChapterImage['type'],
            order: img.order ?? index,
            created_at: img.created_at,
            updated_at: img.updated_at,
          }));
        setImages(draftImages);
        if (draftImages.length > 0 && !selectedImage) {
          setSelectedImage(draftImages[0]);
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let imagesData: ChapterImage[] = [];

        // Priority 1: Use bundle data if available
        if (bundle?.images && Array.isArray(bundle.images)) {
          imagesData = bundle.images.map((img: any) => ({
            id: img.id || '',
            chapter_id: img.chapter_id || chapterId,
            topic_id: img.topic_id || topicId,
            name: img.name || img.filename || 'Image',
            description: img.description,
            image_url: img.image_url || img.url || img.imageUrl || '',
            thumbnail_url: img.thumbnail_url || img.thumbnail,
            type: img.type || (img.source === 'pdf' ? 'pdf' : 'other'),
            order: img.order ?? 0,
            created_at: img.created_at,
            updated_at: img.updated_at,
          }));
          console.log(`✅ Loaded ${imagesData.length} images from bundle (including ${bundle.images.filter((i: any) => i.source === 'pdf').length} from PDF)`);
        } else {
          // Fallback: Fetch directly
          imagesData = await getChapterImages(chapterId, topicId);
          console.log(`✅ Loaded ${imagesData.length} images from direct fetch`);
        }

        setImages(imagesData);
        if (imagesData.length > 0 && !selectedImage) {
          setSelectedImage(imagesData[0]);
        }
      } catch (error) {
        console.error('Error loading images:', error);
        toast.error('Failed to load images');
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, [chapterId, topicId, bundle, imagesDirty, pendingDeleteIds, draftSnapshot]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const imagesData = await getChapterImages(chapterId, topicId);
      setImages(imagesData);
      toast.success('Images refreshed');
    } catch (error) {
      console.error('Error refreshing images:', error);
      toast.error('Failed to refresh images');
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
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    const validFiles: File[] = [];
    const newMetadata: { [key: string]: { name: string; type: ChapterImage['type'] } } = { ...imageMetadata };
    
    files.forEach(file => {
      const fileName = file.name.toLowerCase();
      const isValid = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValid) {
        toast.error(`${file.name}: Invalid format. Use JPG, PNG, GIF, WebP, or SVG`);
        return;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        return;
      }
      
      validFiles.push(file);
      newMetadata[file.name] = {
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'other',
      };
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setImageMetadata(newMetadata);
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    const newMetadata = { ...imageMetadata };
    delete newMetadata[fileName];
    setImageMetadata(newMetadata);
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    if (!storage) {
      toast.error('Storage is not available');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const totalFiles = selectedFiles.length;
    let uploadedCount = 0;
    const newImages: ChapterImage[] = [];

    try {
      for (const file of selectedFiles) {
        const metadata = imageMetadata[file.name] || { name: file.name, type: 'other' as const };
        const timestamp = Date.now();
        const fileName = `${metadata.name.replace(/\s+/g, '_')}_${timestamp}${file.name.substring(file.name.lastIndexOf('.'))}`;
        const storagePath = `chapter_images/${chapterId}/${topicId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Save to chapter_images collection
        // New images are NOT core by default (can be deleted by admin)
        const imageDoc = await addDoc(collection(db, 'chapter_images'), {
          chapter_id: chapterId,
          topic_id: topicId,
          name: metadata.name,
          image_url: downloadUrl,
          type: metadata.type,
          order: images.length + uploadedCount,
          isCore: false, // New uploads are not core by default
          assetTier: 'optional', // Can be changed later by superadmin
          created_at: serverTimestamp(),
        });
        
        const newImage: ChapterImage = {
          id: imageDoc.id,
          chapter_id: chapterId,
          topic_id: topicId,
          name: metadata.name,
          image_url: downloadUrl,
          type: metadata.type,
          order: images.length + uploadedCount,
          created_at: new Date().toISOString(),
        };
        
        newImages.push(newImage);
        uploadedCount++;
        setUploadProgress((uploadedCount / totalFiles) * 100);
      }
      
      // Update chapter.sharedAssets.image_ids with all new image IDs
      if (newImages.length > 0) {
        try {
          const { addImageIdToChapterSharedAssets } = await import('../../../lib/firestore/updateHelpers');
          for (const newImage of newImages) {
            await addImageIdToChapterSharedAssets(chapterId, newImage.id);
          }
          console.log(`✅ Updated chapter ${chapterId} sharedAssets with ${newImages.length} new image IDs`);
        } catch (error) {
          console.warn('Could not update chapter sharedAssets (non-critical):', error);
        }
      }
      
      // Update local state
      setImages(prev => [...prev, ...newImages]);
      if (newImages.length > 0) {
        setSelectedImage(newImages[0]);
      }
      
      // Update draft store — mark images tab dirty + update snapshot
      try {
        const store = useLessonDraftStore.getState();
        if (store.draftSnapshot) {
          const currentImages = store.draftSnapshot.images || [];
          const newStoreImages = newImages.map((img) => ({
            id: img.id,
            name: img.name,
            image_url: img.image_url,
            url: img.image_url,
            type: img.type,
          }));
          store.updateTab('images', [...currentImages, ...newStoreImages]);
        }
      } catch (storeErr) {
        console.warn('Draft store update failed (non-blocking):', storeErr);
      }
      
      toast.success(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded successfully! Save Draft to commit.`);
      
      // Reset and close
      setShowUploadModal(false);
      setSelectedFiles([]);
      setImageMetadata({});
      setUploadProgress(0);
      
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const classification = classifyError(error);
      toast.error(classification.userMessage);
    } finally {
      setUploading(false);
    }
  };

  // Delete image — Associate creates a delete request; Admin/SuperAdmin can hard delete
  const handleDeleteImage = async () => {
    if (!imageToDelete || !profile) return;

    // Associate role: always allow creating a delete REQUEST (including for core images); superadmin approves later
    const isAssociate = profile.role === 'associate';
    if (isAssociate) {
      const store = useLessonDraftStore.getState();
      store.addDeleteRequest({
        tab: 'images',
        itemId: imageToDelete.id,
        assetUrl: imageToDelete.image_url || '',
        itemName: imageToDelete.name,
      });
      toast.info('Delete request created. Save Draft to submit for admin approval.');
      setShowDeleteConfirm(false);
      setImageToDelete(null);
      return;
    }

    // Admin/SuperAdmin: check permission for hard delete (only superadmin can delete core images)
    const imageAsAsset = { isCore: (imageToDelete as any).isCore, assetTier: (imageToDelete as any).assetTier };
    if (!canDeleteAsset(profile, imageAsAsset)) {
      toast.error('You do not have permission to delete this core image. Only superadmin can delete core images.');
      setShowDeleteConfirm(false);
      setImageToDelete(null);
      return;
    }

    // Admin/SuperAdmin: hard delete
    setDeletingImageId(imageToDelete.id);
    
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'chapter_images', imageToDelete.id));
      
      // Try to delete from storage if it's a Firebase URL
      const storageInstance = storage;
      if (storageInstance && imageToDelete.image_url?.includes('firebase')) {
        try {
          const storageRef = ref(storageInstance, imageToDelete.image_url);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn('Could not delete from storage:', storageError);
        }
      }
      
      // Remove from local state
      setImages(prev => prev.filter(img => img.id !== imageToDelete.id));
      
      // Update draft store
      try {
        const store = useLessonDraftStore.getState();
        if (store.draftSnapshot) {
          const updatedImages = (store.draftSnapshot.images || []).filter(
            (img) => img.id !== imageToDelete.id
          );
          store.updateTab('images', updatedImages);
        }
      } catch (storeErr) {
        console.warn('Draft store update failed (non-blocking):', storeErr);
      }
      
      // If this was selected, select another
      if (selectedImage?.id === imageToDelete.id) {
        const remaining = images.filter(img => img.id !== imageToDelete.id);
        setSelectedImage(remaining[0] || null);
      }
      
      toast.success('Image deleted');
    } catch (error: unknown) {
      console.error('Delete error:', error);
      toast.error('Failed to delete image');
    } finally {
      setDeletingImageId(null);
      setShowDeleteConfirm(false);
      setImageToDelete(null);
    }
  };

  const openDeleteConfirm = (image: ChapterImage) => {
    setImageToDelete(image);
    setShowDeleteConfirm(true);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, image: ChapterImage) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ image, x: e.clientX, y: e.clientY });
  };

  const getTypeConfig = (type: ChapterImage['type']) => {
    return imageTypes.find(t => t.value === type) || imageTypes[4];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading images from chapter_images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Unsaved changes banner */}
      {(imagesDirty || pendingDeletes.length > 0) && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <Save className="w-4 h-4" />
            <span>
              {pendingDeletes.length > 0
                ? `${pendingDeletes.length} delete request(s) pending. `
                : ''}
              Unsaved image changes — use Save Draft to commit.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-violet-400" />
            Chapter Images
            <span className="ml-2 px-2 py-0.5 text-xs font-medium text-violet-400 bg-violet-500/10 rounded-full border border-violet-500/20">
              {images.length}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Educational images for this topic
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                     text-foreground bg-gradient-to-r from-violet-500 to-purple-600
                     hover:from-violet-400 hover:to-purple-500
                     rounded-lg shadow-lg shadow-violet-500/20
                     transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Images
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 text-muted-foreground hover:text-foreground
                     bg-muted hover:bg-muted/80
                     rounded-lg border border-border
                     transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center mb-6 border border-white/10">
            <Image className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No Images Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
            Upload educational images like diagrams, illustrations, and photos to enhance your lesson content.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-8 py-3.5 text-sm font-semibold
                     text-foreground bg-gradient-to-r from-violet-500 to-purple-600
                     hover:from-violet-400 hover:to-purple-500
                     rounded-xl shadow-lg shadow-violet-500/25
                     transition-all duration-200 hover:-translate-y-0.5"
          >
            <Upload className="w-5 h-5" />
            Upload Your First Image
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Image Grid/List */}
          <div className={`${selectedImage ? 'w-1/2' : 'flex-1'} border-r border-border overflow-y-auto p-4 bg-muted/50 transition-all`}>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {images.map((image) => {
                  const typeConfig = getTypeConfig(image.type);
                  return (
                    <div
                      key={image.id}
                      onClick={() => setSelectedImage(image)}
                      onContextMenu={(e) => handleContextMenu(e, image)}
                      className={`relative rounded-xl border transition-all duration-200 cursor-pointer group overflow-hidden
                                ${selectedImage?.id === image.id
                                  ? 'border-violet-500/30 shadow-lg shadow-violet-500/10'
                                  : 'border-border hover:border-border'
                                }`}
                    >
                      {/* Image */}
                      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden relative">
                        <img
                          src={image.image_url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage(image);
                              setShowLightbox(true);
                            }}
                            className="p-2 bg-violet-500/20 rounded-lg text-violet-400 hover:bg-violet-500/30"
                          >
                            <Maximize2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteConfirm(image);
                            }}
                            className="p-2 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="p-3 bg-muted">
                        <p className="text-xs text-foreground font-medium truncate">{image.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                        </div>
                      </div>
                      
                      {/* Deleting indicator */}
                      {deletingImageId === image.id && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                        </div>
                      )}
                      {/* Pending delete request (Associate — awaiting admin approval) */}
                      {hasDeleteRequest(image.id) && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-500/90 text-amber-950 text-[10px] font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Pending delete
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="space-y-2">
                {images.map((image) => {
                  const typeConfig = getTypeConfig(image.type);
                  return (
                    <div
                      key={image.id}
                      onClick={() => setSelectedImage(image)}
                      onContextMenu={(e) => handleContextMenu(e, image)}
                      className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 cursor-pointer group
                                ${selectedImage?.id === image.id
                                  ? 'bg-violet-500/10 border-violet-500/30'
                                  : 'bg-muted/50 border-border hover:border-border hover:bg-muted'
                                }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-20 h-14 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img
                          src={image.thumbnail_url || image.image_url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{image.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {image.description || 'No description'}
                        </p>
                      </div>
                      
                      {/* Type & Actions */}
                      <div className="flex items-center gap-2">
                        {hasDeleteRequest(image.id) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Pending delete
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-md border ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(image);
                          }}
                          className="p-2 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Image Preview */}
          {selectedImage && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 relative bg-muted flex items-center justify-center p-4">
                <img
                  src={selectedImage.image_url}
                  alt={selectedImage.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => setShowLightbox(true)}
                    className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm border border-white/10 text-foreground/80"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  <a
                    href={selectedImage.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm border border-white/10 text-foreground/80"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>
              
              {/* Image Details */}
              <div className="p-5 border-t border-border bg-muted/50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedImage.name}</h3>
                    {selectedImage.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedImage.description}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${getTypeConfig(selectedImage.type).color}`}>
                    {getTypeConfig(selectedImage.type).label}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-xl border border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Image ID</p>
                    <p className="text-xs text-foreground font-mono truncate">{selectedImage.id}</p>
                  </div>
                  {selectedImage.created_at && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                      <p className="text-xs text-foreground">
                        {new Date(selectedImage.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => openDeleteConfirm(selectedImage)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium
                           text-red-400 bg-red-500/10 hover:bg-red-500/20
                           rounded-lg border border-red-500/30 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Image
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card rounded-xl border border-border shadow-2xl py-2 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setSelectedImage(contextMenu.image);
              setShowLightbox(true);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Eye className="w-4 h-4" />
            View Full Size
          </button>
          <a
            href={contextMenu.image.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            onClick={() => setContextMenu(null)}
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </a>
          {canEditLesson(profile) && (
            <>
              <div className="my-1 border-t border-border" />
              {canDeleteAsset(profile, { isCore: (contextMenu.image as any).isCore, assetTier: (contextMenu.image as any).assetTier }) ? (
                <button
                  onClick={() => openDeleteConfirm(contextMenu.image)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Core Image (Superadmin only)
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Upload className="w-5 h-5 text-violet-400" />
                Upload Images
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setImageMetadata({});
                }}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
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
                            ? 'border-violet-500 bg-violet-500/10' 
                            : 'border-border hover:border-border hover:bg-muted/50'
                          }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                />
                
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium mb-1">
                  Drop your images here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (JPG, PNG, GIF, WebP, SVG • Max 10MB each)
                </p>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                    >
                      <div className="w-12 h-12 bg-violet-500/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={imageMetadata[file.name]?.name || ''}
                          onChange={(e) => setImageMetadata(prev => ({
                            ...prev,
                            [file.name]: { ...prev[file.name], name: e.target.value }
                          }))}
                          placeholder="Image name..."
                          className="w-full bg-transparent text-foreground text-sm font-medium outline-none placeholder:text-muted-foreground"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={imageMetadata[file.name]?.type || 'other'}
                            onChange={(e) => setImageMetadata(prev => ({
                              ...prev,
                              [file.name]: { ...prev[file.name], type: e.target.value as ChapterImage['type'] }
                            }))}
                            className="text-xs bg-muted border border-border rounded px-2 py-0.5 text-foreground"
                          >
                            {imageTypes.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-muted-foreground">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(file.name)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
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
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                    setImageMetadata({});
                  }}
                  disabled={uploading}
                  className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground
                           bg-muted hover:bg-muted rounded-lg
                           transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadAll}
                  disabled={selectedFiles.length === 0 || uploading}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium
                           text-foreground bg-gradient-to-r from-violet-500 to-purple-600
                           hover:from-violet-400 hover:to-purple-500
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
      {showDeleteConfirm && imageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Delete Image?</h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete "{imageToDelete.name}"? This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setImageToDelete(null);
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground
                           bg-muted hover:bg-muted rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteImage}
                  disabled={deletingImageId !== null}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium
                           text-foreground bg-red-600 hover:bg-red-500
                           rounded-lg transition-all disabled:opacity-50"
                >
                  {deletingImageId ? (
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

      {/* Lightbox */}
      {showLightbox && selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-3 text-foreground/60 hover:text-foreground"
            onClick={() => setShowLightbox(false)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={selectedImage.image_url}
            alt={selectedImage.name}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
