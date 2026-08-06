/**
 * User-generated lessons (Street View, Create-page scenes, Spiral scenes).
 *
 * Teachers and partners can author a lesson (skybox + optional 3D asset) and
 * launch it in their own class immediately, without review. They may also
 * submit it for Super Admin review; on approval it is copied into
 * `curriculum_chapters` as a normal topic (optionally marked as a demo
 * lesson), reusing the exact same playback pipeline as any other lesson.
 */

import { Request, Response, Router } from 'express';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { requireRole } from '../middleware/rbac';
import { fetchAndStitchStreetView } from '../services/streetViewImagery';
import {
  USER_LESSONS_COLLECTION,
  MAX_TOUR_STOPS,
  promoteUserGeneratedLesson,
  type UserGeneratedLessonSource,
  type StreetViewTour,
  type TourStop,
  type TourStopAsset,
} from '../services/userGeneratedLessons';
import {
  getTileSession,
  getPanoramaMetadata,
  getOrStitchPanorama,
  searchPanoId,
  type TileZoomLevel,
} from '../services/streetViewTileApi';
import TextToSpeechService from '../services/textToSpeechService';

const router = Router();

const requireLessonAuthor = requireRole(['teacher', 'partner', 'admin', 'superadmin']);
const requireSuperadmin = requireRole(['superadmin']);

const VALID_SOURCES: UserGeneratedLessonSource[] = ['street_view', 'create_scene', 'spiral_scene'];

async function getOwnedDraft(
  db: admin.firestore.Firestore,
  lessonId: string,
  uid: string,
  isStaff: boolean
): Promise<{ ref: admin.firestore.DocumentReference; data: admin.firestore.DocumentData } | null> {
  const ref = db.collection(USER_LESSONS_COLLECTION).doc(lessonId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (!isStaff && data.ownerUid !== uid) return null;
  return { ref, data };
}

/**
 * POST /user-lessons — create a new draft.
 */
router.post(['/', ''], requireLessonAuthor, async (req: Request, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  const role = req.userProfile!.role;
  const title = String(req.body?.title || 'Untitled lesson').trim().slice(0, 200);
  const source = VALID_SOURCES.includes(req.body?.source) ? req.body.source : 'street_view';

  try {
    const db = admin.firestore();
    const ref = db.collection(USER_LESSONS_COLLECTION).doc();
    await ref.set({
      ownerUid: uid,
      ownerRole: role,
      source,
      title,
      curriculum: '',
      class_name: '',
      subject: '',
      skybox_url: '',
      skybox_glb_url: '',
      asset_urls: [],
      asset_ids: [],
      meshy_asset_ids: [],
      moderation: { status: 'draft' },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, lessonId: ref.id });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to create draft lesson' });
  }
});

const PATCHABLE_FIELDS = [
  'title',
  'skybox_url',
  'skybox_glb_url',
  'asset_urls',
  'asset_ids',
  'curriculum',
  'class_name',
  'subject',
] as const;

/**
 * PATCH /user-lessons/:id — owner updates safe scalar/array fields on their own draft
 * (used by the Create page and Spiral scene "Submit for review" flows, which already
 * have a skybox/assets in memory and don't need to re-generate via Street View).
 */
router.patch(
  ['/:id', '/:id/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    try {
      const db = admin.firestore();
      const ref = db.collection(USER_LESSONS_COLLECTION).doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.ownerUid !== uid) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const update: Record<string, unknown> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      for (const field of PATCHABLE_FIELDS) {
        if (req.body?.[field] === undefined) continue;
        if (field === 'title') update[field] = String(req.body[field]).trim().slice(0, 200);
        else if (field === 'asset_urls' || field === 'asset_ids') {
          update[field] = Array.isArray(req.body[field]) ? req.body[field].map((v: unknown) => String(v)).slice(0, 50) : [];
        } else {
          update[field] = String(req.body[field]).slice(0, 300);
        }
      }
      await ref.update(update);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to update draft lesson' });
    }
  }
);

/**
 * GET /user-lessons/mine — list the caller's own drafts/submissions.
 */
router.get(['/mine', '/mine/'], requireLessonAuthor, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await admin
      .firestore()
      .collection(USER_LESSONS_COLLECTION)
      .where('ownerUid', '==', req.user!.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, lessons });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to list lessons' });
  }
});

/**
 * POST /user-lessons/:id/street-view — generate the equirectangular skybox for a draft.
 */
router.post(
  ['/:id/street-view', '/:id/street-view/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const db = admin.firestore();

    try {
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }

      const apiKey = (process.env.GOOGLE_STREETVIEW_API_KEY || '').trim();
      if (!apiKey) {
        res.status(503).json({ success: false, message: 'Google Street View API key is not configured on the server' });
        return;
      }

      const panoId = String(req.body?.panoId || '').trim();
      const lat = req.body?.lat;
      const lng = req.body?.lng;
      const hasValidLocation =
        typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      if (!panoId && !hasValidLocation) {
        res.status(400).json({ success: false, message: 'Provide either a panorama ID or a valid lat/lng location.' });
        return;
      }

      const equirectBuffer = await fetchAndStitchStreetView({
        apiKey,
        location: hasValidLocation ? { lat, lng } : undefined,
        panoId: panoId || undefined,
        heading: req.body?.heading,
        pitch: req.body?.pitch,
        fov: req.body?.fov,
      });

      const fileName = `streetview_${Date.now()}.jpg`;
      const storagePath = `user_generated_lessons/${req.params.id}/${fileName}`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      await file.save(equirectBuffer, {
        contentType: 'image/jpeg',
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      await file.makePublic();
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      await draft.ref.update({
        skybox_url: imageUrl,
        skybox_glb_url: imageUrl,
        streetView: {
          lat: hasValidLocation ? lat : null,
          lng: hasValidLocation ? lng : null,
          panoId: panoId || null,
          formattedAddress: typeof req.body?.formattedAddress === 'string' ? req.body.formattedAddress.slice(0, 300) : null,
          placeId: typeof req.body?.placeId === 'string' ? req.body.placeId.slice(0, 200) : null,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, imageUrl });
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Street View skybox generation failed';
      const status = message.includes('No Street View')
        ? 404
        : message.includes('quota')
          ? 429
          : message.includes('API key')
            ? 503
            : 500;
      res.status(status).json({ success: false, message });
    }
  }
);

function clampTileZoom(value: unknown): TileZoomLevel {
  const n = Number(value);
  if (n === 2 || n === 4) return n;
  return 3;
}

function requireStreetViewApiKey(res: Response): string | null {
  const apiKey = (process.env.GOOGLE_STREETVIEW_API_KEY || '').trim();
  if (!apiKey) {
    res.status(503).json({ success: false, message: 'Google Street View API key is not configured on the server' });
    return null;
  }
  return apiKey;
}

function tileApiErrorStatus(message: string): number {
  if (message.includes('No Street View')) return 404;
  if (message.includes('quota')) return 429;
  if (message.includes('API key') || message.includes('denied') || message.includes('enabled')) return 503;
  return 500;
}

/**
 * POST /user-lessons/:id/streetview-tour/explore — resolve a location (lat/lng or panoId)
 * to a stitched skybox + metadata + links, powering the live "walk" explorer UI.
 */
router.post(
  ['/:id/streetview-tour/explore', '/:id/streetview-tour/explore/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const apiKey = requireStreetViewApiKey(res);
    if (!apiKey) return;

    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }

      const panoIdInput = String(req.body?.panoId || '').trim();
      const lat = req.body?.lat;
      const lng = req.body?.lng;
      const hasLocation = typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      if (!panoIdInput && !hasLocation) {
        res.status(400).json({ success: false, message: 'Provide either a panorama ID or a valid lat/lng location.' });
        return;
      }

      const zoom = clampTileZoom(req.body?.zoom);
      const session = await getTileSession(apiKey);

      let panoId = panoIdInput;
      if (!panoId) {
        panoId = (await searchPanoId(apiKey, session, lat, lng)) || '';
        if (!panoId) {
          res.status(404).json({ success: false, message: 'No Street View imagery available near this location.' });
          return;
        }
      }

      const metadata = await getPanoramaMetadata(apiKey, session, { panoId });
      const cached = await getOrStitchPanorama(apiKey, session, panoId, zoom, metadata);
      const skyboxUrl = cached.skyboxUrls[zoom]!;

      res.json({
        success: true,
        panoId,
        lat: metadata.lat,
        lng: metadata.lng,
        heading: metadata.heading,
        skyboxUrl,
        links: metadata.links,
        copyright: metadata.copyright || null,
        zoom,
      });
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Street View exploration failed';
      res.status(tileApiErrorStatus(message)).json({ success: false, message });
    }
  }
);

/**
 * POST /user-lessons/:id/streetview-tour/walk — hop to a linked neighboring panorama.
 * Identical response shape to `explore`; kept as a separate route for clarity in client code
 * and so a future rate-limit tier can be tuned independently of the initial search.
 */
router.post(
  ['/:id/streetview-tour/walk', '/:id/streetview-tour/walk/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const apiKey = requireStreetViewApiKey(res);
    if (!apiKey) return;

    const toPanoId = String(req.body?.toPanoId || '').trim();
    if (!toPanoId) {
      res.status(400).json({ success: false, message: 'toPanoId is required' });
      return;
    }

    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }

      const zoom = clampTileZoom(req.body?.zoom);
      const session = await getTileSession(apiKey);
      const metadata = await getPanoramaMetadata(apiKey, session, { panoId: toPanoId });
      const cached = await getOrStitchPanorama(apiKey, session, toPanoId, zoom, metadata);
      const skyboxUrl = cached.skyboxUrls[zoom]!;

      res.json({
        success: true,
        panoId: toPanoId,
        lat: metadata.lat,
        lng: metadata.lng,
        heading: metadata.heading,
        skyboxUrl,
        links: metadata.links,
        copyright: metadata.copyright || null,
        zoom,
      });
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Street View walk failed';
      res.status(tileApiErrorStatus(message)).json({ success: false, message });
    }
  }
);

function getTour(data: admin.firestore.DocumentData): StreetViewTour {
  const tour = data.streetViewTour as StreetViewTour | undefined;
  return tour && Array.isArray(tour.stops) ? tour : { stops: [], tileZoom: 3 };
}

/**
 * POST /user-lessons/:id/streetview-tour/stops — append a new stop, bookmarking the
 * currently-explored panorama (already stitched/cached by explore or walk).
 */
router.post(
  ['/:id/streetview-tour/stops', '/:id/streetview-tour/stops/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const apiKey = requireStreetViewApiKey(res);
    if (!apiKey) return;

    const panoId = String(req.body?.panoId || '').trim();
    if (!panoId) {
      res.status(400).json({ success: false, message: 'panoId is required' });
      return;
    }

    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }

      const tour = getTour(draft.data);
      if (tour.stops.length >= MAX_TOUR_STOPS) {
        res.status(400).json({ success: false, message: `A tour may have at most ${MAX_TOUR_STOPS} stops.` });
        return;
      }

      const zoom = clampTileZoom(req.body?.zoom ?? tour.tileZoom);
      const session = await getTileSession(apiKey);
      const metadata = await getPanoramaMetadata(apiKey, session, { panoId });
      const cached = await getOrStitchPanorama(apiKey, session, panoId, zoom, metadata);
      const skyboxUrl = cached.skyboxUrls[zoom]!;

      const stop: TourStop = {
        id: randomUUID(),
        order: tour.stops.length + 1,
        panoId,
        lat: metadata.lat,
        lng: metadata.lng,
        heading: Number(req.body?.heading) || 0,
        pitch: Number(req.body?.pitch) || 0,
        label: typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 200) : `Stop ${tour.stops.length + 1}`,
        skyboxUrl,
        links: metadata.links,
        assets: [],
        voiceover: null,
        ...(metadata.copyright ? { copyright: metadata.copyright } : {}),
      };

      const updatedTour: StreetViewTour = { stops: [...tour.stops, stop], tileZoom: zoom };
      // JSON round-trip drops any residual undefined nested fields before Firestore write.
      await draft.ref.update({
        streetViewTour: JSON.parse(JSON.stringify(updatedTour)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, stop });
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to add tour stop';
      res.status(tileApiErrorStatus(message)).json({ success: false, message });
    }
  }
);

const STOP_PATCHABLE_FIELDS = ['label', 'heading', 'pitch'] as const;

/**
 * PATCH /user-lessons/:id/streetview-tour/stops/:stopId — rename/adjust an existing stop.
 */
router.patch(
  ['/:id/streetview-tour/stops/:stopId', '/:id/streetview-tour/stops/:stopId/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const tour = getTour(draft.data);
      const idx = tour.stops.findIndex((s) => s.id === req.params.stopId);
      if (idx === -1) {
        res.status(404).json({ success: false, message: 'Stop not found' });
        return;
      }
      const stop = { ...tour.stops[idx] };
      for (const field of STOP_PATCHABLE_FIELDS) {
        if (req.body?.[field] === undefined) continue;
        (stop as any)[field] = field === 'label' ? String(req.body[field]).trim().slice(0, 200) : Number(req.body[field]);
      }
      const stops = [...tour.stops];
      stops[idx] = stop;
      await draft.ref.update({ 'streetViewTour.stops': stops, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.json({ success: true, stop });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to update stop' });
    }
  }
);

/**
 * DELETE /user-lessons/:id/streetview-tour/stops/:stopId — remove a stop and renumber the rest.
 */
router.delete(
  ['/:id/streetview-tour/stops/:stopId', '/:id/streetview-tour/stops/:stopId/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const tour = getTour(draft.data);
      const remaining = tour.stops.filter((s) => s.id !== req.params.stopId).map((s, i) => ({ ...s, order: i + 1 }));
      await draft.ref.update({ 'streetViewTour.stops': remaining, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to delete stop' });
    }
  }
);

/**
 * POST /user-lessons/:id/streetview-tour/stops/reorder — persist a new stop order.
 * Body: { stopIds: string[] } — the full list of stop IDs in the desired order.
 */
router.post(
  ['/:id/streetview-tour/stops/reorder', '/:id/streetview-tour/stops/reorder/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const stopIds = Array.isArray(req.body?.stopIds) ? req.body.stopIds.map((v: unknown) => String(v)) : [];
    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const tour = getTour(draft.data);
      const byId = new Map<string, TourStop>(tour.stops.map((s): [string, TourStop] => [s.id, s]));
      const reordered = stopIds
        .map((id: string) => byId.get(id))
        .filter((s: TourStop | undefined): s is TourStop => !!s)
        .map((s: TourStop, i: number) => ({ ...s, order: i + 1 }));
      if (reordered.length !== tour.stops.length) {
        res.status(400).json({ success: false, message: 'stopIds must include every existing stop exactly once' });
        return;
      }
      await draft.ref.update({ 'streetViewTour.stops': reordered, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.json({ success: true, stops: reordered });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to reorder stops' });
    }
  }
);

/**
 * POST /user-lessons/:id/streetview-tour/stops/:stopId/assets — place a floating 3D asset on a stop.
 */
router.post(
  ['/:id/streetview-tour/stops/:stopId/assets', '/:id/streetview-tour/stops/:stopId/assets/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const assetId = typeof req.body?.assetId === 'string' ? req.body.assetId.trim() : undefined;
    const glbUrl = String(req.body?.glbUrl || '').trim();
    if (!glbUrl) {
      res.status(400).json({ success: false, message: 'glbUrl is required' });
      return;
    }
    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const tour = getTour(draft.data);
      const idx = tour.stops.findIndex((s) => s.id === req.params.stopId);
      if (idx === -1) {
        res.status(404).json({ success: false, message: 'Stop not found' });
        return;
      }
      const stop = { ...tour.stops[idx] };
      // Only include defined optional fields — Firestore rejects `undefined` values.
      const asset: TourStopAsset = {
        id: randomUUID(),
        glbUrl,
        ath: Number(req.body?.ath) || 0,
        atv: Number(req.body?.atv) || 0,
        ...(assetId ? { assetId } : {}),
        ...(req.body?.depth !== undefined && req.body?.depth !== null && req.body?.depth !== ''
          ? { depth: Number(req.body.depth) }
          : {}),
        ...(req.body?.scale !== undefined && req.body?.scale !== null && req.body?.scale !== ''
          ? { scale: Number(req.body.scale) }
          : {}),
        ...(req.body?.rotationY !== undefined && req.body?.rotationY !== null && req.body?.rotationY !== ''
          ? { rotationY: Number(req.body.rotationY) }
          : {}),
      };
      stop.assets = [...(stop.assets || []), asset];
      const stops = [...tour.stops];
      stops[idx] = stop;
      // JSON round-trip drops any residual undefined nested fields before Firestore write
      // (same pattern as POST /stops — existing stop.links[].text can be undefined).
      await draft.ref.update({
        'streetViewTour.stops': JSON.parse(JSON.stringify(stops)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.json({ success: true, asset });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to attach asset to stop' });
    }
  }
);

/**
 * DELETE /user-lessons/:id/streetview-tour/stops/:stopId/assets/:assetInstanceId
 */
router.delete(
  ['/:id/streetview-tour/stops/:stopId/assets/:assetInstanceId', '/:id/streetview-tour/stops/:stopId/assets/:assetInstanceId/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const tour = getTour(draft.data);
      const idx = tour.stops.findIndex((s) => s.id === req.params.stopId);
      if (idx === -1) {
        res.status(404).json({ success: false, message: 'Stop not found' });
        return;
      }
      const stop = { ...tour.stops[idx] };
      stop.assets = (stop.assets || []).filter((a) => a.id !== req.params.assetInstanceId);
      const stops = [...tour.stops];
      stops[idx] = stop;
      await draft.ref.update({
        'streetViewTour.stops': JSON.parse(JSON.stringify(stops)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to remove asset from stop' });
    }
  }
);

/**
 * POST /user-lessons/:id/streetview-tour/stops/:stopId/voiceover — generate narration audio
 * for a stop via OpenAI TTS (same service the curriculum pipeline already uses).
 */
router.post(
  ['/:id/streetview-tour/stops/:stopId/voiceover', '/:id/streetview-tour/stops/:stopId/voiceover/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const script = String(req.body?.script || '').trim().slice(0, 2000);
    if (!script) {
      res.status(400).json({ success: false, message: 'script is required' });
      return;
    }
    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const tour = getTour(draft.data);
      const idx = tour.stops.findIndex((s) => s.id === req.params.stopId);
      if (idx === -1) {
        res.status(404).json({ success: false, message: 'Stop not found' });
        return;
      }

      const tts = new TextToSpeechService(process.env.OPENAI_AVATAR_API_KEY || process.env.OPENAI_API_KEY);
      const filename = `streetview_tours/${req.params.id}/${req.params.stopId}_${Date.now()}.mp3`;
      const audioUrl = await tts.generateSpeechFile(script, filename);

      const stop = { ...tour.stops[idx], voiceover: { script, audioUrl, language: 'en' } };
      const stops = [...tour.stops];
      stops[idx] = stop;
      await draft.ref.update({ 'streetViewTour.stops': stops, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.json({ success: true, voiceover: stop.voiceover });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to generate voiceover' });
    }
  }
);

/**
 * POST /user-lessons/:id/attach-asset — link an existing meshy_assets doc onto the draft.
 */
router.post(
  ['/:id/attach-asset', '/:id/attach-asset/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    const isStaff = req.userProfile!.role === 'admin' || req.userProfile!.role === 'superadmin';
    const assetId = String(req.body?.assetId || '').trim();
    if (!assetId) {
      res.status(400).json({ success: false, message: 'assetId is required' });
      return;
    }

    try {
      const db = admin.firestore();
      const draft = await getOwnedDraft(db, req.params.id, uid, isStaff);
      if (!draft) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }

      const assetSnap = await db.collection('meshy_assets').doc(assetId).get();
      if (!assetSnap.exists) {
        res.status(404).json({ success: false, message: '3D asset not found' });
        return;
      }
      const asset = assetSnap.data()!;
      const assetUrl = String(asset.render_url || asset.glb_url || '');

      const updatePayload: Record<string, unknown> = {
        asset_ids: admin.firestore.FieldValue.arrayUnion(assetId),
        meshy_asset_ids: admin.firestore.FieldValue.arrayUnion(assetId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (assetUrl) {
        updatePayload.asset_urls = admin.firestore.FieldValue.arrayUnion(assetUrl);
      }
      await draft.ref.update(updatePayload);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to attach asset' });
    }
  }
);

/**
 * POST /user-lessons/:id/submit — owner submits a draft for Super Admin review.
 */
router.post(
  ['/:id/submit', '/:id/submit/'],
  requireLessonAuthor,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.user!.uid;
    try {
      const db = admin.firestore();
      const ref = db.collection(USER_LESSONS_COLLECTION).doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.ownerUid !== uid) {
        res.status(404).json({ success: false, message: 'Draft lesson not found' });
        return;
      }
      const lessonData = snap.data() || {};
      const tour = lessonData.streetViewTour as StreetViewTour | undefined;
      if (!lessonData.skybox_url && !tour?.stops?.length) {
        res.status(400).json({ success: false, message: 'Add at least one stop before submitting for review.' });
        return;
      }
      await ref.update({
        'moderation.status': 'submitted',
        'moderation.submittedAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to submit lesson for review' });
    }
  }
);

/**
 * GET /user-lessons/admin/list?status= — superadmin review queue.
 */
router.get(
  ['/admin/list', '/admin/list/'],
  requireSuperadmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'submitted';
      const db = admin.firestore();
      let query: admin.firestore.Query = db.collection(USER_LESSONS_COLLECTION);
      if (status !== 'all') {
        query = query.where('moderation.status', '==', status);
      }
      const snap = await query.orderBy('createdAt', 'desc').limit(100).get();
      const lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ success: true, lessons });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to list lessons for review' });
    }
  }
);

/**
 * POST /user-lessons/admin/:id/review — approve (optionally as demo) or reject a submitted lesson.
 */
router.post(
  ['/admin/:id/review', '/admin/:id/review/'],
  requireSuperadmin,
  async (req: Request, res: Response): Promise<void> => {
    const reviewerUid = req.user!.uid;
    const approve = req.body?.approve === true;
    const markAsDemo = req.body?.markAsDemo === true;
    const rejectionReason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.slice(0, 500) : '';

    try {
      const db = admin.firestore();
      const ref = db.collection(USER_LESSONS_COLLECTION).doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ success: false, message: 'Lesson not found' });
        return;
      }
      const lessonData = snap.data()!;

      if (!approve) {
        await ref.update({
          'moderation.status': 'rejected',
          'moderation.reviewedBy': reviewerUid,
          'moderation.reviewedAt': admin.firestore.FieldValue.serverTimestamp(),
          'moderation.rejectionReason': rejectionReason || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ success: true, status: 'rejected' });
        return;
      }

      const promoted = await promoteUserGeneratedLesson(req.params.id, lessonData, {
        markAsDemo,
        approvedBy: reviewerUid,
      });

      await ref.update({
        'moderation.status': 'approved',
        'moderation.reviewedBy': reviewerUid,
        'moderation.reviewedAt': admin.firestore.FieldValue.serverTimestamp(),
        'moderation.promotedChapterId': promoted.chapterId,
        'moderation.promotedTopicId': promoted.topicId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, status: 'approved', ...promoted });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to review lesson' });
    }
  }
);

export default router;
