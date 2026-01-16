import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from '../config/firebase';

const Lessons = ({ setBackgroundSkybox }) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Filter states
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  const navigate = useNavigate();

  // Fetch chapters from Firestore with real-time updates
  useEffect(() => {
    setLoading(true);
    
    if (!db) {
      console.error('❌ Lessons: Firestore db is not available!');
      setError('Firestore database is not initialized. Please refresh the page.');
      setLoading(false);
      return;
    }
    
    // Build query constraints based on filters
    const constraints = [];
    
    if (selectedCurriculum) {
      constraints.push(where('curriculum', '==', selectedCurriculum.toUpperCase()));
    }
    if (selectedClass) {
      constraints.push(where('class', '==', parseInt(selectedClass)));
    }
    if (selectedSubject) {
      constraints.push(where('subject', '==', selectedSubject));
    }
    
    // Create query
    const chaptersRef = collection(db, 'curriculum_chapters');
    const chaptersQuery = constraints.length > 0 
      ? query(chaptersRef, ...constraints)
      : query(chaptersRef);
    
    console.log('🔍 Lessons: Starting to load chapters with filters:', {
      curriculum: selectedCurriculum || 'all',
      class: selectedClass || 'all',
      subject: selectedSubject || 'all',
      constraintsCount: constraints.length
    });
    
    // Listen for real-time updates
    const unsubscribe = onSnapshot(
      chaptersQuery,
      (snapshot) => {
        try {
          console.log(`📦 Lessons: Received ${snapshot.docs.length} chapter documents from Firestore`);
          
          const chaptersData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data
            };
          });
          
          // Sort by curriculum, class, subject, chapter_number
          chaptersData.sort((a, b) => {
            if (a.curriculum !== b.curriculum) {
              return a.curriculum.localeCompare(b.curriculum);
            }
            if (a.class !== b.class) {
              return a.class - b.class;
            }
            if (a.subject !== b.subject) {
              return a.subject.localeCompare(b.subject);
            }
            return a.chapter_number - b.chapter_number;
          });
          
          console.log(`✅ Lessons: Processed ${chaptersData.length} chapters, sorted by curriculum/class/subject/chapter`);
          setChapters(chaptersData);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error("❌ Lessons: Error processing chapter data:", err);
          setError("Error processing chapter data: " + err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error("❌ Lessons: Error in chapters listener:", err);
        console.error("   Error code:", err.code);
        console.error("   Error message:", err.message);
        setError(`Failed to load lessons: ${err.message}. Check console for details.`);
        setLoading(false);
      }
    );
    
    return () => {
      unsubscribe();
    };
  }, [selectedCurriculum, selectedClass, selectedSubject]);

  // Extract unique filter options
  const availableCurricula = useMemo(() => {
    const unique = [...new Set(chapters.map(c => c.curriculum))];
    return unique.sort();
  }, [chapters]);

  const availableClasses = useMemo(() => {
    if (!selectedCurriculum) return [];
    const filtered = chapters.filter(c => c.curriculum === selectedCurriculum);
    const unique = [...new Set(filtered.map(c => c.class))];
    return unique.sort((a, b) => a - b);
  }, [chapters, selectedCurriculum]);

  const availableSubjects = useMemo(() => {
    if (!selectedCurriculum || !selectedClass) return [];
    const filtered = chapters.filter(
      c => c.curriculum === selectedCurriculum && c.class === parseInt(selectedClass)
    );
    const unique = [...new Set(filtered.map(c => c.subject))];
    return unique.sort();
  }, [chapters, selectedCurriculum, selectedClass]);

  // Filter chapters based on current selections
  const filteredChapters = useMemo(() => {
    return chapters.filter(chapter => {
      if (selectedCurriculum && chapter.curriculum !== selectedCurriculum) return false;
      if (selectedClass && chapter.class !== parseInt(selectedClass)) return false;
      if (selectedSubject && chapter.subject !== selectedSubject) return false;
      return true;
    });
  }, [chapters, selectedCurriculum, selectedClass, selectedSubject]);

  // Handle chapter click - navigate to main page with skybox and 3D assets
  const handleChapterClick = (chapter) => {
    console.log('📖 Lessons: Chapter clicked:', chapter.id);
    
    // Find first topic with skybox_url for background
    const firstTopicWithSkybox = chapter.topics?.find(t => t.skybox_url);
    const skyboxUrl = firstTopicWithSkybox?.skybox_url || null;
    
    // Collect all 3D assets from all topics
    const allAssetUrls = [];
    const allAssets = [];
    
    chapter.topics?.forEach(topic => {
      if (topic.asset_urls && Array.isArray(topic.asset_urls)) {
        topic.asset_urls.forEach((assetUrl, index) => {
          if (assetUrl) {
            allAssetUrls.push(assetUrl);
            allAssets.push({
              id: topic.asset_ids?.[index] || `asset-${Date.now()}-${index}`,
              url: assetUrl,
              topic_id: topic.topic_id,
              topic_name: topic.topic_name,
              asset_name: topic.asset_list?.[index] || '3D Asset'
            });
          }
        });
      }
    });
    
    // Get first 3D asset URL for the resume data (MainSection expects single asset)
    const firstAssetUrl = allAssetUrls.length > 0 ? allAssetUrls[0] : null;
    
    // Set background skybox if available
    if (skyboxUrl && setBackgroundSkybox) {
      const skyboxData = {
        image: skyboxUrl,
        image_jpg: skyboxUrl,
        title: chapter.chapter_name,
        prompt: firstTopicWithSkybox?.in3d_prompt || chapter.chapter_name,
        metadata: {
          chapter_id: chapter.id,
          curriculum: chapter.curriculum,
          class: chapter.class,
          subject: chapter.subject
        }
      };
      setBackgroundSkybox(skyboxData);
      
      // Save to sessionStorage for persistence
      sessionStorage.setItem('appliedBackgroundSkybox', JSON.stringify(skyboxData));
    }
    
    // Prepare resume data for MainSection
    const resumeData = {
      prompt: firstTopicWithSkybox?.in3d_prompt || chapter.chapter_name,
      negativePrompt: '',
      styleId: null, // We don't have style info from curriculum chapters
      has3DAsset: firstAssetUrl !== null,
      meshUrl: firstAssetUrl,
      meshFormat: 'glb', // Default format
      modelUrls: firstAssetUrl ? { glb: firstAssetUrl } : null,
      // Additional lesson-specific data
      chapter: chapter,
      allAssets: allAssets,
      allAssetUrls: allAssetUrls
    };
    
    // Save to sessionStorage
    sessionStorage.setItem('resumeGenerationData', JSON.stringify(resumeData));
    sessionStorage.setItem('fromLessons', 'true');
    sessionStorage.setItem('fromHistory', 'true'); // Reuse fromHistory flag for compatibility
    
    // Navigate to main page
    navigate('/main', {
      state: {
        chapter: chapter,
        curriculum: chapter.curriculum,
        class: chapter.class,
        subject: chapter.subject,
        fromLessons: true,
        skyboxUrl: skyboxUrl,
        assetUrls: allAssetUrls
      }
    });
  };

  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    const date = new Date(timestamp);
    return isNaN(date.getTime()) 
      ? 'Invalid Date'
      : date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
  };

  // Chapter Card Component
  const ChapterCard = ({ chapter, viewMode }) => {
    // Get first topic's skybox URL for thumbnail
    const thumbnailUrl = chapter.topics?.find(t => t.skybox_url)?.skybox_url || null;
    
    // Count generated topics
    const generatedTopics = chapter.topics?.filter(t => t.status === 'generated').length || 0;
    const totalTopics = chapter.topics?.length || 0;
    
    // Calculate completion percentage
    const completionPercent = totalTopics > 0 
      ? Math.round((generatedTopics / totalTopics) * 100) 
      : 0;
    
    return (
      <motion.div
        whileHover={{ y: -4 }}
        className={`
          relative group bg-gradient-to-br from-[#141414]/90 via-[#0a0a0a]/90 to-[#1a1a1a]/90
          backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl
          transform transition-all duration-500 cursor-pointer
          border border-gray-800/50 hover:border-cyan-500/50
          ${viewMode === 'list' ? 'flex items-center space-x-6 p-6' : ''}
        `}
        onClick={() => handleChapterClick(chapter)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleChapterClick(chapter);
          }
        }}
      >
        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 pointer-events-none" />
        
        {/* Subtle Texture Overlay */}
        <div className="absolute inset-0 bg-texture opacity-30 pointer-events-none" />
        
        {/* Thumbnail Container */}
        <div className={`relative overflow-hidden ${viewMode === 'grid' ? 'aspect-[16/9]' : 'w-40 h-40 flex-shrink-0 rounded-2xl'}`}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={chapter.chapter_name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div 
            className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#1a1a1a] ${
              thumbnailUrl ? 'hidden' : 'flex'
            }`}
          >
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">No Preview</p>
            </div>
          </div>

          {/* Badges - Top Left */}
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10 flex-wrap">
            <span className="px-3 py-1.5 text-xs font-display font-bold rounded-xl border backdrop-blur-xl shadow-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/40">
              {chapter.curriculum}
            </span>
            <span className="px-3 py-1.5 text-xs font-display font-bold rounded-xl border backdrop-blur-xl shadow-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/40">
              Class {chapter.class}
            </span>
            {completionPercent > 0 && (
              <span className={`px-3 py-1.5 text-xs font-display font-bold rounded-xl border backdrop-blur-xl shadow-xl ${
                completionPercent === 100 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {completionPercent}% Complete
              </span>
            )}
          </div>

          {/* Chapter Number Badge - Top Right */}
          <div className="absolute top-4 right-4 z-10">
            <span className="px-3 py-1.5 text-xs font-display font-bold rounded-xl border backdrop-blur-xl shadow-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/40">
              Ch {chapter.chapter_number}
            </span>
          </div>

          {/* Hover Overlay */}
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
                  <span className="text-white font-display font-semibold text-sm">View Lesson</span>
                </div>
              </div>
              <p className="text-xs text-gray-200/90 line-clamp-2 mb-2 font-body leading-relaxed">
                {totalTopics} {totalTopics === 1 ? 'topic' : 'topics'} • {generatedTopics} generated
              </p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className={`relative z-10 ${viewMode === 'grid' ? 'p-6' : 'flex-1 p-6'}`}>
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-display text-xl font-bold text-white line-clamp-2 flex-1 pr-3 group-hover:text-cyan-300 transition-colors duration-300 leading-tight">
              {chapter.chapter_name}
            </h3>
          </div>
          
          {/* Subject Badge */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 backdrop-blur-sm">
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-xs font-display font-semibold text-purple-300">{chapter.subject}</span>
            </span>
          </div>
          
          {/* Topics Info */}
          <div className="mb-4">
            <p className="font-body text-sm text-gray-300/70 mb-2 leading-relaxed">
              {totalTopics} {totalTopics === 1 ? 'Topic' : 'Topics'}
            </p>
            
            {/* Progress Bar */}
            {totalTopics > 0 && (
              <div className="w-full h-2 bg-gray-800/50 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${
                    completionPercent === 100 
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPercent}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
            <div className="flex items-center gap-2.5 text-xs text-gray-400 font-body">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-mono">{formatDate(chapter.createdAt || chapter.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              {generatedTopics > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-lg border border-emerald-500/30 backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
                    {generatedTopics}/{totalTopics}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
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
        {/* Editorial Header */}
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
                <span className="text-xs justify-center items-center text-center font-mono font-semibold text-cyan-300 uppercase tracking-wider">Curriculum</span>
              </div>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                  Available
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Lessons
                </span>
              </h1>
              <p className="font-body text-lg text-gray-300/80 max-w-2xl leading-relaxed">
                Browse and explore all available curriculum lessons organized by curriculum, class, and subject.
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
                title="Refresh lessons"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </div>
              </motion.button>
            </div>
          </div>

          {/* Editorial Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#141414]/60 backdrop-blur-xl rounded-2xl border border-gray-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-4 flex-wrap">
              {/* View Mode Toggle */}
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

              {/* Curriculum Filter */}
              <select
                value={selectedCurriculum}
                onChange={(e) => {
                  setSelectedCurriculum(e.target.value);
                  setSelectedClass('');
                  setSelectedSubject('');
                }}
                className="px-4 py-2.5 bg-[#1a1a1a]/80 border border-gray-700/50 rounded-xl text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 backdrop-blur-sm font-body transition-all duration-300"
              >
                <option value="">All Curricula</option>
                {availableCurricula.map(curriculum => (
                  <option key={curriculum} value={curriculum}>{curriculum}</option>
                ))}
              </select>

              {/* Class Filter */}
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSubject('');
                }}
                disabled={!selectedCurriculum}
                className="px-4 py-2.5 bg-[#1a1a1a]/80 border border-gray-700/50 rounded-xl text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 backdrop-blur-sm font-body transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Classes</option>
                {availableClasses.map(classNum => (
                  <option key={classNum} value={classNum}>Class {classNum}</option>
                ))}
              </select>

              {/* Subject Filter */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={!selectedCurriculum || !selectedClass}
                className="px-4 py-2.5 bg-[#1a1a1a]/80 border border-gray-700/50 rounded-xl text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 backdrop-blur-sm font-body transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Subjects</option>
                {availableSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              {/* Clear Filters Button */}
              {(selectedCurriculum || selectedClass || selectedSubject) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedCurriculum('');
                    setSelectedClass('');
                    setSelectedSubject('');
                  }}
                  className="px-4 py-2.5 bg-[#1a1a1a]/80 hover:bg-[#222]/80 border border-gray-700/50 rounded-xl text-gray-300 hover:text-white text-sm font-medium font-body transition-all duration-300"
                >
                  Clear Filters
                </motion.button>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a]/80 rounded-xl border border-gray-700/50">
              <span className="text-sm font-mono font-semibold text-cyan-300">{filteredChapters.length}</span>
              <span className="text-sm text-gray-400 font-body">
                {filteredChapters.length !== 1 ? 'lessons' : 'lesson'}
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
                <p className="text-red-300 font-display font-semibold mb-2 text-lg">Error loading lessons</p>
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
                  Loading lessons
                </p>
                <p className="font-body text-sm text-gray-400">Gathering curriculum data...</p>
              </div>
            </div>
          </motion.div>
        ) : filteredChapters.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-gradient-to-br from-[#141414]/80 via-[#0a0a0a]/80 to-[#1a1a1a]/80 backdrop-blur-xl rounded-3xl p-16 text-center border border-gray-800/50 shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-display text-3xl font-bold text-white mb-3">No lessons found</h3>
              <p className="font-body text-lg text-gray-300/80 mb-8 max-w-md mx-auto leading-relaxed">
                {selectedCurriculum || selectedClass || selectedSubject
                  ? 'Try adjusting your filters to see more lessons.'
                  : 'Lessons will appear here once they are added to the curriculum.'}
              </p>
              {(selectedCurriculum || selectedClass || selectedSubject) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedCurriculum('');
                    setSelectedClass('');
                    setSelectedSubject('');
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 text-white rounded-xl transition-all duration-300 font-display font-semibold text-lg shadow-xl shadow-cyan-500/30 border border-cyan-400/20"
                >
                  Clear All Filters
                </motion.button>
              )}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewMode}-${selectedCurriculum}-${selectedClass}-${selectedSubject}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}
            >
              {filteredChapters.map((chapter, index) => (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  viewMode={viewMode}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default Lessons;
