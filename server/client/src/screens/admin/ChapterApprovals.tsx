/**
 * Chapter Approvals - Admin page for approving curriculum chapters
 * 
 * Only accessible to admin/superadmin roles.
 * Shows unapproved chapters and allows approval/rejection.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Check,
  X,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Languages,
  FileText,
  Mic,
  HelpCircle,
  Box,
  Sparkles,
  Clock,
  Eye,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Shield,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { canApproveChapters, ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import {
  fetchUnapprovedChapters,
  approveChapter,
  unapproveChapter,
  getChapterStats,
} from '../../lib/firebase/queries/curriculumChapters';
import { LanguageBadge } from '../../Components/LanguageSelector';
import type { NormalizedChapter, LanguageCode } from '../../types/curriculum';

const ChapterApprovals = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // State
  const [chapters, setChapters] = useState<NormalizedChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCurriculum, setFilterCurriculum] = useState<string>('all');
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    byCurriculum: {} as Record<string, number>,
  });

  // Check permissions
  useEffect(() => {
    if (profile && !canApproveChapters(profile)) {
      toast.error('You do not have permission to access this page');
      navigate('/lessons');
    }
  }, [profile, navigate]);

  // Fetch unapproved chapters
  useEffect(() => {
    if (!profile || !canApproveChapters(profile)) return;

    const loadChapters = async () => {
      setLoading(true);
      try {
        const [chaptersData, statsData] = await Promise.all([
          fetchUnapprovedChapters('en'),
          getChapterStats(),
        ]);
        setChapters(chaptersData);
        setStats(statsData);
        console.log('📚 Loaded unapproved chapters:', chaptersData.length);
      } catch (error) {
        console.error('Failed to load chapters:', error);
        toast.error('Failed to load chapters');
      } finally {
        setLoading(false);
      }
    };

    loadChapters();
  }, [profile]);

  // Available curricula from chapters
  const availableCurricula = useMemo(() => {
    const curricula = new Set<string>();
    chapters.forEach(ch => {
      if (ch.curriculum) curricula.add(ch.curriculum);
    });
    return Array.from(curricula).sort();
  }, [chapters]);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    let result = chapters;

    // Filter by curriculum
    if (filterCurriculum !== 'all') {
      result = result.filter(ch => ch.curriculum === filterCurriculum);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ch =>
        ch.chapterName.toLowerCase().includes(q) ||
        ch.subject.toLowerCase().includes(q) ||
        ch.topics.some(t => t.topicName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [chapters, filterCurriculum, searchQuery]);

  // Handle approve
  const handleApprove = useCallback(async (chapterId: string) => {
    if (!profile?.uid) return;

    setProcessingId(chapterId);
    try {
      const success = await approveChapter(chapterId, profile.uid);
      if (success) {
        // Remove from list
        setChapters(prev => prev.filter(ch => ch.id !== chapterId));
        setStats(prev => ({
          ...prev,
          approved: prev.approved + 1,
          pending: prev.pending - 1,
        }));
        toast.success('Chapter approved! It will now appear in Lessons.');
      } else {
        toast.error('Failed to approve chapter');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve chapter');
    } finally {
      setProcessingId(null);
    }
  }, [profile?.uid]);

  // Handle reject (keep unapproved but could add a reason)
  const handleReject = useCallback(async (chapterId: string) => {
    // For now, just remove from pending list visually
    // In a full implementation, you might mark it as "rejected" with a reason
    toast.info('Chapter left unapproved. Edit and resubmit when ready.');
    setExpandedChapterId(null);
  }, []);

  // Toggle expanded chapter
  const toggleExpanded = useCallback((chapterId: string) => {
    setExpandedChapterId(prev => prev === chapterId ? null : chapterId);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading pending chapters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                Chapter Approvals
              </h1>
              <p className="text-white/50 mt-1">
                Review and approve curriculum chapters before they appear in Lessons
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 font-bold text-lg">{stats.pending}</span>
                <span className="text-amber-400/70 text-sm ml-2">Pending</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 font-bold text-lg">{stats.approved}</span>
                <span className="text-emerald-400/70 text-sm ml-2">Approved</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20">
                <span className="text-slate-400 font-bold text-lg">{stats.total}</span>
                <span className="text-slate-400/70 text-sm ml-2">Total</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search chapters or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/10
                       text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
            />
          </div>

          {/* Curriculum Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterCurriculum('all')}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                filterCurriculum === 'all'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 border'
                  : 'bg-white/[0.03] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              All Curricula
            </button>
            {availableCurricula.map(curr => (
              <button
                key={curr}
                onClick={() => setFilterCurriculum(curr)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  filterCurriculum === curr
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 border'
                    : 'bg-white/[0.03] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Chapters List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {filteredChapters.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
              <p className="text-white/50">
                {searchQuery || filterCurriculum !== 'all'
                  ? 'No chapters match your search criteria'
                  : 'All chapters have been reviewed'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredChapters.map((chapter, index) => {
                  const isProcessing = processingId === chapter.id;
                  const isExpanded = expandedChapterId === chapter.id;

                  return (
                    <motion.div
                      key={chapter.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ delay: index * 0.05 }}
                      layout
                      className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
                    >
                      {/* Chapter Header */}
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Chapter Info */}
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 
                                          border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-lg font-bold text-cyan-300">
                                {chapter.chapterNumber}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-semibold text-cyan-400 uppercase">
                                  {chapter.curriculum}
                                </span>
                                <span className="text-white/20">•</span>
                                <span className="text-xs text-purple-400">
                                  Class {chapter.classNumber}
                                </span>
                                <span className="text-white/20">•</span>
                                <span className="text-xs text-slate-400">
                                  {chapter.subject}
                                </span>
                              </div>

                              <h3 className="text-lg font-semibold text-white truncate mb-2">
                                {chapter.chapterName}
                              </h3>

                              {/* Stats Row */}
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-slate-400">
                                  <FileText className="w-3 h-3" />
                                  {chapter.topics.length} topics
                                </span>
                                
                                <span className="flex items-center gap-1 text-slate-400">
                                  <HelpCircle className="w-3 h-3" />
                                  MCQ: EN {chapter.mcqCountByLanguage.en} | HI {chapter.mcqCountByLanguage.hi}
                                </span>
                                
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Mic className="w-3 h-3" />
                                  TTS: EN {chapter.ttsCountByLanguage.en} | HI {chapter.ttsCountByLanguage.hi}
                                </span>
                                
                                <LanguageBadge languages={chapter.supportedLanguages} size="sm" />
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                              onClick={() => toggleExpanded(chapter.id)}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl 
                                       bg-white/5 border border-white/10
                                       text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="font-medium text-sm">Preview</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            <button
                              onClick={() => handleReject(chapter.id)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                                       bg-red-500/10 border border-red-500/20
                                       text-red-400 hover:bg-red-500/20 transition-all
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <X className="w-4 h-4" />
                              <span className="font-medium">Skip</span>
                            </button>

                            <button
                              onClick={() => handleApprove(chapter.id)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                                       bg-emerald-500/20 border border-emerald-500/30
                                       text-emerald-400 hover:bg-emerald-500/30 transition-all
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span className="font-medium">Approve</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Topics Preview */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="border-t border-white/10 bg-white/[0.01]"
                          >
                            <div className="p-6">
                              <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Topics Preview
                              </h4>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {chapter.topics.map((topic, idx) => (
                                  <div
                                    key={topic.topicId}
                                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center
                                                    text-xs font-mono text-slate-400 flex-shrink-0">
                                        {topic.topicPriority}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h5 className="text-sm font-medium text-white truncate mb-1">
                                          {topic.topicName}
                                        </h5>
                                        {topic.learningObjective && (
                                          <p className="text-xs text-slate-400 line-clamp-2">
                                            {topic.learningObjective}
                                          </p>
                                        )}
                                        
                                        {/* Content indicators */}
                                        <div className="flex items-center gap-2 mt-2">
                                          {topic.skyboxUrl && (
                                            <Sparkles className="w-3 h-3 text-purple-400" title="Has Skybox" />
                                          )}
                                          {(topic.scripts.intro || topic.scripts.explanation) && (
                                            <Mic className="w-3 h-3 text-emerald-400" title="Has Script" />
                                          )}
                                          {topic.assetUrls.length > 0 && (
                                            <Box className="w-3 h-3 text-blue-400" title="Has 3D Assets" />
                                          )}
                                          {topic.mcqIds.length > 0 && (
                                            <HelpCircle className="w-3 h-3 text-amber-400" title="Has MCQs" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Quick stats */}
                              <div className="mt-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                  <div>
                                    <div className="text-lg font-bold text-cyan-400">
                                      {chapter.topics.filter(t => t.skyboxUrl).length}
                                    </div>
                                    <div className="text-xs text-slate-400">Skyboxes</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-emerald-400">
                                      {chapter.topics.filter(t => t.scripts.intro || t.scripts.explanation).length}
                                    </div>
                                    <div className="text-xs text-slate-400">With Scripts</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-blue-400">
                                      {chapter.meshyAssetIds.length}
                                    </div>
                                    <div className="text-xs text-slate-400">3D Assets</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-amber-400">
                                      {chapter.mcqCountByLanguage.en + chapter.mcqCountByLanguage.hi}
                                    </div>
                                    <div className="text-xs text-slate-400">Total MCQs</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Curriculum Distribution Card */}
        {Object.keys(stats.byCurriculum).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
          >
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Chapters by Curriculum
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(stats.byCurriculum).map(([curriculum, count]) => (
                <div
                  key={curriculum}
                  className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/30"
                >
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-slate-400">{curriculum}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ChapterApprovals;
