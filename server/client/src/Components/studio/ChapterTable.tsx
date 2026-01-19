import { Chapter } from '../../types/curriculum';
import {
  ExternalLink,
  Hash,
  BookOpen,
  Layers,
  Clock,
  GitBranch,
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

  return (
    <div className="bg-[#0d1424] rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[60px_1fr_100px_120px_140px_100px] gap-4 px-5 py-3 
                      bg-slate-800/30 border-b border-slate-700/50">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <Hash className="w-3.5 h-3.5" />
          No.
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          Chapter Name
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5" />
          Topics
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <GitBranch className="w-3.5 h-3.5" />
          Version
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5" />
          Updated
        </div>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider text-right">
          Actions
        </div>
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-slate-700/30">
        {chapters.map((chapter, index) => (
          <div
            key={chapter.id}
            className="grid grid-cols-[60px_1fr_100px_120px_140px_100px] gap-4 px-5 py-4
                       hover:bg-slate-800/20 transition-colors duration-150 group"
          >
            {/* Chapter Number */}
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-8 h-8 
                             text-sm font-semibold text-cyan-400 bg-cyan-500/10 
                             rounded-lg border border-cyan-500/20">
                {chapter.chapter_number || index + 1}
              </span>
            </div>
            
            {/* Chapter Name */}
            <div className="flex items-center">
              <span className="text-sm font-medium text-white truncate">
                {chapter.chapter_name}
              </span>
            </div>
            
            {/* Topic Count */}
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 
                             text-xs font-medium text-slate-300 
                             bg-slate-700/50 rounded-full">
                <Layers className="w-3 h-3" />
                {chapter.topic_count || 0}
              </span>
            </div>
            
            {/* Version */}
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 
                             text-xs font-medium text-emerald-400 
                             bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <GitBranch className="w-3 h-3" />
                {chapter.current_version || 'v1'}
              </span>
            </div>
            
            {/* Updated At */}
            <div className="flex items-center">
              <span className="text-xs text-slate-400">
                {formatDate(chapter.updated_at)}
              </span>
            </div>
            
            {/* Actions */}
            <div className="flex items-center justify-end">
              <button
                onClick={() => onOpenChapter(chapter)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5
                         text-xs font-medium text-cyan-400 
                         bg-cyan-500/10 hover:bg-cyan-500/20
                         rounded-lg border border-cyan-500/20 hover:border-cyan-500/40
                         transition-all duration-200
                         opacity-0 group-hover:opacity-100"
              >
                Open
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Loading overlay */}
      {loading && chapters.length > 0 && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
