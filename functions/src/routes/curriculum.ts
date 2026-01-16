/**
 * Curriculum-related routes
 * Handles saving curriculum chapters with generated skyboxes and 3D assets
 */

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { validateFullAccess } from '../middleware/validateIn3dApiKey';
import { successResponse, errorResponse, ErrorCode, HTTP_STATUS } from '../utils/apiResponse';

const router = Router();

/**
 * Save curriculum chapter with generated assets
 * POST /curriculum/save
 * Requires FULL scope API key
 */
router.post('/save', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { curriculum, class: classNum, subject, chapter_number, chapter_name, topics } = req.body;
    
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

    console.log(`[${requestId}] Saving curriculum chapter:`, {
      curriculum,
      class: classNum,
      subject,
      chapter_number,
      chapter_name,
      topics_count: topics.length
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
    
    // Generate document ID: {curriculum}_{class}_{subject}_ch{chapter_number}
    const documentId = `${curriculum}_${classNum}_${subject}_ch${chapter_number}`;
    
    // Prepare chapter data
    const chapterData: any = {
      curriculum,
      class: classNum,
      subject,
      chapter_number,
      chapter_name,
      topics: topics.map((topic: any) => {
        // Extract asset data if it's nested in an assets array
        const assets = topic.assets || [];
        const assetIds = assets.map((asset: any) => asset.asset_id).filter(Boolean);
        const assetUrls = assets.map((asset: any) => asset.asset_url).filter(Boolean);
        
        // Extract remix IDs from assets for regeneration
        const assetRemixIds = assets.map((asset: any) => asset.asset_remix_id || asset.asset_id).filter(Boolean);
        
        // Preserve ALL fields from topic including all MCQ fields (mcq1_*, mcq2_*, etc.)
        return {
          ...topic, // This preserves all original fields including MCQs
          // Ensure topic has required fields (only override if missing)
          topic_id: topic.topic_id || `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          skybox_id: topic.skybox_id || null,
          skybox_remix_id: topic.skybox_remix_id || topic.skybox_id || null, // For regeneration
          skybox_url: topic.skybox_url || null,
          asset_ids: assetIds.length > 0 ? assetIds : (topic.asset_ids || []),
          asset_remix_ids: assetRemixIds.length > 0 ? assetRemixIds : (topic.asset_remix_ids || []), // For regeneration
          asset_urls: assetUrls.length > 0 ? assetUrls : (topic.asset_urls || []),
          status: (topic.skybox_url || topic.skybox_id) && (assetIds.length > 0 || assetUrls.length > 0) ? 'generated' : 'pending',
          generatedAt: (topic.skybox_url || topic.skybox_id) || (assetIds.length > 0 || assetUrls.length > 0) 
            ? new Date().toISOString()  // Use ISO string - FieldValue.serverTimestamp() cannot be used in arrays
            : null
          // All MCQ fields (mcq1_question, mcq1_option1, mcq1_option2, mcq1_option3, mcq1_option4,
          // mcq1_correct_option_index, mcq1_correct_option_text, mcq1_explanation, mcq1_question_id,
          // and same for mcq2, mcq3, mcq4, mcq5) are preserved via ...topic spread operator
        };
      }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore
    const chapterRef = db.collection('curriculum_chapters').doc(documentId);
    await chapterRef.set(chapterData, { merge: true });

    console.log(`[${requestId}] ✅ Curriculum chapter saved: ${documentId}`);

    return res.status(HTTP_STATUS.OK).json(successResponse({
      documentId,
      curriculum,
      class: classNum,
      subject,
      chapter_number,
      chapter_name,
      topics_count: topics.length
    }, {
      requestId,
      message: 'Curriculum chapter saved successfully'
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
