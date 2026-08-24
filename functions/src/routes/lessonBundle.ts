/**
 * GET /lesson-bundle - Returns lesson bundle JSON for standalone VR player.
 * Auth: Bearer token (Firebase ID token) in Authorization header.
 * Query: chapterId, topicId, lang (default en).
 * Used by mobile app WebView: page fetches bundle with token, then renders Krpano without requiring web app auth.
 */

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';

const router = Router();
const COLLECTION_CHAPTERS = 'curriculum_chapters';
const COLLECTION_SKYBOXES = 'skyboxes';
const COLLECTION_MESHY_ASSETS = 'meshy_assets';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const COLLECTION_CHAPTER_MCQS = 'chapter_mcqs';
/** Extract language-aware avatar scripts from the topic object (mirrors web app logic). */
function extractAvatarScriptsForLanguage(
  topic: any, lang: string
): { intro: string; explanation: string; outro: string } | null {
  if (!topic) return null;
  const scripts1 = topic.topic_avatar_scripts?.[lang];
  if (scripts1 && typeof scripts1 === 'object') {
    return { intro: scripts1.intro || '', explanation: scripts1.explanation || '', outro: scripts1.outro || '' };
  }
  const scripts2 = topic.avatar_scripts_by_language?.[lang];
  if (scripts2 && typeof scripts2 === 'object') {
    return { intro: scripts2.intro || '', explanation: scripts2.explanation || '', outro: scripts2.outro || '' };
  }
  if (lang === 'en') {
    const intro = topic.topic_avatar_intro || '';
    const explanation = topic.topic_avatar_explanation || '';
    const outro = topic.topic_avatar_outro || '';
    if (intro || explanation || outro) return { intro, explanation, outro };
  }
  return null;
}

/** Match topic when request topicId equals either topic_id or id (string comparison). */
function topicMatches(t: any, topicId: string): boolean {
  if (!topicId || !t) return false;
  const norm = String(topicId).trim();
  const tTopicId = t.topic_id != null ? String(t.topic_id) : '';
  const tId = t.id != null ? String(t.id) : '';
  return tTopicId === norm || tId === norm;
}

function isRetiredMeshyAsset(asset: any): boolean {
  return Boolean(
    asset?.active === false ||
    asset?.status === 'replaced' ||
    asset?.replaced_by_meshy_asset_id ||
    (asset?.asset_repair_status === 'regenerated' && asset?.replaced_by_meshy_asset_id)
  );
}

function isRenderAssetUrl(url: string): boolean {
  return typeof url === 'string' && url.includes('/render-asset/') && /\.glb(?:\?|$|\/?$)/i.test(url);
}

function pickPlayerGlbUrl(asset: any): string {
  const candidates = [
    asset?.animated_render_url,
    asset?.render_url,
    asset?.model_urls?.glb,
    asset?.glb_url,
    asset?.file_url,
  ];
  const url = candidates.find((candidate) => isRenderAssetUrl(String(candidate || '')));
  return url ? String(url) : '';
}

function extractIds(chapterData: any, topicId: string | undefined, lang: string): {
  skyboxId?: string;
  assetIds: string[];
  ttsIds: string[];
  mcqIds: string[];
} {
  const topics = Array.isArray(chapterData?.topics) ? chapterData.topics : [];
  const topic = topicId
    ? topics.find((t: any) => topicMatches(t, topicId))
    : topics[0];
  const shared = chapterData?.sharedAssets || {};
  const topicShared = topic?.sharedAssets || {};
  // Match web app order: sharedAssets first (topic then chapter), then legacy topic/chapter
  let skyboxId: string | undefined;
  if (topicShared?.skybox_id) {
    skyboxId = topicShared.skybox_id;
  } else if (shared?.skybox_id) {
    skyboxId = shared.skybox_id;
  } else {
    skyboxId = topic?.skybox_id || chapterData.skybox_id;
  }
  const assetIds = [
    ...(topic?.meshy_asset_ids || []),
    ...(topic?.asset_ids || []),
    ...(topicShared?.meshy_asset_ids || []),
    ...(topicShared?.asset_ids || []),
    ...(shared?.meshy_asset_ids || []),
    ...(shared?.asset_ids || []),
    ...(chapterData.meshy_asset_ids || []),
  ].filter(Boolean);
  // TTS: match web priority - localized[lang] first, then tts_ids_by_language, then legacy with language filter
  const ttsIds: string[] = [];
  if (topic?.localized?.[lang]?.tts_ids?.length) {
    ttsIds.push(...topic.localized[lang].tts_ids);
  } else if (chapterData.localized?.[lang]?.tts_ids?.length) {
    ttsIds.push(...chapterData.localized[lang].tts_ids);
  } else {
    ttsIds.push(
      ...(topic?.tts_ids_by_language?.[lang] || []),
      ...(chapterData.tts_ids_by_language?.[lang] || []),
      ...(topic?.tts_ids || []),
      ...(chapterData.tts_ids || []),
    );
    if (ttsIds.length > 0 && (lang === 'hi' || lang === 'en')) {
      const all = ttsIds.filter(Boolean);
      ttsIds.length = 0;
      if (lang === 'hi') {
        ttsIds.push(...all.filter((id: string) => id.includes('_hi') || id.includes('_HI')));
      } else {
        ttsIds.push(...all.filter((id: string) => !id.includes('_hi') && !id.includes('_HI')));
      }
    }
  }

  // MCQ: prioritize topic-level, fall back to chapter-level (never merge both to avoid duplicates)
  const mcqIds: string[] = [];
  if (topic?.localized?.[lang]?.mcq_ids?.length) {
    mcqIds.push(...topic.localized[lang].mcq_ids);
  } else if (topic?.mcq_ids_by_language?.[lang]?.length) {
    mcqIds.push(...topic.mcq_ids_by_language[lang]);
  } else if (topic?.mcq_ids?.length) {
    mcqIds.push(...topic.mcq_ids);
  } else if (chapterData.localized?.[lang]?.mcq_ids?.length) {
    mcqIds.push(...chapterData.localized[lang].mcq_ids);
  } else if (chapterData.mcq_ids_by_language?.[lang]?.length) {
    mcqIds.push(...chapterData.mcq_ids_by_language[lang]);
  } else if (chapterData.mcq_ids?.length) {
    mcqIds.push(...chapterData.mcq_ids);
  }
  if (mcqIds.length > 0 && (lang === 'hi' || lang === 'en')) {
    const all = mcqIds.filter(Boolean);
    mcqIds.length = 0;
    if (lang === 'hi') {
      mcqIds.push(...all.filter((id: string) => id.includes('_hi') || id.includes('_HI')));
    } else {
      mcqIds.push(...all.filter((id: string) => !id.includes('_hi') && !id.includes('_HI')));
    }
  }
  const toValidIds = (arr: any[]): string[] =>
    [...new Set(arr)]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter((id) => id.length > 0);
  return {
    skyboxId: skyboxId != null && String(skyboxId).trim().length > 0 ? String(skyboxId).trim() : undefined,
    assetIds: toValidIds(assetIds),
    ttsIds: toValidIds(ttsIds),
    mcqIds: toValidIds(mcqIds),
  };
}

router.get('/', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const chapterId = (req.query.chapterId as string)?.trim();
  const topicId = (req.query.topicId as string)?.trim();
  const lang = ((req.query.lang as string) || 'en').toLowerCase();

  if (!chapterId) {
    return res.status(400).json({ error: 'chapterId is required' });
  }

  const db = admin.firestore();
  try {
    const chapterRef = db.collection(COLLECTION_CHAPTERS).doc(chapterId);
    const chapterSnap = await chapterRef.get();
    if (!chapterSnap.exists) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    const rawData = chapterSnap.data();
    const chapterData: Record<string, any> = {
      id: chapterSnap.id,
      ...(rawData && typeof rawData === 'object' ? rawData : {}),
      topics: Array.isArray((rawData as any)?.topics) ? (rawData as any).topics : [],
    };

    const ids = extractIds(chapterData, topicId || undefined, lang);
    const topics = chapterData.topics;
    const matchedTopic = topicId
      ? topics.find((t: any) => topicMatches(t, topicId))
      : topics[0];
    const effectiveTopicIdForQuery = matchedTopic?.topic_id ?? chapterData.topics?.[0]?.topic_id ?? topicId ?? '';

    const safeTtsIds = (ids.ttsIds || []).slice(0, 30).filter((id) => typeof id === 'string' && id.trim().length > 0);
    const safeMcqIds = (ids.mcqIds || []).slice(0, 30).filter((id) => typeof id === 'string' && id.trim().length > 0);
    const safeAssetIds = (ids.assetIds || []).filter((id) => typeof id === 'string' && id.trim().length > 0);

    const [skyboxSnap, meshyByTopic, ttsSnap, mcqSnap] = await Promise.all([
      ids.skyboxId
        ? db.collection(COLLECTION_SKYBOXES).doc(ids.skyboxId).get()
        : Promise.resolve(null),
      db
        .collection(COLLECTION_MESHY_ASSETS)
        .where('chapter_id', '==', chapterId)
        .where('topic_id', '==', effectiveTopicIdForQuery)
        .get(),
      safeTtsIds.length > 0
        ? Promise.all(
            safeTtsIds.map((id) =>
              db
                .collection(COLLECTION_CHAPTER_TTS)
                .doc(id)
                .get()
            )
          ).then((snaps) => snaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() })))
        : Promise.resolve([]),
      safeMcqIds.length > 0
        ? Promise.all(
            safeMcqIds.map((id) =>
              db
                .collection(COLLECTION_CHAPTER_MCQS)
                .doc(id)
                .get()
            )
          ).then((snaps) => snaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() })))
        : Promise.resolve([]),
    ]);

    const skyboxData = skyboxSnap?.exists
      ? { id: skyboxSnap.id, ...(skyboxSnap.data() || {}) }
      : null;
    const skyboxImageUrl =
      (skyboxData as any)?.imageUrl ||
      (skyboxData as any)?.file_url ||
      (skyboxData as any)?.skybox_url;

    const meshyAssets = (meshyByTopic?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() || {}) }));
    if (safeAssetIds.length > 0) {
      for (let i = 0; i < safeAssetIds.length; i += 30) {
        const chunk = safeAssetIds.slice(i, i + 30);
        const snap = await db
          .collection(COLLECTION_MESHY_ASSETS)
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
          .get();
        snap.docs.forEach((d) => {
          if (!meshyAssets.some((a: any) => a.id === d.id)) {
            meshyAssets.push({ id: d.id, ...d.data() });
          }
        });
      }
    }

    const activeMeshyAssets = meshyAssets.filter((a: any) => !isRetiredMeshyAsset(a) && pickPlayerGlbUrl(a));
    const assets3d = activeMeshyAssets.map((a: any) => {
      const glbUrl = pickPlayerGlbUrl(a);
      const animatedRenderUrl = isRenderAssetUrl(String(a.animated_render_url || ''))
        ? String(a.animated_render_url)
        : '';
      return {
        id: a.id,
        animated_render_url: animatedRenderUrl,
        animated_glb_url: animatedRenderUrl,
        render_url: isRenderAssetUrl(String(a.render_url || '')) ? a.render_url : glbUrl,
        storage_path: a.storage_path || a.storagePath,
        storage_paths: a.storage_paths,
        model_urls: {
          ...(a.model_urls || {}),
          glb: glbUrl,
        },
        glb_url: glbUrl,
        file_url: glbUrl,
        name: a.name || a.prompt,
      };
    });

    const ttsList = Array.isArray(ttsSnap) ? ttsSnap : [];
    const mcqsList = Array.isArray(mcqSnap) ? mcqSnap : [];
    const avatarScripts = extractAvatarScriptsForLanguage(matchedTopic, lang);

    const bundle = {
      lang,
      chapter: chapterData,
      topic: matchedTopic || null,
      skybox: skyboxData
        ? {
            ...(typeof skyboxData === 'object' && skyboxData !== null ? skyboxData : {}),
            imageUrl: skyboxImageUrl,
            file_url: skyboxImageUrl,
          }
        : null,
      assets3d,
      tts: ttsList.filter(Boolean).map((t: any) => ({
        id: t?.id ?? '',
        script_type: t?.script_type || t?.section || 'full',
        audio_url: t?.audio_url || t?.audioUrl || t?.url,
        language: t?.language || t?.lang || lang,
      })),
      // Pass the answer-bearing fields through UNCHANGED and let the client resolve them
      // (src/lib/mcq/answerIndex.ts). This used to project each MCQ down to five fields,
      // which discarded `correct_option_text` — the only field that names the right answer
      // without relying on a base convention — along with the `option1..4` / `option_a..d`
      // scalars that the n8n curriculum path writes INSTEAD of an `options` array. For
      // every n8n-ingested lesson this endpoint therefore returned `options: []` and an
      // index with nothing to index into.
      mcqs: mcqsList.filter(Boolean).map((m: any) => ({
        ...m,
        id: m?.id ?? '',
        question: m?.question || m?.question_text,
        explanation: m?.explanation || '',
      })),
      avatarScripts,
      images: [],
      textTo3dAssets: [],
      pdf: null,
      _meta: { source: 'lesson-bundle-api' },
    };

    console.log(`[${requestId}] [lesson-bundle] chapter=${chapterId} topic=${topicId} -> skybox=${!!skyboxData} assets=${assets3d.length} tts=${bundle.tts.length} mcqs=${bundle.mcqs.length}`);
    return res.json(bundle);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}] [lesson-bundle] error:`, errMsg, err);
    return res.status(500).json({ error: 'Failed to load lesson bundle' });
  }
});

export default router;
