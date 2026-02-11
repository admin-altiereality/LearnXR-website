import { Topic, Scene, LanguageCode } from '../../../types/curriculum';
import { FileText, Hash, Tag, Target, HelpCircle, Box, Image, Loader2, CheckCircle, XCircle, Volume2, Globe, Sparkles } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select';
import { cn } from '@/lib/utils';
import { LanguageToggle } from '../../../Components/LanguageSelector';
import {
  getChapterNameByLanguage,
  getTopicNameByLanguage,
  getLearningObjectiveByLanguage,
} from '../../../lib/firebase/utils/languageAvailability';
import type { CurriculumChapter } from '../../../types/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useState, useEffect } from 'react';

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
  const [, setLoading] = useState(false);
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
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Loading content availability...</span>
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
          <Label className="text-muted-foreground">Content Language</Label>
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
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Chapter Name
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>🇬🇧</span> English
                </div>
                <div className="rounded-lg border border-input bg-muted/50 px-4 py-3 text-sm text-foreground">
                  {chapterNameEn || 'Not available'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>🇮🇳</span> Hindi
                </div>
                <div className="rounded-lg border border-input bg-muted/50 px-4 py-3 text-sm text-foreground">
                  {chapterNameHi || 'Not available'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Topic Name */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Topic Name
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>🇬🇧</span> English
              </div>
              <Input
                value={selectedLanguage === 'en' ? (topicNameEn || topicFormState.topic_name || '') : topicNameEn || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'en') {
                    onTopicChange('topic_name', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'en'}
                placeholder="Enter topic name (English)..."
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>🇮🇳</span> Hindi
              </div>
              <Input
                value={selectedLanguage === 'hi' ? (topicNameHi || '') : topicNameHi || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'hi') {
                    onTopicChange('topic_name', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'hi'}
                placeholder="Enter topic name (Hindi)..."
                className="h-11"
              />
            </div>
          </div>
        </div>
        
        {/* Priority & Scene Type Row */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              Topic Priority
            </Label>
            <Input
              type="number"
              value={topicFormState.topic_priority || 1}
              onChange={(e) => onTopicChange('topic_priority', parseInt(e.target.value) || 1)}
              disabled={isReadOnly}
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              Determines the order in the topic list
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              Scene Type
            </Label>
            <Select
              value={topicFormState.scene_type || 'interactive'}
              onValueChange={(v) => onTopicChange('scene_type', v)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sceneTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Defines how the scene will be presented
            </p>
          </div>
        </div>
        
        {/* Learning Objective */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Learning Objective
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
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
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>🇮🇳</span> Hindi
              </div>
              <textarea
                value={selectedLanguage === 'hi' ? (learningObjectiveHi || '') : learningObjectiveHi || ''}
                onChange={(e) => {
                  if (selectedLanguage === 'hi') {
                    onSceneChange('learning_objective', e.target.value);
                  }
                }}
                disabled={isReadOnly || selectedLanguage !== 'hi'}
                placeholder="What should students learn from this topic? (Hindi)"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A clear statement of what learners will be able to do after completing this topic
          </p>
        </div>
        
        {/* Content Availability Card */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Content Availability</CardTitle>
                  <p className="text-xs text-muted-foreground">Language: {selectedLanguage === 'en' ? 'English 🇬🇧' : 'Hindi 🇮🇳'}</p>
                </div>
              </div>
              {availability.loading && (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
          {availability.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-3 text-sm text-muted-foreground">Analyzing content from bundle...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scene Status */}
              <div className={cn(
                'p-4 rounded-lg border-2 transition-all',
                availability.sceneStatus === 'published' && 'bg-emerald-500/10 border-emerald-500/30',
                availability.sceneStatus === 'draft' && 'bg-amber-500/10 border-amber-500/30',
                availability.sceneStatus === 'pending' && 'bg-muted/50 border-border'
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      availability.sceneStatus === 'published' && 'bg-emerald-500/20',
                      availability.sceneStatus === 'draft' && 'bg-amber-500/20',
                      availability.sceneStatus === 'pending' && 'bg-muted'
                    )}>
                      {availability.sceneStatus === 'published' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : availability.sceneStatus === 'draft' ? (
                        <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Scene Status</p>
                      <p className="text-xs text-muted-foreground">
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
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                        Skybox ✓
                      </Badge>
                    )}
                    <Badge variant={availability.sceneStatus === 'published' ? 'default' : 'secondary'} className={cn(
                      availability.sceneStatus === 'published' && 'bg-emerald-600 hover:bg-emerald-600',
                      availability.sceneStatus === 'draft' && 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20',
                      availability.sceneStatus === 'pending' && 'bg-muted text-muted-foreground'
                    )}>
                      {availability.sceneStatus === 'published' ? 'Published' : availability.sceneStatus === 'draft' ? 'Draft' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Content Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { key: 'mcqs', label: 'MCQs', Icon: HelpCircle, has: availability.hasMCQs && availability.mcqsWithOptions > 0, count: availability.mcqsWithOptions, total: availability.mcqCount, extra: availability.mcqCount > 0 && availability.mcqsWithOptions === 0 && '⚠️ Missing options' },
                  { key: 'tts', label: 'TTS Audio', Icon: Volume2, has: availability.hasTTS && availability.ttsWithAudio > 0, count: availability.ttsWithAudio, total: availability.ttsCount },
                  { key: '3d', label: '3D Assets', Icon: Box, has: availability.has3DAssets, count: availability.assetCount, suffix: 'assets' },
                  { key: 'images', label: 'Images', Icon: Image, has: availability.hasImages, count: availability.imageCount, suffix: 'images' },
                  { key: 'avatar', label: 'Avatar Scripts', Icon: FileText, has: availability.hasAvatarScripts, labelYes: 'Available' },
                  { key: 'skybox', label: 'Skybox', Icon: Globe, has: availability.hasSkybox, labelYes: 'Configured' },
                  { key: 'text3d', label: 'Text-to-3D', Icon: Sparkles, has: availability.hasTextTo3dAssets, count: availability.textTo3dApprovedCount, total: availability.textTo3dAssetsCount, suffix: 'approved' },
                ].map(({ key, label, Icon, has, count, total, suffix, labelYes, extra }) => (
                  <Card key={key} className={cn('transition-colors', has ? 'border-primary/30' : '')}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn('w-4 h-4', has ? 'text-primary' : 'text-muted-foreground')} />
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        {has ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                            {labelYes ? (
                              <span className="text-sm font-bold text-foreground">{labelYes}</span>
                            ) : (
                              <>
                                <span className="text-lg font-bold text-foreground">{count}</span>
                                {total != null && <span className="text-xs text-muted-foreground">/ {total} total</span>}
                                {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">None</span>
                          </>
                        )}
                      </div>
                      {extra && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{extra}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Content Readiness:</span>
                  <div className="flex items-center gap-4">
                    <Badge variant={availability.hasMCQs && availability.mcqsWithOptions > 0 ? 'default' : 'secondary'} className="text-[10px]">
                      MCQs {availability.hasMCQs && availability.mcqsWithOptions > 0 ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={availability.hasTTS && availability.ttsWithAudio > 0 ? 'default' : 'secondary'} className="text-[10px]">
                      TTS {availability.hasTTS && availability.ttsWithAudio > 0 ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={availability.hasSkybox ? 'default' : 'secondary'} className="text-[10px]">
                      Skybox {availability.hasSkybox ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={availability.sceneStatus === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                      {availability.sceneStatus === 'published' ? 'Published' : 'Not Published'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
        
        {/* Scene Status Card */}
        <Card className="mt-4">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center border',
                topicFormState.has_scene ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted border-border'
              )}>
                {topicFormState.has_scene ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Scene Configuration</p>
                <p className="text-xs text-muted-foreground">
                  {topicFormState.has_scene ? 'Scene is configured with skybox/assets' : 'No scene configured yet'}
                </p>
              </div>
            </div>
            <Badge variant={topicFormState.has_scene ? 'default' : 'secondary'} className={topicFormState.has_scene ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
              {topicFormState.has_scene ? 'Ready' : 'Pending'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
