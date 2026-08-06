/**
 * Street View Tour Creator — teachers and partners walk through real-world
 * Google Street View locations (official Tile API "links" hopping, mirroring
 * StreetVision/OculusStreetView), bookmark stops along the way, attach
 * floating 3D assets (Meshy text-to-3D or Trellis 2 image-to-3D) per stop,
 * then launch the guided tour directly to class (no Super Admin approval required).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Rocket,
  Sparkles,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { Button } from '../../Components/ui/button';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/ui/card';
import { StreetViewMapPicker } from '../../Components/studio/StreetViewMapPicker';
import { AssetLibraryPicker } from '../../Components/create/AssetLibraryPicker';
import { ImageTo3DPanel } from '../../Components/studio/tabs/ImageTo3DPanel';
import { StreetViewPanoramaViewer, type PanoramaLink } from '../../Components/streetview/StreetViewPanoramaViewer';
import { fetchPlaceSuggestions, fetchPlaceDetails, type StreetViewPlacePrediction } from '../../services/streetViewPlacesService';
import {
  createDraftLesson,
  exploreStreetView,
  walkToPanorama,
  addTourStop,
  updateTourStop,
  deleteTourStop,
  reorderTourStops,
  addTourStopAsset,
  removeTourStopAsset,
  type TourStop,
  type TourTileZoom,
} from '../../services/userLessonService';
import { meshyApiService } from '../../services/meshyApiService';
import { getLessonBundle } from '../../services/firestore/getLessonBundle';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { useLesson } from '../../contexts/LessonContext';
import {
  launchPartnerDemoLesson,
  fetchPartnerMe,
  provisionPartnerDemoClass,
  startPartnerDemoSession,
} from '../../services/partnerService';

const ZOOM_OPTIONS: { value: TourTileZoom; label: string }[] = [
  { value: 2, label: 'Low' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'High' },
];

type AssetGenProvider = 'meshy' | 'trellis';

export default function StreetViewLessonCreator() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeSessionId, startSession, launchLesson: launchLessonToClass, bindActiveSession } = useClassSession();
  const { startLesson: contextStartLesson } = useLesson();
  const isPartner = profile?.role === 'partner';

  const [title, setTitle] = useState('My Street View Tour');
  const [lessonId, setLessonId] = useState<string | null>(null);

  const [placeQuery, setPlaceQuery] = useState('');
  const [predictions, setPredictions] = useState<StreetViewPlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [zoom, setZoom] = useState<TourTileZoom>(3);

  // Currently-explored panorama (may or may not correspond to a saved stop yet).
  const [currentPanoId, setCurrentPanoId] = useState<string | null>(null);
  const [currentSkyboxUrl, setCurrentSkyboxUrl] = useState<string | null>(null);
  const [currentLinks, setCurrentLinks] = useState<PanoramaLink[]>([]);
  const [currentView, setCurrentView] = useState({ heading: 0, pitch: 0 });
  const [exploring, setExploring] = useState(false);

  const [stops, setStops] = useState<TourStop[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [addingStop, setAddingStop] = useState(false);

  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generatingAsset, setGeneratingAsset] = useState(false);
  const [assetGenProvider, setAssetGenProvider] = useState<AssetGenProvider>('meshy');

  const [launching, setLaunching] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  const selectedStop = stops.find((s) => s.id === selectedStopId) || null;

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
    const res = await createDraftLesson(title.trim() || 'Untitled tour', 'street_view');
    setLessonId(res.lessonId);
    return res.lessonId;
  }, [lessonId, title]);

  const exploreLocation = async (params: { lat?: number; lng?: number; panoId?: string }) => {
    setExploring(true);
    try {
      const id = await ensureDraft();
      const res = await exploreStreetView(id, { ...params, zoom });
      setCurrentPanoId(res.panoId);
      setCurrentSkyboxUrl(res.skyboxUrl);
      setCurrentLinks(res.links);
      setSelectedStopId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Street View imagery.');
    } finally {
      setExploring(false);
    }
  };

  const handleSelectPrediction = async (prediction: StreetViewPlacePrediction) => {
    setPredictions([]);
    setPlaceQuery(prediction.description);
    const details = await fetchPlaceDetails(prediction.place_id);
    if (!details.success || details.lat === undefined || details.lng === undefined) {
      toast.error(details.error || 'Could not resolve place location.');
      return;
    }
    await exploreLocation({ lat: details.lat, lng: details.lng });
  };

  const handleWalk = async (toPanoId: string) => {
    if (!lessonId) return;
    setExploring(true);
    try {
      const res = await walkToPanorama(lessonId, toPanoId, zoom);
      setCurrentPanoId(res.panoId);
      setCurrentSkyboxUrl(res.skyboxUrl);
      setCurrentLinks(res.links);
      setSelectedStopId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to walk to that panorama.');
    } finally {
      setExploring(false);
    }
  };

  const handleSelectStop = async (stop: TourStop) => {
    setSelectedStopId(stop.id);
    setCurrentPanoId(stop.panoId);
    setCurrentSkyboxUrl(stop.skyboxUrl);
    setCurrentLinks(stop.links);
  };

  const handleAddStop = async () => {
    if (!lessonId || !currentPanoId) {
      toast.error('Explore a location first.');
      return;
    }
    setAddingStop(true);
    try {
      const res = await addTourStop(lessonId, {
        panoId: currentPanoId,
        heading: currentViewRef.current.heading,
        pitch: currentViewRef.current.pitch,
        label: `Stop ${stops.length + 1}`,
        zoom,
      });
      setStops((prev) => [...prev, res.stop]);
      setSelectedStopId(res.stop.id);
      toast.success('Stop added to the tour.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add stop.');
    } finally {
      setAddingStop(false);
    }
  };

  const handleRenameStop = async (stop: TourStop, label: string) => {
    setStops((prev) => prev.map((s) => (s.id === stop.id ? { ...s, label } : s)));
    if (!lessonId) return;
    try {
      await updateTourStop(lessonId, stop.id, { label });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename stop.');
    }
  };

  const handleDeleteStop = async (stop: TourStop) => {
    if (!lessonId) return;
    try {
      await deleteTourStop(lessonId, stop.id);
      setStops((prev) => prev.filter((s) => s.id !== stop.id));
      if (selectedStopId === stop.id) setSelectedStopId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete stop.');
    }
  };

  const handleMoveStop = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (!lessonId || target < 0 || target >= stops.length) return;
    const reordered = [...stops];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setStops(reordered);
    try {
      await reorderTourStops(lessonId, reordered.map((s) => s.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder stops.');
    }
  };

  const attachAssetToSelectedStop = async (assetId: string, glbUrl: string) => {
    if (!lessonId || !selectedStop) return;
    try {
      const res = await addTourStopAsset(lessonId, selectedStop.id, {
        assetId,
        glbUrl,
        ath: currentViewRef.current.heading,
        atv: currentViewRef.current.pitch,
        depth: 500,
      });
      setStops((prev) =>
        prev.map((s) => (s.id === selectedStop.id ? { ...s, assets: [...s.assets, res.asset] } : s))
      );
      toast.success('3D asset placed where you were looking.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place asset.');
    }
  };

  const handlePickLibraryAsset = async (assetId: string) => {
    try {
      const snap = await getDoc(doc(db, 'meshy_assets', assetId));
      const data = snap.data() as { render_url?: string; glb_url?: string } | undefined;
      const glbUrl = data?.render_url || data?.glb_url || '';
      if (!glbUrl) {
        toast.error('This asset has no usable 3D model URL.');
        return;
      }
      await attachAssetToSelectedStop(assetId, glbUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach asset.');
    }
  };

  const handleRemoveStopAsset = async (assetInstanceId: string) => {
    if (!lessonId || !selectedStop) return;
    try {
      await removeTourStopAsset(lessonId, selectedStop.id, assetInstanceId);
      setStops((prev) =>
        prev.map((s) => (s.id === selectedStop.id ? { ...s, assets: s.assets.filter((a) => a.id !== assetInstanceId) } : s))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove asset.');
    }
  };

  const handleGenerateAsset = async () => {
    if (!genPrompt.trim() || !selectedStop) {
      toast.error('Select a stop and describe the 3D object you want to generate.');
      return;
    }
    setGeneratingAsset(true);
    try {
      const id = await ensureDraft();
      // Teachers/partners must finalize with chapterId === topicId === lessonId
      const asset = await meshyApiService.generateTexturedAsset({
        prompt: genPrompt.trim(),
        ai_model: 'meshy-6',
        target_formats: ['glb'],
      });
      if (!asset.downloadUrl) throw new Error('Generation did not return a usable 3D model.');
      const persisted = await meshyApiService.finalizeGeneratedAsset({
        sourceAssetId: asset.id,
        sourceCollection: 'meshy_assets',
        chapterId: id,
        topicId: id,
        name: genPrompt.trim().slice(0, 100),
        prompt: genPrompt.trim(),
        aiModel: 'meshy-6',
        meshyId: asset.id,
        modelUrls: { glb: asset.downloadUrl },
        thumbnailUrl: asset.thumbnailUrl,
      });
      const persistedId = String(persisted.asset_id || persisted.id || asset.id || '');
      const glbUrl = String(
        (persisted as { render_url?: string; glb_url?: string }).render_url ||
          (persisted as { render_url?: string; glb_url?: string }).glb_url ||
          asset.downloadUrl
      );
      await attachAssetToSelectedStop(persistedId, glbUrl);
      setGenPrompt('');
      toast.success('Meshy 3D asset generated and placed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate 3D asset with Meshy.');
    } finally {
      setGeneratingAsset(false);
    }
  };

  const attachLatestLessonAsset = useCallback(async () => {
    if (!lessonId || !selectedStop) return;
    try {
      // Finalize may still be flushing to Firestore — brief wait, then pick newest for this draft.
      await new Promise((r) => setTimeout(r, 1200));
      const snap = await getDocs(query(collection(db, 'meshy_assets'), where('chapter_id', '==', lessonId), limit(25)));
      if (snap.empty) {
        toast.info('Asset saved to library — pick it with “Pick from library” if it did not attach automatically.');
        return;
      }
      const sorted = [...snap.docs].sort((a, b) => {
        const ta = (a.data() as { created_at?: { toMillis?: () => number }; updated_at?: { toMillis?: () => number } }).created_at?.toMillis?.()
          || (a.data() as { updated_at?: { toMillis?: () => number } }).updated_at?.toMillis?.()
          || 0;
        const tb = (b.data() as { created_at?: { toMillis?: () => number }; updated_at?: { toMillis?: () => number } }).created_at?.toMillis?.()
          || (b.data() as { updated_at?: { toMillis?: () => number } }).updated_at?.toMillis?.()
          || 0;
        return tb - ta;
      });
      const docSnap = sorted[0];
      const data = docSnap.data() as { render_url?: string; glb_url?: string; asset_id?: string };
      const glbUrl = data.render_url || data.glb_url || '';
      if (!glbUrl) {
        toast.error('Generated asset has no usable 3D model URL.');
        return;
      }
      await attachAssetToSelectedStop(String(data.asset_id || docSnap.id), glbUrl);
    } catch (err) {
      console.warn('Auto-attach Trellis asset failed:', err);
      toast.info('Asset saved — use “Pick from library” to place it on this stop.');
    }
  }, [lessonId, selectedStop]);

  const handleLaunch = async () => {
    if (!lessonId || stops.length === 0) {
      toast.error('Add at least one stop before launching.');
      return;
    }
    setLaunching(true);
    try {
      const firstStop = stops[0];
      const firstStopTopicId = `${lessonId}__stop_${firstStop.id}`;

      // Fetch the fully-resolved bundle (assets3d) rather than hand-rolling the topic, so
      // 3D assets render immediately just like they would after a stop switch.
      const bundle = await getLessonBundle({ chapterId: lessonId, topicId: firstStopTopicId, lang: 'en', source: 'user_generated' });
      const topic = bundle.chapter.topics?.find((t: any) => t.topic_id === firstStopTopicId) || bundle.chapter.topics?.[0];
      const cleanChapter = {
        chapter_id: lessonId,
        chapter_name: title || 'My Tour',
        chapter_number: 1,
        curriculum: 'Community',
        class_name: '',
        subject: 'Community',
      };
      const cleanTopic = {
        topic_id: firstStopTopicId,
        topic_name: topic?.topic_name || firstStop.label || title || 'My Tour',
        topic_priority: 1,
        learning_objective: '',
        in3d_prompt: '',
        skybox_url: bundle.skybox?.imageUrl || bundle.skybox?.file_url || topic?.skybox_url || firstStop.skyboxUrl,
        skybox_glb_url: topic?.skybox_glb_url || firstStop.skyboxUrl,
        asset_urls: Array.isArray(topic?.asset_urls) ? topic.asset_urls : [],
        asset_ids: Array.isArray(topic?.asset_ids) ? topic.asset_ids : [],
        assetPlacements: Array.isArray(topic?.assetPlacements) ? topic.assetPlacements : [],
        avatar_intro: topic?.avatar_intro || firstStop.voiceover?.script || '',
        ttsAudio: Array.isArray(bundle.tts)
          ? bundle.tts.map((t: any) => ({ id: t.id, script_type: t.script_type || 'intro', audio_url: t.audio_url, language: t.language || 'en' }))
          : [],
        isTourStop: true,
      };
      const assets3d = Array.isArray(bundle.assets3d) ? bundle.assets3d : [];

      let sessionId: string | null = null;

      if (isPartner) {
        const rawSession = sessionStorage.getItem('learnxr_partner_demo_session');
        let partnerSession = rawSession ? JSON.parse(rawSession) : null;
        if (!partnerSession?.id) {
          // Auto-start a demo session so launching never requires a separate Partner Dashboard step.
          const me = await fetchPartnerMe();
          if (!me.trialActive) {
            toast.error(me.trialBlockReason || 'Your Channel Partner trial is inactive.');
            return;
          }
          let demoSchoolId = me.partner.demoSchoolId;
          let demoClassId = me.partner.demoClassId;
          if (!demoSchoolId || !demoClassId) {
            const provisioned = await provisionPartnerDemoClass(me.partner.id);
            demoSchoolId = provisioned.demoSchoolId;
            demoClassId = provisioned.demoClassId;
          }
          if (!demoSchoolId || !demoClassId) {
            toast.error('Demo class is not set up for your partner account.');
            return;
          }
          const started = await startPartnerDemoSession(demoSchoolId, demoClassId);
          partnerSession = {
            id: started.sessionId,
            code: started.sessionCode,
            schoolId: demoSchoolId,
            classId: demoClassId,
          };
          sessionStorage.setItem('learnxr_partner_demo_session', JSON.stringify(partnerSession));
          toast.success(`Demo session started. Code: ${started.sessionCode}`);
        }
        await launchPartnerDemoLesson(partnerSession.id, {
          chapterId: lessonId,
          topicId: firstStopTopicId,
          title,
          lessonType: 'user_generated',
        });
        sessionId = partnerSession.id;
        bindActiveSession(partnerSession.id);
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
            topic_id: firstStopTopicId,
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
          assets3d,
          startedAt: new Date().toISOString(),
          language: 'en',
        })
      );
      if (sessionId) sessionStorage.setItem('learnxr_class_session_id', sessionId);
      contextStartLesson(cleanChapter, cleanTopic);
      toast.success('Tour launched to your class.');
      navigate('/vrlessonplayer-krpano');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to launch tour.');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Street View Tour Creator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search Street View locations, bookmark stops, add 3D models (Meshy or Trellis 2), then launch
            straight to your class — no Super Admin approval needed.
            {isPartner ? ' Each demo class launch uses 1 of your 50 Street View class credits.' : ''}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tour title</CardTitle>
          </CardHeader>
          <CardContent>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walking tour of the Eiffel Tower" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Explore &amp; walk
                  </span>
                  <div className="flex items-center gap-1">
                    {ZOOM_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setZoom(opt.value)}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          zoom === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search for a place to explore in Street View…"
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
                  {!searching && placeQuery.trim().length >= 2 && predictions.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No places matched. Try a landmark, address, or city attraction.
                    </p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setMapPickerOpen(true)}>
                  Pick on map
                </Button>

                <div className="h-[420px] rounded-lg overflow-hidden border border-border">
                  <StreetViewPanoramaViewer
                    skyboxUrl={currentSkyboxUrl}
                    links={currentLinks}
                    loading={exploring}
                    assets={selectedStop?.assets.map((a) => ({ id: a.id, ath: a.ath, atv: a.atv, depth: a.depth })) || []}
                    onWalk={handleWalk}
                    onViewChange={(heading, pitch) => setCurrentView({ heading, pitch })}
                  />
                </div>

                <Button onClick={handleAddStop} disabled={addingStop || !currentPanoId || stops.length >= 12}>
                  {addingStop ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add current view as Stop
                </Button>
              </CardContent>
            </Card>

            {selectedStop && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Editing: {selectedStop.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-xs">3D assets floating at this stop</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" variant="outline" size="sm" onClick={() => setLibraryPickerOpen(true)}>
                        Pick from library
                      </Button>
                      <span className="text-xs text-muted-foreground">Look where you want it placed, then pick or generate an asset.</span>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/70 p-1 w-fit">
                      <button
                        type="button"
                        onClick={() => setAssetGenProvider('meshy')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          assetGenProvider === 'meshy'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        Meshy
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssetGenProvider('trellis')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          assetGenProvider === 'trellis'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        Trellis 2
                      </button>
                    </div>

                    {assetGenProvider === 'meshy' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Text-to-3D with Meshy. Generation can take a few minutes.</p>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Describe a new 3D object to generate…"
                            value={genPrompt}
                            onChange={(e) => setGenPrompt(e.target.value)}
                            disabled={generatingAsset}
                          />
                          <Button type="button" variant="outline" onClick={() => void handleGenerateAsset()} disabled={generatingAsset || !genPrompt.trim()}>
                            {generatingAsset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    ) : lessonId ? (
                      <ImageTo3DPanel
                        chapterId={lessonId}
                        topicId={lessonId}
                        onAssetGenerated={() => {
                          void attachLatestLessonAsset();
                        }}
                      />
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Add a stop first so we can save Trellis assets to this tour draft.</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await ensureDraft();
                              toast.success('Draft ready — upload an image for Trellis 2.');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Could not create draft.');
                            }
                          }}
                        >
                          Prepare draft for Trellis
                        </Button>
                      </div>
                    )}

                    {selectedStop.assets.length > 0 && (
                      <ul className="space-y-1">
                        {selectedStop.assets.map((asset) => (
                          <li key={asset.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-2 py-1">
                            <span>3D asset (ath {Math.round(asset.ath)}°, atv {Math.round(asset.atv)}°)</span>
                            <button onClick={() => handleRemoveStopAsset(asset.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tour stops ({stops.length}/12)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Explore a location, then click "Add current view as Stop" to start building your tour.
                  </p>
                ) : (
                  stops.map((stop, index) => (
                    <div
                      key={stop.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 cursor-pointer ${
                        selectedStopId === stop.id ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                      onClick={() => handleSelectStop(stop)}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <img src={stop.skyboxUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      <Input
                        value={stop.label || ''}
                        onChange={(e) => handleRenameStop(stop, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-xs flex-1"
                      />
                      <div className="flex flex-col shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveStop(index, -1);
                          }}
                          disabled={index === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveStop(index, 1);
                          }}
                          disabled={index === stops.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStop(stop);
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button onClick={handleLaunch} disabled={launching || stops.length === 0}>
                {launching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                Save &amp; Launch to my class
              </Button>
              <p className="text-xs text-muted-foreground">
                Launches immediately — no Super Admin approval required.
              </p>
            </div>
          </div>
        </div>
      </div>

      <StreetViewMapPicker
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        onSelectLocation={(lat, lng) => {
          setMapPickerOpen(false);
          exploreLocation({ lat, lng });
        }}
      />
      <AssetLibraryPicker
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        onSelect={(assetId) => void handlePickLibraryAsset(assetId)}
      />
    </div>
  );
}
