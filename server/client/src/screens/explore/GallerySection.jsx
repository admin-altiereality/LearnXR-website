import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import api from '../../config/axios';
import DownloadPopup from '../../Components/DownloadPopup';

const GallerySection = ({ onSelect, setBackgroundSkybox }) => {
  const [skyboxStyles, setSkyboxStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [currentImageForDownload, setCurrentImageForDownload] = useState(null);

  // Fetch skybox styles from API
  useEffect(() => {
    const fetchSkyboxStyles = async () => {
      try {
        setLoading(true);
        // Fetch all skybox styles by requesting a large limit
        const response = await api.get('/api/skybox/styles?page=1&limit=100');
        const styles = response.data.data?.styles || [];
        console.log(`Loaded ${styles.length} skybox styles in explore section`);
        
        if (styles.length === 0) {
          // fallback data
          const fallbackStyles = [
            {
              id: 'abstract-1',
              name: 'Abstract Dreams',
              description: 'Surreal abstract patterns with vibrant colors and shapes',
              preview_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
              created_at: new Date().toISOString()
            }
          ];
          setSkyboxStyles(fallbackStyles);
        } else {
          setSkyboxStyles(styles);
        }
      } catch (err) {
        console.error('Error fetching skybox styles:', err);
        setError('Failed to load skybox styles');
      } finally {
        setLoading(false);
      }
    };

    fetchSkyboxStyles();
  }, []);

  // Restore selected skybox style from sessionStorage
  useEffect(() => {
    const savedStyle = sessionStorage.getItem('selectedSkyboxStyle');
    if (savedStyle && setBackgroundSkybox) {
      try {
        const parsedStyle = JSON.parse(savedStyle);
        setBackgroundSkybox(parsedStyle);
        setSelectedStyle(parsedStyle);
      } catch (error) {
        console.error('Error parsing saved skybox style:', error);
        sessionStorage.removeItem('selectedSkyboxStyle');
      }
    }
  }, [setBackgroundSkybox]);

  // Handle skybox style selection
  const handleUseSkybox = (skyboxStyle) => {
    // Set the background skybox
    if (setBackgroundSkybox) {
      setBackgroundSkybox(skyboxStyle);
    }
    
    // Update selected style
    setSelectedStyle(skyboxStyle);
    
    // Store in sessionStorage for persistence
    sessionStorage.setItem('selectedSkyboxStyle', JSON.stringify(skyboxStyle));
    
    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(skyboxStyle);
    }

    // Show success message using a toast or notification
    const successMessage = document.createElement('div');
    successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
              successMessage.textContent = `✅ In3D.Ai style "${skyboxStyle.name}" applied!`;
    document.body.appendChild(successMessage);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      if (successMessage.parentNode) {
        successMessage.parentNode.removeChild(successMessage);
      }
    }, 3000);
  };

  // Handle download for skybox style
  const handleDownload = (skyboxStyle) => {
    // For skybox styles, we'll use the preview image or a placeholder
    const imageUrl = skyboxStyle.preview_url || skyboxStyle.image_jpg || skyboxStyle.image;
    if (imageUrl) {
      setCurrentImageForDownload({ image: imageUrl, title: skyboxStyle.name });
      setShowDownloadPopup(true);
    } else {
      alert('No preview image available for download');
    }
  };

  // Filter styles by category
  const filteredStyles = selectedCategory === 'all' 
    ? skyboxStyles 
    : skyboxStyles.filter(style => 
        style.name?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        style.description?.toLowerCase().includes(selectedCategory.toLowerCase())
      );

  // Get unique categories from styles
  const categories = ['all', ...new Set(
    skyboxStyles.flatMap(style => {
      const cats = [];
      if (style.name?.toLowerCase().includes('nature')) cats.push('nature');
      if (style.name?.toLowerCase().includes('sci-fi') || style.name?.toLowerCase().includes('space')) cats.push('sci-fi');
      if (style.name?.toLowerCase().includes('fantasy') || style.name?.toLowerCase().includes('magical')) cats.push('fantasy');
      if (style.name?.toLowerCase().includes('urban') || style.name?.toLowerCase().includes('city')) cats.push('urban');
      if (style.name?.toLowerCase().includes('abstract')) cats.push('abstract');
      if (style.name?.toLowerCase().includes('minimal')) cats.push('minimal');
      return cats;
    })
  )];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
                  <div className="text-white text-lg">Loading In3D.Ai styles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Skybox Gallery</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Browse and apply stunning In3D.Ai styles to your 3D scenes
        </p>
      </div>

      {/* Categories Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((category) => (
          <motion.button
            key={category}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg backdrop-blur-md border transition-all duration-200 ${
              selectedCategory === category
                ? 'bg-white/20 border-white/30 text-white'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </motion.button>
        ))}
      </div>

                {/* In3D.Ai Styles Grid */}
      {filteredStyles.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
                      <p>No In3D.Ai styles found for "{selectedCategory}" category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredStyles.map((style, index) => (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`relative group rounded-xl overflow-hidden border transition-all duration-200 ${
                selectedStyle?.id === style.id
                  ? 'bg-white/10 border-green-500/50 shadow-lg shadow-green-500/20'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              {/* Preview Image */}
              <div className="aspect-square relative overflow-hidden">
                {style.preview_url ? (
                  <img
                    src={style.preview_url}
                    alt={style.name}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 ${
                    style.preview_url ? 'hidden' : 'flex'
                  }`}
                >
                  <div className="text-center text-white/80">
                    <div className="text-4xl mb-2">🌌</div>
                    <div className="text-sm">{style.name}</div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Selected indicator */}
                {selectedStyle?.id === style.id && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-2">{style.name}</h3>
                {style.description && (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-2">{style.description}</p>
                )}
                
                {/* Style Info */}
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>ID: {style.id}</span>
                  {style.created_at && (
                    <span>{new Date(style.created_at).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUseSkybox(style)}
                    className={`flex-1 px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                      selectedStyle?.id === style.id
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                    }`}
                  >
                    {selectedStyle?.id === style.id ? '✓ Applied' : 'Use Style'}
                  </button>
                  
                  <button
                    onClick={() => handleDownload(style)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all duration-200"
                    title="Download preview"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-gray-400 text-sm">
        <p>Showing {filteredStyles.length} of {skyboxStyles.length} total styles</p>
      </div>

      {/* Download Popup */}
      <DownloadPopup
        isOpen={showDownloadPopup}
        onClose={() => setShowDownloadPopup(false)}
        imageUrl={currentImageForDownload?.image}
        title={currentImageForDownload?.title || 'skybox-style'}
      />
    </div>
  );
};

export default GallerySection; 