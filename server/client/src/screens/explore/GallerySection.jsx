import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { skyboxApiService } from '../../services/skyboxApiService';
import DownloadPopup from '../../Components/DownloadPopup';

const GallerySection = ({ onSelect, setBackgroundSkybox }) => {
  const navigate = useNavigate();
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [currentImageForDownload, setCurrentImageForDownload] = useState(null);

  // Fetch skybox styles from API
  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetchStyles = async () => {
      try {
        const response = await skyboxApiService.getStyles(1, 100);
        // Handle nested response structure: { success, data: { styles: [...] } }
        const rawStyles = response?.data?.styles || response?.styles || response?.data || [];
        const stylesArr = Array.isArray(rawStyles) ? rawStyles : [];
        setStyles(stylesArr);
        setLoading(false);
        setError(null);
        console.log('Fetched In3D.Ai styles (explore):', stylesArr);
      } catch (err) {
        setLoading(false);
        setError("Failed to load In3D.Ai styles");
        setStyles([]);
        console.error("Error fetching In3D.Ai styles (explore):", err);
      }
    };
    fetchStyles();
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
    
    // Store in sessionStorage for persistence and navigation
    sessionStorage.setItem('selectedSkyboxStyle', JSON.stringify(skyboxStyle));
    sessionStorage.setItem('fromExplore', 'true');
    sessionStorage.setItem('navigateToMain', 'true');
    
    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(skyboxStyle);
    }

    // Show success message
    const successMessage = document.createElement('div');
    successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
    successMessage.innerHTML = `
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span>Style "${skyboxStyle.name}" selected! Navigating to Create...</span>
    `;
    document.body.appendChild(successMessage);
    
    // Navigate to main section after a short delay
    setTimeout(() => {
      navigate('/main');
      
      // Remove the message after navigation
      setTimeout(() => {
        if (successMessage.parentNode) {
          successMessage.parentNode.removeChild(successMessage);
        }
      }, 2000);
    }, 1500);
  };

  // Handle download for skybox style
  const handleDownload = (skyboxStyle) => {
    // For skybox styles, we'll use the preview image or a placeholder
    const imageUrl = skyboxStyle.preview_url || skyboxStyle.preview_image_url || skyboxStyle.image || skyboxStyle.image_url || skyboxStyle.image_jpg;
    if (imageUrl) {
      setCurrentImageForDownload({ image: imageUrl, title: skyboxStyle.name });
      setShowDownloadPopup(true);
    } else {
      alert('No preview image available for download');
    }
  };

  // Filter styles by category
  const filteredStyles = selectedCategory === 'all' 
    ? styles 
    : styles.filter(style => 
        style.name?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        style.description?.toLowerCase().includes(selectedCategory.toLowerCase())
      );

  // Get unique categories from styles
  const categories = ['all', ...new Set(
    styles.flatMap(style => {
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <div className="text-white/60 text-lg">Loading In3D.Ai styles...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/30">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-300 mb-4">{error}</p>
        <motion.button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white rounded-xl font-medium transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Retry
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Skybox Gallery</h2>
        <p className="text-white/50 max-w-2xl mx-auto">
          Browse and apply stunning In3D.Ai styles to your 3D scenes
        </p>
      </div>

      {/* Categories Filter */}
      <div className="flex flex-wrap gap-3 justify-center">
        {categories.map((category) => (
          <motion.button
            key={category}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-xl border transition-all duration-300 ${
              selectedCategory === category
                ? 'bg-gradient-to-r from-sky-500 to-violet-500 border-transparent text-white shadow-lg shadow-violet-500/25'
                : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </motion.button>
        ))}
      </div>

                {/* In3D.Ai Styles Grid */}
      {filteredStyles.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-6 border border-white/10">
            <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/50">No In3D.Ai styles found for "{selectedCategory}" category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStyles.map((style, index) => (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.25, 0.4, 0.25, 1] }}
              className={`relative group rounded-2xl overflow-hidden border transition-all duration-300 ${
                selectedStyle?.id === style.id
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
              }`}
            >
              {/* Preview Image */}
              <div className="aspect-square relative overflow-hidden">
                {(style.preview_url || style.preview_image_url || style.image || style.image_url) ? (
                  <img
                    src={style.preview_url || style.preview_image_url || style.image || style.image_url}
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
                    (style.preview_url || style.preview_image_url || style.image || style.image_url) ? 'hidden' : 'flex'
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
                  <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-lg font-semibold text-white mb-2">{style.name}</h3>
                {style.description && (
                  <p className="text-sm text-white/60 mb-3 line-clamp-2">{style.description}</p>
                )}
                
                {/* Style Info */}
                <div className="flex items-center justify-between text-xs text-white/40 mb-4">
                  <span>ID: {style.id}</span>
                  {style.created_at && (
                    <span>{new Date(style.created_at).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => handleUseSkybox(style)}
                    className={`group/btn relative flex-1 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium overflow-hidden ${
                      selectedStyle?.id === style.id
                        ? 'text-white'
                        : 'text-white'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {selectedStyle?.id === style.id ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                        <span className="relative">✓ Applied</span>
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                        <span className="relative">Use Style</span>
                      </>
                    )}
                  </motion.button>
                  
                  <motion.button
                    onClick={() => handleDownload(style)}
                    className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 hover:border-white/20 text-white rounded-xl transition-all duration-300"
                    title="Download preview"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-white/50 text-sm mt-8">
        <p>Showing {filteredStyles.length} of {styles.length} total styles</p>
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