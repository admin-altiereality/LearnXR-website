import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
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

            // If there are variations, include them in the same object
            if (data.variations && Array.isArray(data.variations) && data.variations.length > 0) {
              baseSkybox.variations = data.variations.map((variation, index) => ({
                id: `${doc.id}_variation_${index}`,
                file_url: variation.image || variation.image_jpg || variation.file_url,
                title: variation.title || `${baseSkybox.title} (Variation ${index + 1})`,
                prompt: variation.prompt || baseSkybox.prompt,
                created_at: data.createdAt,
                status: variation.status || data.status || 'completed',
                metadata: data.metadata || {},
                isVariation: true,
                parentId: doc.id,
                variationIndex: index
              }));
            } else {
              baseSkybox.variations = [];
            }

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
    if (!variation.file_url) {
      console.warn("No file URL available for this variation");
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
    <div className="flex-1 bg-transparent min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white/90 mb-2">Generation History</h1>
            <p className="text-gray-400">Manage and explore your created In3D.Ai environments</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                // Force refresh by re-triggering the query
                console.log('🔄 Manual refresh triggered');
                setLoading(true);
                // The useEffect will re-run when loading state changes, but we need to force it
                // Actually, the onSnapshot should auto-update, so this is just for user feedback
                setTimeout(() => setLoading(false), 1000);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 text-sm"
              title="Refresh history"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => navigate('/main')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-medium shadow-lg"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create New</span>
              </div>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'list'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="text-sm text-gray-400">
            {filteredHistory.length} generation{filteredHistory.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 backdrop-blur-sm rounded-lg border border-red-500/20">
            <p className="text-red-300 font-semibold mb-2">Error loading history:</p>
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                // Force re-render by updating a dependency
                window.location.reload();
              }}
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-t-2 border-b-2 border-blue-400 rounded-full animate-spin"></div>
              <p className="text-blue-300">Loading your generations...</p>
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="bg-gray-900/20 backdrop-blur-sm rounded-lg p-12 text-center border border-gray-700/20">
            <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No generations found</h3>
            <p className="text-gray-400 mb-6">Start creating your first In3D.Ai environment to see it here</p>
            <button
              onClick={() => navigate('/main')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-medium"
            >
                              Create Your First In3D.Ai Environment
            </button>
          </div>
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
                  {/* Main In3D.Ai Environment - Enhanced Card */}
                  <div
                    className={`
                      relative group bg-gradient-to-br from-gray-900/40 via-gray-900/30 to-gray-800/40 
                      backdrop-blur-md rounded-2xl overflow-hidden shadow-xl
                      transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer
                      border border-gray-700/30 hover:border-blue-500/50 active:scale-[0.98]
                      ${selectedSkybox?.id === item.id ? 'ring-2 ring-blue-500/70 shadow-blue-500/20' : ''}
                      ${viewMode === 'list' ? 'flex items-center space-x-4 p-4' : ''}
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
                    {/* Image Container with Enhanced Styling */}
                    <div className={`relative overflow-hidden ${viewMode === 'grid' ? 'aspect-[16/9]' : 'w-32 h-32 flex-shrink-0 rounded-lg'}`}>
                      {item.file_url ? (
                        <img
                          src={item.file_url}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800/90 via-gray-700/80 to-gray-900/90 ${
                          item.file_url ? 'hidden' : 'flex'
                        }`}
                      >
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-500">No Preview</p>
                        </div>
                      </div>

                      {/* Enhanced Status Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg border backdrop-blur-sm shadow-lg ${getStatusColor(item.status)}`}>
                          <span className="flex items-center gap-1.5">
                            {item.status === 'completed' && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {item.status === 'pending' && (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {item.status === 'failed' && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className="capitalize">{item.status}</span>
                          </span>
                        </span>
                        {/* Source Indicator */}
                        {item.source && (
                          <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-gray-800/80 backdrop-blur-sm text-gray-300 border border-gray-700/50">
                            {item.source === 'skyboxes' ? 'Skybox' : 'Job'}
                          </span>
                        )}
                      </div>

                      {/* Enhanced Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end">
                        <div className="p-5 w-full">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span className="text-white text-sm font-semibold">Click to apply</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Download Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(item.file_url, `${item.title}.jpg`);
                                }}
                                className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-all duration-200 hover:scale-110"
                                title="Download"
                              >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {item.prompt && (
                            <p className="text-xs text-gray-300 line-clamp-2 mb-2">{item.prompt}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Content Section */}
                    <div className={viewMode === 'grid' ? 'p-5' : 'flex-1 p-4'}>
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-bold text-white line-clamp-2 flex-1 pr-2 group-hover:text-blue-300 transition-colors">
                          {formatTitle(item.title)}
                        </h3>
                        {item.variations && item.variations.length > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-md border border-purple-500/30">
                            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-xs font-semibold text-purple-300">{item.variations.length}</span>
                          </div>
                        )}
                      </div>
                      
                      {item.prompt && (
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2 leading-relaxed">{item.prompt}</p>
                      )}
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                        {item.metadata?.hasMesh && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-md border border-emerald-500/30">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="text-[10px] font-medium text-emerald-300">3D</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Variations Section */}
                  {item.variations && item.variations.length > 0 && (
                    <div className="mt-4 space-y-3 pt-4 border-t border-gray-700/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <h4 className="text-sm font-semibold text-gray-300">Variations</h4>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{item.variations.length} total</span>
                      </div>
                      
                      <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                        {item.variations.map((variation) => (
                          <div
                            key={variation.id}
                            className={`
                              relative group bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm 
                              rounded-xl overflow-hidden shadow-lg
                              transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer
                              border border-gray-700/40 hover:border-purple-500/60 active:scale-95
                              ${selectedVariation?.id === variation.id ? 'ring-2 ring-purple-500/70 shadow-purple-500/30' : ''}
                            `}
                            onClick={() => handleVariationClick(variation)}
                          >
                            <div className="aspect-square relative overflow-hidden">
                              {variation.file_url ? (
                                <img
                                  src={variation.file_url}
                                  alt={variation.title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800/90 to-gray-900/90">
                                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}

                              {/* Enhanced Variation Number Badge */}
                              <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg backdrop-blur-sm border border-purple-400/30">
                                #{variation.variationIndex + 1}
                              </div>

                              {/* Enhanced Hover Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end">
                                <div className="p-3 w-full">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs font-semibold flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Apply
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadImage(variation.file_url, `${variation.title}.jpg`);
                                      }}
                                      className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-all duration-200 hover:scale-110"
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full h-full max-w-7xl max-h-[90vh] m-4 bg-gray-900/95 backdrop-blur-md rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl"
            >
              {/* Close Button */}
              <button
                onClick={closePreview}
                className="absolute top-4 right-4 z-10 p-3 bg-gray-800/90 hover:bg-gray-700/90 backdrop-blur-sm rounded-lg transition-all duration-200 hover:scale-110 border border-gray-700/50"
                aria-label="Close preview"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Preview Content */}
              <div className="w-full h-full flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700/50 bg-gradient-to-r from-gray-900/50 to-gray-800/50">
                  <h2 className="text-2xl font-bold text-white mb-2">{formatTitle(previewItem.title)}</h2>
                  {previewItem.prompt && (
                    <p className="text-gray-300 text-sm">{previewItem.prompt}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDate(previewItem.created_at)}
                    </span>
                    <span className={`px-2 py-1 rounded-md border ${getStatusColor(previewItem.status)}`}>
                      {previewItem.status}
                    </span>
                    {previewItem.source && (
                      <span className="px-2 py-1 rounded-md bg-gray-700/50 text-gray-300 border border-gray-600/50">
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
                          // Fallback to skybox preview on error
                          setPreviewType('skybox');
                        }}
                      />
                    </div>
                  ) : (
                    // Skybox Image Preview
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-8">
                      {previewItem.file_url ? (
                        <img
                          src={previewItem.file_url}
                          alt={previewItem.title}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="hidden w-full h-full items-center justify-center">
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-400">No preview available</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-900/50 to-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {previewItem.variations && previewItem.variations.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>{previewItem.variations.length} variations</span>
                      </div>
                    )}
                    {previewItem.metadata?.hasMesh && (
                      <div className="flex items-center gap-2 text-sm text-emerald-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>3D Asset Available</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (previewType === '3d' && previewItem.meshUrl) {
                          window.open(previewItem.meshUrl, '_blank');
                        } else if (previewItem.file_url) {
                          downloadImage(previewItem.file_url, `${previewItem.title}.jpg`);
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={() => {
                        handleSkyboxClick(previewItem);
                        closePreview();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Apply
                    </button>
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