/**
 * Curriculum-related routes
 * Handles saving curriculum chapters with generated skyboxes and 3D assets
 */

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { validateFullAccess } from '../middleware/validateIn3dApiKey';
import { successResponse, errorResponse, ErrorCode, HTTP_STATUS } from '../utils/apiResponse';
import TextToSpeechService from '../services/textToSpeechService';

const router = Router();

/** Recursively replace undefined with null - Firestore rejects undefined */
function stripUndefined<T>(obj: T): T {
  if (obj === undefined) return null as T;
  if (obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as T;
  if (typeof obj === 'object' && obj !== null) {
    // Skip Date, Firestore FieldValue, and other non-plain objects
    if (obj instanceof Date) return obj;
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype && !Array.isArray(obj)) return obj;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = v === undefined ? null : stripUndefined(v);
    }
    return result as T;
  }
  return obj;
}

/**
 * Save curriculum chapter with generated assets
 * POST /curriculum/save
 * Requires FULL scope API key
 */
router.post('/save', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { 
      curriculum, 
      class: classNum, 
      subject, 
      chapter_number, 
      chapter_name, 
      topics,
      pdf_images,      // PDF images array from Group by Topic node
      pdf_id,          // PDF identifier
      pdf_hash,        // PDF hash
      image3dasset,    // 3D asset generated from PDF image
      chapter_id,      // Topic-specific chapter ID (e.g., cbse_6_social science_ch1_topic1)
      topic_number,    // Topic number (1, 2, etc.)
      chapter_name_by_language,  // { en: string, hi: string }
      supported_languages,       // ["en", "hi"]
      pdf_storage_url,
      pdf_normalized_text,
      pdf_text_hash
    } = req.body;
    
    // Validate required fields
    if (!curriculum || !classNum || !subject || !chapter_number || !chapter_name) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Missing required fields: curriculum, class, subject, chapter_number, and chapter_name are required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Topics array is required and must not be empty',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    // Extract and validate PDF images
    let validatedPdfImages: any[] = [];
    let validatedPdfId: string | null = null;
    let validatedPdfHash: string | null = null;
    
    if (pdf_images && Array.isArray(pdf_images) && pdf_images.length > 0) {
      validatedPdfHash = pdf_hash || pdf_id;
      validatedPdfId = pdf_id || pdf_hash;
      
      // Validate that all images have required structure (url is required)
      validatedPdfImages = pdf_images.filter((img: any) => {
        if (!img.url || typeof img.url !== 'string') {
          console.warn(`[${requestId}] ⚠️ Invalid image structure, missing URL:`, img);
          return false;
        }
        return true;
      });
      
      // If PDF hash is provided, optionally verify images match the PDF document in Firebase
      if (validatedPdfHash && validatedPdfImages.length > 0) {
        try {
          const dbCheck = admin.firestore();
          const pdfRef = dbCheck.collection('pdfs').doc(validatedPdfHash);
          const pdfDoc = await pdfRef.get();
          
          if (pdfDoc.exists) {
            const pdfData = pdfDoc.data();
            const storedImages = pdfData?.images || [];
            
            if (storedImages.length > 0) {
              const storedImageUrls = new Set(storedImages.map((img: any) => img.url));
              
              // Verify all provided images exist in stored PDF
              const allImagesMatch = validatedPdfImages.every((img: any) => storedImageUrls.has(img.url));
              
              if (allImagesMatch) {
                console.log(`[${requestId}] ✅ All ${validatedPdfImages.length} PDF images validated against stored PDF document`);
              } else {
                console.warn(`[${requestId}] ⚠️ Some PDF images don't match stored PDF document. Storing anyway.`);
              }
            }
          }
        } catch (pdfCheckError: any) {
          console.warn(`[${requestId}] ⚠️ Could not verify PDF images against stored document:`, pdfCheckError.message);
          // Continue anyway - images will still be stored
        }
      }
      
      console.log(`[${requestId}] 📄 PDF images: ${validatedPdfImages.length} valid images from PDF ${validatedPdfHash}`);
    }

    console.log(`[${requestId}] Saving curriculum chapter:`, {
      curriculum,
      class: classNum,
      subject,
      chapter_number,
      chapter_name,
      topics_count: topics.length,
      pdf_images_count: validatedPdfImages.length,
      pdf_hash: validatedPdfHash
    });
    
    // Log MCQ fields presence for debugging
    if (topics.length > 0 && topics[0]) {
      const firstTopic = topics[0];
      const mcqFields = Object.keys(firstTopic).filter(key => key.startsWith('mcq'));
      if (mcqFields.length > 0) {
        console.log(`[${requestId}] ✅ MCQ fields detected: ${mcqFields.length} fields (e.g., ${mcqFields.slice(0, 3).join(', ')})`);
      }
    }

    const db = admin.firestore();
    
    // Generate document ID: supports topic-specific IDs like cbse_6_social science_ch1_topic1
    let documentId: string;
    
    if (chapter_id && typeof chapter_id === 'string') {
      // Use provided chapter_id directly (already includes topic number)
      documentId = chapter_id;
      console.log(`[${requestId}] 📝 Using provided chapter_id: ${documentId}`);
    } else if (topic_number) {
      // Construct topic-specific ID: {curriculum}_{class}_{subject}_ch{chapter_number}_topic{topic_number}
      documentId = `${curriculum}_${classNum}_${subject}_ch${chapter_number}_topic${topic_number}`;
      console.log(`[${requestId}] 📝 Generated topic-specific ID: ${documentId}`);
    } else {
      // Fallback to chapter-only ID (legacy format)
      documentId = `${curriculum}_${classNum}_${subject}_ch${chapter_number}`;
      console.log(`[${requestId}] 📝 Using chapter-only ID (legacy): ${documentId}`);
    }
    
    // Supported languages: from payload or derive from content
    const LANG_CODES = ['en', 'hi'] as const;
    const inferredLangs = Array.isArray(supported_languages) && supported_languages.length > 0
      ? supported_languages.filter((l: string) => LANG_CODES.includes(l as any))
      : LANG_CODES;
    const langsToProcess: readonly string[] = inferredLangs.length > 0 ? inferredLangs : LANG_CODES;

    // Helper function to generate TTS with error handling (doesn't halt process)
    const generateTTSWithErrorHandling = async (
      text: string,
      ttsId: string,
      scriptType: 'intro' | 'explanation' | 'outro'
    ): Promise<string | null> => {
      try {
        if (!text || text.trim().length === 0) {
          console.log(`[${requestId}] ⚠️ Empty text for TTS ${scriptType}, skipping`);
          return null;
        }

        const ttsService = new TextToSpeechService();
        const filename = `tts_${documentId}_${ttsId}_${scriptType}_${Date.now()}.wav`;
        const audioUrl = await ttsService.generateWavFile(text, filename, 'nova');
        
        console.log(`[${requestId}] ✅ TTS generated for ${scriptType}: ${audioUrl}`);
        return audioUrl;
      } catch (error: any) {
        // Log error but don't throw - automation should continue
        console.error(`[${requestId}] ⚠️ TTS generation failed for ${scriptType} (non-blocking):`, error.message);
        return null;
      }
    };

    // Process topics and store meshy assets, MCQs, and images in separate collections
    const processedTopics: any[] = [];
    const meshyAssetIds: string[] = [];
    const imageIds: string[] = [];
    const mcqIds: string[] = [];
    const ttsIds: string[] = [];
    const mcqIdsByLanguage: Record<string, string[]> = { en: [], hi: [] };
    const ttsIdsByLanguage: Record<string, string[]> = { en: [], hi: [] };
    const skyboxGlbUrls: string[] = [];
    const meshyGlbUrls: string[] = [];

    for (const topic of topics) {
      const topicId = topic.topic_id || `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 1. Store Meshy 3D Assets in separate collection
      const assets = topic.assets || [];
      const topicAssetIds: string[] = [...(topic.asset_ids || [])];
      
      for (const asset of assets) {
        if (asset.asset_id) {
          const assetId = asset.asset_id;
          if (!topicAssetIds.includes(assetId)) topicAssetIds.push(assetId);
          
          // Store in meshy_assets collection
          const meshyAssetRef = db.collection('meshy_assets').doc(assetId);
          const glbUrl = asset.textured_model_glb || asset.final_asset_url || asset.asset_url;
          if (glbUrl) meshyGlbUrls.push(glbUrl);
          
          const meshyAssetData = {
            asset_id: assetId,
            chapter_id: documentId,
            topic_id: topicId,
            prompt: asset.prompt || topic.in3d_prompt || '',
            downloadUrl: asset.downloadUrl || null,
            previewUrl: asset.previewUrl || null,
            final_asset_url: asset.final_asset_url || null,
            textured_model_glb: asset.textured_model_glb || null,
            textured_model_fbx: asset.textured_model_fbx || null,
            textured_model_usdz: asset.textured_model_usdz || null,
            asset_url: asset.asset_url || null,
            format: asset.format || null,
            size: asset.size || null,
            status: asset.status || 'completed',
            asset_remix_id: asset.asset_remix_id || null,
            metadata: asset.metadata || {},
            groundingMetadata: asset.groundingMetadata || {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await meshyAssetRef.set(meshyAssetData, { merge: true });
          if (!meshyAssetIds.includes(assetId)) meshyAssetIds.push(assetId);
          console.log(`[${requestId}] ✅ Meshy asset stored: ${assetId}`);
        }
      }
      
      // Collect skybox GLB URL if provided
      const skyboxStoredGlb = topic.skybox_stored_glb_url || topic.skybox_glb_url;
      if (skyboxStoredGlb) skyboxGlbUrls.push(skyboxStoredGlb);

      // 2. Store MCQs in separate collection
      // Support: (a) mcqs_by_language { en: [...], hi: [...] } (b) mcqs array (c) mcq1_question...
      const topicMcqIds: string[] = [];
      const topicMcqIdsByLanguage: Record<string, string[]> = { en: [], hi: [] };

      const storeMcq = async (m: any, mcqId: string, lang: string, mcqNum: number) => {
        const opts = Array.isArray(m.options) ? m.options : [];
        let correctIdx = m.correct_index ?? m.correctIndex;
        if (correctIdx == null || correctIdx < 0) {
          const found = opts.findIndex((o: any) => o.correct === true || o.correct === 'true');
          correctIdx = found >= 0 ? found : 0;
        }
        const question = typeof m.question === 'string' ? m.question : (m.text || '');
        const mcqData = {
          mcq_id: mcqId,
          chapter_id: documentId,
          topic_id: topicId,
          question_id: mcqId,
          question: question.trim(),
          option1: opts[0]?.text ?? opts[0] ?? null,
          option2: opts[1]?.text ?? opts[1] ?? null,
          option3: opts[2]?.text ?? opts[2] ?? null,
          option4: opts[3]?.text ?? opts[3] ?? null,
          correct_option_index: correctIdx >= 0 ? correctIdx : null,
          correct_option_text: opts[correctIdx]?.text ?? opts[correctIdx] ?? null,
          explanation: m.explanation ?? null,
          mcq_number: mcqNum,
          language: lang,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('chapter_mcqs').doc(mcqId).set(mcqData, { merge: true });
        topicMcqIds.push(mcqId);
        mcqIds.push(mcqId);
        if (!topicMcqIdsByLanguage[lang]) topicMcqIdsByLanguage[lang] = [];
        if (!mcqIdsByLanguage[lang]) mcqIdsByLanguage[lang] = [];
        topicMcqIdsByLanguage[lang].push(mcqId);
        mcqIdsByLanguage[lang].push(mcqId);
        console.log(`[${requestId}] ✅ MCQ stored (${lang}): ${mcqId}`);
      };

      const mcqsByLang = topic.mcqs_by_language || {};
      const hasMcqsByLanguage = Object.keys(mcqsByLang).some(k => Array.isArray(mcqsByLang[k]) && mcqsByLang[k].length > 0);

      if (hasMcqsByLanguage) {
        for (const lang of langsToProcess) {
          const arr = Array.isArray(mcqsByLang[lang]) ? mcqsByLang[lang] : [];
          for (let i = 0; i < Math.min(arr.length, 5); i++) {
            const m = arr[i];
            const question = typeof m.question === 'string' ? m.question : (m.text || '');
            if (!question.trim()) continue;
            const slug = question.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40);
            const mcqId = m.id || m.question_id || `q${i + 1}_${slug}`;
            await storeMcq(m, mcqId, lang, i + 1);
          }
        }
      } else {
        const mcqsArray = topic.mcqs && Array.isArray(topic.mcqs) ? topic.mcqs : [];
        if (mcqsArray.length > 0) {
          for (let i = 0; i < Math.min(mcqsArray.length, 5); i++) {
            const m = mcqsArray[i];
            const question = typeof m.question === 'string' ? m.question : (m.text || '');
            if (!question.trim()) continue;
            const mcqId = m.id || m.question_id || `${topicId}_q${i + 1}`;
            await storeMcq(m, mcqId, 'en', i + 1);
          }
        } else {
          for (let i = 1; i <= 5; i++) {
            const questionKey = `mcq${i}_question`;
            const questionIdKey = `mcq${i}_question_id`;
            if (topic[questionKey]) {
              const mcqId = topic[questionIdKey] || `${topicId}_mcq${i}`;
              topicMcqIds.push(mcqId);
              const mcqData = {
                mcq_id: mcqId,
                chapter_id: documentId,
                topic_id: topicId,
                question_id: mcqId,
                question: topic[questionKey],
                option1: topic[`mcq${i}_option1`] || null,
                option2: topic[`mcq${i}_option2`] || null,
                option3: topic[`mcq${i}_option3`] || null,
                option4: topic[`mcq${i}_option4`] || null,
                correct_option_index: topic[`mcq${i}_correct_option_index`] ?? null,
                correct_option_text: topic[`mcq${i}_correct_option_text`] || null,
                explanation: topic[`mcq${i}_explanation`] || null,
                mcq_number: i,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              await db.collection('chapter_mcqs').doc(mcqId).set(mcqData, { merge: true });
              mcqIds.push(mcqId);
              topicMcqIdsByLanguage.en.push(mcqId);
              mcqIdsByLanguage.en.push(mcqId);
              console.log(`[${requestId}] ✅ MCQ stored: ${mcqId}`);
            }
          }
        }
      }

      // 3. Generate and store TTS for avatar scripts (multi-language)
      // Support: avatar_scripts_by_language.{en,hi}.{intro,explanation,outro}, topic_avatar_*, topic_avatar_scripts
      const topicTtsIds: string[] = [];
      const topicTtsIdsByLanguage: Record<string, string[]> = { en: [], hi: [] };
      const scriptTypes = ['intro', 'explanation', 'outro'] as const;

      const getScriptForLang = (lang: string, field: 'intro' | 'explanation' | 'outro'): string | null => {
        const byLang = topic.avatar_scripts_by_language?.[lang] || topic.topic_avatar_scripts?.[lang];
        if (byLang?.[field] && typeof byLang[field] === 'string' && String(byLang[field]).trim())
          return String(byLang[field]).trim();
        if (lang === 'en') {
          const flat = topic[`topic_avatar_${field}`];
          if (flat && typeof flat === 'string' && flat.trim()) return flat.trim();
        }
        return null;
      };

      for (const lang of langsToProcess) {
        for (const scriptType of scriptTypes) {
          const text = getScriptForLang(lang, scriptType);
          if (!text || text.trim().length === 0) continue;

          const ttsId = `${topicId}_${scriptType}_${lang}_female_professional`;
          const audioUrl = await generateTTSWithErrorHandling(text, ttsId, scriptType);

          const ttsData: any = {
            tts_id: ttsId,
            chapter_id: documentId,
            topic_id: topicId,
            script_type: scriptType,
            script_text: text,
            language: lang,
            audio_url: audioUrl,
            audio_format: 'wav',
            status: audioUrl ? 'completed' : 'failed',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          if (!audioUrl) ttsData.error = 'TTS generation failed (non-blocking)';

          const ttsRef = db.collection('chapter_tts').doc(ttsId);
          await ttsRef.set(ttsData, { merge: true });

          topicTtsIds.push(ttsId);
          ttsIds.push(ttsId);
          if (!topicTtsIdsByLanguage[lang]) topicTtsIdsByLanguage[lang] = [];
          if (!ttsIdsByLanguage[lang]) ttsIdsByLanguage[lang] = [];
          topicTtsIdsByLanguage[lang].push(ttsId);
          ttsIdsByLanguage[lang].push(ttsId);
          console.log(`[${requestId}] ✅ TTS stored (${lang}): ${ttsId}`);
        }
      }

      // 4. Prepare topic data with references to separate collections (schema like previous save-lesson)
      const topicData: any = {
        topic_id: topicId,
        topic_name: topic.topic_name ?? null,
        topic_priority: topic.topic_priority ?? null,
        learning_objective: topic.learning_objective ?? null,
        topic_avatar_intro: topic.topic_avatar_intro ?? null,
        topic_avatar_explanation: topic.topic_avatar_explanation ?? null,
        topic_avatar_outro: topic.topic_avatar_outro ?? null,
        topic_name_by_language: topic.topic_name_by_language || (topic.topic_name ? { en: topic.topic_name } : null),
        learning_objective_by_language: topic.learning_objective_by_language || (topic.learning_objective ? { en: topic.learning_objective } : null),
        avatar_scripts_by_language: topic.avatar_scripts_by_language || topic.topic_avatar_scripts || null,
        scene_type: topic.scene_type ?? null,
        in3d_prompt: topic.in3d_prompt ?? null,
        asset_list: topic.asset_list || [],
        asset_ids: topicAssetIds,
        camera_guidance: topic.camera_guidance ?? null,
        negative_text: topic.negative_text ?? null,
        negative_text_short: topic.negative_text_short ?? null,
        skybox_id: topic.skybox_id || null,
        skybox_remix_id: topic.skybox_remix_id || topic.skybox_id || null,
        skybox_url: topic.skybox_url || null,
        skybox_stored_glb_url: topic.skybox_stored_glb_url || topic.skybox_glb_url || null,
        meshy_asset_ids: topicAssetIds,
        mcq_ids: topicMcqIds,
        tts_ids: topicTtsIds,
        mcq_ids_by_language: Object.keys(topicMcqIdsByLanguage).length > 0 ? topicMcqIdsByLanguage : null,
        tts_ids_by_language: Object.keys(topicTtsIdsByLanguage).length > 0 ? topicTtsIdsByLanguage : null,
        sharedAssets: topicAssetIds.length > 0 ? { asset_ids: topicAssetIds, meshy_asset_ids: topicAssetIds } : null,
        status: (topic.skybox_url || topic.skybox_id) && topicAssetIds.length > 0 ? 'generated' : 'pending',
        generatedAt: (topic.skybox_url || topic.skybox_id) || topicAssetIds.length > 0 ? new Date().toISOString() : null
      };
      processedTopics.push(topicData);
    }

    // 5. Store PDF images in separate collection (chapter-level, not topic-level)
    if (validatedPdfImages.length > 0) {
      for (let i = 0; i < validatedPdfImages.length; i++) {
        const img = validatedPdfImages[i];
        const imageId = `img_${documentId}_${i}_${Date.now()}`;
        imageIds.push(imageId);
        
        // Store in chapter_images collection
        const imageRef = db.collection('chapter_images').doc(imageId);
        const imageData = {
          image_id: imageId,
          chapter_id: documentId,
          url: img.url,
          width: img.width || null,
          height: img.height || null,
          page_number: img.page_number || i + 1,
          pdf_id: validatedPdfId,
          pdf_hash: validatedPdfHash,
          metadata: img.metadata || {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await imageRef.set(imageData, { merge: true });
        console.log(`[${requestId}] ✅ Image stored: ${imageId}`);
      }
    }

    // Build chapter_name_by_language
    const chapterNameByLang = chapter_name_by_language && typeof chapter_name_by_language === 'object'
      ? chapter_name_by_language
      : { en: chapter_name, hi: chapter_name_by_language?.hi || null };

    // Prepare chapter data - schema matching previous save-lesson flow
    const chapterData: any = {
      curriculum,
      class: classNum,
      subject,
      chapter_number,
      chapter_name,
      chapter_name_by_language: chapterNameByLang,
      topic_number: topic_number || null,
      topics: processedTopics,
      // Approval fields (initial state)
      approved: false,
      approvedAt: null,
      approvedBy: null,
      // Multi-language
      supported_languages: langsToProcess,
      moi: 'en',
      // Legacy + new ID arrays
      meshy_asset_ids: meshyAssetIds,
      mcq_ids: mcqIds,
      tts_ids: ttsIds,
      image_ids: imageIds,
      mcq_ids_by_language: Object.keys(mcqIdsByLanguage).length > 0 ? mcqIdsByLanguage : null,
      tts_ids_by_language: Object.keys(ttsIdsByLanguage).length > 0 ? ttsIdsByLanguage : null,
      // Shared assets (schema like previous save-lesson)
      sharedAssets: {
        image_ids: imageIds,
        meshy_asset_ids: meshyAssetIds,
        skybox_glb_urls: skyboxGlbUrls,
        meshy_glb_urls: meshyGlbUrls,
      },
      skybox_glb_urls: skyboxGlbUrls.length > 0 ? skyboxGlbUrls : [],
      meshy_glb_urls: meshyGlbUrls.length > 0 ? meshyGlbUrls : [],
      // PDF metadata
      pdf_id: validatedPdfId,
      pdf_hash: validatedPdfHash,
      pdf_images_count: validatedPdfImages.length,
      pdf_images_validated_at: validatedPdfImages.length > 0 
        ? admin.firestore.FieldValue.serverTimestamp() 
        : null,
      pdf_storage_url: pdf_storage_url || null,
      pdf_stored_at: (pdf_storage_url || validatedPdfId) ? admin.firestore.FieldValue.serverTimestamp() : null,
      pdf_normalized_text: pdf_normalized_text ?? null,
      pdf_text_hash: pdf_text_hash ?? null,
      pdf_images_approved: 0,
      pdf_images_generated: 0,
      pdf_images_pending_approval: validatedPdfImages.length > 0 ? validatedPdfImages.length : 0,
      pdf_images_rejected: 0,
      // Text-to-3D assets (placeholders)
      text_to_3d_asset_ids: [],
      text_to_3d_assets_approved: 0,
      text_to_3d_assets_generated: 0,
      text_to_3d_assets_pending_approval: 0,
      text_to_3d_assets_rejected: 0,
      texture_request_ids: [],
      texture_requests_approved: 0,
      texture_requests_generated: 0,
      texture_requests_pending_approval: 0,
      texture_requests_rejected: 0,
      // 3D asset from PDF image
      image3dasset: image3dasset || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore (strip undefined - Firestore rejects it)
    const chapterRef = db.collection('curriculum_chapters').doc(documentId);
    await chapterRef.set(stripUndefined(chapterData), { merge: true });

    const hasImage3dAsset = image3dasset && image3dasset.asset_id;
    console.log(`[${requestId}] ✅ Curriculum chapter saved: ${documentId}`);
    console.log(`[${requestId}]   - Topics: ${processedTopics.length}`);
    console.log(`[${requestId}]   - Meshy assets: ${meshyAssetIds.length}`);
    console.log(`[${requestId}]   - MCQs: ${mcqIds.length}`);
    console.log(`[${requestId}]   - TTS files: ${ttsIds.length}`);
    console.log(`[${requestId}]   - Images: ${imageIds.length}`);

    return res.status(HTTP_STATUS.OK).json(successResponse({
      documentId,
      curriculum,
      class: classNum,
      subject,
      chapter_number,
      chapter_name,
      topic_number: topic_number || null,
      topics_count: processedTopics.length,
      meshy_assets_count: meshyAssetIds.length,
      mcqs_count: mcqIds.length,
      tts_files_count: ttsIds.length,
      images_count: imageIds.length,
      pdf_images_count: validatedPdfImages.length,
      pdf_hash: validatedPdfHash,
      has_image3dasset: hasImage3dAsset,
      // Return IDs for reference
      meshy_asset_ids: meshyAssetIds,
      mcq_ids: mcqIds,
      tts_ids: ttsIds,
      image_ids: imageIds
    }, {
      requestId,
      message: 'Curriculum chapter saved successfully with separate collections'
    }));

  } catch (error: any) {
    console.error(`[${requestId}] Error saving curriculum:`, error);
    
    const { statusCode, response } = errorResponse(
      'Save failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
});

/**
 * Get curriculum chapter
 * GET /curriculum/:documentId
 */
router.get('/:documentId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { documentId } = req.params;
    
    if (!documentId) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Document ID is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    const db = admin.firestore();
    const chapterRef = db.collection('curriculum_chapters').doc(documentId);
    const chapterDoc = await chapterRef.get();

    if (!chapterDoc.exists) {
      const { statusCode, response } = errorResponse(
        'Not found',
        'Curriculum chapter not found',
        ErrorCode.NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    return res.status(HTTP_STATUS.OK).json(successResponse(chapterDoc.data(), {
      requestId,
      message: 'Curriculum chapter retrieved successfully'
    }));

  } catch (error: any) {
    console.error(`[${requestId}] Error retrieving curriculum:`, error);
    
    const { statusCode, response } = errorResponse(
      'Retrieval failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
});

export default router;
