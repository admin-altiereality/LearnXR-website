/**
 * PDF routes
 * GET /pdf/check-status/:id - Check PDF processing status (used by In3D integrations)
 * POST /pdf/extract-images - Extract images from a PDF (used by n8n/In3D workflows)
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import { validateReadAccess, validateFullAccess } from '../middleware/validateIn3dApiKey';
import { successResponse, errorResponse, ErrorCode, HTTP_STATUS } from '../utils/apiResponse';
import { getFirestore } from 'firebase-admin/firestore';

const router = Router();

/**
 * Check PDF processing status
 * GET /pdf/check-status/:id
 * Used by In3D platform to poll status of PDF processing jobs.
 * The id may be a Firestore pdf document ID or a job identifier.
 */
router.get('/check-status/:id', validateReadAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { id } = req.params;

  try {
    if (!id) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'ID is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    const db = getFirestore();
    const pdfRef = db.collection('pdfs').doc(id);
    const pdfSnap = await pdfRef.get();

    if (pdfSnap.exists) {
      const data = pdfSnap.data();
      // Map Firestore pdf doc to status response
      // Common fields: status, processing_status, images, etc.
      const status = (data?.status ?? data?.processing_status ?? 'completed') as string;
      const response = {
        status,
        id: pdfSnap.id,
        ...(data?.images && { image_count: Array.isArray(data.images) ? data.images.length : 0 }),
        ...(data?.processing_status && { processing_status: data.processing_status }),
      };
      return res.json(successResponse(response, { requestId }));
    }

    // PDF doc not found - return a standard status for polling clients
    // In3D or other clients may retry; returning 200 with not_found avoids 404
    return res.json(
      successResponse(
        {
          status: 'not_found',
          id,
          message: 'PDF processing job not found. It may not exist yet or may have expired.',
        },
        { requestId }
      )
    );
  } catch (error: any) {
    console.error(`[${requestId}] PDF check-status error:`, error);
    const { statusCode, response } = errorResponse(
      'Status check failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
});

/**
 * Extract images from a PDF
 * POST /pdf/extract-images
 * Body: { pdf_id?: string, pdf_url?: string, storage_path?: string }
 * - pdf_id: Firestore pdf document ID (returns existing images if already processed)
 * - pdf_url: URL to PDF (not yet implemented - returns 501)
 * - storage_path: Firebase Storage path (not yet implemented - returns 501)
 */
router.post('/extract-images', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { pdf_id, pdf_url, storage_path } = req.body || {};

  try {
    if (pdf_id) {
      const db = getFirestore();
      const pdfRef = db.collection('pdfs').doc(pdf_id);
      const pdfSnap = await pdfRef.get();

      if (pdfSnap.exists) {
        const data = pdfSnap.data();
        const images = Array.isArray(data?.images) ? data.images : [];
        return res.json(
          successResponse(
            {
              id: pdfSnap.id,
              status: images.length > 0 ? 'completed' : 'pending',
              images,
              image_count: images.length,
            },
            { requestId }
          )
        );
      }

      // PDF not found - return 200 with not_found so n8n workflows can continue
      return res.json(
        successResponse(
          {
            id: pdf_id,
            status: 'not_found',
            images: [],
            image_count: 0,
            message: `PDF document ${pdf_id} not found in Firestore. It may not exist yet or the ID may be incorrect.`,
          },
          { requestId }
        )
      );
    }

    if (pdf_url || storage_path) {
      const { statusCode, response } = errorResponse(
        'Not implemented',
        'PDF extraction from URL or storage path is not yet implemented. Use pdf_id with an existing Firestore pdf document.',
        ErrorCode.SERVICE_UNAVAILABLE,
        501,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    const { statusCode, response } = errorResponse(
      'Validation error',
      'At least one of pdf_id, pdf_url, or storage_path is required',
      ErrorCode.MISSING_REQUIRED_FIELD,
      HTTP_STATUS.BAD_REQUEST,
      { requestId }
    );
    return res.status(statusCode).json(response);
  } catch (error: any) {
    console.error(`[${requestId}] PDF extract-images error:`, error);
    const { statusCode, response } = errorResponse(
      'Extraction failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
});

export default router;
