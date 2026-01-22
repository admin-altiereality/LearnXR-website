/**
 * AvatarTab - Avatar Scripts and TTS Audio Management
 * 
 * Data Source: chapter_tts collection (NEW Firestore schema)
 * TTS audio files are now stored in the chapter_tts collection
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Scene, ChapterTTS, LanguageCode } from '../../../types/curriculum';
import { getChapterTTS, getChapterTTSByLanguage, extractTopicScriptsForLanguage } from '../../../lib/firestore/queries';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../../types/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { LanguageToggle } from '../../../Components/LanguageSelector';
import {
  MessageSquare,
  BookOpen,
  Flag,
  Volume2,
  Loader2,
  RefreshCw,
  Play,
  Pause,
  ExternalLink,
  Mic,
} from 'lucide-react';

interface AvatarTabProps {
  sceneFormState: Partial<Scene>;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  isReadOnly: boolean;
  chapterId?: string;
  topicId?: string;
  language?: LanguageCode;
  onLanguageChange?: (language: LanguageCode) => void;
}

export const AvatarTab = ({
  sceneFormState,
  onSceneChange,
  isReadOnly,
  chapterId,
  topicId,
  language = 'en',
  onLanguageChange,
}: AvatarTabProps) => {
  // TTS audio from chapter_tts collection
  const [ttsData, setTtsData] = useState<ChapterTTS[]>([]);
  const [loadingTTS, setLoadingTTS] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [languageScripts, setLanguageScripts] = useState<{
    intro: string;
    explanation: string;
    outro: string;
  } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  
  // Sync with parent language prop and reload data when it changes
  useEffect(() => {
    if (language !== selectedLanguage) {
      console.log(`[AvatarTab] Syncing language from parent: ${language} (was ${selectedLanguage})`);
      setSelectedLanguage(language);
      // Data will reload automatically via useEffect dependencies on selectedLanguage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  
  const handleLanguageChange = (lang: LanguageCode) => {
    console.log(`[AvatarTab] Language changed to: ${lang}`);
    setSelectedLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    // Scripts and TTS will reload automatically via useEffect dependencies
  };
  
  // Load language-specific scripts using bundle for consistency
  useEffect(() => {
    const loadLanguageScripts = async () => {
      if (!chapterId || !topicId) return;
      
      try {
        console.log(`[AvatarTab] Loading ${selectedLanguage} scripts for topic ${topicId}...`);
        
        // Use bundle to get scripts (consistent with other tabs)
        const { getLessonBundle } = await import('../../../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({
          chapterId,
          lang: selectedLanguage,
          topicId,
        });
        
        const scripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
        setLanguageScripts(scripts);
        
        console.log(`[AvatarTab] Loaded ${selectedLanguage} scripts:`, {
          hasIntro: !!scripts.intro,
          hasExplanation: !!scripts.explanation,
          hasOutro: !!scripts.outro,
        });
        
        // Update scene form state with language-specific scripts
        onSceneChange('avatar_intro', scripts.intro || '');
        onSceneChange('avatar_explanation', scripts.explanation || '');
        onSceneChange('avatar_outro', scripts.outro || '');
      } catch (error) {
        console.error(`[AvatarTab] Error loading ${selectedLanguage} scripts:`, error);
        // Fallback to direct chapter fetch
        try {
          const chapterRef = doc(db, 'curriculum_chapters', chapterId);
          const chapterSnap = await getDoc(chapterRef);
          
          if (chapterSnap.exists()) {
            const chapterData = chapterSnap.data() as CurriculumChapter;
            const topic = chapterData.topics?.find(t => t.topic_id === topicId);
            
            if (topic) {
              const scripts = extractTopicScriptsForLanguage(topic, selectedLanguage);
              setLanguageScripts(scripts);
              onSceneChange('avatar_intro', scripts.intro || '');
              onSceneChange('avatar_explanation', scripts.explanation || '');
              onSceneChange('avatar_outro', scripts.outro || '');
            }
          }
        } catch (fallbackError) {
          console.error(`[AvatarTab] Fallback also failed:`, fallbackError);
        }
      }
    };
    
    loadLanguageScripts();
  }, [chapterId, topicId, selectedLanguage, onSceneChange]);
  
  // Load TTS data from bundle (language-specific)
  useEffect(() => {
    const loadTTSData = async () => {
      if (!chapterId || !topicId) return;
      
      setLoadingTTS(true);
      try {
        console.log(`[AvatarTab] Loading ${selectedLanguage} TTS for topic ${topicId}...`);
        
        // Use bundle to get TTS (consistent with other tabs)
        const { getLessonBundle } = await import('../../../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({
          chapterId,
          lang: selectedLanguage,
          topicId,
        });
        
        setTtsData(bundle.tts || []);
        console.log(`[AvatarTab] ✅ Loaded ${bundle.tts.length} ${selectedLanguage} TTS files from bundle`);
      } catch (error) {
        console.error(`[AvatarTab] Error loading ${selectedLanguage} TTS from bundle:`, error);
        // Fallback to direct query
        try {
          const data = await getChapterTTSByLanguage(chapterId, topicId, selectedLanguage);
          setTtsData(data);
          console.log(`[AvatarTab] Fallback: Loaded ${data.length} ${selectedLanguage} TTS files`);
        } catch (fallbackError) {
          console.error(`[AvatarTab] Fallback also failed:`, fallbackError);
          setTtsData([]);
        }
      } finally {
        setLoadingTTS(false);
      }
    };
    
    loadTTSData();
  }, [chapterId, topicId, selectedLanguage]);
  
  const handleRefreshTTS = async () => {
    if (!chapterId || !topicId) return;
    
    setLoadingTTS(true);
    try {
      // Use bundle to refresh TTS
      const { getLessonBundle } = await import('../../../services/firestore/getLessonBundle');
      const bundle = await getLessonBundle({
        chapterId,
        lang: selectedLanguage,
        topicId,
      });
      
      setTtsData(bundle.tts || []);
      toast.success(`${selectedLanguage === 'en' ? 'English' : 'Hindi'} TTS data refreshed`);
    } catch (error) {
      console.error(`[AvatarTab] Error refreshing ${selectedLanguage} TTS:`, error);
      // Fallback to direct query
      try {
        const data = await getChapterTTSByLanguage(chapterId, topicId, selectedLanguage);
        setTtsData(data);
        toast.success(`${selectedLanguage === 'en' ? 'English' : 'Hindi'} TTS data refreshed`);
      } catch (fallbackError) {
        toast.error(`Failed to refresh ${selectedLanguage === 'en' ? 'English' : 'Hindi'} TTS`);
      }
    } finally {
      setLoadingTTS(false);
    }
  };
  
  const handlePlayAudio = (audioUrl: string, scriptType: string) => {
    if (playingAudio === scriptType) {
      audioRef?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef) {
        audioRef.pause();
      }
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setAudioRef(audio);
      setPlayingAudio(scriptType);
    }
  };
  
  // Get TTS for a specific script type
  const getTTSForType = (type: 'intro' | 'explanation' | 'outro'): ChapterTTS | undefined => {
    return ttsData.find(t => t.script_type === type);
  };

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
              <span className="text-cyan-400/60 ml-1">
                ({selectedLanguage === 'en' ? 'English' : 'Hindi'})
              </span>
              {ttsData.length > 0 && (
                <span className="text-cyan-400/60 ml-1">
                  • {ttsData.length} {selectedLanguage === 'en' ? 'English' : 'Hindi'} TTS audio{ttsData.length !== 1 ? 's' : ''} from chapter_tts
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Language:</span>
              <LanguageToggle
                value={selectedLanguage}
                onChange={handleLanguageChange}
                size="sm"
                showFlags={true}
              />
            </div>
            {chapterId && topicId && (
              <button
                onClick={handleRefreshTTS}
                disabled={loadingTTS}
                className="p-2 text-slate-400 hover:text-white
                         bg-slate-800/50 hover:bg-slate-700/50
                         rounded-lg border border-slate-600/50
                         transition-all duration-200"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTTS ? 'animate-spin' : ''}`} />
              </button>
            )}
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
        </div>
        
        {/* TTS Audio List */}
        {ttsData.length > 0 && (
          <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-400">Generated TTS Audio</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ttsData.map((tts) => (
                <div key={tts.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <button
                    onClick={() => tts.audio_url && handlePlayAudio(tts.audio_url, tts.script_type)}
                    disabled={!tts.audio_url}
                    className={`p-2 rounded-lg transition-all ${
                      playingAudio === tts.script_type 
                        ? 'bg-cyan-500 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    } disabled:opacity-50`}
                  >
                    {playingAudio === tts.script_type ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white capitalize">{tts.script_type}</p>
                    <p className="text-[10px] text-slate-500">
                      {tts.duration_seconds ? `${tts.duration_seconds}s` : 'No duration'}
                      {tts.voice_name && ` • ${tts.voice_name}`}
                    </p>
                  </div>
                  {tts.audio_url && (
                    <a
                      href={tts.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-500 hover:text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Script Sections */}
        {scriptSections.map((section) => {
          const Icon = section.icon;
          const colors = getColorClasses(section.color);
          // Use languageScripts if available, otherwise fall back to sceneFormState
          const scriptValue = languageScripts 
            ? (section.id === 'avatar_intro' ? languageScripts.intro
               : section.id === 'avatar_explanation' ? languageScripts.explanation
               : languageScripts.outro)
            : (sceneFormState[section.id as keyof Scene] as string) || '';
          const value = scriptValue;
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
                onChange={(e) => {
                  const newValue = e.target.value;
                  // Update both languageScripts state and sceneFormState
                  if (languageScripts) {
                    setLanguageScripts({
                      ...languageScripts,
                      [section.id === 'avatar_intro' ? 'intro'
                       : section.id === 'avatar_explanation' ? 'explanation'
                       : 'outro']: newValue,
                    });
                  }
                  onSceneChange(section.id as keyof Scene, newValue);
                }}
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
            // Use languageScripts if available, otherwise fall back to sceneFormState
            const value = languageScripts 
              ? (section.id === 'avatar_intro' ? languageScripts.intro
                 : section.id === 'avatar_explanation' ? languageScripts.explanation
                 : languageScripts.outro)
              : (sceneFormState[section.id as keyof Scene] as string) || '';
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
