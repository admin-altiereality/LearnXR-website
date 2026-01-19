import { Scene } from '../../../types/curriculum';
import {
  MessageSquare,
  BookOpen,
  Flag,
  Volume2,
  Loader2,
} from 'lucide-react';

interface AvatarTabProps {
  sceneFormState: Partial<Scene>;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  isReadOnly: boolean;
}

export const AvatarTab = ({
  sceneFormState,
  onSceneChange,
  isReadOnly,
}: AvatarTabProps) => {
  const scriptSections = [
    {
      id: 'avatar_intro',
      label: 'Introduction Script',
      icon: MessageSquare,
      placeholder: 'Write the avatar\'s introduction to the topic...',
      description: 'What the avatar says to introduce the topic and hook learner attention',
      color: 'cyan',
    },
    {
      id: 'avatar_explanation',
      label: 'Explanation Script',
      icon: BookOpen,
      placeholder: 'Write the main explanation content...',
      description: 'The core teaching content delivered by the avatar',
      color: 'violet',
    },
    {
      id: 'avatar_outro',
      label: 'Conclusion Script',
      icon: Flag,
      placeholder: 'Write the avatar\'s concluding remarks...',
      description: 'Summary, key takeaways, and transition to next activity',
      color: 'emerald',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { icon: string; bg: string; border: string }> = {
      cyan: {
        icon: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/20',
      },
      violet: {
        icon: 'text-violet-400',
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/20',
      },
      emerald: {
        icon: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
      },
    };
    return colors[color] || colors.cyan;
  };

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const estimateReadTime = (text: string) => {
    const words = countWords(text);
    const minutes = Math.ceil(words / 150); // Average speaking rate
    return minutes;
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Avatar Scripts</h2>
            <p className="text-sm text-slate-400 mt-1">
              Write the dialogue for the teaching avatar in each phase of the lesson
            </p>
          </div>
          <button
            disabled={isReadOnly}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                     text-slate-300 bg-slate-800/50 hover:bg-slate-700/50
                     rounded-lg border border-slate-600/50
                     transition-all duration-200 disabled:opacity-50"
          >
            <Volume2 className="w-4 h-4" />
            Preview Voice
          </button>
        </div>
        
        {/* Script Sections */}
        {scriptSections.map((section) => {
          const Icon = section.icon;
          const colors = getColorClasses(section.color);
          const value = (sceneFormState[section.id as keyof Scene] as string) || '';
          const wordCount = countWords(value);
          const readTime = estimateReadTime(value);
          
          return (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span className={`p-1.5 rounded-lg ${colors.bg} ${colors.border} border`}>
                    <Icon className={`w-4 h-4 ${colors.icon}`} />
                  </span>
                  {section.label}
                </label>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{wordCount} words</span>
                  <span>~{readTime} min</span>
                </div>
              </div>
              
              <textarea
                value={value}
                onChange={(e) => onSceneChange(section.id as keyof Scene, e.target.value)}
                disabled={isReadOnly}
                placeholder={section.placeholder}
                rows={6}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                         px-4 py-3 text-white placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed resize-none
                         transition-all duration-200 leading-relaxed"
              />
              
              <p className="text-xs text-slate-500">{section.description}</p>
            </div>
          );
        })}
        
        {/* Tips Card */}
        <div className="p-5 bg-gradient-to-br from-slate-800/30 to-slate-800/10 
                      rounded-xl border border-slate-700/30">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Writing Tips</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              Keep sentences short and conversational for natural speech delivery
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              Use simple language appropriate for the target grade level
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              Include pauses with "..." for emphasis and natural rhythm
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              The explanation section should be the longest, with intro and outro being concise
            </li>
          </ul>
        </div>
        
        {/* Total Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/20 rounded-xl border border-slate-700/20">
          {scriptSections.map((section) => {
            const value = (sceneFormState[section.id as keyof Scene] as string) || '';
            const wordCount = countWords(value);
            const colors = getColorClasses(section.color);
            
            return (
              <div key={section.id} className="text-center">
                <p className="text-xs text-slate-500 mb-1">{section.label}</p>
                <p className={`text-lg font-semibold ${colors.icon}`}>
                  {wordCount}
                  <span className="text-xs font-normal text-slate-500 ml-1">words</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
