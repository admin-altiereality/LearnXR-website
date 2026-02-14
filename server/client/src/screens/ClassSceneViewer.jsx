/**
 * ClassSceneViewer – 360° scene viewer for teacher-launched scenes.
 * Reads learnxr_launched_scene from sessionStorage (set when teacher sends scene to class)
 * and renders the skybox in fullscreen. Used by students in a class session.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SkyboxFullScreen from './SkyboxFullScreen';
import { Button } from '../Components/ui/button';
import { ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'learnxr_launched_scene';

export default function ClassSceneViewer() {
  const navigate = useNavigate();
  const [sceneData, setSceneData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (!raw) {
        setError('No scene to display.');
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.type !== 'create_scene') {
        setError('Invalid scene data.');
        return;
      }
      setSceneData(parsed);
    } catch (e) {
      setError('Failed to load scene.');
    }
  }, []);

  const handleBack = () => {
    navigate('/lessons');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lessons
        </Button>
      </div>
    );
  }

  if (!sceneData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading scene…
      </div>
    );
  }

  const imageUrl = sceneData.skybox_image_url || sceneData.skybox_glb_url;
  if (!imageUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <p className="text-muted-foreground mb-4">Scene has no image to display.</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lessons
        </Button>
      </div>
    );
  }

  const style = {
    image: imageUrl,
    image_jpg: imageUrl,
    name: sceneData.name || "Teacher's scene",
  };

  return (
    <div className="relative w-full h-screen bg-black">
      <SkyboxFullScreen skyboxData={style} isBackground={false} />
      <Button
        className="absolute top-4 left-4 z-10 bg-background/90 hover:bg-background text-foreground border border-border"
        onClick={handleBack}
        variant="outline"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Lessons
      </Button>
    </div>
  );
}
