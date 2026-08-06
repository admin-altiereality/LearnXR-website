/**
 * Street View Lesson Creator — teachers and partners can turn any real-world
 * Google Street View location into a launchable VR lesson: search a place,
 * generate the equirectangular skybox, optionally attach a 3D asset, then
 * launch it privately to their own class (no approval needed) or submit it
 * for Super Admin review to be promoted platform-wide.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Image as ImageIcon, Loader2, MapPin, Rocket, Send, Sparkles } from 'lucide-react';
import { Button } from '../../Components/ui/button';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/ui/card';
import { StreetViewMapPicker } from '../../Components/studio/StreetViewMapPicker';
import { AssetLibraryPicker } from '../../Components/create/AssetLibraryPicker';
import { fetchPlaceSuggestions, fetchPlaceDetails, type StreetViewPlacePrediction } from '../../services/streetViewPlacesService';
import {
  createDraftLesson,
  generateLessonStreetView,
  attachLibraryAsset,
  submitLessonForReview,
} from '../../services/userLessonService';
import { meshyApiService } from '../../services/meshyApiService';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { useLesson } from '../../contexts/LessonContext';
import { launchPartnerDemoLesson } from '../../services/partnerService';

export default function StreetViewLessonCreator() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeSessionId, startSession, launchLesson: launchLessonToClass } = useClassSession();
  const { startLesson: contextStartLesson } = useLesson();
  const isPartner = profile?.role === 'partner';

  const [title, setTitle] = useState('My Street View Lesson');
  const [lessonId, setLessonId] = useState<string | null>(null);

  const [placeQuery, setPlaceQuery] = useState('');
  const [predictions, setPredictions] = useState<StreetViewPlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; label?: string; placeId?: string } | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [fov, setFov] = useState(90);

  const [generating, setGenerating] = useState(false);
  const [skyboxUrl, setSkyboxUrl] = useState<string | null>(null);

  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [attachedAssetIds, setAttachedAssetIds] = useState<string[]>([]);
  const [genPrompt, setGenPrompt] = useState('');
  const [generatingAsset, setGeneratingAsset] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (placeQuery.trim().length < 2) {
      setPredictions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetchPlaceSuggestions(placeQuery);
      setSearching(false);
      if (res.success) setPredictions(res.predictions || []);
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [placeQuery]);

  const ensureDraft = useCallback(async (): Promise<string> => {
    if (lessonId) return lessonId;
    const res = await createDraftLesson(title.trim() || 'Untitled lesson', 'street_view');
    setLessonId(res.lessonId);
    return res.lessonId;
  }, [lessonId, title]);

  const handleSelectPrediction = async (prediction: StreetViewPlacePrediction) => {
    setPredictions([]);
    setPlaceQuery(prediction.description);
    const details = await fetchPlaceDetails(prediction.place_id);
    if (!details.success || details.lat === undefined || details.lng === undefined) {
      toast.error(details.error || 'Could not resolve place location.');
      return;
    }
    setLocation({ lat: details.lat, lng: details.lng, label: details.formatted_address, placeId: prediction.place_id });
  };

  const handleGenerateSkybox = async () => {
    if (!location) {
      toast.error('Search for a place or pick a location on the map first.');
      return;
    }
    setGenerating(true);
    try {
      const id = await ensureDraft();
      const res = await generateLessonStreetView(id, {
        lat: location.lat,
        lng: location.lng,
        heading,
        pitch,
        fov,
        formattedAddress: location.label,
        placeId: location.placeId,
      });
      setSkyboxUrl(res.imageUrl);
      toast.success('Skybox generated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate skybox.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAttachLibraryAsset = async (assetId: string) => {
    try {
      const id = await ensureDraft();
      await attachLibraryAsset(id, assetId);
      setAttachedAssetIds((prev) => [...prev, assetId]);
      toast.success('Asset attached.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach asset.');
    }
  };

  const handleGenerateAsset = async () => {
    if (!genPrompt.trim()) {
      toast.error('Describe the 3D object you want to generate.');
      return;
    }
    setGeneratingAsset(true);
    try {
      const id = await ensureDraft();
      const asset = await meshyApiService.generateTexturedAsset({ prompt: genPrompt.trim() });
      if (!asset.downloadUrl) throw new Error('Generation did not return a usable 3D model.');
      const persisted = await meshyApiService.finalizeGeneratedAsset({
        sourceAssetId: asset.id,
        sourceCollection: 'meshy_assets',
        chapterId: id,
        topicId: id,
        name: genPrompt.trim().slice(0, 100),
        prompt: genPrompt.trim(),
        aiModel: 'meshy-6',
        modelUrls: { glb: asset.downloadUrl },
        thumbnailUrl: asset.thumbnailUrl,
      });
      const persistedId = String(persisted.asset_id || persisted.id || '');
      if (persistedId) {
        await attachLibraryAsset(id, persistedId);
        setAttachedAssetIds((prev) => [...prev, persistedId]);
      }
      setGenPrompt('');
      toast.success('3D asset generated and attached.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate 3D asset.');
    } finally {
      setGeneratingAsset(false);
    }
  };

  const handleLaunch = async () => {
    if (!lessonId || !skyboxUrl) {
      toast.error('Generate a skybox before launching.');
      return;
    }
    setLaunching(true);
    try {
      const cleanChapter = {
        chapter_id: lessonId,
        chapter_name: title || 'My Lesson',
        chapter_number: 1,
        curriculum: 'Community',
        class_name: '',
        subject: 'Community',
      };
      const cleanTopic = {
        topic_id: lessonId,
        topic_name: title || 'My Lesson',
        topic_priority: 1,
        learning_objective: '',
        skybox_url: skyboxUrl,
        skybox_glb_url: skyboxUrl,
        asset_urls: [],
        asset_ids: attachedAssetIds,
      };

      let sessionId: string | null = null;

      if (isPartner) {
        const rawSession = sessionStorage.getItem('learnxr_partner_demo_session');
        const partnerSession = rawSession ? JSON.parse(rawSession) : null;
        if (!partnerSession?.id) {
          toast.error('Start a Channel Partner demo session from your Partner Dashboard first.');
          return;
        }
        await launchPartnerDemoLesson(partnerSession.id, {
          chapterId: lessonId,
          topicId: lessonId,
          title,
          lessonType: 'user_generated',
        });
        sessionId = partnerSession.id;
      } else {
        const classId = profile?.managed_class_ids?.[0] || profile?.class_ids?.[0];
        sessionId = activeSessionId;
        if (!sessionId) {
          if (!classId) {
            toast.error('Add a class before launching a lesson.');
            return;
          }
          sessionId = await startSession(classId);
        }
        if (!sessionId) {
          toast.error('Could not start a class session.');
          return;
        }
        const ok = await launchLessonToClass(
          {
            chapter_id: lessonId,
            topic_id: lessonId,
            lesson_type: 'user_generated',
            curriculum: 'Community',
            class_name: '',
            subject: 'Community',
            lang: 'en',
          },
          sessionId
        );
        if (!ok) {
          toast.error('Failed to launch lesson to class.');
          return;
        }
      }

      sessionStorage.setItem(
        'activeLesson',
        JSON.stringify({
          chapter: cleanChapter,
          topic: cleanTopic,
          image3dasset: null,
          assets3d: [],
          startedAt: new Date().toISOString(),
          language: 'en',
        })
      );
      if (sessionId) sessionStorage.setItem('learnxr_class_session_id', sessionId);
      contextStartLesson(cleanChapter, cleanTopic);
      toast.success('Lesson launched to your class.');
      navigate('/vrlessonplayer-krpano');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to launch lesson.');
    } finally {
      setLaunching(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!lessonId) {
      toast.error('Generate a skybox before submitting for review.');
      return;
    }
    setSubmitting(true);
    try {
      await submitLessonForReview(lessonId);
      toast.success('Submitted for Super Admin review.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit for review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Street View Lesson Creator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Turn any real-world location into an immersive VR lesson you can launch to your class right away.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Lesson title</CardTitle>
          </CardHeader>
          <CardContent>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Eiffel Tower" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" /> 2. Choose a location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Search for a place…"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
              />
              {searching && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
              {predictions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
                  {predictions.map((p) => (
                    <button
                      key={p.place_id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => handleSelectPrediction(p)}
                    >
                      {p.description}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setMapPickerOpen(true)}>
                Pick on map
              </Button>
              {location && (
                <span className="text-xs text-muted-foreground">
                  {location.label || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Heading</Label>
                <Input type="number" value={heading} onChange={(e) => setHeading(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Pitch</Label>
                <Input type="number" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Field of view</Label>
                <Input type="number" value={fov} onChange={(e) => setFov(Number(e.target.value))} />
              </div>
            </div>
            <Button onClick={handleGenerateSkybox} disabled={generating || !location}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
              Generate skybox
            </Button>
            {skyboxUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={skyboxUrl} alt="Generated skybox preview" className="w-full h-48 object-cover" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Attach a 3D asset (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => setLibraryPickerOpen(true)}>
                Pick from library
              </Button>
              {attachedAssetIds.length > 0 && (
                <span className="text-xs text-muted-foreground">{attachedAssetIds.length} asset(s) attached</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Describe a new 3D object to generate…"
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleGenerateAsset} disabled={generatingAsset}>
                {generatingAsset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3 justify-end">
          <Button variant="outline" onClick={handleSubmitForReview} disabled={submitting || !lessonId}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Submit for Super Admin review
          </Button>
          <Button onClick={handleLaunch} disabled={launching || !skyboxUrl}>
            {launching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Save &amp; Launch to my class
          </Button>
        </div>
      </div>

      <StreetViewMapPicker
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialCenter={location ? { lat: location.lat, lng: location.lng } : undefined}
        onSelectLocation={(lat, lng) => setLocation({ lat, lng })}
      />
      <AssetLibraryPicker
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        onSelect={handleAttachLibraryAsset}
      />
    </div>
  );
}
