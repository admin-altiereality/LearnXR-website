/**
 * LaunchLessonButton - Launches a lesson from the Content Studio to the /main page
 * 
 * Collects all topic data (skybox, avatar scripts, MCQs, 3D assets) and navigates
 * to /main with the lesson context set.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useLesson, LessonChapter, LessonTopic, LessonMCQ } from '../../contexts/LessonContext';
import { getTopicSkybox, getMCQs, get3DAssets } from '../../lib/firestore/queries';
import { Play, Loader2, Rocket, CheckCircle } from 'lucide-react';

interface LaunchLessonButtonProps {
  chapterId: string;
  chapterName: string;
  chapterNumber: number;
  curriculum: string;
  className: string;
  subject: string;
  topicId: string;
  topicName: string;
  topicPriority: number;
  learningObjective?: string;
  in3dPrompt?: string;
  avatarIntro?: string;
  avatarExplanation?: string;
  avatarOutro?: string;
  skyboxId?: string;
  skyboxUrl?: string;
  assetList?: string[];
  assetUrls?: string[];
  assetIds?: string[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'icon';
  disabled?: boolean;
}

export const LaunchLessonButton = ({
  chapterId,
  chapterName,
  chapterNumber,
  curriculum,
  className,
  subject,
  topicId,
  topicName,
  topicPriority,
  learningObjective = '',
  in3dPrompt = '',
  avatarIntro = '',
  avatarExplanation = '',
  avatarOutro = '',
  skyboxId,
  skyboxUrl,
  assetList = [],
  assetUrls = [],
  assetIds = [],
  size = 'md',
  variant = 'primary',
  disabled = false,
}: LaunchLessonButtonProps) => {
  const navigate = useNavigate();
  const { startLesson } = useLesson();
  const [loading, setLoading] = useState(false);
  
  const handleLaunch = useCallback(async () => {
    if (loading || disabled) return;
    
    setLoading(true);
    
    // Comprehensive logging for debugging
    console.log('🚀 [LaunchLesson] Starting lesson launch...');
    console.log('📋 [LaunchLesson] Props received:', {
      chapterId,
      chapterName,
      topicId,
      topicName,
      skyboxId,
      skyboxUrl: skyboxUrl?.substring(0, 50),
      avatarIntro: avatarIntro?.substring(0, 50),
      avatarExplanation: avatarExplanation?.substring(0, 50),
      avatarOutro: avatarOutro?.substring(0, 50),
      assetUrls,
      assetIds,
    });
    
    try {
      // Validate required fields
      if (!chapterId) {
        console.error('❌ [LaunchLesson] Missing chapterId');
        toast.error('Cannot launch: Missing chapter ID');
        return;
      }
      
      if (!topicId) {
        console.error('❌ [LaunchLesson] Missing topicId');
        toast.error('Cannot launch: Missing topic ID');
        return;
      }
      
      // Build chapter data
      const chapter: LessonChapter = {
        chapter_id: chapterId,
        chapter_name: chapterName,
        chapter_number: chapterNumber,
        curriculum,
        class_name: className,
        subject,
      };
      
      console.log('📚 [LaunchLesson] Chapter built:', chapter);
      
      // Try to fetch additional data if not provided
      let finalSkyboxUrl = skyboxUrl;
      let mcqs: LessonMCQ[] = [];
      let finalAssetUrls = [...assetUrls];
      
      // Fetch skybox if not provided
      if (!finalSkyboxUrl && chapterId && topicId) {
        console.log('🔍 [LaunchLesson] Fetching skybox from Firestore...');
        try {
          const skyboxData = await getTopicSkybox(chapterId, topicId);
          console.log('📦 [LaunchLesson] Skybox fetch result:', skyboxData);
          if (skyboxData) {
            finalSkyboxUrl = skyboxData.imageUrl || skyboxData.file_url;
            console.log('✅ [LaunchLesson] Got skybox URL:', finalSkyboxUrl?.substring(0, 50));
          }
        } catch (e) {
          console.warn('⚠️ [LaunchLesson] Could not fetch skybox:', e);
        }
      }
      
      // Fetch MCQs
      if (chapterId && topicId) {
        console.log('🔍 [LaunchLesson] Fetching MCQs...');
        try {
          const mcqData = await getMCQs(chapterId, 'current', topicId);
          console.log('📦 [LaunchLesson] MCQ fetch result:', mcqData);
          mcqs = mcqData.map(m => ({
            id: m.id,
            question: m.question,
            options: m.options,
            correct_option_index: m.correct_option_index,
            explanation: m.explanation,
          }));
          console.log('✅ [LaunchLesson] Got MCQs count:', mcqs.length);
        } catch (e) {
          console.warn('⚠️ [LaunchLesson] Could not fetch MCQs:', e);
        }
      }
      
      // Fetch 3D assets if not provided
      if (finalAssetUrls.length === 0 && chapterId && topicId) {
        console.log('🔍 [LaunchLesson] Fetching 3D assets...');
        try {
          const assets = await get3DAssets(chapterId, topicId);
          console.log('📦 [LaunchLesson] 3D assets fetch result:', assets);
          finalAssetUrls = assets.map(a => a.glb_url).filter(Boolean);
          console.log('✅ [LaunchLesson] Got asset URLs:', finalAssetUrls);
        } catch (e) {
          console.warn('⚠️ [LaunchLesson] Could not fetch 3D assets:', e);
        }
      }
      
      // Build topic data
      const topic: LessonTopic = {
        topic_id: topicId,
        topic_name: topicName,
        topic_priority: topicPriority,
        learning_objective: learningObjective,
        in3d_prompt: in3dPrompt,
        skybox_id: skyboxId,
        skybox_url: finalSkyboxUrl,
        avatar_intro: avatarIntro,
        avatar_explanation: avatarExplanation,
        avatar_outro: avatarOutro,
        asset_list: assetList,
        asset_urls: finalAssetUrls,
        asset_ids: assetIds,
        mcqs,
      };
      
      console.log('📚 [LaunchLesson] Topic built:', {
        ...topic,
        avatar_intro: topic.avatar_intro?.substring(0, 50),
        avatar_explanation: topic.avatar_explanation?.substring(0, 50),
        avatar_outro: topic.avatar_outro?.substring(0, 50),
      });
      
      // Validate we have minimum required data
      if (!finalSkyboxUrl && !avatarIntro && !avatarExplanation) {
        console.warn('⚠️ [LaunchLesson] No content available');
        toast.warning('This topic has no content yet. Generate a skybox or add scripts first.');
        setLoading(false);
        return;
      }
      
      console.log('🎬 [LaunchLesson] Calling startLesson...');
      
      // Start the lesson
      startLesson(chapter, topic);
      
      console.log('✅ [LaunchLesson] startLesson called successfully');
      
      toast.success(`Launching lesson: ${topicName}`);
      
      console.log('🧭 [LaunchLesson] Navigating to /vrlessonplayer...');
      
      // Navigate to VR Lesson Player
      navigate('/vrlessonplayer');
      
    } catch (error: any) {
      console.error('❌ [LaunchLesson] Error launching lesson:', error);
      console.error('❌ [LaunchLesson] Error stack:', error?.stack);
      toast.error(`Failed to launch lesson: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [
    loading, disabled, chapterId, chapterName, chapterNumber, curriculum, className, subject,
    topicId, topicName, topicPriority, learningObjective, in3dPrompt,
    avatarIntro, avatarExplanation, avatarOutro, skyboxId, skyboxUrl,
    assetList, assetUrls, assetIds, startLesson, navigate
  ]);
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };
  
  // Icon sizes
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  // Variant styles
  const variantClasses = {
    primary: `
      bg-gradient-to-r from-emerald-500 to-teal-600 
      hover:from-emerald-400 hover:to-teal-500 
      text-white font-semibold
      shadow-lg shadow-emerald-500/25 
      hover:shadow-emerald-500/40 hover:-translate-y-0.5 
      active:translate-y-0
    `,
    secondary: `
      bg-slate-800/50 hover:bg-slate-700/50
      text-emerald-400 hover:text-emerald-300
      border border-emerald-500/30 hover:border-emerald-500/50
    `,
    icon: `
      bg-emerald-500/10 hover:bg-emerald-500/20
      text-emerald-400 hover:text-emerald-300
      border border-emerald-500/30
      !p-2
    `,
  };
  
  if (variant === 'icon') {
    return (
      <button
        onClick={handleLaunch}
        disabled={loading || disabled}
        className={`
          flex items-center justify-center rounded-lg
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
        `}
        title={`Launch lesson: ${topicName}`}
      >
        {loading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <Rocket className={iconSizes[size]} />
        )}
      </button>
    );
  }
  
  return (
    <button
      onClick={handleLaunch}
      disabled={loading || disabled}
      className={`
        flex items-center justify-center rounded-xl
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
    >
      {loading ? (
        <>
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
          <span>Launching...</span>
        </>
      ) : (
        <>
          <Rocket className={iconSizes[size]} />
          <span>Launch Lesson</span>
        </>
      )}
    </button>
  );
};

export default LaunchLessonButton;
