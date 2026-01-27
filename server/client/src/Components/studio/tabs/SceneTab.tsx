/**
 * SceneTab - Professional Skybox Editor with 360° Viewer
 * 
 * Features:
 * - Instant image preview + immersive 360° mode using AssetViewerWithSkybox
 * - Prominent skybox ID and remix ID display
 * - Style selector with preview
 * - Generation with progress tracking
 * 
 * Data Source: skybox_glb_urls collection (NEW Firestore schema)
 * Skybox GLB URLs are now stored in the skybox_glb_urls collection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { Scene, SkyboxGLBUrl } from '../../../types/curriculum';
import { skyboxApiService } from '../../../services/skyboxApiService';
import { getTopicSkybox, getSkyboxGLBUrls, SkyboxData } from '../../../lib/firestore/queries';
import { AssetViewerWithSkybox } from '../../AssetViewerWithSkybox';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { uploadSkyboxImage } from '../../../services/skyboxImageService';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Sparkles,
  Image,
  RefreshCw,
  ExternalLink,
  Loader2,
  Play,
  ChevronDown,
  Minimize2,
  Copy,
  Check,
  Info,
  Palette,
  Zap,
  Globe,
  ImageIcon,
  Upload,
  X,
} from 'lucide-react';

interface SkyboxStyle {
  id: number | string;
  name: string;
  image?: string;
  image_jpg?: string;
  preview_url?: string;
  description?: string;
  model?: string;
}

interface SceneTabProps {
  sceneFormState: Partial<Scene>;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  isReadOnly: boolean;
  chapterId: string;
  versionId: string;
  topicId: string;
}

export const SceneTab = ({
  sceneFormState,
  onSceneChange,
  isReadOnly,
  chapterId,
  versionId,
  topicId,
}: SceneTabProps) => {
  // Skybox data state
  const [skyboxData, setSkyboxData] = useState<SkyboxData | null>(null);
  const [loadingSkybox, setLoadingSkybox] = useState(true);
  
  // Skybox GLB URLs from new collection
  const [skyboxGLBUrls, setSkyboxGLBUrls] = useState<SkyboxGLBUrl[]>([]);
  const [selectedSkyboxGLB, setSelectedSkyboxGLB] = useState<SkyboxGLBUrl | null>(null);
  
  // Skybox styles state
  const [skyboxStyles, setSkyboxStyles] = useState<SkyboxStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<SkyboxStyle | null>(null);
  const [loadingStyles, setLoadingStyles] = useState(true);
  
  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // UI state
  const [showFullPreview, setShowFullPreview] = useState(true);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [view360, setView360] = useState(true); // Default to 360° view like /main
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewer360Error, setViewer360Error] = useState(false);
  
  // Skybox image upload state
  const [uploadingSkybox, setUploadingSkybox] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  // Prompt state (local editing)
  const [localPrompt, setLocalPrompt] = useState(sceneFormState.in3d_prompt || '');
  
  // Sync local prompt with form state
  useEffect(() => {
    setLocalPrompt(sceneFormState.in3d_prompt || '');
  }, [sceneFormState.in3d_prompt]);
  
  // Load skybox data from Firestore
  // Priority: skybox_glb_urls collection (NEW) -> legacy skybox data
  useEffect(() => {
    const loadSkyboxData = async () => {
      if (!chapterId || !topicId) return;
      
      setLoadingSkybox(true);
      setImageLoaded(false);
      setViewer360Error(false);
      
      try {
        // First, try to load from skybox_glb_urls collection (NEW schema)
        console.log('🔍 Fetching skybox GLB URLs from skybox_glb_urls collection...');
        const glbUrls = await getSkyboxGLBUrls(chapterId, topicId);
        setSkyboxGLBUrls(glbUrls);
        
        if (glbUrls.length > 0) {
          // Use the first skybox GLB URL
          const primarySkybox = glbUrls[0];
          setSelectedSkyboxGLB(primarySkybox);
          
          console.log('✅ Using skybox from skybox_glb_urls collection:', primarySkybox);
          
          // Convert to SkyboxData format for compatibility
          setSkyboxData({
            id: primarySkybox.skybox_id || primarySkybox.id,
            imageUrl: primarySkybox.preview_url || primarySkybox.glb_url,
            file_url: primarySkybox.glb_url,
            promptUsed: primarySkybox.prompt_used || '',
            styleId: primarySkybox.style_id,
            styleName: primarySkybox.style_name,
            status: primarySkybox.status,
          });
          setImageLoadError(false);
        } else {
          // Fallback: Try legacy skybox loading
          console.log('ℹ️ No skybox GLB URLs found, trying legacy source...');
          const data = await getTopicSkybox(chapterId, topicId);
          console.log('🖼️ Loaded legacy skybox data:', data);
          setSkyboxData(data);
          setImageLoadError(false);
        }
      } catch (error) {
        console.error('Error loading skybox:', error);
      } finally {
        setLoadingSkybox(false);
      }
    };
    
    loadSkyboxData();
  }, [chapterId, topicId]);
  
  // Fetch skybox styles on mount
  useEffect(() => {
    const fetchStyles = async () => {
      setLoadingStyles(true);
      try {
        const response = await skyboxApiService.getStyles(1, 100);
        if (response.success && response.data) {
          setSkyboxStyles(response.data);
          if (response.data.length > 0 && !selectedStyle) {
            const defaultStyle = response.data.find((s: SkyboxStyle) => {
              const name = s.name?.toLowerCase() || '';
              return name.includes('ethereal') && name.includes('fantasy');
            }) || response.data[0];
            setSelectedStyle(defaultStyle);
          }
        }
      } catch (error) {
        console.error('Error fetching skybox styles:', error);
      } finally {
        setLoadingStyles(false);
      }
    };
    
    fetchStyles();
  }, []);

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const styleId = e.target.value;
    const style = skyboxStyles.find(s => String(s.id) === styleId);
    if (style) {
      setSelectedStyle(style);
    }
  };
  
  const handlePromptChange = (value: string) => {
    setLocalPrompt(value);
    onSceneChange('in3d_prompt', value);
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle skybox image upload/replacement
  const handleSkyboxImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    if (isReadOnly) {
      toast.error('Read-only mode: Cannot replace skybox');
      return;
    }

    setUploadingSkybox(true);
    setUploadProgress(10);

    try {
      // Validate and upload
      setUploadProgress(20);
      const result = await uploadSkyboxImage({
        chapterId,
        topicId,
        file,
        userId: user.uid,
        existingSkyboxId: selectedSkyboxGLB?.skybox_id || selectedSkyboxGLB?.id,
      });
      
      setUploadProgress(80);

      if (!result.success) {
        toast.error(result.error || 'Failed to upload skybox image');
        return;
      }

      setUploadProgress(90);
      
      // Show warning if aspect ratio is not ideal (non-blocking)
      if (result.warning) {
        toast.warning(result.warning, { autoClose: 5000 });
      }
      
      toast.success('Skybox image replaced successfully!');

      // Reload skybox data to reflect the change
      const glbUrls = await getSkyboxGLBUrls(chapterId, topicId);
      setUploadProgress(100);
      setSkyboxGLBUrls(glbUrls);
      
      if (glbUrls.length > 0) {
        const primarySkybox = glbUrls[0];
        setSelectedSkyboxGLB(primarySkybox);
        setSkyboxData({
          id: primarySkybox.skybox_id || primarySkybox.id,
          imageUrl: primarySkybox.preview_url || primarySkybox.glb_url,
          file_url: primarySkybox.glb_url,
          promptUsed: primarySkybox.prompt_used || '',
          styleId: primarySkybox.style_id,
          styleName: primarySkybox.style_name,
          status: primarySkybox.status,
        });
      }

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading skybox image:', error);
      toast.error('Failed to upload skybox image');
    } finally {
      setUploadingSkybox(false);
      setUploadProgress(0);
    }
  };

  // Trigger file input click
  const triggerFileUpload = () => {
    if (isReadOnly) {
      toast.error('Read-only mode: Cannot replace skybox');
      return;
    }
    fileInputRef.current?.click();
  };
  
  // Generate skybox
  const handleGenerateSkybox = useCallback(async () => {
    if (!localPrompt.trim()) {
      toast.error('Please enter a scene prompt first');
      return;
    }
    
    if (!selectedStyle) {
      toast.error('Please select a skybox style');
      return;
    }
    
    setGenerating(true);
    setGenerationProgress(10);
    
    try {
      const response = await skyboxApiService.generateSkybox({
        prompt: localPrompt.trim(),
        style_id: selectedStyle.id,
      });
      
      const generationId = response.data?.generationId || response.data?.id;
      if (!response.success || !generationId) {
        throw new Error('Failed to start skybox generation');
      }
      
      setGenerationProgress(30);
      
      let attempts = 0;
      const maxAttempts = 90;
      
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const status = await skyboxApiService.getSkyboxStatus(generationId.toString());
          const normalizedStatus = status.data?.status?.toLowerCase();
          
          if (normalizedStatus === 'complete' || normalizedStatus === 'completed' || status.data?.file_url) {
            const skyboxUrl = status.data.file_url || status.data.image || status.data.imageUrl;
            
            onSceneChange('skybox_id', generationId.toString());
            onSceneChange('skybox_url', skyboxUrl);
            
            // Save to skybox_glb_urls collection (NEW schema)
            try {
              const newSkyboxGLB: Omit<SkyboxGLBUrl, 'id'> = {
                chapter_id: chapterId,
                topic_id: topicId,
                skybox_id: generationId.toString(),
                glb_url: skyboxUrl,
                preview_url: skyboxUrl,
                prompt_used: localPrompt,
                style_id: typeof selectedStyle.id === 'number' ? selectedStyle.id : parseInt(selectedStyle.id as string),
                style_name: selectedStyle.name,
                status: 'complete',
                created_at: new Date().toISOString(),
              };
              
              await addDoc(collection(db, 'skybox_glb_urls'), {
                ...newSkyboxGLB,
                created_at: serverTimestamp(),
              });
              console.log('✅ Saved to skybox_glb_urls collection');
            } catch (saveError) {
              console.warn('Could not save to skybox_glb_urls collection:', saveError);
            }
            
            setSkyboxData({
              id: generationId.toString(),
              imageUrl: skyboxUrl,
              file_url: skyboxUrl,
              promptUsed: localPrompt,
              styleId: typeof selectedStyle.id === 'number' ? selectedStyle.id : parseInt(selectedStyle.id as string),
              styleName: selectedStyle.name,
              status: 'complete',
              obfuscated_id: status.data.obfuscated_id,
              remix_id: status.data.remix_id || status.data.obfuscated_id,
            });
            
            setGenerationProgress(100);
            setImageLoadError(false);
            setImageLoaded(false);
            setViewer360Error(false);
            toast.success('Skybox generated successfully!');
            setGenerating(false);
            setGenerationProgress(0);
            return;
          } else if (normalizedStatus === 'error' || normalizedStatus === 'failed' || normalizedStatus === 'abort') {
            throw new Error(status.data?.error_message || 'Skybox generation failed');
          }
          
          const progress = Math.min(30 + (attempts / maxAttempts) * 60, 90);
          setGenerationProgress(progress);
        } catch (pollError: unknown) {
          console.error('Poll error:', pollError);
          if (pollError instanceof Error && pollError.message?.includes('not found')) {
            throw pollError;
          }
        }
      }
      
      throw new Error('Generation timed out. Please try again.');
    } catch (error: unknown) {
      console.error('Skybox generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate skybox');
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
    }
  }, [localPrompt, selectedStyle, onSceneChange]);

  // Current skybox data
  const currentSkyboxUrl = skyboxData?.imageUrl || skyboxData?.file_url || sceneFormState.skybox_url;
  const currentSkyboxId = skyboxData?.id || sceneFormState.skybox_id;
  const currentRemixId = skyboxData?.remix_id || skyboxData?.obfuscated_id || (sceneFormState as Record<string, unknown>).skybox_remix_id as string | undefined;
  const currentPrompt = skyboxData?.promptUsed || sceneFormState.in3d_prompt;
  
  const isValidSkyboxUrl = currentSkyboxUrl && 
    typeof currentSkyboxUrl === 'string' && 
    currentSkyboxUrl.startsWith('http') &&
    !imageLoadError;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050810]">
      {/* Full-screen Background */}
      <div className="relative flex-1 min-h-0">
        {/* Loading state for data */}
        {loadingSkybox ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050810]">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-slate-400">Loading scene data...</p>
            </div>
          </div>
        ) : isValidSkyboxUrl && showFullPreview ? (
          <>
            {/* 360° Viewer using AssetViewerWithSkybox (same as /main page) */}
            {view360 && !viewer360Error ? (
              <div className="absolute inset-0">
                <AssetViewerWithSkybox
                  assetUrl="" 
                  skyboxImageUrl={currentSkyboxUrl!}
                  className="w-full h-full"
                  autoRotate={true}
                  onLoad={() => {
                    console.log('✅ 360° viewer loaded');
                    setImageLoaded(true);
                  }}
                  onError={(error) => {
                    console.error('❌ 360° viewer error:', error);
                    setViewer360Error(true);
                    setView360(false);
                  }}
                />
              </div>
            ) : (
              /* 2D Image Fallback */
              <div className="absolute inset-0">
                <img
                  src={currentSkyboxUrl}
                  alt="Skybox preview"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageLoadError(true)}
                />
                {/* Gradient overlays for 2D view */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050810] via-transparent to-[#050810]/30" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050810]/40 via-transparent to-[#050810]/40" />
                {/* Vignette */}
                <div className="absolute inset-0" style={{
                  background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,8,16,0.6) 100%)'
                }} />
              </div>
            )}
          </>
        ) : (
          /* No Skybox State */
          <div className="absolute inset-0 bg-[#050810]">
            {/* Animated Grid Background */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0" style={{
                backgroundImage: `
                  linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
              }} />
            </div>
            {/* Floating Orbs */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* No skybox message */}
            {!generating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8 max-w-lg">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center border border-white/10">
                    <Image className="w-12 h-12 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Create Your Environment</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Generate immersive 360° skybox environments using BlockadeLabs AI. 
                    Describe your scene and select a style to get started.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Gradient Overlays for controls readability (only for 360 view) */}
        {isValidSkyboxUrl && showFullPreview && view360 && !viewer360Error && (
          <>
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#050810] via-[#050810]/90 to-transparent pointer-events-none z-10" />
          </>
        )}
        
        {/* ==================== TOP BAR ==================== */}
        <div className="absolute top-0 left-0 right-0 z-30">
          <div className="flex items-start justify-between p-4 gap-4">
            
            {/* LEFT: Skybox Info Panel */}
            {currentSkyboxId && showInfoPanel && (
              <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl min-w-[280px]">
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      Environment Active
                    </span>
                    <button
                      onClick={() => setShowInfoPanel(false)}
                      className="text-white/40 hover:text-white/80 transition-colors"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Skybox ID */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-cyan-400/80 uppercase tracking-wider font-medium">Skybox ID</span>
                      <button
                        onClick={() => copyToClipboard(currentSkyboxId, 'Skybox ID')}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                      >
                        {copiedId === 'Skybox ID' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="px-3 py-2 bg-slate-900/50 rounded-lg border border-cyan-500/20">
                      <p className="text-xs text-white font-mono truncate">{currentSkyboxId}</p>
                    </div>
                  </div>
                  
                  {/* Remix ID */}
                  {currentRemixId && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-violet-400/80 uppercase tracking-wider font-medium">Remix ID</span>
                        <button
                          onClick={() => copyToClipboard(currentRemixId, 'Remix ID')}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                        >
                          {copiedId === 'Remix ID' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="px-3 py-2 bg-slate-900/50 rounded-lg border border-violet-500/20">
                        <p className="text-xs text-violet-300 font-mono truncate">{currentRemixId}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Style */}
                  {skyboxData?.styleName && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <Palette className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-300">{skyboxData.styleName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Collapsed Info Button */}
            {currentSkyboxId && !showInfoPanel && (
              <button
                onClick={() => setShowInfoPanel(true)}
                className="p-3 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-black/80 transition-all"
              >
                <Info className="w-5 h-5 text-cyan-400" />
              </button>
            )}
            
            {/* RIGHT: View Controls */}
            <div className="flex items-center gap-2">
              {isValidSkyboxUrl && (
                <>
                  {/* Replace Skybox Button */}
                  {!isReadOnly && (
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleSkyboxImageUpload}
                        className="hidden"
                        disabled={uploadingSkybox}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingSkybox || isReadOnly}
                        className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl backdrop-blur-sm border border-amber-500/30 text-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title="Replace skybox image (equirectangular 2:1 recommended, but any image will work)"
                      >
                        {uploadingSkybox ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </button>
                      {uploadingSkybox && uploadProgress > 0 && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-amber-400 bg-black/80 px-2 py-1 rounded z-50">
                          {Math.round(uploadProgress)}%
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-1">
                    <button
                      onClick={() => {
                        setView360(false);
                        setViewer360Error(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all
                               ${!view360 
                                 ? 'bg-cyan-500/20 text-cyan-300' 
                                 : 'text-white/60 hover:text-white'
                               }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      2D
                    </button>
                    <button
                      onClick={() => {
                        setView360(true);
                        setViewer360Error(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all
                               ${view360 && !viewer360Error
                                 ? 'bg-cyan-500/20 text-cyan-300' 
                                 : 'text-white/60 hover:text-white'
                               }`}
                    >
                      <Globe className="w-4 h-4" />
                      360°
                    </button>
                  </div>
                  
                  <button
                    onClick={() => setShowFullPreview(!showFullPreview)}
                    className="p-2.5 bg-black/50 hover:bg-black/70 rounded-xl backdrop-blur-sm border border-white/10 text-white/80 transition-all"
                  >
                    {showFullPreview ? <Minimize2 className="w-5 h-5" /> : <Image className="w-5 h-5" />}
                  </button>
                  <a
                    href={currentSkyboxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-black/50 hover:bg-black/70 rounded-xl backdrop-blur-sm border border-white/10 text-white/80 transition-all"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Interaction hint for 360 view */}
        {isValidSkyboxUrl && view360 && !viewer360Error && imageLoaded && (
          <div className="absolute bottom-80 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white/60 flex items-center gap-2 animate-pulse">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              Drag to look around • Scroll to zoom
            </div>
          </div>
        )}
        
        {/* ==================== GENERATION PROGRESS ==================== */}
        {generating && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-md">
            <div className="text-center p-10 bg-gradient-to-b from-slate-900/90 to-slate-800/90 rounded-3xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 max-w-md">
              <div className="relative w-28 h-28 mx-auto mb-8">
                {/* Outer glow */}
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
                {/* Track */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-700/50" />
                {/* Progress */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="52"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${generationProgress * 3.27} 327`}
                    className="transition-all duration-500"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Percentage */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                    {Math.round(generationProgress)}%
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Generating Environment</h3>
              <p className="text-slate-400 text-sm mb-6">Creating your immersive 360° skybox...</p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                Powered by BlockadeLabs AI
              </div>
            </div>
          </div>
        )}
        
        {/* ==================== BOTTOM EDITOR PANEL ==================== */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="pt-12 pb-6 px-6">
            <div className="max-w-5xl mx-auto">
              {/* Current Prompt Display */}
              {currentPrompt && currentSkyboxUrl && (
                <div className="mb-4 p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-slate-700/30">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active Scene Prompt</span>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{currentPrompt}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Main Editor */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* LEFT: Prompt Input */}
                <div className="lg:col-span-2">
                  <div className="bg-black/60 backdrop-blur-md rounded-2xl border border-slate-600/30 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                        Scene Description
                      </label>
                      <button
                        disabled={isReadOnly}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20
                                 rounded-lg border border-violet-500/30
                                 transition-all duration-200 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Enhance
                      </button>
                    </div>
                    <textarea
                      value={localPrompt}
                      onChange={(e) => handlePromptChange(e.target.value)}
                      disabled={isReadOnly || generating}
                      placeholder="Describe your 3D environment in vivid detail... 

Example: A mystical ancient library with towering bookshelves reaching into darkness, floating candles casting warm golden light..."
                      rows={4}
                      className="w-full bg-slate-900/50 border border-slate-600/30 rounded-xl
                               px-4 py-3.5 text-white placeholder:text-slate-500 text-sm leading-relaxed
                               focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40
                               disabled:opacity-50 disabled:cursor-not-allowed resize-none
                               transition-all duration-200"
                    />
                  </div>
                </div>
                
                {/* RIGHT: Style & Generate */}
                <div className="space-y-4">
                  {/* Style Selector */}
                  <div className="bg-black/60 backdrop-blur-md rounded-2xl border border-emerald-500/20 p-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      BlockadeLabs Style
                    </label>
                    
                    {/* Style Preview */}
                    {selectedStyle && (selectedStyle.image_jpg || selectedStyle.image) && (
                      <div className="overflow-hidden rounded-xl border border-white/10 mb-3 shadow-lg">
                        <div className="relative">
                          <img
                            src={selectedStyle.image_jpg || selectedStyle.image}
                            alt={selectedStyle.name}
                            className="w-full h-20 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs font-semibold text-white truncate">{selectedStyle.name}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Dropdown */}
                    {loadingStyles ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading styles...
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedStyle?.id ?? ''}
                          onChange={handleStyleChange}
                          disabled={isReadOnly || generating}
                          className="w-full appearance-none bg-slate-900/60 border border-emerald-500/20 
                                   rounded-xl px-4 py-2.5 pr-10 text-sm text-white
                                   focus:outline-none focus:ring-2 focus:ring-emerald-500/30
                                   disabled:opacity-50 transition-all cursor-pointer"
                        >
                          <option value="" disabled>Select a style...</option>
                          {skyboxStyles.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60 pointer-events-none" />
                      </div>
                    )}
                  </div>
                  
                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateSkybox}
                    disabled={isReadOnly || generating || !localPrompt.trim() || !selectedStyle}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 
                             text-base font-bold uppercase tracking-wider rounded-2xl
                             transition-all duration-300 shadow-xl
                             ${generating
                               ? 'bg-slate-700 cursor-not-allowed'
                               : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] hover:-translate-y-1 active:translate-y-0'
                             }
                             text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-xl`}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : currentSkyboxUrl ? (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        <span>Regenerate</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        <span>Generate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
