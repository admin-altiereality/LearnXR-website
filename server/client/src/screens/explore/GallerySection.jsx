import { motion } from 'framer-motion';
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { skyboxApiService } from '../../services/skyboxApiService';
import DownloadPopup from '../../Components/DownloadPopup';
import { useAuth } from '../../contexts/AuthContext';
import { getAllStyleUsageStats } from '../../services/styleUsageService';

// Utility functions for tracking style usage
const STYLE_USAGE_KEY = 'skybox_style_usage';

const getStyleUsage = () => {
  try {
    const stored = localStorage.getItem(STYLE_USAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading style usage:', error);
    return {};
  }
};

const incrementStyleUsage = (styleId) => {
  try {
    const usage = getStyleUsage();
    usage[styleId] = (usage[styleId] || 0) + 1;
    localStorage.setItem(STYLE_USAGE_KEY, JSON.stringify(usage));
    return usage[styleId];
  } catch (error) {
    console.error('Error incrementing style usage:', error);
    return 0;
  }
};

const getStyleUsageCount = (styleId) => {
  const usage = getStyleUsage();
  return usage[styleId] || 0;
};

const GallerySection = ({ onSelect, setBackgroundSkybox }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [currentImageForDownload, setCurrentImageForDownload] = useState(null);
  const [styleUsageStats, setStyleUsageStats] = useState({});
  const [totalGenerations, setTotalGenerations] = useState(0);
  const [refreshingStats, setRefreshingStats] = useState(false);

  // Fetch skybox styles from API and usage statistics from Firebase
  const fetchStylesAndUsage = async () => {
      try {
        // Fetch styles from API
        const response = await skyboxApiService.getStyles(1, 100);
        const rawStyles = response?.data?.styles || response?.styles || response?.data || [];
        const stylesArr = Array.isArray(rawStyles) ? rawStyles : [];
        
        // Fetch usage statistics from the new style_usage_stats collection (much more efficient!)
        let firebaseUsageStats = {};
        try {
          if (db) {
            console.log('📊 Fetching style usage statistics from style_usage_stats collection...');
            
            // Use the new service to get all style usage stats efficiently
            firebaseUsageStats = await getAllStyleUsageStats();
            
            console.log('📊 Style usage statistics from Firebase:', firebaseUsageStats);
            console.log(`📊 Found usage stats for ${Object.keys(firebaseUsageStats).length} styles`);
            
            // Normalize all keys to strings for consistent matching
            const normalizedStats = {};
            Object.keys(firebaseUsageStats).forEach(key => {
              normalizedStats[key.toString()] = firebaseUsageStats[key];
            });
            firebaseUsageStats = normalizedStats;
            
            // Calculate total generations
            const total = Object.values(firebaseUsageStats).reduce((sum, count) => sum + count, 0);
            setTotalGenerations(total);
            console.log('📊 Total skybox generations:', total);
            console.log('📊 Normalized usage stats:', firebaseUsageStats);
          } else {
            console.warn('⚠️ Firestore db is not available');
          }
        } catch (firebaseError) {
          console.error('❌ Error fetching usage stats from Firebase:', firebaseError);
          console.error('Error details:', firebaseError);
          // Continue with empty stats if Firebase query fails
        }
        
        // Merge with localStorage usage (for client-side tracking - legacy support)
        const localUsage = getStyleUsage();
        const combinedUsage = { ...firebaseUsageStats };
        
        // Add any local usage that might not be in Firebase yet (for backward compatibility)
        Object.keys(localUsage).forEach(styleId => {
          const normalizedId = styleId.toString();
          if (!combinedUsage[normalizedId] || combinedUsage[normalizedId] < localUsage[styleId]) {
            combinedUsage[normalizedId] = localUsage[styleId];
          }
        });
        
        console.log('📊 Final combined usage stats:', combinedUsage);
        console.log('📊 Sample style IDs from API:', stylesArr.slice(0, 5).map(s => ({ id: s.id, style_id: s.style_id })));
        
        setStyleUsageStats(combinedUsage);
        setStyles(stylesArr);
        setLoading(false);
        setError(null);
        console.log('✅ Fetched In3D.Ai styles and usage statistics:', {
          stylesCount: stylesArr.length,
          usageStatsCount: Object.keys(combinedUsage).length
        });
      } catch (err) {
        setLoading(false);
        setError("Failed to load In3D.Ai styles");
        setStyles([]);
        console.error("❌ Error fetching In3D.Ai styles (explore):", err);
      }
    };

  // Initial fetch on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStylesAndUsage();
  }, []);

  // Refresh usage stats function
  const refreshUsageStats = async () => {
    setRefreshingStats(true);
    try {
      if (db) {
        console.log('🔄 Refreshing style usage statistics...');
        const firebaseUsageStats = await getAllStyleUsageStats();
        
        // Normalize all keys to strings for consistent matching
        const normalizedStats = {};
        Object.keys(firebaseUsageStats).forEach(key => {
          normalizedStats[key.toString()] = firebaseUsageStats[key];
        });
        
        const total = Object.values(normalizedStats).reduce((sum, count) => sum + count, 0);
        setTotalGenerations(total);
        setStyleUsageStats(normalizedStats);
        console.log('✅ Usage statistics refreshed:', {
          stylesCount: Object.keys(normalizedStats).length,
          totalGenerations: total
        });
      }
    } catch (error) {
      console.error('❌ Error refreshing usage stats:', error);
    } finally {
      setRefreshingStats(false);
    }
  };

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
    // Track style usage
    const styleId = skyboxStyle.id?.toString() || skyboxStyle.style_id?.toString();
    if (styleId) {
      const newUsageCount = incrementStyleUsage(styleId);
      setStyleUsageStats(prev => ({
        ...prev,
        [styleId]: newUsageCount
      }));
    }
    
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

  // Sort and filter styles by category and usage
  const filteredAndSortedStyles = useMemo(() => {
    // First filter by category
    let filtered = selectedCategory === 'all' 
      ? styles 
      : styles.filter(style => 
          style.name?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          style.description?.toLowerCase().includes(selectedCategory.toLowerCase())
        );
    
    // Then sort by usage count (most used first)
    filtered = [...filtered].sort((a, b) => {
      // Normalize IDs to strings for consistent matching
      const aId = (a.id?.toString() || a.style_id?.toString() || '').trim();
      const bId = (b.id?.toString() || b.style_id?.toString() || '').trim();
      const aUsage = styleUsageStats[aId] || 0;
      const bUsage = styleUsageStats[bId] || 0;
      
      // Sort by usage count (descending), then by name if usage is equal
      if (bUsage !== aUsage) {
        return bUsage - aUsage;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    
    return filtered;
  }, [styles, selectedCategory, styleUsageStats]);

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
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-sky-500/20 border-t-sky-500 mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sky-400 to-purple-400 animate-pulse"></div>
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/70 text-base sm:text-lg font-medium"
          >
            Loading In3D.Ai styles...
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white/40 text-sm mt-2"
          >
            Please wait while we fetch amazing styles
          </motion.p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 sm:py-20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-red-500/10 to-rose-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/30 shadow-lg"
        >
          <svg className="w-10 h-10 sm:w-12 sm:h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-red-300 mb-2 text-base sm:text-lg font-medium"
        >
          {error}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/40 text-sm mb-6"
        >
          We couldn't load the styles. Please try again.
        </motion.p>
        <motion.button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </span>
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-6 sm:mb-8"
      >
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300">
          Skybox Gallery
        </h2>
        <p className="text-white/60 sm:text-white/50 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-4">
          Browse and apply stunning In3D.Ai styles to your 3D scenes
        </p>
        
        {/* Usage Statistics Summary */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/10 backdrop-blur-sm"
        >
          {totalGenerations > 0 ? (
            <>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-white/80 text-sm font-medium">
                <span className="text-white font-bold">{totalGenerations.toLocaleString()}</span> total skybox generations
              </span>
            </div>
            <div className="h-4 w-px bg-white/20"></div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-white/80 text-sm font-medium">
                <span className="text-white font-bold">{Object.keys(styleUsageStats).filter(id => styleUsageStats[id] > 0).length}</span> styles in use
              </span>
            </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-white/60 text-sm">No usage data yet</span>
            </div>
          )}
          <div className="h-4 w-px bg-white/20"></div>
          <motion.button
            onClick={refreshUsageStats}
            disabled={refreshingStats}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: refreshingStats ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Refresh usage statistics"
          >
            <svg 
              className={`w-4 h-4 text-white/60 ${refreshingStats ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-white/60 text-xs">{refreshingStats ? 'Refreshing...' : 'Refresh'}</span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Categories Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-wrap gap-2 sm:gap-3 justify-center px-2"
      >
        {categories.map((category, index) => (
          <motion.button
            key={category}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border transition-all duration-300 font-medium text-sm sm:text-base relative overflow-hidden ${
              selectedCategory === category
                ? 'bg-gradient-to-r from-sky-500 to-violet-500 border-transparent text-white shadow-lg shadow-violet-500/30'
                : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white hover:border-white/20 hover:shadow-md'
            }`}
          >
            {selectedCategory === category && (
              <motion.div
                layoutId="activeCategory"
                className="absolute inset-0 bg-gradient-to-r from-sky-400 to-violet-400"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* In3D.Ai Styles Grid */}
      {filteredAndSortedStyles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-16 sm:py-20"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-lg">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/60 text-base sm:text-lg">No In3D.Ai styles found for "{selectedCategory}" category.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {filteredAndSortedStyles.map((style, index) => {
            // Normalize style ID to string for consistent matching
            const styleId = (style.id?.toString() || style.style_id?.toString() || '').trim();
            const usageCount = styleUsageStats[styleId] || 0;
            
            // Debug logging for first few styles
            if (index < 3) {
              console.log(`🎨 Style ${index + 1}:`, {
                name: style.name,
                id: style.id,
                style_id: style.style_id,
                normalizedId: styleId,
                usageCount,
                availableStats: Object.keys(styleUsageStats).slice(0, 5)
              });
            }
            const isPopular = usageCount > 0 && index < 12; // Top 12 most used styles
            return (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.25, 0.4, 0.25, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`relative group rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 cursor-pointer ${
                selectedStyle?.id === style.id
                  ? 'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/50 shadow-2xl shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/25 hover:shadow-xl hover:shadow-purple-500/10'
              }`}
            >
              {/* Preview Image */}
              <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
                {(style.preview_url || style.preview_image_url || style.image || style.image_url) ? (
                  <img
                    src={style.preview_url || style.preview_image_url || style.image || style.image_url}
                    alt={style.name}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 ${
                    (style.preview_url || style.preview_image_url || style.image || style.image_url) ? 'hidden' : 'flex'
                  }`}
                >
                  <div className="text-center text-white/90">
                    <div className="text-5xl mb-3">🌌</div>
                    <div className="text-sm font-medium px-4">{style.name}</div>
                  </div>
                </div>
                
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Shine effect on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                {/* Usage count badge - always visible */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className={`absolute top-3 left-3 text-white rounded-full px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg ring-2 z-10 ${
                    usageCount > 0
                      ? isPopular 
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/50 ring-amber-300/50' 
                        : 'bg-gradient-to-br from-blue-500/90 to-indigo-500/90 shadow-blue-500/50 ring-blue-300/50'
                      : 'bg-gradient-to-br from-gray-600/90 to-gray-700/90 shadow-gray-500/50 ring-gray-400/50'
                  }`}
                >
                  {isPopular && usageCount > 0 && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-xs font-bold">{usageCount.toLocaleString()}</span>
                  <span className="text-[10px] opacity-80 ml-0.5">uses</span>
                </motion.div>
                
                {/* Selected indicator */}
                {selectedStyle?.id === style.id && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-3 right-3 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300/50 z-10"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-sky-300 group-hover:to-purple-300 transition-all duration-300">
                  {style.name}
                </h3>
                {style.description && (
                  <p className="text-xs sm:text-sm text-white/60 mb-3 line-clamp-2 leading-relaxed">{style.description}</p>
                )}
                
                {/* Style Info */}
                <div className="flex items-center justify-between text-xs text-white/40 mb-4 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-white/30">#{style.id}</span>
                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                      usageCount > 0 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="font-semibold">{usageCount.toLocaleString()}</span>
                      <span className="text-[10px] opacity-70">total uses</span>
                    </span>
                  </div>
                  {style.created_at && (
                    <span className="text-white/30">{new Date(style.created_at).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => handleUseSkybox(style)}
                    className={`group/btn relative flex-1 px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base overflow-hidden ${
                      selectedStyle?.id === style.id
                        ? 'text-white shadow-lg'
                        : 'text-white'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {selectedStyle?.id === style.id ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                        <span className="relative flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Applied
                        </span>
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
                    className="px-4 py-2.5 sm:py-3 bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-white/25 text-white rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
                    title="Download preview"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
          })}
        </div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center mt-6 sm:mt-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-purple-400 animate-pulse" />
          <p className="text-white/60 text-xs sm:text-sm font-medium">
            Showing <span className="text-white font-semibold">{filteredAndSortedStyles.length}</span> of <span className="text-white font-semibold">{styles.length}</span> total styles
            {filteredAndSortedStyles.length > 0 && (
              <span className="ml-2 text-white/40 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Sorted by usage from Firebase
              </span>
            )}
          </p>
        </div>
      </motion.div>

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

