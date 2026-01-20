import { Chapter } from '../../types/curriculum';
import {
  ExternalLink,
  Hash,
  BookOpen,
  Layers,
  Clock,
  GitBranch,
  HelpCircle,
  Box,
  Image,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface ChapterTableProps {
  chapters: Chapter[];
  onOpenChapter: (chapter: Chapter) => void;
  loading?: boolean;
}

export const ChapterTable = ({
  chapters,
  onOpenChapter,
  loading,
}: ChapterTableProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };
  
  // Helper to check if chapter has content
  const getContentStatus = (chapter: Chapter) => {
    const hasMCQs = (chapter.mcq_ids && chapter.mcq_ids.length > 0) || 
                   (chapter.topics?.some(t => t.mcq_ids && t.mcq_ids.length > 0));
    const has3DAssets = (chapter.meshy_asset_ids && chapter.meshy_asset_ids.length > 0) ||
                        (chapter.image3dasset?.imageasset_url) ||
                        (chapter.topics?.some(t => t.meshy_asset_ids && t.meshy_asset_ids.length > 0));
    const hasImages = (chapter.image_ids && chapter.image_ids.length > 0);
    
    return { hasMCQs, has3DAssets, hasImages };
  };

  return (
    <div className="bg-[#0d1424] rounded-2xl border border-slate-700/30 overflow-hidden shadow-xl shadow-slate-900/50">
      {/* Table Header */}
      <div className="grid grid-cols-[60px_1fr_80px_200px_120px_140px_100px] gap-4 px-6 py-4 
                      bg-gradient-to-r from-slate-800/50 to-slate-800/30 border-b border-slate-700/30">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <Hash className="w-3 h-3 text-cyan-500/50" />
          No.
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <BookOpen className="w-3 h-3 text-cyan-500/50" />
          Chapter Name
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <Layers className="w-3 h-3 text-cyan-500/50" />
          Topics
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Content
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <GitBranch className="w-3 h-3 text-cyan-500/50" />
          Version
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <Clock className="w-3 h-3 text-cyan-500/50" />
          Updated
        </div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-right">
          Actions
        </div>
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-slate-700/20">
        {chapters.map((chapter, index) => {
          const contentStatus = getContentStatus(chapter);
          
          return (
            <div
              key={chapter.id}
              onClick={() => onOpenChapter(chapter)}
              className="grid grid-cols-[60px_1fr_80px_200px_120px_140px_100px] gap-4 px-6 py-5
                         hover:bg-slate-800/30 transition-all duration-200 group cursor-pointer
                         border-l-2 border-transparent hover:border-cyan-500"
            >
              {/* Chapter Number */}
              <div className="flex items-center">
                <span className="inline-flex items-center justify-center w-9 h-9 
                               text-sm font-bold text-cyan-400 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 
                               rounded-xl border border-cyan-500/20 shadow-inner">
                  {chapter.chapter_number || index + 1}
                </span>
              </div>
              
              {/* Chapter Name */}
              <div className="flex items-center min-w-0">
                <div className="truncate">
                  <span className="text-sm font-semibold text-white group-hover:text-cyan-50 transition-colors">
                    {chapter.chapter_name}
                  </span>
                  {chapter.subject && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{chapter.subject}</p>
                  )}
                </div>
              </div>
              
              {/* Topic Count */}
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 
                               text-xs font-semibold text-slate-200 
                               bg-slate-700/40 rounded-lg">
                  {chapter.topic_count || chapter.topics?.length || 0}
                </span>
              </div>
              
              {/* Content Status Indicators */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                              ${contentStatus.hasMCQs 
                                ? 'text-emerald-400 bg-emerald-500/10' 
                                : 'text-slate-500 bg-slate-700/30'}`}
                     title={contentStatus.hasMCQs ? 'Has MCQs' : 'No MCQs'}>
                  <HelpCircle className="w-3 h-3" />
                  MCQ
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                              ${contentStatus.has3DAssets 
                                ? 'text-violet-400 bg-violet-500/10' 
                                : 'text-slate-500 bg-slate-700/30'}`}
                     title={contentStatus.has3DAssets ? 'Has 3D Assets' : 'No 3D Assets'}>
                  <Box className="w-3 h-3" />
                  3D
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                              ${contentStatus.hasImages 
                                ? 'text-amber-400 bg-amber-500/10' 
                                : 'text-slate-500 bg-slate-700/30'}`}
                     title={contentStatus.hasImages ? 'Has Images' : 'No Images'}>
                  <Image className="w-3 h-3" />
                  IMG
                </div>
              </div>
              
              {/* Version */}
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 
                               text-xs font-semibold text-emerald-400 
                               bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  {chapter.current_version || 'v1'}
                </span>
              </div>
              
              {/* Updated At */}
              <div className="flex items-center">
                <span className="text-xs text-slate-400 font-medium">
                  {formatDate(chapter.updated_at)}
                </span>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChapter(chapter);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2
                           text-xs font-semibold text-white 
                           bg-gradient-to-r from-cyan-500 to-blue-600
                           hover:from-cyan-400 hover:to-blue-500
                           rounded-lg shadow-lg shadow-cyan-500/20
                           transition-all duration-200
                           opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
                >
                  Open
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Loading overlay */}
      {loading && chapters.length > 0 && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
