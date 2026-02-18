/**
 * PDF routes
 * GET /pdf/check-status/:id - Check PDF processing status (used by In3D integrations)
 * POST /pdf/extract-images - Extract images from a PDF (used by n8n/In3D workflows)
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as crypto from 'crypto';
import axios from 'axios';
import { validateReadAccess, validateFullAccess } from '../middleware/validateIn3dApiKey';
import { successResponse, errorResponse, ErrorCode, HTTP_STATUS } from '../utils/apiResponse';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const router = Router();

const PDF_SCALE = 2;
const MAX_PAGES = 100;

/**
 * Convert PDF buffer to array of PNG image buffers (one per page) using pdf-to-img.
 */
async function extractImagesFromPdfBuffer(pdfBuffer: Buffer): Promise<Buffer[]> {
  const dataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
  const { pdf } = await import('pdf-to-img');
  const document = await pdf(dataUrl, { scale: PDF_SCALE });
  const images: Buffer[] = [];
  let count = 0;
  for await (const image of document) {
    if (count >= MAX_PAGES) break;
    images.push(image as Buffer);
    count++;
  }
  return images;
}
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
      let pdfBuffer: Buffer;
      if (storage_path) {
        const bucket = getStorage().bucket();
        const file = bucket.file(storage_path);
        const [buf] = await file.download();
        pdfBuffer = Buffer.from(buf);
      } else if (pdf_url) {
        const response = await axios.get(String(pdf_url), {
          responseType: 'arraybuffer',
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024,
        });
        pdfBuffer = Buffer.from(response.data);
      } else {
        const { statusCode, response } = errorResponse(
          'Validation error',
          'Either pdf_url or storage_path must be provided',
          ErrorCode.MISSING_REQUIRED_FIELD,
          HTTP_STATUS.BAD_REQUEST,
          { requestId }
        );
        return res.status(statusCode).json(response);
      }

      const images = await extractImagesFromPdfBuffer(pdfBuffer);
      const docId = crypto.createHash('sha256').update(pdfBuffer).digest('hex').slice(0, 24);
      const bucket = getStorage().bucket();
      const imageEntries: { url: string; index: number }[] = [];

      for (let i = 0; i < images.length; i++) {
        const storagePath = `pdfs/${docId}/images/${i}.png`;
        const file = bucket.file(storagePath);
        await file.save(images[i], {
          metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
          public: true,
        });
        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        imageEntries.push({ url, index: i });
      }

      const db = getFirestore();
      await db.collection('pdfs').doc(docId).set(
        {
          status: 'completed',
          processing_status: 'completed',
          images: imageEntries,
          updatedAt: new Date().toISOString(),
          ...(storage_path && { storage_path }),
          ...(pdf_url && { pdf_url }),
        },
        { merge: true }
      );

      return res.json(
        successResponse(
          {
            id: docId,
            status: 'completed',
            images: imageEntries,
            image_count: imageEntries.length,
          },
          { requestId }
        )
      );
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
