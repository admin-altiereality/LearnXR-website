import { Topic, Scene, LanguageCode } from '../../../types/curriculum';
import { FileText, Hash, Tag, Target, HelpCircle, Box, Image, Loader2, CheckCircle, XCircle, Volume2, Globe, Sparkles } from 'lucide-react';
import { LanguageToggle } from '../../../Components/LanguageSelector';
import {
  getChapterNameByLanguage,
  getTopicNameByLanguage,
  getLearningObjectiveByLanguage,
} from '../../../lib/firebase/utils/languageAvailability';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../../types/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useState, useEffect, useCallback } from 'react';
import { getChapterImages } from '../../../lib/firestore/queries';

interface ContentAvailability {
  hasMCQs: boolean;
  mcqCount: number;
  mcqsWithOptions: number;
  has3DAssets: boolean;
  assetCount: number;
  hasImages: boolean;
  imageCount: number;
  hasTTS: boolean;
  ttsCount: number;
  ttsWithAudio: number;
  hasSkybox: boolean;
  hasAvatarScripts: boolean;
  hasTextTo3dAssets: boolean;
  textTo3dAssetsCount: number;
  textTo3dApprovedCount: number;
  sceneStatus: 'published' | 'draft' | 'pending';
  loading: boolean;
}

interface OverviewTabProps {
  topicFormState: Partial<Topic>;
  sceneFormState: Partial<Scene>;
  onTopicChange: (field: keyof Topic, value: unknown) => void;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  isReadOnly: boolean;
  contentAvailability?: ContentAvailability;
  chapterId?: string;
  topicId?: string;
  language?: LanguageCode;
  selectedLanguage?: LanguageCode;
}

const sceneTypes = [
  { value: 'interactive', label: 'Interactive' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exploration', label: 'Exploration' },
];

export const OverviewTab = ({
  topicFormState,
  sceneFormState,
  onTopicChange,
  onSceneChange,
  isReadOnly,
  contentAvailability,
  chapterId,
  topicId,
  selectedLanguage: propLanguage,
}: OverviewTabProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(propLanguage || 'en');
  const [chapterData, setChapterData] = useState<CurriculumChapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [bundleAvailability, setBundleAvailability] = useState<ContentAvailability>({
    hasMCQs: false,
    mcqCount: 0,
    mcqsWithOptions: 0,
    has3DAssets: false,
    assetCount: 0,
    hasImages: false,
    imageCount: 0,
          hasTTS: false,
          ttsCount: 0,
          ttsWithAudio: 0,
          hasSkybox: false,
          hasAvatarScripts: false,
          hasTextTo3dAssets: false,
          textTo3dAssetsCount: 0,
          textTo3dApprovedCount: 0,
          sceneStatus: 'pending',
          loading: true,
        });
  
  // Sync with prop language
  useEffect(() => {
    if (propLanguage) {
      setSelectedLanguage(propLanguage);
    }
  }, [propLanguage]);

  // Load chapter data and bundle-based content availability
  // This MUST run first and block rendering until complete
  useEffect(() => {
    const loadData = async () => {
      if (!chapterId || !topicId) {
        setBundleAvailability(prev => ({ ...prev, loading: false }));
        return;
      }
      
      setLoading(true);
      setBundleAvailability(prev => ({ ...prev, loading: true }));
      
      try {
        // Load chapter data
        const chapterRef = doc(db, 'curriculum_chapters', chapterId);
        const chapterSnap = await getDoc(chapterRef);
        
        if (chapterSnap.exists()) {
          setChapterData(chapterSnap.data() as CurriculumChapter);
        }
        
        // Load bundle for content availability check - THIS IS THE GATE
        const { getLessonBundle } = await import('../../../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({
          chapterId,
          lang: selectedLanguage,
          topicId,
        });
        
        // Use images from bundle (includes PDF suitable images) - safe defaults
        const images = Array.isArray(bundle.images) ? bundle.images : [];
        
        // Analyze bundle content - safe defaults
        const safeMcqs = Array.isArray(bundle.mcqs) ? bundle.mcqs : [];
        const mcqsWithOptions = safeMcqs.filter(
          (m: any) => m.options && Array.isArray(m.options) && m.options.length > 0
        );
        
        const safeTts = Array.isArray(bundle.tts) ? bundle.tts : [];
        const ttsWithAudio = safeTts.filter(
          (t: any) => t.audio_url || t.audioUrl || t.url
        );
        
        // Determine scene status
        let sceneStatus: 'published' | 'draft' | 'pending' = 'pending';
        if (sceneFormState.status === 'published') {
          sceneStatus = 'published';
        } else if (sceneFormState.skybox_url || bundle.skybox) {
          sceneStatus = 'draft';
        }
        
        const safeTextTo3dAssets = Array.isArray(bundle.textTo3dAssets) ? bundle.textTo3dAssets : [];
        const textTo3dApproved = safeTextTo3dAssets.filter((a: any) => a.approval_status === true);
        
        const safeAssets3d = Array.isArray(bundle.assets3d) ? bundle.assets3d : [];
        
        // Enhanced skybox availability check - check multiple sources
        const hasSkybox = !!(
          bundle.skybox || // From bundle (fetched by skybox_id)
          sceneFormState.skybox_url || // From scene form state
          sceneFormState.skybox_id || // Skybox ID exists
          chapterData?.topics?.find((t: any) => t.topic_id === topicId)?.skybox_url || // Topic-level skybox URL
          chapterData?.topics?.find((t: any) => t.topic_id === topicId)?.skybox_id // Topic-level skybox ID
        );
        
        console.log('🔍 [OverviewTab] Skybox availability check:', {
          bundleSkybox: !!bundle.skybox,
          sceneFormSkyboxUrl: !!sceneFormState.skybox_url,
          sceneFormSkyboxId: !!sceneFormState.skybox_id,
          topicSkyboxUrl: !!chapterData?.topics?.find((t: any) => t.topic_id === topicId)?.skybox_url,
          topicSkyboxId: !!chapterData?.topics?.find((t: any) => t.topic_id === topicId)?.skybox_id,
          finalHasSkybox: hasSkybox,
        });
        
        setBundleAvailability({
          hasMCQs: mcqsWithOptions.length > 0,
          mcqCount: safeMcqs.length,
          mcqsWithOptions: mcqsWithOptions.length,
          has3DAssets: safeAssets3d.length > 0,
          assetCount: safeAssets3d.length,
          hasImages: images.length > 0,
          imageCount: images.length,
          hasTTS: ttsWithAudio.length > 0,
          ttsCount: safeTts.length,
          ttsWithAudio: ttsWithAudio.length,
          hasSkybox: hasSkybox,
          hasAvatarScripts: !!(bundle.avatarScripts && (
            bundle.avatarScripts.intro || 
            bundle.avatarScripts.explanation || 
            bundle.avatarScripts.outro
          )),
          hasTextTo3dAssets: safeTextTo3dAssets.length > 0,
          textTo3dAssetsCount: safeTextTo3dAssets.length,
          textTo3dApprovedCount: textTo3dApproved.length,
          sceneStatus,
          loading: false,
        });
        
        console.log('📊 [OverviewTab] Bundle-based content availability:', {
          language: selectedLanguage,
          mcqs: {
            total: safeMcqs.length,
            withOptions: mcqsWithOptions.length,
          },
          tts: {
            total: safeTts.length,
            withAudio: ttsWithAudio.length,
          },
          assets: safeAssets3d.length,
          images: images.length,
          textTo3dAssets: safeTextTo3dAssets.length,
          textTo3dApproved: textTo3dApproved.length,
          skybox: !!bundle.skybox,
          avatarScripts: !!bundle.avatarScripts,
          sceneStatus,
        });
      } catch (error) {
        console.error('❌ [OverviewTab] Error loading content availability:', error);
        // Set safe defaults on error
        setBundleAvailability({
          hasMCQs: false,
          mcqCount: 0,
          mcqsWithOptions: 0,
          has3DAssets: false,
          assetCount: 0,
          hasImages: false,
          imageCount: 0,
          hasTTS: false,
          ttsCount: 0,
          ttsWithAudio: 0,
          hasSkybox: false,
          hasAvatarScripts: false,
          hasTextTo3dAssets: false,
          textTo3dAssetsCount: 0,
          textTo3dApprovedCount: 0,
          sceneStatus: 'pending',
          loading: false,
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [chapterId, topicId, selectedLanguage, sceneFormState.status, sceneFormState.skybox_url]);
  
  // BLOCK RENDERING until availability check completes
  if (bundleAvailability.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading content availability...</span>
        </div>
      </div>
    );
  }
  
  // Get language-specific names
  const topic = chapterData?.topics?.find(t => t.topic_id === topicId);
  const chapterNameEn = chapterData ? getChapterNameByLanguage(chapterData, 'en') : '';
  const chapterNameHi = chapterData ? getChapterNameByLanguage(chapterData, 'hi') : '';
  const topicNameEn = topic ? getTopicNameByLanguage(topic, 'en') : '';
  const topicNameHi = topic ? getTopicNameByLanguage(topic, 'hi') : '';
  const learningObjectiveEn = topic ? getLearningObjectiveByLanguage(topic, 'en') : '';
  const learningObjectiveHi = topic ? getLearningObjectiveByLanguage(topic, 'hi') : '';
  
  // Use bundle-based availability (more accurate) or fallback to prop
  const availability = bundleAvailability.loading === false ? bundleAvailability : (contentAvailability || bundleAvailability);
  
  return (
    <div className="p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Language Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400">Content Language</h3>
          <LanguageToggle
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            size="sm"
            showFlags={true}
          />
        </div>
        
        {/* Chapter Name */}
        {(chapterNameEn || chapterNameHi) && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <FileText className="w-4 h-4 text-cyan-400" />
              Chapter Name
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <span>🇬🇧</span> English
                </div>
                <div className="bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white">
                  {chapterNameEn || 'Not available'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <span>🇮🇳</span> Hindi
                </div>
                <div className="bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white">
                  {chapterNameHi || 'Not available'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Topic Name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <FileText className="w-4 h-4 text-cyan-400" />
            Topic Name
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>🇬🇧</span> English
              </div>
              <input
                type="text"
                value={selectedLanguage === 'en' ? (topicNameEn || topicFormState.topic_name || '') : topicNameEn || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'en') {
                    onTopicChange('topic_name', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'en'}
                placeholder="Enter topic name (English)..."
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                         px-4 py-3 text-white placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>🇮🇳</span> Hindi
              </div>
              <input
                type="text"
                value={selectedLanguage === 'hi' ? (topicNameHi || '') : topicNameHi || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'hi') {
                    // For Hindi, we'd need to update topic_name_by_language
                    // This is a simplified version - full implementation would update the nested structure
                    onTopicChange('topic_name', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'hi'}
                placeholder="Enter topic name (Hindi)..."
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                         px-4 py-3 text-white placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
              />
            </div>
          </div>
        </div>
        
        {/* Priority & Scene Type Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Topic Priority */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Hash className="w-4 h-4 text-cyan-400" />
              Topic Priority
            </label>
            <input
              type="number"
              value={topicFormState.topic_priority || 1}
              onChange={(e) => onTopicChange('topic_priority', parseInt(e.target.value) || 1)}
              disabled={isReadOnly}
              min={1}
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                       px-4 py-3 text-white
                       focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            />
            <p className="text-xs text-slate-500">
              Determines the order in the topic list
            </p>
          </div>
          
          {/* Scene Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Tag className="w-4 h-4 text-cyan-400" />
              Scene Type
            </label>
            <select
              value={topicFormState.scene_type || 'interactive'}
              onChange={(e) => onTopicChange('scene_type', e.target.value)}
              disabled={isReadOnly}
              className="w-full appearance-none bg-slate-800/50 border border-slate-600/50 rounded-xl
                       px-4 py-3 text-white
                       focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            >
              {sceneTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Defines how the scene will be presented
            </p>
          </div>
        </div>
        
        {/* Learning Objective */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Target className="w-4 h-4 text-cyan-400" />
            Learning Objective
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>🇬🇧</span> English
              </div>
              <textarea
                value={selectedLanguage === 'en' ? (learningObjectiveEn || sceneFormState.learning_objective || '') : learningObjectiveEn || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'en') {
                    onSceneChange('learning_objective', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'en'}
                placeholder="What should students learn from this topic? (English)"
                rows={4}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                         px-4 py-3 text-white placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed resize-none
                         transition-all duration-200"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>🇮🇳</span> Hindi
              </div>
              <textarea
                value={selectedLanguage === 'hi' ? (learningObjectiveHi || '') : learningObjectiveHi || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'hi') {
                    // For Hindi, we'd need to update learning_objective_by_language
                    // This is a simplified version
                    onSceneChange('learning_objective', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'hi'}
                placeholder="What should students learn from this topic? (Hindi)"
                rows={4}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                         px-4 py-3 text-white placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed resize-none
                         transition-all duration-200"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            A clear statement of what learners will be able to do after completing this topic
          </p>
        </div>
        
        {/* Content Availability Card - Revamped with Bundle Approach */}
        <div className="mt-8 p-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 rounded-xl border border-slate-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Content Availability</h3>
                <p className="text-xs text-slate-400">Language: {selectedLanguage === 'en' ? 'English 🇬🇧' : 'Hindi 🇮🇳'}</p>
              </div>
            </div>
            {availability.loading && (
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            )}
          </div>
          
          {availability.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="ml-3 text-sm text-slate-400">Analyzing content from bundle...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scene Status - Enhanced */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                availability.sceneStatus === 'published'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : availability.sceneStatus === 'draft'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-700/30 border-slate-600/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      availability.sceneStatus === 'published'
                        ? 'bg-emerald-500/20'
                        : availability.sceneStatus === 'draft'
                        ? 'bg-amber-500/20'
                        : 'bg-slate-700/50'
                    }`}>
                      {availability.sceneStatus === 'published' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : availability.sceneStatus === 'draft' ? (
                        <Loader2 className="w-5 h-5 text-amber-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Scene Status</p>
                      <p className="text-xs text-slate-400">
                        {availability.sceneStatus === 'published' 
                          ? 'Published and ready' 
                          : availability.sceneStatus === 'draft'
                          ? 'Draft - needs publishing'
                          : 'Pending configuration'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {availability.hasSkybox && (
                      <span className="px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        Skybox ✓
                      </span>
                    )}
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                      availability.sceneStatus === 'published'
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : availability.sceneStatus === 'draft'
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                    }`}>
                      {availability.sceneStatus === 'published' ? 'Published' : availability.sceneStatus === 'draft' ? 'Draft' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Content Grid - Enhanced */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {/* MCQs */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.hasMCQs && availability.mcqsWithOptions > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className={`w-4 h-4 ${
                      availability.hasMCQs && availability.mcqsWithOptions > 0 ? 'text-emerald-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">MCQs</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.hasMCQs && availability.mcqsWithOptions > 0 ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-lg font-bold text-emerald-400">{availability.mcqsWithOptions}</span>
                        <span className="text-xs text-slate-400">/ {availability.mcqCount} total</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">None</span>
                      </>
                    )}
                  </div>
                  {availability.mcqCount > 0 && availability.mcqsWithOptions === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">⚠️ Missing options</p>
                  )}
                </div>
                
                {/* TTS */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.hasTTS && availability.ttsWithAudio > 0
                    ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className={`w-4 h-4 ${
                      availability.hasTTS && availability.ttsWithAudio > 0 ? 'text-blue-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">TTS Audio</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.hasTTS && availability.ttsWithAudio > 0 ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-lg font-bold text-blue-400">{availability.ttsWithAudio}</span>
                        <span className="text-xs text-slate-400">/ {availability.ttsCount} total</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">None</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* 3D Assets */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.has3DAssets
                    ? 'bg-violet-500/10 border-violet-500/30 hover:border-violet-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Box className={`w-4 h-4 ${
                      availability.has3DAssets ? 'text-violet-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">3D Assets</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.has3DAssets ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <span className="text-lg font-bold text-violet-400">{availability.assetCount}</span>
                        <span className="text-xs text-slate-400">assets</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">None</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Images */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.hasImages
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Image className={`w-4 h-4 ${
                      availability.hasImages ? 'text-amber-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">Images</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.hasImages ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="text-lg font-bold text-amber-400">{availability.imageCount}</span>
                        <span className="text-xs text-slate-400">images</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">None</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Avatar Scripts */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.hasAvatarScripts
                    ? 'bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className={`w-4 h-4 ${
                      availability.hasAvatarScripts ? 'text-cyan-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">Avatar Scripts</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.hasAvatarScripts ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-sm font-bold text-cyan-400">Available</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">None</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Skybox */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.hasSkybox
                    ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className={`w-4 h-4 ${
                      availability.hasSkybox ? 'text-indigo-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">Skybox</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.hasSkybox ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="text-sm font-bold text-indigo-400">Configured</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">Missing</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Text-to-3D Assets */}
                <div className={`p-4 rounded-lg border transition-all ${
                  availability.hasTextTo3dAssets
                    ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className={`w-4 h-4 ${
                      availability.hasTextTo3dAssets ? 'text-purple-400' : 'text-slate-500'
                    }`} />
                    <p className="text-xs font-medium text-slate-300">Text-to-3D</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {availability.hasTextTo3dAssets ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-lg font-bold text-purple-400">{availability.textTo3dApprovedCount}</span>
                        <span className="text-xs text-slate-400">/ {availability.textTo3dAssetsCount} approved</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-500">None</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Summary Bar */}
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Content Readiness:</span>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded ${
                      availability.hasMCQs && availability.mcqsWithOptions > 0 
                        ? 'text-emerald-400 bg-emerald-500/10' 
                        : 'text-slate-500 bg-slate-700/30'
                    }`}>
                      MCQs {availability.hasMCQs && availability.mcqsWithOptions > 0 ? '✓' : '✗'}
                    </span>
                    <span className={`px-2 py-1 rounded ${
                      availability.hasTTS && availability.ttsWithAudio > 0 
                        ? 'text-blue-400 bg-blue-500/10' 
                        : 'text-slate-500 bg-slate-700/30'
                    }`}>
                      TTS {availability.hasTTS && availability.ttsWithAudio > 0 ? '✓' : '✗'}
                    </span>
                    <span className={`px-2 py-1 rounded ${
                      availability.hasSkybox 
                        ? 'text-indigo-400 bg-indigo-500/10' 
                        : 'text-slate-500 bg-slate-700/30'
                    }`}>
                      Skybox {availability.hasSkybox ? '✓' : '✗'}
                    </span>
                    <span className={`px-2 py-1 rounded ${
                      availability.sceneStatus === 'published' 
                        ? 'text-emerald-400 bg-emerald-500/10' 
                        : 'text-amber-400 bg-amber-500/10'
                    }`}>
                      {availability.sceneStatus === 'published' ? 'Published' : 'Not Published'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Scene Status Card */}
        <div className="mt-4 p-4 bg-slate-800/20 rounded-xl border border-slate-700/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                            ${topicFormState.has_scene 
                              ? 'bg-emerald-500/10 border border-emerald-500/20' 
                              : 'bg-slate-700/30 border border-slate-600/30'}`}>
                {topicFormState.has_scene ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">Scene Configuration</p>
                <p className="text-xs text-slate-400">
                  {topicFormState.has_scene ? 'Scene is configured with skybox/assets' : 'No scene configured yet'}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1.5 text-xs font-semibold rounded-full
                           ${topicFormState.has_scene
                             ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                             : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                           }`}>
              {topicFormState.has_scene ? 'Ready' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
