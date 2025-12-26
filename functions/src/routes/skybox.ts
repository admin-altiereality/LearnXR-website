/**
 * Skybox-related routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { initializeServices, BLOCKADE_API_KEY } from '../utils/services';
import { incrementStyleUsage, getAllStyleUsageStats, getStyleUsageCounts } from '../utils/styleUsageTracker';
import { migrateStyleUsage } from '../scripts/migrateStyleUsage';

const router = Router();

// Skybox Styles API
router.get('/styles', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100; // Increased default limit
  
  try {
    console.log(`[${requestId}] Fetching skybox styles, page: ${page}, limit: ${limit}`);
    
    initializeServices();
    
    // Try BlockadeLabs API first
    if (BLOCKADE_API_KEY) {
      try {
        const response = await axios.get('https://backend.blockadelabs.com/api/v1/skybox/styles', {
          headers: {
            'x-api-key': BLOCKADE_API_KEY,
            'Content-Type': 'application/json'
          },
          params: { page, limit },
          timeout: 10000 // 10 second timeout
        });
        
        const styles = Array.isArray(response.data) ? response.data : [];
        console.log(`[${requestId}] Successfully fetched ${styles.length} styles from BlockadeLabs`);
        
        // Cache styles in Firestore for fallback
        if (styles.length > 0) {
          const db = admin.firestore();
          const batch = db.batch();
          styles.slice(0, 50).forEach((style: any) => { // Cache first 50 styles
            const styleId = style.id?.toString() || style.style_id?.toString() || `style-${Date.now()}-${Math.random()}`;
            const styleRef = db.collection('skyboxStyles').doc(styleId);
            batch.set(styleRef, {
              ...style,
              id: style.id || style.style_id,
              style_id: style.id || style.style_id,
              cachedAt: admin.firestore.FieldValue.serverTimestamp(),
              source: 'blockadelabs'
            }, { merge: true });
          });
          try {
            await batch.commit();
            console.log(`[${requestId}] Cached ${Math.min(styles.length, 50)} styles to Firestore`);
          } catch (cacheError) {
            console.warn(`[${requestId}] Failed to cache styles (non-critical):`, cacheError);
          }
        }
        
        return res.json({
          success: true,
          data: styles,
          pagination: {
            page,
            limit,
            total: styles.length
          },
          requestId
        });
      } catch (error: any) {
        console.error(`[${requestId}] BlockadeLabs API error:`, error.message || error);
        // Continue to Firestore fallback
      }
    }
    
    // Fallback: Get styles from Firebase cache
    const db = admin.firestore();
    const stylesRef = db.collection('skyboxStyles');
    const snapshot = await stylesRef
      .orderBy('cachedAt', 'desc')
      .limit(limit)
      .get();
    
    const styles = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: data.id || data.style_id || doc.id,
        style_id: data.id || data.style_id || doc.id,
        ...data
      };
    });
    
    console.log(`[${requestId}] Successfully fetched ${styles.length} styles from Firebase cache`);
    
    if (styles.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'Skybox styles are not available. Please check API configuration.',
        code: 'STYLES_UNAVAILABLE',
        requestId
      });
    }
    
    return res.json({
      success: true,
      data: styles,
      pagination: {
        page,
        limit,
        total: styles.length
      },
      requestId,
      source: 'firestore_cache'
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error fetching skybox styles:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch skybox styles',
      details: error.message || 'Unknown error',
      requestId
    });
  }
});

// Skybox Generation API
router.post('/generate', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { prompt, style_id, negative_prompt, userId, export_wireframe, mesh_density, depth_scale } = req.body;
  
  try {
    console.log(`[${requestId}] Skybox generation requested:`, { prompt, style_id, userId });
    
    initializeServices();
    
    if (!BLOCKADE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BlockadeLabs API not configured',
        requestId
      });
    }
    
    if (!prompt || !style_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: prompt and style_id',
        requestId
      });
    }
    
    // Construct webhook URL for completion notifications
    // Dynamically determine the webhook URL based on the request origin
    const projectId = process.env.GCLOUD_PROJECT || 'in3devoneuralai';
    const region = process.env.FUNCTION_REGION || 'us-central1';
    const webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/api/skybox/webhook`;
    console.log(`[${requestId}] Using webhook URL: ${webhookUrl}`);
    
    // Build request payload
    const payload: any = {
      prompt,
      style_id,
      negative_prompt: negative_prompt || '',
      webhook_url: webhookUrl
    };

    // Add wireframe export parameters if provided
    if (export_wireframe) {
      payload.export_glb = true;
      if (mesh_density) {
        payload.mesh_density = mesh_density;
      }
      if (depth_scale !== undefined && depth_scale !== null) {
        // Validate depth_scale range (3.0 to 10.0)
        const depthScaleValue = parseFloat(depth_scale);
        if (depthScaleValue >= 3.0 && depthScaleValue <= 10.0) {
          payload.depth_scale = depthScaleValue;
        } else {
          console.warn(`[${requestId}] Invalid depth_scale value: ${depth_scale}, using default 3.0`);
          payload.depth_scale = 3.0;
        }
      }
    }

    console.log(`[${requestId}] Sending skybox generation request with wireframe:`, {
      export_wireframe,
      mesh_density,
      depth_scale,
      payload_keys: Object.keys(payload)
    });

    const response = await axios.post('https://backend.blockadelabs.com/api/v1/skybox', payload, {
      headers: {
        'x-api-key': BLOCKADE_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    const generation = response.data;
    console.log(`[${requestId}] Generation created:`, generation.id);
    
    if (!generation.id) {
      console.error(`[${requestId}] No generation ID returned from BlockadeLabs API`);
      return res.status(500).json({
        success: false,
        error: 'No generation ID returned from API',
        requestId
      });
    }
    
    // Store generation in Firestore
    const db = admin.firestore();
    const generationIdStr = generation.id.toString();
    const skyboxData: any = {
      generationId: generation.id,
      id: generationIdStr, // Also store as 'id' for easier querying
      prompt,
      style_id: typeof style_id === 'string' ? parseInt(style_id, 10) : style_id,
      negative_prompt: negative_prompt || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookUrl: webhookUrl, // Store webhook URL for reference
      // Store wireframe export parameters
      exportWireframe: export_wireframe || false,
      meshDensity: mesh_density || null,
      depthScale: depth_scale || null
    };
    const resolvedUserId = userId || (req as any).user?.uid;
    if (resolvedUserId) {
      skyboxData.userId = resolvedUserId;
    }
    
    // Use set with merge to avoid overwriting existing data
    await db.collection('skyboxes').doc(generationIdStr).set(skyboxData, { merge: false });
    
    console.log(`[${requestId}] Skybox data stored in Firestore with ID: ${generationIdStr}`);
    
    return res.json({
      success: true,
      data: {
        generationId: generation.id,
        status: 'pending',
        ...generation
      },
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error generating skybox:`, error);
    
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 403) {
        let errorMessage = 'Generation quota exceeded';
        if (data && data.error) {
          if (data.error.includes('used every generation')) {
            errorMessage = 'API quota has been exhausted. Please contact support or try again later.';
          } else if (data.error.includes('generations are disabled')) {
            errorMessage = 'Skybox generation is temporarily disabled. Please try again later.';
          } else {
            errorMessage = data.error;
          }
        }
        
        return res.status(403).json({
          success: false,
          error: errorMessage,
          code: 'QUOTA_EXCEEDED',
          requestId
        });
      }
      
      if (status === 400) {
        return res.status(400).json({
          success: false,
          error: data?.error || 'Invalid request parameters',
          code: 'INVALID_REQUEST',
          requestId
        });
      }
      
      if (status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key or authentication failed',
          code: 'AUTH_ERROR',
          requestId
        });
      }
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate skybox',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Skybox Status API
router.get('/status/:generationId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  let { generationId } = req.params;
  
  try {
    generationId = generationId.toString();
    console.log(`[${requestId}] Checking status for generation: ${generationId}`);
    
    initializeServices();
    
    if (!BLOCKADE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BlockadeLabs API not configured',
        requestId
      });
    }
    
    if (!generationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing generation ID',
        requestId
      });
    }
    
    // Check Firestore first for cached data
    const db = admin.firestore();
    const firestoreDoc = await db.collection('skyboxes').doc(generationId).get();
    const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : null;
    
    // If Firestore has completed status with file URL, return it immediately
    if (firestoreData && firestoreData.status === 'completed' && firestoreData.fileUrl) {
      console.log(`[${requestId}] Returning cached completed status from Firestore`);
      return res.json({
        success: true,
        data: {
          id: generationId,
          generationId: firestoreData.generationId || generationId,
          status: 'completed',
          file_url: firestoreData.fileUrl,
          thumbnail_url: firestoreData.thumbnailUrl || firestoreData.fileUrl,
          prompt: firestoreData.prompt,
          style_id: firestoreData.style_id,
          ...firestoreData
        },
        requestId,
        source: 'firestore_cache'
      });
    }
    
    // Get generation status from BlockadeLabs API
    let generation;
    try {
      const response = await axios.get(`https://backend.blockadelabs.com/api/v1/skybox/generations/${generationId}`, {
        headers: {
          'x-api-key': BLOCKADE_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      generation = response.data;
      console.log(`[${requestId}] BlockadeLabs API response:`, {
        status: generation.status,
        hasFileUrl: !!generation.file_url,
        id: generation.id
      });
    } catch (apiError: any) {
      if (apiError.response?.status === 404) {
        console.log(`[${requestId}] Generation ${generationId} not found in BlockadeLabs API, checking Firestore`);
        
        if (firestoreData) {
          return res.json({
            success: true,
            data: {
              id: generationId,
              status: firestoreData.status || 'pending',
              file_url: firestoreData.fileUrl || firestoreData.imageUrl,
              thumbnail_url: firestoreData.thumbnailUrl,
              prompt: firestoreData.prompt,
              style_id: firestoreData.style_id,
              ...firestoreData
            },
            requestId,
            source: 'firestore_cache'
          });
        }
        
        return res.status(404).json({
          success: false,
          error: 'Generation not found',
          code: 'GENERATION_NOT_FOUND',
          message: 'The skybox generation does not exist. It may have expired or was never created. Please try generating a new skybox.',
          requestId
        });
      }
      throw apiError;
    }
    
    // Normalize status - BlockadeLabs statuses: pending, dispatched, processing, complete, abort, error
    // Map to our internal status: pending, processing, completed, failed
    let normalizedStatus = generation.status;
    if (generation.status === 'complete' || generation.status === 'completed') {
      normalizedStatus = 'completed';
    } else if (generation.status === 'dispatched' || generation.status === 'processing') {
      normalizedStatus = 'processing';
    } else if (generation.status === 'abort' || generation.status === 'error') {
      normalizedStatus = 'failed';
    }
    
    // Update Firestore with latest status
    const updateData: any = {
      status: normalizedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Check if generation is complete
    const isComplete = normalizedStatus === 'completed';
    
    if (isComplete && generation.file_url) {
      updateData.fileUrl = generation.file_url;
      updateData.thumbnailUrl = generation.thumbnail_url || generation.file_url;
      updateData.imageUrl = generation.file_url;
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
      console.log(`[${requestId}] Generation completed, file URL: ${generation.file_url}`);
    } else if (generation.status === 'error' || generation.status === 'abort') {
      updateData.errorMessage = generation.error_message || generation.error || 'Generation failed';
      updateData.failedAt = admin.firestore.FieldValue.serverTimestamp();
      console.log(`[${requestId}] Generation failed: ${updateData.errorMessage}`);
    }
    
    // Check if this is a new completion (status changed from non-completed to completed)
    const wasCompleted = firestoreData?.status === 'completed';
    const isNewCompletion = isComplete && !wasCompleted;
    
    // Always update Firestore, even if status hasn't changed (for lastCheckedAt)
    await db.collection('skyboxes').doc(generationId).set(updateData, { merge: true });
    
    // If status changed to completed, also update the 'id' field if it exists
    if (isComplete) {
      await db.collection('skyboxes').doc(generationId).update({
        id: generationId,
        generationId: generation.id || generationId
      });
      
      // Track style usage when skybox is newly completed
      if (isNewCompletion) {
        // Try to get style_id from multiple sources
        const styleId = firestoreData?.style_id || updateData.style_id || generation.style_id;
        if (styleId) {
          console.log(`[${requestId}] Tracking style usage for style ${styleId}`);
          await incrementStyleUsage(styleId, 1);
        } else {
          console.warn(`[${requestId}] Cannot track style usage: style_id not found for generation ${generationId}`);
        }
      }
    }
    
    console.log(`[${requestId}] Firestore updated with status: ${normalizedStatus} (original: ${generation.status})`);
    
    // Return normalized status in response
    const responseData = {
      ...generation,
      status: normalizedStatus
    };
    
    return res.json({
      success: true,
      data: responseData,
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error checking skybox status:`, error);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found',
        code: 'GENERATION_NOT_FOUND',
        message: 'The skybox generation does not exist. It may have expired or was never created. Please try generating a new skybox.',
        requestId
      });
    }
    
    if (error.response) {
      const { status, data } = error.response;
      return res.status(status).json({
        success: false,
        error: data?.error || `BlockadeLabs API error (${status})`,
        code: `BLOCKADE_API_ERROR_${status}`,
        details: data?.message || error.message,
        requestId
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check skybox status',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Skybox Webhook API - Receives completion notifications from BlockadeLabs
router.post('/webhook', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || `webhook-${Date.now()}`;
  
  try {
    console.log(`[${requestId}] Webhook received from BlockadeLabs:`, req.body);
    
    const webhookData = req.body;
    const generationId = webhookData.id || webhookData.generation_id;
    
    if (!generationId) {
      console.error(`[${requestId}] Webhook missing generation ID`);
      return res.status(400).json({
        success: false,
        error: 'Missing generation ID',
        requestId
      });
    }
    
    const db = admin.firestore();
    const firestoreDoc = await db.collection('skyboxes').doc(generationId.toString()).get();
    
    if (!firestoreDoc.exists) {
      console.warn(`[${requestId}] Webhook received for unknown generation: ${generationId}`);
      // Still acknowledge the webhook
      return res.json({
        success: true,
        message: 'Webhook received but generation not found in Firestore',
        requestId
      });
    }
    
    // Normalize status
    let normalizedStatus = webhookData.status;
    if (webhookData.status === 'complete' || webhookData.status === 'completed') {
      normalizedStatus = 'completed';
    } else if (webhookData.status === 'dispatched' || webhookData.status === 'processing') {
      normalizedStatus = 'processing';
    } else if (webhookData.status === 'abort' || webhookData.status === 'error') {
      normalizedStatus = 'failed';
    }
    
    // Update Firestore with webhook data
    const updateData: any = {
      status: normalizedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // If complete, update file URLs
    if (normalizedStatus === 'completed' && webhookData.file_url) {
      updateData.fileUrl = webhookData.file_url;
      updateData.thumbnailUrl = webhookData.thumbnail_url || webhookData.file_url;
      updateData.imageUrl = webhookData.file_url;
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
      console.log(`[${requestId}] Webhook: Generation ${generationId} completed, file URL: ${webhookData.file_url}`);
    } else if (normalizedStatus === 'failed') {
      updateData.errorMessage = webhookData.error_message || webhookData.error || 'Generation failed';
      updateData.failedAt = admin.firestore.FieldValue.serverTimestamp();
      console.log(`[${requestId}] Webhook: Generation ${generationId} failed: ${updateData.errorMessage}`);
    }
    
    // Check if this is a new completion (status changed from non-completed to completed)
    const wasCompleted = firestoreDoc.data()?.status === 'completed';
    const isNewCompletion = normalizedStatus === 'completed' && !wasCompleted;
    
    await db.collection('skyboxes').doc(generationId.toString()).set(updateData, { merge: true });
    
    // If completed, ensure id and generationId fields are set
    if (normalizedStatus === 'completed') {
      await db.collection('skyboxes').doc(generationId.toString()).update({
        id: generationId.toString(),
        generationId: generationId
      });
      
      // Track style usage when skybox is newly completed via webhook
      if (isNewCompletion) {
        // Try to get style_id from multiple sources
        const firestoreData = firestoreDoc.data();
        const styleId = firestoreData?.style_id || updateData.style_id || webhookData.style_id;
        if (styleId) {
          console.log(`[${requestId}] Webhook: Tracking style usage for style ${styleId}`);
          await incrementStyleUsage(styleId, 1);
        } else {
          console.warn(`[${requestId}] Webhook: Cannot track style usage: style_id not found for generation ${generationId}`);
        }
      }
    }
    
    console.log(`[${requestId}] Webhook processed successfully for generation: ${generationId}, status: ${normalizedStatus}`);
    
    // Acknowledge webhook
    return res.json({
      success: true,
      message: 'Webhook processed',
      generationId,
      status: normalizedStatus,
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error processing webhook:`, error);
    
    // Still acknowledge webhook to prevent retries
    return res.status(200).json({
      success: false,
      error: 'Webhook received but processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Skybox History API
router.get('/history', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const userId = (req as any).user?.uid;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  try {
    console.log(`[${requestId}] Fetching skybox history for user: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
        requestId
      });
    }
    
    const db = admin.firestore();
    const skyboxesRef = db.collection('skyboxes');
    const snapshot = await skyboxesRef
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .get();
    
    const skyboxes = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));
    
    console.log(`[${requestId}] Found ${skyboxes.length} skyboxes for user`);
    
    return res.json({
      success: true,
      data: skyboxes,
      pagination: {
        page,
        limit,
        total: skyboxes.length
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error fetching skybox history:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch skybox history',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

/**
 * Get style usage statistics
 * GET /api/skybox/style-usage
 */
router.get('/style-usage', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || `style-usage-${Date.now()}`;
  
  try {
    console.log(`[${requestId}] Fetching style usage statistics`);
    
    const styleIds = req.query.styleIds ? (req.query.styleIds as string).split(',').map(id => id.trim()) : null;
    
    let usageStats: Record<string, number>;
    
    if (styleIds && styleIds.length > 0) {
      // Get usage for specific styles
      usageStats = await getStyleUsageCounts(styleIds);
    } else {
      // Get all style usage stats
      usageStats = await getAllStyleUsageStats();
    }
    
    return res.json({
      success: true,
      data: {
        usageStats
      },
      message: `Retrieved usage statistics for ${Object.keys(usageStats).length} styles`,
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error fetching style usage statistics:`, error);
    
    return res.status(500).json({
      success: false,
      error: 'SERVICE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch style usage statistics',
      requestId
    });
  }
});

/**
 * Migrate style usage statistics from existing skyboxes
 * POST /api/skybox/migrate-style-usage
 * Query params: dryRun=true (optional, default: false)
 */
router.post('/migrate-style-usage', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || `migrate-${Date.now()}`;
  
  try {
    const dryRun = req.query.dryRun === 'true' || req.query.dryRun === '1';
    
    console.log(`[${requestId}] Starting style usage migration`);
    console.log(`   Dry run: ${dryRun}`);
    console.log(`   User: ${(req as any).user?.uid || 'system'}`);
    
    // Run migration
    const result = await migrateStyleUsage(dryRun);
    
    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      data: {
        totalSkyboxes: result.totalSkyboxes,
        completedSkyboxes: result.completedSkyboxes,
        stylesProcessed: result.stylesProcessed,
        styleCounts: result.styleCounts,
        errors: result.errors,
        dryRun
      },
      message: dryRun 
        ? `Migration dry run completed. Found ${result.stylesProcessed} unique styles.`
        : `Migration completed successfully. Processed ${result.stylesProcessed} styles.`,
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error during migration:`, error);
    
    return res.status(500).json({
      success: false,
      error: 'MIGRATION_ERROR',
      message: error instanceof Error ? error.message : 'Migration failed',
      requestId
    });
  }
});

export default router;

