import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AssetViewerWithSkybox } from '../Components/AssetViewerWithSkybox';
import { skyboxApiService } from '../services/skyboxApiService';
import { Grid3X3, List, RefreshCw, Plus, ImageIcon, AlertCircle, Loader2, X } from 'lucide-react';

const History = ({ setBackgroundSkybox }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSkybox, setSelectedSkybox] = useState(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [hoveredVariationsSection, setHoveredVariationsSection] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'pending'
  const [previewItem, setPreviewItem] = useState(null); // Item to show in preview modal
  const [previewType, setPreviewType] = useState('skybox'); // 'skybox' or '3d'
  const [availableStyles, setAvailableStyles] = useState([]); // Available skybox styles
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load available skybox styles
  useEffect(() => {
    const loadStyles = async () => {
      try {
        const response = await skyboxApiService.getStyles(1, 100);
        const rawStyles = response?.data?.styles || response?.styles || response?.data || [];
        const stylesArr = Array.isArray(rawStyles) ? rawStyles : [];
        if (stylesArr.length > 0) {
          setAvailableStyles(stylesArr);
        }
      } catch (error) {
        console.error('Failed to load skybox styles:', error);
      }
    };
    loadStyles();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      console.log('⚠️ History: No user ID, skipping query');
      setLoading(false);
      return;
    }

    console.log('🔍 History: Starting to load history for user:', user.uid);
    console.log('🔍 History: User object:', { uid: user.uid, email: user.email });
    console.log('🔍 History: Firestore db instance:', db ? 'Available' : 'Missing');
    setLoading(true);
    
    if (!db) {
      console.error('❌ History: Firestore db is not available!');
      setError('Firestore database is not initialized. Please refresh the page.');
      setLoading(false);
      return;
    }
    
    // Query both skyboxes and unified_jobs collections
    const skyboxesRef = collection(db, 'skyboxes');
    const jobsRef = collection(db, 'unified_jobs');
    
    // Use simple query without orderBy to avoid index requirements - always sort client-side
    const skyboxQuery = query(
      skyboxesRef,
      where('userId', '==', user.uid)
    );
    
    const jobsQuery = query(
      jobsRef,
      where('userId', '==', user.uid)
    );
    
    console.log(`🔍 History: Query created for userId: ${user.uid}`);
    console.log(`🔍 History: Query details:`, {
      collections: ['skyboxes', 'unified_jobs'],
      filter: `userId == '${user.uid}'`,
      hasOrderBy: false
    });

    let skyboxUnsubscribe;
    let jobsUnsubscribe;
    let skyboxData = [];
    let jobsData = [];

    const processAndMergeData = () => {
      try {
        const allItems = [...skyboxData, ...jobsData];
        
        // Always sort by createdAt client-side (most recent first)
        allItems.sort((a, b) => {
          const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at || 0).getTime();
          const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at || 0).getTime();
          return bTime - aTime; // Descending order (newest first)
        });

        console.log(`✅ History: Processed ${allItems.length} items (${skyboxData.length} skyboxes, ${jobsData.length} jobs), sorted by createdAt`);
        setHistory(allItems);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error("❌ History: Error processing merged data:", err);
        setError("Error processing history data: " + err.message);
        setLoading(false);
      }
    };

    // Listen to skyboxes collection
    skyboxUnsubscribe = onSnapshot(
      skyboxQuery,
      (snapshot) => {
        try {
          console.log(`📦 History: Received ${snapshot.docs.length} skybox documents from Firestore`);
          
          skyboxData = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`📄 History: Processing skybox document ${doc.id}:`, {
              hasUserId: !!data.userId,
              userId: data.userId,
              matchesCurrentUser: data.userId === user.uid,
              hasCreatedAt: !!data.createdAt,
              hasImageUrl: !!data.imageUrl,
              hasVariations: !!data.variations,
              variationsCount: data.variations?.length || 0,
              status: data.status
            });
            
            const baseSkybox = {
              id: doc.id,
              file_url: data.imageUrl || data.image || data.file_url || data.skyboxUrl,
              title: data.title || data.promptUsed || data.prompt || 'Untitled Generation',
              prompt: data.promptUsed || data.prompt || '',
              created_at: data.createdAt,
              status: data.status || 'completed',
              metadata: data.metadata || {},
              isVariation: false,
              source: 'skyboxes',
              style_id: data.style_id || data.skybox_style_id || data.metadata?.style_id || null,
              style_name: data.style_name || data.styleName || data.metadata?.style_name || null // Use stored style name if available
            };

            // Build variations array - start with skybox variations if they exist
            let variationsArray = [];
            
            // Add skybox variations if they exist
            if (data.variations && Array.isArray(data.variations) && data.variations.length > 0) {
              variationsArray = data.variations.map((variation, index) => ({
                id: `${doc.id}_variation_${index}`,
                file_url: variation.image || variation.image_jpg || variation.file_url,
                title: variation.title || `${baseSkybox.title} (Variation ${index + 1})`,
                prompt: variation.prompt || baseSkybox.prompt,
                created_at: data.createdAt,
                status: variation.status || data.status || 'completed',
                metadata: data.metadata || {},
                isVariation: true,
                parentId: doc.id,
                variationIndex: index,
                type: 'skybox',
                style_id: baseSkybox.style_id // Inherit style_id from parent
              }));
            }

            // Add Meshy 3D asset as a variation if it exists in the same document
            if (data.meshUrl || data.meshyAsset || data.meshResult) {
              // Extract model_urls - prioritize GLB format
              const modelUrls = data.meshResult?.model_urls || data.meshyAsset?.metadata?.model_urls || null;
              
              // Get the best 3D model URL - prioritize model_urls.glb
              let bestMeshUrl = null;
              if (modelUrls) {
                bestMeshUrl = modelUrls.glb || modelUrls.fbx || modelUrls.obj || modelUrls.usdz;
              }
              // Fallback to direct URLs
              if (!bestMeshUrl) {
                bestMeshUrl = data.meshResult?.downloadUrl || data.meshyAsset?.downloadUrl || data.meshUrl;
              }
              
              // Check for video URL (MP4 preview)
              let videoUrl = null;
              if (data.meshResult?.videoUrl) {
                videoUrl = data.meshResult.videoUrl;
              } else if (data.meshyAsset?.videoUrl) {
                videoUrl = data.meshyAsset.videoUrl;
              } else if (data.meshResult?.previewUrl && data.meshResult.previewUrl.toLowerCase().includes('.mp4')) {
                videoUrl = data.meshResult.previewUrl;
              } else if (data.meshyAsset?.previewUrl && data.meshyAsset.previewUrl.toLowerCase().includes('.mp4')) {
                videoUrl = data.meshyAsset.previewUrl;
              } else if (data.meshResult?.downloadUrl && data.meshResult.downloadUrl.toLowerCase().includes('.mp4')) {
                videoUrl = data.meshResult.downloadUrl;
              } else if (data.meshyAsset?.downloadUrl && data.meshyAsset.downloadUrl.toLowerCase().includes('.mp4')) {
                videoUrl = data.meshyAsset.downloadUrl;
              }
              
              const meshyVariation = {
                id: `${doc.id}_mesh`,
                file_url: bestMeshUrl, // Use the best mesh URL as the primary file_url
                title: `${baseSkybox.title} (3D Asset)`,
                prompt: baseSkybox.prompt,
                created_at: data.createdAt,
                status: data.meshResult?.status || data.meshyAsset?.status || data.status || 'completed',
                isVariation: true,
                parentId: doc.id,
                variationIndex: variationsArray.length,
                type: '3d_asset',
                format: data.meshResult?.format || data.meshyAsset?.format || 'glb',
                model_urls: modelUrls,
                downloadUrl: data.meshResult?.downloadUrl || data.meshyAsset?.downloadUrl || data.meshUrl,
                previewUrl: data.meshResult?.previewUrl || data.meshyAsset?.previewUrl,
                meshUrl: bestMeshUrl, // Store the resolved mesh URL directly
                videoUrl: videoUrl, // Store video URL for MP4 preview
                style_id: baseSkybox.style_id // Inherit style_id from parent
              };
              variationsArray.push(meshyVariation);
              console.log(`📦 History: Added Meshy 3D asset variation to skybox ${doc.id}`, {
                meshUrl: bestMeshUrl,
                modelUrls: modelUrls,
                format: meshyVariation.format
              });
            }

            // Assign variations array to baseSkybox
            baseSkybox.variations = variationsArray;

            return baseSkybox;
          });

          processAndMergeData();
        } catch (err) {
          console.error("❌ History: Error processing skybox data:", err);
          setError("Error processing skybox data: " + err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error("❌ History: Error in skybox listener:", err);
        console.error("   Error code:", err.code);
        console.error("   Error message:", err.message);
        // Don't set error here, let jobs query handle it
      }
    );

    // Listen to unified_jobs collection
    jobsUnsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        try {
          console.log(`📦 History: Received ${snapshot.docs.length} job documents from Firestore`);
          
          jobsData = snapshot.docs.map(doc => {
            const data = doc.data();
            
            // Normalize errors field - handle both array and object formats for backward compatibility
            let errors = [];
            if (data.errors) {
              if (Array.isArray(data.errors)) {
                errors = data.errors;
              } else if (typeof data.errors === 'object') {
                // Handle legacy object format: { id, prompt, status }
                // Convert to array of error messages
                if (data.errors.status && data.errors.status !== 'completed') {
                  errors = [`Status: ${data.errors.status}`];
                }
                if (data.errors.prompt) {
                  errors.push(`Prompt: ${data.errors.prompt}`);
                }
                console.warn(`⚠️ History: Found legacy errors object format in job ${doc.id}, converting to array`);
              }
            }
            
            console.log(`📄 History: Processing job document ${doc.id}:`, {
              hasUserId: !!data.userId,
              userId: data.userId,
              matchesCurrentUser: data.userId === user.uid,
              hasCreatedAt: !!data.createdAt,
              hasSkyboxUrl: !!data.skyboxUrl,
              hasMeshUrl: !!data.meshUrl,
              status: data.status,
              errorsCount: errors.length
            });
            
            // Convert job to history item format
            const jobItem = {
              id: doc.id,
              file_url: data.skyboxUrl || data.skyboxResult?.fileUrl || data.skyboxResult?.downloadUrl || data.meshResult?.previewUrl || data.meshResult?.downloadUrl,
              title: data.prompt || 'Untitled Generation',
              prompt: data.prompt || '',
              created_at: data.createdAt,
              status: data.status || 'pending',
              metadata: {
                ...data.metadata,
                jobId: doc.id,
                hasSkybox: !!data.skyboxUrl || !!data.skyboxResult,
                hasMesh: !!data.meshUrl || !!data.meshResult,
                errors: errors
              },
              isVariation: false,
              source: 'unified_jobs',
              style_id: data.style_id || data.skybox_style_id || data.metadata?.style_id || null,
              style_name: data.style_name || data.styleName || data.metadata?.style_name || null, // Use stored style name if available
              // Include full job data for potential future use
              jobData: {
                skyboxUrl: data.skyboxUrl,
                meshUrl: data.meshUrl,
                skyboxResult: data.skyboxResult,
                meshResult: data.meshResult,
                // Include model_urls if available (from Meshy API response)
                model_urls: data.meshResult?.model_urls || data.model_urls
              }
            };

            // If job has both skybox and mesh, create variations
            if (data.skyboxUrl && data.meshUrl) {
              // Check for video URL (MP4 preview) for 3D asset
              let meshVideoUrl = null;
              if (data.meshResult?.videoUrl) {
                meshVideoUrl = data.meshResult.videoUrl;
              } else if (data.meshResult?.previewUrl && data.meshResult.previewUrl.toLowerCase().includes('.mp4')) {
                meshVideoUrl = data.meshResult.previewUrl;
              } else if (data.meshResult?.downloadUrl && data.meshResult.downloadUrl.toLowerCase().includes('.mp4')) {
                meshVideoUrl = data.meshResult.downloadUrl;
              }
              
              jobItem.variations = [
                {
                  id: `${doc.id}_skybox`,
                  file_url: data.skyboxUrl,
                  title: `${jobItem.title} (Skybox)`,
                  prompt: jobItem.prompt,
                  created_at: data.createdAt,
                  status: data.skyboxResult?.status || data.status || 'completed',
                  isVariation: true,
                  parentId: doc.id,
                  variationIndex: 0
                },
                {
                  id: `${doc.id}_mesh`,
                  file_url: data.meshResult?.previewUrl || data.meshResult?.downloadUrl || data.meshUrl,
                  title: `${jobItem.title} (3D Asset)`,
                  prompt: jobItem.prompt,
                  created_at: data.createdAt,
                  status: data.meshResult?.status || data.status || 'completed',
                  isVariation: true,
                  parentId: doc.id,
                  variationIndex: 1,
                  type: '3d_asset',
                  format: data.meshResult?.format || 'glb',
                  model_urls: data.meshResult?.model_urls || data.model_urls,
                  downloadUrl: data.meshResult?.downloadUrl || data.meshUrl,
                  previewUrl: data.meshResult?.previewUrl,
                  meshUrl: data.meshResult?.downloadUrl || data.meshUrl,
                  videoUrl: meshVideoUrl // Include video URL for MP4 preview
                }
              ];
            } else {
              jobItem.variations = [];
            }

            return jobItem;
          });

          processAndMergeData();
        } catch (err) {
          console.error("❌ History: Error processing job data:", err);
          setError("Error processing job data: " + err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error("❌ History: Error in jobs listener:", err);
        console.error("   Error code:", err.code);
        console.error("   Error message:", err.message);
        setError(`Failed to load generation history: ${err.message}. Check console for details.`);
        setLoading(false);
      }
    );

    return () => {
      if (skyboxUnsubscribe) skyboxUnsubscribe();
      if (jobsUnsubscribe) jobsUnsubscribe();
    };
  }, [user?.uid]);

  const handleSkyboxClick = (item) => {
    if (!item.file_url) {
      console.warn("No file URL available for this skybox");
      return;
    }

    setSelectedSkybox(item);
    setSelectedVariation(null);
    const skyboxData = {
      image: item.file_url,
      image_jpg: item.file_url,
      title: formatTitle(item.title),
      prompt: item.prompt,
      metadata: item.metadata
    };
    setBackgroundSkybox(skyboxData);

    // Save resume data for restoring generation panel
    const resumeData = {
      prompt: item.prompt || '',
      negativePrompt: item.negative_text || item.negativePrompt || '',
      styleId: item.skybox_style_id || item.style_id || item.metadata?.style_id || null,
      has3DAsset: item.type === '3d_asset' || !!item.meshUrl || !!item.jobData?.meshUrl || item.metadata?.hasMesh || false,
      meshUrl: item.meshUrl || item.file_url || item.jobData?.meshUrl || null,
      meshFormat: item.format || item.jobData?.format || 'glb',
      modelUrls: item.model_urls || item.jobData?.model_urls || null,
    };
    
    // Save to sessionStorage
    sessionStorage.setItem('resumeGenerationData', JSON.stringify(resumeData));
    sessionStorage.setItem('appliedBackgroundSkybox', JSON.stringify(skyboxData));
    sessionStorage.setItem('fromHistory', 'true');
    
    // Navigate to create page
    navigate('/main');
  };

  const handlePreviewClick = (item, e) => {
    e.stopPropagation();
    
    // Helper to check if URL is a video file
    const isVideoUrl = (url) => {
      if (!url) return false;
      const urlLower = url.toLowerCase();
      // Check for video extensions
      const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
      if (videoExtensions.some(ext => urlLower.includes(ext))) {
        return true;
      }
      // Check for specific video URL patterns
      if (urlLower.includes('/output/output.mp4') || 
          urlLower.includes('/output.mp4') ||
          urlLower.includes('video') ||
          urlLower.includes('output.mp4')) {
        return true;
      }
      return false;
    };
    
    // Helper to check if URL is a 3D model file
    const is3DModelUrl = (url) => {
      if (!url) return false;
      if (isVideoUrl(url)) return false;
      const urlLower = url.toLowerCase();
      return urlLower.includes('.glb') || 
             urlLower.includes('.gltf') || 
             urlLower.includes('.fbx') || 
             urlLower.includes('.obj') || 
             urlLower.includes('.usdz');
    };
    
    // Get 3D model URL - prioritize GLB from model_urls, exclude videos
    let meshUrl = null;
    let meshFormat = 'glb';
    
    // First, check jobData.model_urls (direct access)
    if (item.jobData?.model_urls) {
      meshUrl = item.jobData.model_urls.glb || 
                item.jobData.model_urls.fbx || 
                item.jobData.model_urls.obj ||
                item.jobData.model_urls.usdz;
      if (meshUrl) {
        meshFormat = item.jobData.model_urls.glb ? 'glb' :
                    item.jobData.model_urls.fbx ? 'fbx' :
                    item.jobData.model_urls.obj ? 'obj' : 'usdz';
      }
    }
    
    // Check meshResult for model URLs
    if (!meshUrl && item.jobData?.meshResult) {
      const meshResult = item.jobData.meshResult;
      
      // Check if meshResult has model_urls object (from Meshy API)
      if (meshResult.model_urls) {
        // Prioritize GLB, then FBX, then OBJ, then USDZ
        meshUrl = meshResult.model_urls.glb || 
                  meshResult.model_urls.fbx || 
                  meshResult.model_urls.obj ||
                  meshResult.model_urls.usdz;
        if (meshUrl) {
          meshFormat = meshResult.model_urls.glb ? 'glb' :
                      meshResult.model_urls.fbx ? 'fbx' :
                      meshResult.model_urls.obj ? 'obj' : 'usdz';
        }
      }
      // Only use downloadUrl if it's a 3D model file (not video)
      else if (meshResult.downloadUrl && is3DModelUrl(meshResult.downloadUrl)) {
        meshUrl = meshResult.downloadUrl;
        meshFormat = meshResult.format || 'glb';
      }
    }
    
    // Fallback to meshUrl from jobData (only if it's a 3D model)
    if (!meshUrl && item.jobData?.meshUrl && is3DModelUrl(item.jobData.meshUrl)) {
      meshUrl = item.jobData.meshUrl;
    }
    
    // Final validation: ensure meshUrl is not a video
    if (meshUrl && isVideoUrl(meshUrl)) {
      console.warn('⚠️ Rejected video URL for 3D preview:', meshUrl);
      meshUrl = null; // Clear the video URL
    }
    
    const has3DAsset = !!meshUrl || item.metadata?.hasMesh;
    
    console.log('🔍 Preview click:', {
      has3DAsset,
      meshUrl,
      meshFormat,
      meshResult: item.jobData?.meshResult,
      model_urls: item.jobData?.meshResult?.model_urls,
      downloadUrl: item.jobData?.meshResult?.downloadUrl,
      isVideo: meshUrl ? isVideoUrl(meshUrl) : false,
      finalMeshUrl: meshUrl
    });
    
    // Only set 3D preview if we have a valid 3D model URL (not video)
    if (has3DAsset && meshUrl && !isVideoUrl(meshUrl) && is3DModelUrl(meshUrl)) {
      setPreviewType('3d');
      setPreviewItem({
        ...item,
        meshUrl,
        meshFormat
      });
    } else {
      // Fallback to skybox preview
      setPreviewType('skybox');
      setPreviewItem(item);
    }
  };

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewType('skybox');
  };

  const handleVariationClick = (variation) => {
    if (!variation.file_url && variation.type !== '3d_asset') {
      console.warn("No file URL available for this variation");
      return;
    }

    // If this is a 3D asset variation, handle it specially
    if (variation.type === '3d_asset') {
      console.log('🔍 3D Asset Variation clicked:', variation);
      
      // Extract the best 3D model URL - prioritize model_urls.glb
      let meshUrl = null;
      let meshFormat = 'glb';
      
      // Check model_urls first (Meshy API format)
      if (variation.model_urls) {
        meshUrl = variation.model_urls.glb || 
                  variation.model_urls.fbx || 
                  variation.model_urls.obj ||
                  variation.model_urls.usdz;
        if (meshUrl) {
          meshFormat = variation.model_urls.glb ? 'glb' :
                      variation.model_urls.fbx ? 'fbx' :
                      variation.model_urls.obj ? 'obj' : 'usdz';
        }
      }
      
      // Fallback to downloadUrl or file_url
      if (!meshUrl) {
        meshUrl = variation.downloadUrl || variation.file_url || variation.previewUrl;
      }
      
      console.log('🔍 Extracted mesh URL:', meshUrl, 'Format:', meshFormat);
      
      if (!meshUrl) {
        console.error('❌ No valid 3D model URL found for this variation');
        return;
      }
      
      // Set preview directly without going through handlePreviewClick
      setPreviewType('3d');
      setPreviewItem({
        ...variation,
        meshUrl: meshUrl,
        meshFormat: meshFormat,
        title: variation.title,
        prompt: variation.prompt,
        status: variation.status,
        created_at: variation.created_at,
        // Include parent skybox URL for 3D preview environment
        file_url: variation.parentSkyboxUrl || variation.file_url,
        jobData: {
          ...variation.jobData,
          skyboxUrl: variation.parentSkyboxUrl || variation.jobData?.skyboxUrl
        }
      });
      return;
    }

    setSelectedVariation(variation);
    const skyboxData = {
      image: variation.file_url,
      image_jpg: variation.file_url,
      title: formatTitle(variation.title),
      prompt: variation.prompt,
      metadata: variation.metadata
    };
    setBackgroundSkybox(skyboxData);

    // Save resume data for restoring generation panel
    // Get parent item data if available (variation might be nested)
    const parentItem = variation.parentItem || variation;
    const resumeData = {
      prompt: variation.prompt || parentItem.prompt || '',
      negativePrompt: variation.negative_text || parentItem.negative_text || variation.negativePrompt || parentItem.negativePrompt || '',
      styleId: variation.skybox_style_id || parentItem.skybox_style_id || variation.style_id || parentItem.style_id || variation.metadata?.style_id || parentItem.metadata?.style_id || null,
      has3DAsset: variation.type === '3d_asset' || !!variation.meshUrl || !!variation.model_urls || parentItem.metadata?.hasMesh || false,
      meshUrl: variation.meshUrl || variation.downloadUrl || variation.file_url || parentItem.meshUrl || null,
      meshFormat: variation.meshFormat || variation.format || parentItem.format || 'glb',
      modelUrls: variation.model_urls || parentItem.model_urls || null,
    };
    
    // Save to sessionStorage
    sessionStorage.setItem('resumeGenerationData', JSON.stringify(resumeData));
    sessionStorage.setItem('appliedBackgroundSkybox', JSON.stringify(skyboxData));
    sessionStorage.setItem('fromHistory', 'true');
    
    // Navigate to create page
    navigate('/main');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    const date = new Date(timestamp);
    return isNaN(date.getTime()) 
      ? 'Invalid Date'
      : date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
  };

  const formatTitle = (title) => {
    if (!title) return 'Untitled Generation';
    return title.replace(/^World #\d+ /, '').trim();
  };

  // Get style name from style_id - prioritize stored style_name, fallback to fetching from API
  const getStyleName = (item) => {
    // If style_name is already stored in the item, use it directly (no API call needed)
    if (item.style_name) {
      return item.style_name;
    }
    
    // Fallback: Look up style name from API if style_id is available
    if (item.style_id && availableStyles.length > 0) {
      const style = availableStyles.find(s => s.id === item.style_id || s.id === parseInt(item.style_id));
      return style?.name || null;
    }
    
    return null;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'complete':
        return 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 border-emerald-500/40';
      case 'pending':
      case 'processing':
        return 'text-amber-700 dark:text-amber-400 bg-amber-500/20 border-amber-500/40';
      case 'failed':
        return 'text-destructive bg-destructive/20 border-destructive/40';
      case 'partial':
        return 'text-blue-700 dark:text-blue-400 bg-blue-500/20 border-blue-500/40';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const filteredHistory = history.filter(item => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const downloadImage = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 min-h-screen py-24 bg-background">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div className="space-y-3">
              <Badge variant="secondary" className="mb-4 gap-2 bg-primary/10 text-primary border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Archive
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
                Generation
                <br />
                <span className="text-primary">History</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                A curated archive of your creative journey—every environment, every variation, every moment of inspiration.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  setTimeout(() => setLoading(false), 1000);
                }}
                title="Refresh history"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button onClick={() => navigate('/main')}>
                <Plus className="w-4 h-4" />
                Create New
              </Button>
            </div>
          </div>

          {/* Controls */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex rounded-lg border border-border bg-muted/30 p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="gap-2"
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="gap-2"
                  >
                    <List className="w-4 h-4" />
                    List
                  </Button>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                <span className="text-sm font-semibold text-foreground">{filteredHistory.length}</span>
                <span className="text-sm text-muted-foreground">
                  {filteredHistory.length !== 1 ? 'generations' : 'generation'}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
        
        {error && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center border border-destructive/30">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg text-destructive mb-2">Error loading history</p>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      window.location.reload();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center space-y-6">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-xl font-semibold text-foreground">Loading your archive</p>
                <p className="text-sm text-muted-foreground">Gathering your creative journey...</p>
              </div>
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <Card className="p-16 text-center">
            <CardContent className="flex flex-col items-center">
              <div className="w-24 h-24 mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <ImageIcon className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-3">Your archive awaits</h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                Every creation tells a story. Start your first chapter by generating an In3D.Ai environment.
              </p>
              <Button size="lg" onClick={() => navigate('/main')}>
                <Plus className="w-4 h-4" />
                Create Your First Environment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewMode}-${filterStatus}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}
            >
              {filteredHistory.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={viewMode === 'grid' ? 'space-y-3' : ''}
                  onMouseEnter={() => setHoveredGroup(item.id)}
                  onMouseLeave={() => setHoveredGroup(null)}
                >
                  {/* Main card */}
                  <motion.div
                    whileHover={{ y: -4 }}
                    className={`
                      relative group bg-card rounded-2xl overflow-hidden shadow-lg
                      transform transition-all duration-500 cursor-pointer
                      border border-border hover:border-primary/50
                      ${selectedSkybox?.id === item.id ? 'ring-2 ring-primary shadow-primary/20' : ''}
                      ${viewMode === 'list' ? 'flex items-center space-x-6 p-6' : ''}
                    `}
                    onClick={() => handleSkyboxClick(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSkyboxClick(item);
                      }
                    }}
                  >
                    {/* Image Container */}
                    <div className={`relative overflow-hidden ${viewMode === 'grid' ? 'aspect-[16/9]' : 'w-40 h-40 flex-shrink-0 rounded-2xl'}`}>
                      {item.file_url ? (
                        <img
                          src={item.file_url}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center bg-muted ${
                          item.file_url ? 'hidden' : 'flex'
                        }`}
                      >
                        <div className="text-center">
                          <ImageIcon className="w-16 h-16 text-muted-foreground mx-auto mb-3" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">No Preview</p>
                        </div>
                      </div>

                      {/* Editorial Status Badge */}
                      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                        <span className={`px-3 py-1.5 text-xs font-display font-bold rounded-xl border backdrop-blur-xl shadow-xl ${getStatusColor(item.status)}`}>
                          <span className="flex items-center gap-1.5">
                            {item.status === 'completed' && (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {item.status === 'pending' && (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {item.status === 'failed' && (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className="uppercase tracking-wider">{item.status}</span>
                          </span>
                        </span>
                        {item.source && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {item.source === 'skyboxes' ? 'Skybox' : 'Job'}
                          </Badge>
                        )}
                      </div>

                      {item.style_id && getStyleName(item) && (
                        <div className="absolute top-4 right-4 z-10">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {getStyleName(item)}
                          </Badge>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end">
                        <div className="p-6 w-full">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-primary" />
                              </div>
                              <span className="text-foreground font-semibold text-sm">Apply to background</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Preview Button */}
                              <button
                                onClick={(e) => handlePreviewClick(item, e)}
                                className="p-2.5 bg-background/80 hover:bg-background rounded-xl transition-all border border-border"
                                title="Preview"
                              >
                                <ImageIcon className="w-5 h-5 text-foreground" />
                              </button>
                              {/* Download Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(item.file_url, `${item.title}.jpg`);
                                }}
                                className="p-2.5 bg-background/80 hover:bg-background rounded-xl transition-all border border-border"
                                title="Download"
                              >
                                <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {item.prompt && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">{item.prompt}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Editorial Content Section */}
                    <div className={`relative z-10 ${viewMode === 'grid' ? 'p-6' : 'flex-1 p-6'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-bold text-foreground line-clamp-2 flex-1 pr-3 group-hover:text-primary transition-colors leading-tight">
                          {formatTitle(item.title)}
                        </h3>
                        {item.variations && item.variations.length > 0 && (
                          <Badge variant="secondary" className="gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {item.variations.length}
                          </Badge>
                        )}
                      </div>
                      
                      {item.prompt && (
                        <p className="text-sm text-muted-foreground mb-5 line-clamp-2 leading-relaxed">{item.prompt}</p>
                      )}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-mono">{formatDate(item.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Style Badge */}
                          {item.style_id && getStyleName(item) && (
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {getStyleName(item)}
                            </Badge>
                          )}
                          {item.metadata?.hasMesh && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-lg border border-emerald-500/30 backdrop-blur-sm">
                              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider">3D</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {item.variations && item.variations.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 space-y-4 pt-6 border-t border-border"
                      onMouseEnter={() => setHoveredVariationsSection(item.id)}
                      onMouseLeave={() => setHoveredVariationsSection(null)}
                    >
                      <div className="flex items-center justify-between mb-3 cursor-pointer group/header">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center transition-all group-hover/header:bg-primary/30 group-hover/header:border-primary/50">
                            <svg className="w-4 h-4 text-purple-400 transition-transform duration-300 group-hover/header:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider transition-colors group-hover/header:text-primary">Variations</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-semibold transition-colors group-hover/header:text-primary">{item.variations.length} total</span>
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-all ${hoveredVariationsSection === item.id ? 'rotate-180 text-primary' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {hoveredVariationsSection === item.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                        {item.variations.map((variation) => {
                          // Check if this is a 3D asset variation
                          const is3DAsset = variation.type === '3d_asset';
                          
                          // Helper to check if URL is a video file
                          const isVideoUrl = (url) => {
                            if (!url) return false;
                            const urlLower = url.toLowerCase();
                            const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
                            if (videoExtensions.some(ext => urlLower.includes(ext))) {
                              return true;
                            }
                            if (urlLower.includes('/output/output.mp4') || 
                                urlLower.includes('/output.mp4') ||
                                urlLower.includes('video') ||
                                urlLower.includes('output.mp4')) {
                              return true;
                            }
                            return false;
                          };
                          
                          // Extract MP4 video URL for 3D assets
                          let videoUrl = null;
                          if (is3DAsset) {
                            // First check if videoUrl is directly stored
                            if (variation.videoUrl && isVideoUrl(variation.videoUrl)) {
                              videoUrl = variation.videoUrl;
                            } else {
                              // Check various possible locations for video URL
                              const possibleVideoUrls = [
                                variation.downloadUrl,
                                variation.file_url,
                                variation.previewUrl,
                                variation.jobData?.meshResult?.videoUrl,
                                variation.jobData?.meshResult?.downloadUrl,
                                variation.jobData?.meshResult?.previewUrl,
                                variation.jobData?.meshUrl
                              ];
                              
                              for (const url of possibleVideoUrls) {
                                if (url && isVideoUrl(url)) {
                                  videoUrl = url;
                                  break;
                                }
                              }
                            }
                          }
                          
                          // Get preview URL - prioritize previewUrl for 3D assets, fallback to file_url
                          const previewImageUrl = is3DAsset 
                            ? (variation.previewUrl || variation.file_url)
                            : variation.file_url;
                          
                          // Create variation with parent skybox URL for 3D previews
                          const variationWithParent = {
                            ...variation,
                            parentSkyboxUrl: item.file_url, // Include parent skybox for 3D preview
                            jobData: {
                              ...variation.jobData,
                              skyboxUrl: item.file_url
                            }
                          };
                          
                          return (
                          <motion.div
                            key={variation.id}
                            whileHover={{ scale: 1.05, y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            className={`
                              relative group bg-card rounded-2xl overflow-hidden shadow-lg
                              transform transition-all duration-500 cursor-pointer
                              border ${is3DAsset ? 'border-emerald-500/40 hover:border-emerald-500/70' : 'border-border hover:border-primary/50'}
                              ${selectedVariation?.id === variation.id ? 'ring-2 ring-primary' : ''}
                            `}
                            onClick={() => handleVariationClick(variationWithParent)}
                          >
                            <div className="aspect-square relative overflow-hidden bg-muted">
                              {previewImageUrl && !is3DAsset ? (
                                <img
                                  src={previewImageUrl}
                                  alt={variation.title}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                              ) : is3DAsset ? (
                                // 3D Asset Preview - Show MP4 video if available, otherwise preview image or placeholder
                                <>
                                  {videoUrl ? (
                                    // Show MP4 video preview
                                    <div className="relative w-full h-full flex items-center justify-center">
                                      <video
                                        src={videoUrl}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="w-full h-full object-contain"
                                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                                        onError={(e) => {
                                          console.error('❌ Video load error:', videoUrl);
                                          // Fallback to placeholder if video fails
                                          e.target.style.display = 'none';
                                          if (e.target.nextSibling) {
                                            e.target.nextSibling.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      {/* Fallback placeholder (hidden by default) */}
                                      <div className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-emerald-950/30 via-cyan-950/20 to-purple-950/20 relative overflow-hidden">
                                        <div className="relative z-10 text-center">
                                          <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 backdrop-blur-xl border border-emerald-400/40 flex items-center justify-center shadow-2xl">
                                            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                          </div>
                                          <p className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">3D Model</p>
                                        </div>
                                      </div>
                                      {/* 3D Overlay Indicator */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 via-transparent to-transparent pointer-events-none" />
                                    </div>
                                  ) : previewImageUrl ? (
                                    <div className="relative w-full h-full">
                                      <img
                                        src={previewImageUrl}
                                        alt={variation.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        onError={(e) => {
                                          // If preview image fails, show 3D placeholder
                                          e.target.style.display = 'none';
                                          if (e.target.nextSibling) {
                                            e.target.nextSibling.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      {/* 3D Overlay Indicator */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/40 via-transparent to-transparent pointer-events-none" />
                                      {/* Animated 3D Icon Overlay */}
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 backdrop-blur-xl border border-emerald-400/30 flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    // 3D Placeholder when no preview image or video
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950/30 via-cyan-950/20 to-purple-950/20 relative overflow-hidden">
                                      {/* Animated Background Pattern */}
                                      <div className="absolute inset-0 opacity-20">
                                        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
                                        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                                      </div>
                                      {/* 3D Icon */}
                                      <div className="relative z-10 text-center">
                                        <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 backdrop-blur-xl border border-emerald-400/40 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
                                          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                          </svg>
                                        </div>
                                        <p className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">3D Model</p>
                                        <p className="text-[10px] font-mono text-emerald-500/70 mt-1 uppercase">{variation.format || 'GLB'}</p>
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <ImageIcon className="w-10 h-10 text-muted-foreground" />
                                </div>
                              )}

                              {/* Editorial Variation Number Badge */}
                              <div className={`absolute top-3 left-3 text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-xl border ${
                                is3DAsset 
                                  ? 'bg-emerald-600 border-emerald-400/30' 
                                  : 'bg-primary border-primary/30'
                              }`}>
                                #{variation.variationIndex + 1}
                              </div>
                              
                              {/* 3D Asset Badge */}
                              {is3DAsset && (
                                <div className="absolute top-3 right-3 bg-emerald-600 text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-xl border border-emerald-400/40 uppercase tracking-wider flex items-center gap-1.5">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  3D
                                </div>
                              )}

                              {/* Editorial Hover Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end">
                                <div className="p-4 w-full">
                                  <div className="flex items-center justify-between">
                                    <span className="text-foreground text-xs font-semibold flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-lg backdrop-blur-xl border flex items-center justify-center ${
                                        is3DAsset 
                                          ? 'bg-emerald-500/20 border-emerald-400/30' 
                                          : 'bg-purple-500/20 border-purple-400/30'
                                      }`}>
                                        {is3DAsset ? (
                                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        ) : (
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        )}
                                      </div>
                                      {is3DAsset ? 'View 3D' : 'Apply'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {/* Preview Button for 3D Assets */}
                                      {is3DAsset && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleVariationClick(variationWithParent);
                                          }}
                                          className="p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-lg transition-all duration-300 hover:scale-110 border border-white/20"
                                          title="Preview 3D Model"
                                        >
                                          <svg className="w-3.5 h-3.5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (is3DAsset && variation.meshUrl) {
                                            // For 3D assets, open the mesh URL in a new tab
                                            window.open(variation.meshUrl, '_blank');
                                          } else if (variation.file_url) {
                                            downloadImage(variation.file_url, `${variation.title}.jpg`);
                                          }
                                        }}
                                        className="p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-lg transition-all duration-300 hover:scale-110 border border-white/20"
                                        title={is3DAsset ? "Download 3D Model" : "Download"}
                                      >
                                        <svg className="w-3.5 h-3.5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  {variation.title && (
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-2 leading-relaxed">{variation.title}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                          );
                        })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent
          className="max-w-7xl max-h-[90vh] w-full h-full p-0 gap-0 overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex flex-col h-full bg-background">

            <div className="flex-1 flex flex-col min-h-0">
                <DialogHeader className="p-8 border-b border-border space-y-2">
                  <DialogTitle className="text-3xl font-bold text-foreground">
                    {formatTitle(previewItem?.title)}
                  </DialogTitle>
                  {previewItem?.prompt && (
                    <p className="text-muted-foreground text-base leading-relaxed">{previewItem.prompt}</p>
                  )}
                  {previewItem?.style_id && getStyleName(previewItem) && (
                    <div className="mb-4 flex items-center gap-2">
                      <Badge variant="secondary">{getStyleName(previewItem)}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-mono">{formatDate(previewItem?.created_at)}</span>
                    </span>
                    <span className={`px-3 py-1.5 rounded-xl border text-xs uppercase font-bold ${getStatusColor(previewItem?.status)}`}>
                      {previewItem?.status}
                    </span>
                    {previewItem?.source && (
                      <Badge variant="outline">{previewItem.source === 'skyboxes' ? 'Skybox' : 'Job'}</Badge>
                    )}
                  </div>
                </DialogHeader>

                <div className="flex-1 relative overflow-hidden min-h-0">
                  {previewType === '3d' && previewItem?.meshUrl && 
                   !previewItem.meshUrl.toLowerCase().includes('.mp4') &&
                   !previewItem.meshUrl.toLowerCase().includes('output.mp4') &&
                   !previewItem.meshUrl.toLowerCase().includes('/output/output.mp4') ? (
                    <div className="w-full h-full">
                      <AssetViewerWithSkybox
                        assetUrl={previewItem.meshUrl}
                        skyboxImageUrl={previewItem.file_url || previewItem.jobData?.skyboxUrl}
                        assetFormat={previewItem.meshFormat || 'glb'}
                        className="w-full h-full"
                        onLoad={(model) => {
                          console.log('✅ 3D asset loaded in preview:', model);
                        }}
                        onError={(error) => {
                          console.error('❌ 3D asset loading error:', error);
                          console.error('   URL attempted:', previewItem.meshUrl);
                        }}
                      />
                      {/* Fallback download button in case 3D viewer fails */}
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <button
                          onClick={() => window.open(previewItem.meshUrl, '_blank')}
                          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm rounded-lg transition-colors"
                          title="Open 3D model in new tab"
                        >
                          Open in New Tab
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted p-8">
                      {previewItem?.file_url ? (
                        <img
                          src={previewItem.file_url}
                          alt={previewItem.title}
                          className="max-w-full max-h-full object-contain rounded-2xl shadow-lg border border-border"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="hidden w-full h-full items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">No preview available</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-border flex items-center justify-between flex-wrap gap-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    {previewItem?.variations && previewItem.variations.length > 0 && (
                      <Badge variant="secondary">{previewItem.variations.length} variations</Badge>
                    )}
                    {previewItem?.metadata?.hasMesh && (
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                        3D Asset Available
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => {
                        if (previewType === '3d' && previewItem?.meshUrl) {
                          window.open(previewItem.meshUrl, '_blank');
                        } else if (previewItem?.file_url) {
                          downloadImage(previewItem.file_url, `${previewItem.title}.jpg`);
                        }
                      }}
                    >
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        handleSkyboxClick(previewItem);
                        closePreview();
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;