'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getCurriculums,
  getClasses,
  getSubjects,
  getChapters,
  GetChaptersResult,
} from '../../lib/firestore/queries';
import { ChapterTable } from '../../Components/studio/ChapterTable';
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
  Loader2,
  FolderOpen,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '../../Components/ui/button';
import { PrismFluxLoader } from '../../Components/ui/prism-flux-loader';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../Components/ui/select';
import { Card, CardContent } from '../../Components/ui/card';

const ContentLibrary = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Filters sidebar - no overlay, homogeneous with app sidebar */}
        <aside
          className={`w-72 min-h-screen bg-card border-r border-border p-5
            fixed sm:sticky top-0 left-0 z-30 transition-transform duration-300 flex-shrink-0
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
          style={{ minWidth: '288px' }}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground uppercase tracking-wider">Filters</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8 text-muted-foreground"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close filters"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {loadingFilters && (
              <div className="space-y-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded-md" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded-md" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded-md" />
                </div>
              </div>
            )}

            {!loadingFilters && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Curriculum</Label>
                  <Select
                    value={filters.curriculum}
                    onValueChange={(v) => setFilters((f) => ({ ...f, curriculum: v }))}
                    disabled={loadingFilters}
                  >
                    <SelectTrigger className="w-full h-10 border-input bg-background text-foreground">
                      <SelectValue placeholder="Select curriculum" />
                    </SelectTrigger>
                    <SelectContent>
                      {curriculums.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Class</Label>
                  <Select
                    value={filters.classId}
                    onValueChange={(v) => setFilters((f) => ({ ...f, classId: v }))}
                    disabled={!filters.curriculum || classes.length === 0}
                  >
                    <SelectTrigger className="w-full h-10 border-input bg-background text-foreground">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Subject</Label>
                  <Select
                    value={filters.subject}
                    onValueChange={(v) => setFilters((f) => ({ ...f, subject: v }))}
                    disabled={!filters.classId || subjects.length === 0}
                  >
                    <SelectTrigger className="w-full h-10 border-input bg-background text-foreground">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border my-6" />

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Search chapters</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                      placeholder="Search by name..."
                      className="pl-10 border-input bg-background text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <Card className="border border-border bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Results</span>
                    </div>
                    <p className="text-2xl font-semibold text-foreground">
                      {chapters.length}
                      <span className="text-sm font-normal text-muted-foreground ml-2">chapters</span>
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-background/80 z-20 sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
        )}

        {/* Main content - in-flow title bar, no fixed header (theme-aware for dark mode) */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 bg-background text-foreground">
          {/* Page title and actions - in flow, does not overlay sidebar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 p-2 rounded-lg bg-primary/10 border border-border">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground tracking-tight">Content Studio</h1>
                <p className="text-xs text-muted-foreground">Curriculum Editor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden gap-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Filter className="w-4 h-4" />
                Filters
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => loadChapters(true)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {loading && chapters.length === 0 && (
            <Card className="border border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <PrismFluxLoader
                  size={40}
                  speed={5}
                  textSize={12}
                  statuses={['Fetching', 'Loading', 'Syncing', 'Processing', 'Updating', 'Placing']}
                />
              </CardContent>
            </Card>
          )}

          {!loading && chapters.length === 0 && filters.subject && (
            <Card className="border border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-xl bg-muted/50 mb-4">
                  <FolderOpen className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No chapters found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {filters.search
                    ? `No chapters match "${filters.search}". Try a different search term.`
                    : 'No chapters available for the selected curriculum, class, and subject.'}
                </p>
              </CardContent>
            </Card>
          )}

          {!filters.subject && !loading && (
            <Card className="border border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-xl bg-muted/50 mb-4">
                  <Filter className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Select filters</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Choose a curriculum, class, and subject from the sidebar to view chapters.
                </p>
              </CardContent>
            </Card>
          )}

          {chapters.length > 0 && (
            <>
              <ChapterTable
                chapters={chapters}
                onOpenChapter={handleOpenChapter}
                loading={loading}
                onApprovalChange={() => loadChapters(true)}
              />
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Load more
                  </Button>
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
