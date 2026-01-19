import { EditHistoryEntry } from '../../../lib/firestore/queries';
import {
  History,
  Clock,
  User,
  FileText,
} from 'lucide-react';

interface HistoryTabProps {
  editHistory: EditHistoryEntry[];
}

export const HistoryTab = ({ editHistory }: HistoryTabProps) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return formatDate(dateString);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Edit History
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Last {editHistory.length} edits to this scene
          </p>
        </div>

        {/* History List */}
        {editHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 
                        bg-slate-800/20 rounded-xl border border-slate-700/30">
            <History className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400">No history available</p>
            <p className="text-sm text-slate-500 mt-1">
              Edit history will appear here after changes are saved
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-700/50" />
            
            {/* History Items */}
            <div className="space-y-4">
              {editHistory.map((entry, index) => (
                <div key={index} className="relative flex gap-4">
                  {/* Timeline Dot */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                                flex-shrink-0
                                ${index === 0
                                  ? 'bg-cyan-500/20 border-2 border-cyan-500/50'
                                  : 'bg-slate-800 border-2 border-slate-700'
                                }`}>
                    <Clock className={`w-4 h-4 ${index === 0 ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  
                  {/* Content */}
                  <div className={`flex-1 pb-4 ${index === editHistory.length - 1 ? 'pb-0' : ''}`}>
                    <div className={`p-4 rounded-xl border transition-all duration-200
                                  ${index === 0
                                    ? 'bg-cyan-500/5 border-cyan-500/20'
                                    : 'bg-slate-800/30 border-slate-700/30'
                                  }`}>
                      {/* Change Summary */}
                      <div className="flex items-start gap-2 mb-3">
                        <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-white leading-relaxed">
                          {entry.change_summary || 'Scene updated'}
                        </p>
                      </div>
                      
                      {/* Meta Info */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {/* User */}
                        <span className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          {entry.updated_by || 'Unknown'}
                        </span>
                        
                        {/* Time */}
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span title={formatDate(entry.updated_at)}>
                            {formatRelativeTime(entry.updated_at)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Info Card */}
        <div className="p-4 bg-slate-800/20 rounded-xl border border-slate-700/20">
          <p className="text-xs text-slate-500">
            History is automatically tracked when changes are saved. Only the last 10 entries are shown.
          </p>
        </div>
      </div>
    </div>
  );
};
