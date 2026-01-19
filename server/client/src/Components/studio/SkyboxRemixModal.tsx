import { useState } from 'react';
import { toast } from 'react-toastify';
import {
  X,
  RefreshCw,
  Sparkles,
  Image,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface SkyboxRemixModalProps {
  currentSkyboxUrl?: string;
  currentSkyboxId?: string;
  onUpdate: (skyboxId: string, skyboxUrl: string, remixId?: string) => void;
  onClose: () => void;
}

export const SkyboxRemixModal = ({
  currentSkyboxUrl,
  currentSkyboxId,
  onUpdate,
  onClose,
}: SkyboxRemixModalProps) => {
  const [remixPrompt, setRemixPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSkybox, setGeneratedSkybox] = useState<{
    id: string;
    url: string;
    remixId?: string;
  } | null>(null);

  const handleGenerateRemix = async () => {
    if (!remixPrompt.trim()) {
      toast.error('Please enter a remix prompt');
      return;
    }

    setIsGenerating(true);
    try {
      // This would call your actual skybox generation API
      // For now, we'll simulate the flow
      
      // In production, this would be something like:
      // const response = await fetch('/api/skybox/remix', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     original_skybox_id: currentSkyboxId,
      //     remix_prompt: remixPrompt,
      //   }),
      // });
      // const data = await response.json();
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Simulated response - in production this would come from the API
      const mockResponse = {
        id: `remix_${Date.now()}`,
        url: currentSkyboxUrl || 'https://placeholder.com/skybox.jpg',
        remixId: `remix_job_${Date.now()}`,
      };
      
      setGeneratedSkybox(mockResponse);
      toast.success('Skybox remix generated!');
    } catch (error) {
      console.error('Error generating skybox remix:', error);
      toast.error('Failed to generate skybox remix');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (generatedSkybox) {
      onUpdate(generatedSkybox.id, generatedSkybox.url, generatedSkybox.remixId);
      toast.success('Skybox applied to scene');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 bg-[#0d1424] rounded-2xl border border-slate-700/50 
                    shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 
                          border border-violet-500/30">
              <RefreshCw className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Remix Skybox</h2>
              <p className="text-sm text-slate-400">
                Generate a new variation of the current skybox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 
                     rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Current Skybox */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">
                Current Skybox
              </label>
              <div className="aspect-video bg-slate-800/50 rounded-xl border border-slate-600/50 
                            overflow-hidden flex items-center justify-center">
                {currentSkyboxUrl ? (
                  <img
                    src={currentSkyboxUrl}
                    alt="Current skybox"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Image className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No skybox</p>
                  </div>
                )}
              </div>
              {currentSkyboxId && (
                <p className="text-xs text-slate-500 font-mono truncate">
                  ID: {currentSkyboxId}
                </p>
              )}
            </div>

            {/* Generated/Preview Skybox */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                {generatedSkybox ? 'Generated Result' : 'Preview'}
                {generatedSkybox && (
                  <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-400 
                                 bg-emerald-500/10 rounded border border-emerald-500/20">
                    New
                  </span>
                )}
              </label>
              <div className="aspect-video bg-slate-800/50 rounded-xl border border-slate-600/50 
                            overflow-hidden flex items-center justify-center relative">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                    <p className="text-sm text-slate-400">Generating remix...</p>
                  </div>
                ) : generatedSkybox ? (
                  <img
                    src={generatedSkybox.url}
                    alt="Generated skybox"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      Enter a prompt and generate
                    </p>
                  </div>
                )}
              </div>
              {generatedSkybox && (
                <p className="text-xs text-violet-400 font-mono truncate">
                  Remix ID: {generatedSkybox.remixId}
                </p>
              )}
            </div>
          </div>

          {/* Remix Prompt */}
          <div className="mt-6 space-y-3">
            <label className="text-sm font-medium text-slate-300">
              Remix Prompt
            </label>
            <textarea
              value={remixPrompt}
              onChange={(e) => setRemixPrompt(e.target.value)}
              placeholder="Describe how you want to modify the skybox... e.g., 'Make it sunset, add more clouds, change to winter theme'"
              rows={3}
              disabled={isGenerating}
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                       px-4 py-3 text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
                       disabled:opacity-50 resize-none
                       transition-all duration-200"
            />
            <p className="text-xs text-slate-500">
              Describe the changes you want. Be specific about colors, lighting, weather, time of day, etc.
            </p>
          </div>

          {/* Style Presets */}
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-400 mb-2">Quick Presets:</p>
            <div className="flex flex-wrap gap-2">
              {['Sunset', 'Night sky', 'Cloudy', 'Sci-fi', 'Fantasy', 'Underwater'].map(
                (preset) => (
                  <button
                    key={preset}
                    onClick={() => setRemixPrompt((prev) => 
                      prev ? `${prev}, ${preset.toLowerCase()}` : preset.toLowerCase()
                    )}
                    disabled={isGenerating}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300
                             bg-slate-800/50 hover:bg-slate-700/50
                             rounded-lg border border-slate-600/50
                             transition-all duration-200 disabled:opacity-50"
                  >
                    {preset}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 
                      bg-slate-800/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300
                     hover:text-white hover:bg-slate-800/50
                     rounded-lg transition-all duration-200"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateRemix}
              disabled={isGenerating || !remixPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-white bg-gradient-to-r from-violet-500 to-purple-600
                       hover:from-violet-400 hover:to-purple-500
                       rounded-lg shadow-lg shadow-violet-500/25
                       transition-all duration-200 disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Remix
            </button>

            {generatedSkybox && (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                         text-white bg-gradient-to-r from-cyan-500 to-blue-600
                         hover:from-cyan-400 hover:to-blue-500
                         rounded-lg shadow-lg shadow-cyan-500/25
                         transition-all duration-200"
              >
                Apply to Scene
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
