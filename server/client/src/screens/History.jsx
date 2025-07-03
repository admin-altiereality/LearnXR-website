import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const History = ({ setBackgroundSkybox }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSkybox, setSelectedSkybox] = useState(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'pending'
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const skyboxesRef = collection(db, 'skyboxes');
    const skyboxQuery = query(
      skyboxesRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      skyboxQuery,
      (snapshot) => {
        try {
          const skyboxes = snapshot.docs.map(doc => {
            const data = doc.data();
            const baseSkybox = {
              id: doc.id,
              file_url: data.imageUrl,
              title: data.title || data.promptUsed || 'Untitled Generation',
              prompt: data.promptUsed,
              created_at: data.createdAt,
              status: data.status,
              metadata: data.metadata,
              isVariation: false
            };

            // If there are variations, include them in the same object
            if (data.variations && Array.isArray(data.variations)) {
              baseSkybox.variations = data.variations.map((variation, index) => ({
                id: `${doc.id}_variation_${index}`,
                file_url: variation.image,
                title: `${baseSkybox.title} (Variation ${index + 1})`,
                prompt: variation.prompt || baseSkybox.prompt,
                created_at: data.createdAt,
                status: data.status,
                metadata: data.metadata,
                isVariation: true,
                parentId: doc.id,
                variationIndex: index
              }));
            } else {
              baseSkybox.variations = [];
            }

            return baseSkybox;
          });

          setHistory(skyboxes);
          setLoading(false);
        } catch (err) {
          console.error("Error processing skybox data:", err);
          setError("Error processing skybox data");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error in real-time listener:", err);
        setError(`Failed to load generation history: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
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
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'failed':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
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
            <p className="text-red-300">{error}</p>
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
                  {/* Main In3D.Ai Environment */}
                  <div
                    className={`
                      relative group bg-gray-900/20 backdrop-blur-sm rounded-xl overflow-hidden
                      transform transition-all duration-300 hover:scale-[1.02] cursor-pointer
                      border border-gray-700/20 hover:border-blue-500/30 active:scale-95
                      ${selectedSkybox?.id === item.id ? 'ring-2 ring-blue-500/50' : ''}
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
                    {/* Image */}
                    <div className={`relative ${viewMode === 'grid' ? 'aspect-w-16 aspect-h-9' : 'w-24 h-24 flex-shrink-0'}`}>
                      {item.file_url ? (
                        <img
                          src={item.file_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 ${
                          item.file_url ? 'hidden' : 'flex'
                        }`}
                      >
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-2 left-2">
                        <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                        <div className="p-4 w-full">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm font-medium">Click to apply</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(item.file_url, `${item.title}.jpg`);
                              }}
                              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={viewMode === 'grid' ? 'p-4' : 'flex-1'}>
                      <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{formatTitle(item.title)}</h3>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.prompt}</p>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(item.created_at)}</span>
                        {item.variations && item.variations.length > 0 && (
                          <span className="flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span>{item.variations.length} variations</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Variations */}
                  {item.variations && item.variations.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-300">Variations</h4>
                        <span className="text-xs text-gray-500">{item.variations.length} total</span>
                      </div>
                      
                      <div className={`grid gap-2 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                        {item.variations.map((variation) => (
                          <div
                            key={variation.id}
                            className={`
                              relative group bg-gray-800/30 backdrop-blur-sm rounded-lg overflow-hidden
                              transform transition-all duration-300 hover:scale-105 cursor-pointer
                              border border-gray-700/30 hover:border-purple-500/50 active:scale-95
                              ${selectedVariation?.id === variation.id ? 'ring-2 ring-purple-500/50' : ''}
                            `}
                            onClick={() => handleVariationClick(variation)}
                          >
                            <div className="aspect-square relative">
                              {variation.file_url ? (
                                <img
                                  src={variation.file_url}
                                  alt={variation.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}

                              {/* Variation Number */}
                              <div className="absolute top-1 left-1 bg-purple-500/80 text-white text-xs px-1.5 py-0.5 rounded">
                                {variation.variationIndex + 1}
                              </div>

                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                                <div className="p-2 w-full">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs">Apply</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadImage(variation.file_url, `${variation.title}.jpg`);
                                      }}
                                      className="p-1 bg-white/20 hover:bg-white/30 rounded transition-all duration-200"
                                    >
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  );
};

export default History;
