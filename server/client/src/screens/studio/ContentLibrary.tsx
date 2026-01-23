'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getCurriculums,
  getClasses,
  getSubjects,
  getChapters,
  GetChaptersResult,
} from '../../lib/firestore/queries';
import { ChapterTable } from '../../Components/studio/ChapterTable';
import { LanguageSelector } from '../../Components/LanguageSelector';
import {
  Chapter,
  Curriculum,
  Class,
  Subject,
  ContentFilters,
  LanguageCode,
} from '../../types/curriculum';
import { chapterHasContentForLanguage } from '../../lib/firebase/utils/languageAvailability';
import type { CurriculumChapter } from '../../types/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Search,
  Filter,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  FolderOpen,
  RefreshCw,
  Home,
  Menu,
  X,
} from 'lucide-react';

const ContentLibrary = () => {
  const navigate = useNavigate();
  
  // Header visibility
  const [headerVisible, setHeaderVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  
  // Filter options
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Selected filters
  const [filters, setFilters] = useState<ContentFilters>({
    curriculum: '',
    classId: '',
    subject: '',
    search: '',
  });
  
  // Data state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [rawChapters, setRawChapters] = useState<Array<{ id: string; data: CurriculumChapter }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<unknown>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  
  // Scroll-based header visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show header when scrolling up or at top
      if (currentScrollY < lastScrollY.current || currentScrollY < 50) {
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        // Hide header when scrolling down past threshold
        setHeaderVisible(false);
      }
      
      lastScrollY.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Load curriculums on mount
  useEffect(() => {
    const loadCurriculums = async () => {
      try {
        const data = await getCurriculums();
        setCurriculums(data);
        if (data.length > 0) {
          setFilters((f) => ({ ...f, curriculum: data[0].id }));
        }
      } catch (error) {
        console.error('Error loading curriculums:', error);
        toast.error('Failed to load curriculums');
      } finally {
        setLoadingFilters(false);
      }
    };
    loadCurriculums();
  }, []);
  
  // Load classes when curriculum changes
  useEffect(() => {
    if (!filters.curriculum) {
      setClasses([]);
      return;
    }
    
    const loadClasses = async () => {
      try {
        const data = await getClasses(filters.curriculum);
        setClasses(data);
        if (data.length > 0) {
          setFilters((f) => ({ ...f, classId: data[0].id }));
        } else {
          setFilters((f) => ({ ...f, classId: '', subject: '' }));
        }
      } catch (error) {
        console.error('Error loading classes:', error);
        toast.error('Failed to load classes');
      }
    };
    loadClasses();
  }, [filters.curriculum]);
  
  // Load subjects when class changes
  useEffect(() => {
    if (!filters.curriculum || !filters.classId) {
      setSubjects([]);
      return;
    }
    
    const loadSubjects = async () => {
      try {
        const data = await getSubjects(filters.curriculum, filters.classId);
        setSubjects(data);
        if (data.length > 0) {
          setFilters((f) => ({ ...f, subject: data[0].id }));
        } else {
          setFilters((f) => ({ ...f, subject: '' }));
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
        toast.error('Failed to load subjects');
      }
    };
    loadSubjects();
  }, [filters.curriculum, filters.classId]);
  
  // Load chapters when all filters are set
  const loadChapters = useCallback(async (reset = true) => {
    if (!filters.curriculum || !filters.classId || !filters.subject) {
      setChapters([]);
      setRawChapters([]);
      return;
    }
    
    setLoading(true);
    try {
      const result: GetChaptersResult = await getChapters({
        curriculumId: filters.curriculum,
        classId: filters.classId,
        subjectId: filters.subject,
        searchTerm: filters.search,
        lastDoc: reset ? undefined : (lastDoc as any),
      });
      
      // Fetch raw chapter data for language checking
      const chaptersWithRawData = await Promise.all(
        result.chapters.map(async (chapter) => {
          try {
            const chapterRef = doc(db, 'curriculum_chapters', chapter.id);
            const chapterSnap = await getDoc(chapterRef);
            if (chapterSnap.exists()) {
              return {
                ...chapter,
                _rawData: chapterSnap.data() as CurriculumChapter,
              };
            }
            return chapter;
          } catch (err) {
            console.warn(`Failed to fetch raw data for chapter ${chapter.id}:`, err);
            return chapter;
          }
        })
      );
      
      // Filter by language availability
      const filteredChapters = chaptersWithRawData.filter(ch => {
        if (!ch._rawData) return true; // Include if we couldn't fetch raw data
        return chapterHasContentForLanguage(ch._rawData, selectedLanguage);
      });
      
      if (reset) {
        setChapters(filteredChapters);
        setRawChapters(chaptersWithRawData.map(ch => ({ id: ch.id, data: ch._rawData! })).filter(ch => ch.data));
      } else {
        setChapters((prev) => [...prev, ...filteredChapters]);
        setRawChapters((prev) => [...prev, ...chaptersWithRawData.map(ch => ({ id: ch.id, data: ch._rawData! })).filter(ch => ch.data)]);
      }
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading chapters:', error);
      toast.error('Failed to load chapters');
    } finally {
      setLoading(false);
    }
  }, [filters, lastDoc, selectedLanguage]);
  
  // Re-filter chapters when language changes
  useEffect(() => {
    if (rawChapters.length === 0) return;
    
    const filtered = rawChapters
      .filter(ch => chapterHasContentForLanguage(ch.data, selectedLanguage))
      .map(ch => {
        const chapter = chapters.find(c => c.id === ch.id);
        return chapter || null;
      })
      .filter(Boolean) as Chapter[];
    
    setChapters(filtered);
  }, [selectedLanguage, rawChapters]);
  
  useEffect(() => {
    loadChapters(true);
  }, [filters.curriculum, filters.classId, filters.subject]);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.curriculum && filters.classId && filters.subject) {
        loadChapters(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);
  
  const handleOpenChapter = (chapter: Chapter) => {
    navigate(`/studio/content/${chapter.id}`, {
      state: {
        curriculumId: filters.curriculum,
        classId: filters.classId,
        subjectId: filters.subject,
        language: selectedLanguage,
      },
    });
  };
  
  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadChapters(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Floating Header - Auto-hide on scroll */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out
                   ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-700/50">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left - Logo & Navigation */}
              <div className="flex items-center gap-4">
                <Link 
                  to="/"
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 
                           rounded-lg transition-colors"
                >
                  <Home className="w-5 h-5" />
                </Link>
                
                <div className="hidden sm:flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30">
                    <BookOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-white tracking-tight">
                      Content Studio
                    </h1>
                    <p className="text-xs text-slate-400">
                      Curriculum Editor
                    </p>
                  </div>
                </div>
                
                {/* Mobile Title */}
                <div className="sm:hidden">
                  <h1 className="text-lg font-semibold text-white">Studio</h1>
                </div>
              </div>
              
              {/* Right - Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadChapters(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 
                           bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600/50
                           transition-all duration-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                
                {/* Mobile menu toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 
                           rounded-lg transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        {!headerVisible && (
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setHeaderVisible(true);
            }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2
                     px-4 py-1.5 text-xs font-medium text-slate-400 
                     bg-slate-800/90 backdrop-blur-sm rounded-full border border-slate-700/50
                     hover:text-white hover:bg-slate-700/90 transition-all duration-200
                     flex items-center gap-1.5"
          >
            <ChevronUp className="w-3 h-3" />
            Show Header
          </button>
        )}
      </header>
      
      {/* Spacer for fixed header */}
      <div className="h-16" />
      
      <div className="flex">
        {/* Left Sidebar - Filters - Always visible on desktop */}
        <aside className={`w-72 min-h-[calc(100vh-64px)] bg-[#0d1424] border-r border-slate-700/50 p-5
                        fixed sm:sticky top-16 left-0 z-30 transition-transform duration-300 flex-shrink-0
                        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
               style={{ minWidth: '288px' }}>
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-slate-300">
                <Filter className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-sm tracking-wide uppercase">Filters</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="sm:hidden p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Loading skeleton for filters */}
            {loadingFilters && (
              <div className="space-y-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-slate-700 rounded" />
                  <div className="h-10 bg-slate-700 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-slate-700 rounded" />
                  <div className="h-10 bg-slate-700 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-slate-700 rounded" />
                  <div className="h-10 bg-slate-700 rounded-lg" />
                </div>
              </div>
            )}
            
            {!loadingFilters && (
              <>
            
            {/* Curriculum Dropdown */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Curriculum
              </label>
              <div className="relative">
                <select
                  value={filters.curriculum}
                  onChange={(e) => setFilters((f) => ({ ...f, curriculum: e.target.value }))}
                  disabled={loadingFilters}
                  className="w-full appearance-none bg-slate-800/50 border border-slate-600/50 rounded-lg
                           px-4 py-2.5 pr-10 text-sm text-white
                           focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                           disabled:opacity-50 transition-all duration-200"
                >
                  <option value="">Select Curriculum</option>
                  {curriculums.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Class Dropdown */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Class
              </label>
              <div className="relative">
                <select
                  value={filters.classId}
                  onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value }))}
                  disabled={!filters.curriculum || classes.length === 0}
                  className="w-full appearance-none bg-slate-800/50 border border-slate-600/50 rounded-lg
                           px-4 py-2.5 pr-10 text-sm text-white
                           focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                           disabled:opacity-50 transition-all duration-200"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Subject Dropdown */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Subject
              </label>
              <div className="relative">
                <select
                  value={filters.subject}
                  onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
                  disabled={!filters.classId || subjects.length === 0}
                  className="w-full appearance-none bg-slate-800/50 border border-slate-600/50 rounded-lg
                           px-4 py-2.5 pr-10 text-sm text-white
                           focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                           disabled:opacity-50 transition-all duration-200"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-slate-700/50 my-6" />
            
            {/* Search */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Search Chapters
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search by name..."
                  className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg
                           pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                           transition-all duration-200"
                />
              </div>
            </div>
            
            {/* Stats */}
            <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <div className="flex items-center gap-3 mb-3">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Results
                </span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {chapters.length}
                <span className="text-sm font-normal text-slate-400 ml-2">
                  chapters
                </span>
              </p>
            </div>
            </>
            )}
          </div>
        </aside>
        
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 sm:ml-0">
          {/* Loading State */}
          {loading && chapters.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
              <p className="text-slate-400">Loading chapters...</p>
            </div>
          )}
          
          {/* Empty State */}
          {!loading && chapters.length === 0 && filters.subject && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-2xl bg-slate-800/30 mb-4">
                <FolderOpen className="w-12 h-12 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No chapters found
              </h3>
              <p className="text-slate-400 text-center max-w-md">
                {filters.search
                  ? `No chapters match "${filters.search}". Try a different search term.`
                  : 'No chapters available for the selected curriculum, class, and subject.'}
              </p>
            </div>
          )}
          
          {/* Select Filters State */}
          {!filters.subject && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-2xl bg-slate-800/30 mb-4">
                <Filter className="w-12 h-12 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Select Filters
              </h3>
              <p className="text-slate-400 text-center max-w-md">
                Choose a curriculum, class, and subject from the sidebar to view chapters.
              </p>
            </div>
          )}
          
          {/* Chapter Table */}
          {chapters.length > 0 && (
            <>
              <ChapterTable
                chapters={chapters}
                onOpenChapter={handleOpenChapter}
                loading={loading}
                onApprovalChange={() => loadChapters(true)}
              />
              
              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium
                             text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20
                             rounded-lg border border-cyan-500/30
                             transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ContentLibrary;
