import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AssetViewerWithSkybox } from '../Components/AssetViewerWithSkybox';

const History = ({ setBackgroundSkybox }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSkybox, setSelectedSkybox] = useState(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'pending'
  const [previewItem, setPreviewItem] = useState(null); // Item to show in preview modal
  const [previewType, setPreviewType] = useState('skybox'); // 'skybox' or '3d'
  const navigate = useNavigate();
  const { user } = useAuth();

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
              source: 'skyboxes'
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
                type: 'skybox'
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
                meshUrl: bestMeshUrl // Store the resolved mesh URL directly
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
                  variationIndex: 1
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
        created_at: variation.created_at
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'complete':
        return 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40 shadow-emerald-500/20';
      case 'pending':
      case 'processing':
        return 'text-amber-300 bg-amber-500/20 border-amber-500/40 shadow-amber-500/20';
      case 'failed':
        return 'text-red-300 bg-red-500/20 border-red-500/40 shadow-red-500/20';
      case 'partial':
        return 'text-blue-300 bg-blue-500/20 border-blue-500/40 shadow-blue-500/20';
      default:
        return 'text-gray-300 bg-gray-500/20 border-gray-500/40 shadow-gray-500/20';
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
    <div className="flex-1 bg-transparent min-h-screen py-24 relative">
      {/* Layered Background with Texture */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-layered bg-texture opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-purple-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Editorial Header with Distinctive Typography */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 backdrop-blur-sm mb-4">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-mono font-semibold text-cyan-300 uppercase tracking-wider">Archive</span>
              </div>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                  Generation
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                  History
                </span>
              </h1>
              <p className="font-body text-lg text-gray-300/80 max-w-2xl leading-relaxed">
                A curated archive of your creative journey—every environment, every variation, every moment of inspiration.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  console.log('🔄 Manual refresh triggered');
                  setLoading(true);
                  setTimeout(() => setLoading(false), 1000);
                }}
                className="px-5 py-2.5 bg-[#1a1a1a]/80 hover:bg-[#222]/80 backdrop-blur-xl border border-gray-700/50 rounded-xl text-gray-300 hover:text-white transition-all duration-300 text-sm font-medium font-body"
                title="Refresh history"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/main')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-cyan-400/20 font-display"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create New</span>
                </div>
              </motion.button>
            </div>
          </div>

          {/* Editorial Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#141414]/60 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-[#1a1a1a]/80 rounded-xl p-1 border border-gray-700/50">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 font-body ${
                    viewMode === 'grid'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Grid</span>
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 font-body ${
                    viewMode === 'list'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span>List</span>
                  </div>
                </motion.button>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 bg-[#1a1a1a]/80 border border-gray-700/50 rounded-xl text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 backdrop-blur-sm font-body transition-all duration-300"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a]/80 rounded-xl border border-gray-700/50">
              <span className="text-sm font-mono font-semibold text-cyan-300">{filteredHistory.length}</span>
              <span className="text-sm text-gray-400 font-body">
                {filteredHistory.length !== 1 ? 'generations' : 'generation'}
              </span>
            </div>
          </div>
        </motion.div>
        
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-gradient-to-br from-red-950/30 to-orange-950/20 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-xl shadow-red-500/10"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-300 font-display font-semibold mb-2 text-lg">Error loading history</p>
                <p className="text-red-300/80 text-sm font-body mb-4">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    window.location.reload();
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-lg shadow-red-500/25"
                >
                  Retry
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
        
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center h-96"
          >
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-cyan-500/20 rounded-full" />
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-cyan-400 border-r-purple-400 rounded-full animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display text-xl font-semibold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
                  Loading your archive
                </p>
                <p className="font-body text-sm text-gray-400">Gathering your creative journey...</p>
              </div>
            </div>
          </motion.div>
        ) : filteredHistory.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-gradient-to-br from-[#141414]/80 via-[#0a0a0a]/80 to-[#1a1a1a]/80 backdrop-blur-xl rounded-3xl p-16 text-center border border-gray-800/50 shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-display text-3xl font-bold text-white mb-3">Your archive awaits</h3>
              <p className="font-body text-lg text-gray-300/80 mb-8 max-w-md mx-auto leading-relaxed">
                Every creation tells a story. Start your first chapter by generating an In3D.Ai environment.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/main')}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 text-white rounded-xl transition-all duration-300 font-display font-semibold text-lg shadow-xl shadow-cyan-500/30 border border-cyan-400/20"
              >
                Create Your First Environment
              </motion.button>
            </div>
          </motion.div>
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
                  {/* Main In3D.Ai Environment - Editorial Card Design */}
                  <motion.div
                    whileHover={{ y: -4 }}
                    className={`
                      relative group bg-gradient-to-br from-[#141414]/90 via-[#0a0a0a]/90 to-[#1a1a1a]/90
                      backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl
                      transform transition-all duration-500 cursor-pointer
                      border border-gray-800/50 hover:border-cyan-500/50
                      ${selectedSkybox?.id === item.id ? 'ring-2 ring-cyan-500/70 shadow-cyan-500/30' : ''}
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
                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 pointer-events-none" />
                    
                    {/* Subtle Texture Overlay */}
                    <div className="absolute inset-0 bg-texture opacity-30 pointer-events-none" />
                    {/* Image Container - Editorial Style */}
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
                        className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#1a1a1a] ${
                          item.file_url ? 'hidden' : 'flex'
                        }`}
                      >
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">No Preview</p>
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
                        {/* Source Indicator - Editorial Style */}
                        {item.source && (
                          <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-[#1a1a1a]/90 backdrop-blur-xl text-gray-300 border border-gray-700/50 uppercase tracking-wider">
                            {item.source === 'skyboxes' ? 'Skybox' : 'Job'}
                          </span>
                        )}
                      </div>

                      {/* Editorial Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end">
                        <div className="p-6 w-full">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-xl border border-cyan-500/30 flex items-center justify-center">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </div>
                              <span className="text-white font-display font-semibold text-sm">Apply to background</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Preview Button */}
                              <button
                                onClick={(e) => handlePreviewClick(item, e)}
                                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl transition-all duration-300 hover:scale-110 border border-white/20"
                                title="Preview"
                              >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              {/* Download Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(item.file_url, `${item.title}.jpg`);
                                }}
                                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl transition-all duration-300 hover:scale-110 border border-white/20"
                                title="Download"
                              >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {item.prompt && (
                            <p className="text-xs text-gray-200/90 line-clamp-2 mb-2 font-body leading-relaxed">{item.prompt}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Editorial Content Section */}
                    <div className={`relative z-10 ${viewMode === 'grid' ? 'p-6' : 'flex-1 p-6'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="font-display text-xl font-bold text-white line-clamp-2 flex-1 pr-3 group-hover:text-cyan-300 transition-colors duration-300 leading-tight">
                          {formatTitle(item.title)}
                        </h3>
                        {item.variations && item.variations.length > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 backdrop-blur-sm">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-xs font-display font-bold text-purple-300">{item.variations.length}</span>
                          </div>
                        )}
                      </div>
                      
                      {item.prompt && (
                        <p className="font-body text-sm text-gray-300/70 mb-5 line-clamp-2 leading-relaxed">{item.prompt}</p>
                      )}
                      
                      <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                        <div className="flex items-center gap-2.5 text-xs text-gray-400 font-body">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-mono">{formatDate(item.created_at)}</span>
                        </div>
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
                  </motion.div>

                  {/* Editorial Variations Section */}
                  {item.variations && item.variations.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 space-y-4 pt-6 border-t border-gray-800/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <h4 className="font-display text-sm font-bold text-gray-200 uppercase tracking-wider">Variations</h4>
                        </div>
                        <span className="text-xs font-mono text-gray-500 font-semibold">{item.variations.length} total</span>
                      </div>
                      
                      <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                        {item.variations.map((variation) => (
                          <motion.div
                            key={variation.id}
                            whileHover={{ scale: 1.05, y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            className={`
                              relative group bg-gradient-to-br from-[#1a1a1a]/90 to-[#0a0a0a]/90 backdrop-blur-xl 
                              rounded-2xl overflow-hidden shadow-xl
                              transform transition-all duration-500 cursor-pointer
                              border border-gray-800/50 hover:border-purple-500/60
                              ${selectedVariation?.id === variation.id ? 'ring-2 ring-purple-500/70 shadow-purple-500/30' : ''}
                            `}
                            onClick={() => handleVariationClick(variation)}
                          >
                            <div className="aspect-square relative overflow-hidden">
                              {variation.file_url ? (
                                <img
                                  src={variation.file_url}
                                  alt={variation.title}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]">
                                  <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}

                              {/* Editorial Variation Number Badge */}
                              <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-display font-bold px-2.5 py-1 rounded-xl shadow-xl backdrop-blur-xl border border-purple-400/30">
                                #{variation.variationIndex + 1}
                              </div>

                              {/* Editorial Hover Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end">
                                <div className="p-4 w-full">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs font-display font-semibold flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-lg bg-purple-500/20 backdrop-blur-xl border border-purple-400/30 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                      </div>
                                      Apply
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadImage(variation.file_url, `${variation.title}.jpg`);
                                      }}
                                      className="p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-lg transition-all duration-300 hover:scale-110 border border-white/20"
                                      title="Download"
                                    >
                                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Editorial Preview Modal */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full h-full max-w-7xl max-h-[90vh] m-4 bg-gradient-to-br from-[#141414]/95 via-[#0a0a0a]/95 to-[#1a1a1a]/95 backdrop-blur-2xl rounded-3xl overflow-hidden border border-gray-800/50 shadow-2xl"
            >
              {/* Texture Overlay */}
              <div className="absolute inset-0 bg-texture opacity-20 pointer-events-none" />
              
              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={closePreview}
                className="absolute top-6 right-6 z-10 p-3 bg-[#1a1a1a]/90 hover:bg-[#222]/90 backdrop-blur-xl rounded-xl transition-all duration-300 border border-gray-700/50 shadow-lg"
                aria-label="Close preview"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>

              {/* Preview Content */}
              <div className="w-full h-full flex flex-col relative z-10">
                {/* Editorial Header */}
                <div className="p-8 border-b border-gray-800/50 bg-gradient-to-r from-[#141414]/80 to-[#0a0a0a]/80 backdrop-blur-xl">
                  <h2 className="font-display text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {formatTitle(previewItem.title)}
                  </h2>
                  {previewItem.prompt && (
                    <p className="font-body text-gray-300/80 text-base mb-4 leading-relaxed">{previewItem.prompt}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-2 font-body text-gray-400">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-mono">{formatDate(previewItem.created_at)}</span>
                    </span>
                    <span className={`px-3 py-1.5 rounded-xl border backdrop-blur-xl font-display font-bold text-xs uppercase tracking-wider ${getStatusColor(previewItem.status)}`}>
                      {previewItem.status}
                    </span>
                    {previewItem.source && (
                      <span className="px-3 py-1.5 rounded-xl bg-[#1a1a1a]/80 text-gray-300 border border-gray-700/50 font-mono text-xs uppercase tracking-wider backdrop-blur-xl">
                        {previewItem.source === 'skyboxes' ? 'Skybox' : 'Job'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Preview Body */}
                <div className="flex-1 relative overflow-hidden">
                  {previewType === '3d' && previewItem.meshUrl && 
                   !previewItem.meshUrl.toLowerCase().includes('.mp4') &&
                   !previewItem.meshUrl.toLowerCase().includes('output.mp4') &&
                   !previewItem.meshUrl.toLowerCase().includes('/output/output.mp4') ? (
                    // 3D Preview
                    <div className="w-full h-full">
                      {console.log('🔍 Rendering 3D preview with:', {
                        meshUrl: previewItem.meshUrl,
                        meshFormat: previewItem.meshFormat,
                        skyboxUrl: previewItem.file_url || previewItem.jobData?.skyboxUrl
                      })}
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
                          className="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-500 text-white text-sm rounded-lg backdrop-blur-sm transition-colors"
                          title="Open 3D model in new tab"
                        >
                          Open in New Tab
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Editorial Skybox Image Preview
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#1a1a1a] p-8">
                      {previewItem.file_url ? (
                        <img
                          src={previewItem.file_url}
                          alt={previewItem.title}
                          className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-gray-800/50"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="hidden w-full h-full items-center justify-center">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 flex items-center justify-center border border-gray-700/50">
                            <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="font-body text-gray-400">No preview available</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Editorial Footer Actions */}
                <div className="p-8 border-t border-gray-800/50 bg-gradient-to-r from-[#141414]/80 to-[#0a0a0a]/80 backdrop-blur-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {previewItem.variations && previewItem.variations.length > 0 && (
                      <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 backdrop-blur-sm">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="font-display font-semibold text-sm text-gray-200">{previewItem.variations.length} variations</span>
                      </div>
                    )}
                    {previewItem.metadata?.hasMesh && (
                      <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl border border-emerald-500/30 backdrop-blur-sm">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="font-display font-semibold text-sm text-emerald-300">3D Asset Available</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (previewType === '3d' && previewItem.meshUrl) {
                          window.open(previewItem.meshUrl, '_blank');
                        } else if (previewItem.file_url) {
                          downloadImage(previewItem.file_url, `${previewItem.title}.jpg`);
                        }
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 text-white rounded-xl transition-all duration-300 font-display font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/25 border border-cyan-400/20"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        handleSkyboxClick(previewItem);
                        closePreview();
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white rounded-xl transition-all duration-300 font-display font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/25 border border-emerald-400/20"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Apply
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;