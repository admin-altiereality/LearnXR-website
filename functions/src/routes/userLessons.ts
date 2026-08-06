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
import { requireRole } from '../middleware/rbac';
import { fetchAndStitchStreetView } from '../services/streetViewImagery';
import {
  USER_LESSONS_COLLECTION,
  promoteUserGeneratedLesson,
  type UserGeneratedLessonSource,
} from '../services/userGeneratedLessons';

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
      if (!snap.data()?.skybox_url) {
        res.status(400).json({ success: false, message: 'Generate a skybox before submitting for review.' });
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
