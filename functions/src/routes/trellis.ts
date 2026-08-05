/**
 * Trellis 2 API proxy routes.
 *
 * Keeps the Trellis API key server-side and reuses the existing 3D asset
 * finalizer so generated GLBs are stored with the same render URL contract.
 *
 * Multipart uploads use Busboy with a buffered body (rawBody or streamed
 * chunks). Multer cannot reliably parse multipart on Firebase/Cloud Run.
 */

import { Blob } from 'buffer';
import Busboy from 'busboy';
import { Router, Request, Response as ExpressResponse, NextFunction } from 'express';
import { validateFullAccess } from '../middleware/validateIn3dApiKey';
import { requireRole } from '../middleware/rbac';
import { errorResponse, ErrorCode, HTTP_STATUS, successResponse } from '../utils/apiResponse';
import { initializeServices, TRELLIS_API_KEY } from '../utils/services';
import { finalizeGeneratedAsset, type FinalizeGeneratedAssetInput } from '../services/meshyAssetStorage';

const router = Router();

const TRELLIS_API_BASE_URL = 'https://in3d.evoneural-ai.com';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const DEFAULT_DECIMATION_TARGET = 300000;
const DEFAULT_TEXTURE_SIZE = 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const requireContentEditor = requireRole(['admin', 'superadmin', 'associate']);

interface TrellisUploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

type TrellisStatus = 'queued' | 'running' | 'succeeded' | 'failed';

interface TrellisGeneration {
  id: string;
  status: TrellisStatus;
  created_at?: string;
  [key: string]: unknown;
}

function pickRawStatus(payload: Record<string, unknown>): unknown {
  const nested = payload.data && typeof payload.data === 'object'
    ? (payload.data as Record<string, unknown>)
    : undefined;
  return (
    payload.status
    ?? payload.state
    ?? payload.phase
    ?? payload.job_status
    ?? nested?.status
    ?? nested?.state
    ?? nested?.phase
  );
}

function hasReadyOutput(payload: Record<string, unknown>): boolean {
  const modelUrls = payload.model_urls;
  if (modelUrls && typeof modelUrls === 'object') {
    const glb = (modelUrls as Record<string, unknown>).glb;
    if (typeof glb === 'string' && glb.trim()) return true;
  }
  for (const key of ['output_url', 'glb_url', 'asset_url', 'url'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return true;
  }
  return false;
}

function normalizeTrellisStatus(raw: unknown, payload?: Record<string, unknown>): TrellisStatus {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  if (['succeeded', 'success', 'completed', 'complete', 'finished', 'done', 'ready'].includes(value)) {
    return 'succeeded';
  }
  if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(value)) {
    return 'failed';
  }
  if (['queued', 'pending', 'backlogged', 'scheduled', 'created', 'submitted', 'waiting'].includes(value)) {
    return 'queued';
  }
  if (
    ['running', 'processing', 'in-progress', 'inprogress', 'generating', 'sampling', 'started', 'active'].includes(value)
  ) {
    return 'running';
  }
  if (payload && hasReadyOutput(payload)) return 'succeeded';
  // Unknown / missing status: keep polling instead of falsely failing.
  return value ? 'running' : 'queued';
}

function normalizeGeneration(payload: Record<string, unknown>): TrellisGeneration {
  const id = String(payload.id || payload.job_id || payload.generation_id || '').trim();
  const status = normalizeTrellisStatus(pickRawStatus(payload), payload);
  return {
    ...payload,
    id,
    status,
  };
}

declare module 'express-serve-static-core' {
  interface Request {
    trellisFile?: TrellisUploadedFile;
  }
}

async function readRequestBuffer(req: Request): Promise<Buffer> {
  const anyReq = req as Request & { rawBody?: Buffer | string };

  if (Buffer.isBuffer(anyReq.rawBody) && anyReq.rawBody.length > 0) {
    return anyReq.rawBody;
  }
  if (typeof anyReq.rawBody === 'string' && anyReq.rawBody.length > 0) {
    return Buffer.from(anyReq.rawBody);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseMultipartImage(req: Request, body: Buffer): Promise<{
  file?: TrellisUploadedFile;
  fields: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }
    if (!body.length) {
      reject(new Error('Empty multipart body'));
      return;
    }

    let settled = false;
    let fileTooLarge = false;
    let file: TrellisUploadedFile | undefined;
    const fields: Record<string, string> = {};
    const fileChunks: Buffer[] = [];

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: {
        files: 1,
        fileSize: MAX_IMAGE_BYTES,
      },
    });

    busboy.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'image') {
        stream.resume();
        return;
      }

      stream.on('data', (chunk: Buffer) => {
        fileChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('limit', () => {
        fileTooLarge = true;
      });
      stream.on('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      stream.on('end', () => {
        const buffer = Buffer.concat(fileChunks);
        file = {
          fieldname,
          originalname: info.filename || 'upload.bin',
          mimetype: info.mimeType || 'application/octet-stream',
          buffer,
          size: buffer.length,
        };
      });
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    busboy.on('finish', () => {
      if (settled) return;
      settled = true;
      if (fileTooLarge) {
        reject(new Error('LIMIT_FILE_SIZE'));
        return;
      }
      resolve({ file, fields });
    });

    busboy.end(body);
  });
}

const uploadImage = async (req: Request, res: ExpressResponse, next: NextFunction) => {
  const requestId = (req as any).requestId;

  try {
    const body = await readRequestBuffer(req);
    const parsed = await parseMultipartImage(req, body);

    req.body = {
      ...(req.body && typeof req.body === 'object' ? req.body : {}),
      ...parsed.fields,
    };
    req.trellisFile = parsed.file;
    return next();
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Image upload failed';
    console.error(`[${requestId}] Trellis multipart parse error:`, rawMessage);
    const message = rawMessage === 'LIMIT_FILE_SIZE'
      ? 'Image must be smaller than 12 MB'
      : rawMessage.includes('multipart') || rawMessage.includes('Empty multipart')
        ? rawMessage
        : 'Image upload failed';
    const { statusCode, response } = errorResponse(
      'Validation error',
      message,
      ErrorCode.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
};

function getTrellisApiKey(): string {
  initializeServices();
  return (process.env.TRELLIS_API_KEY || TRELLIS_API_KEY || '').trim();
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function fileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] || '';
}

function validateImageUpload(file?: TrellisUploadedFile): string | null {
  if (!file) return 'Image file is required';
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    return 'Image must be a PNG, JPG, JPEG, or WebP file';
  }
  if (!ALLOWED_IMAGE_EXTENSIONS.has(fileExtension(file.originalname))) {
    return 'Image file extension must be .png, .jpg, .jpeg, or .webp';
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return 'Image file is empty or larger than 12 MB';
  }
  return null;
}

function sanitizeJobId(jobId: string): string {
  const trimmed = String(jobId || '').trim();
  if (!/^[a-zA-Z0-9._-]{1,160}$/.test(trimmed)) {
    throw new Error('Invalid Trellis job id');
  }
  return trimmed;
}

function externalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function trellisFetch(path: string, options: RequestInit = {}): Promise<globalThis.Response> {
  const apiKey = getTrellisApiKey();
  if (!apiKey) {
    throw new Error('Trellis API is not configured. Please contact support.');
  }

  const headers = new Headers(options.headers);
  headers.set('X-API-Key', apiKey);

  return fetch(`${TRELLIS_API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

async function readJsonResponse<T>(response: globalThis.Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Trellis API returned HTTP ${response.status}`);
  }
  return JSON.parse(text) as T;
}

async function getGeneration(jobId: string): Promise<TrellisGeneration> {
  const response = await trellisFetch(`/v1/3d/generations/${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
  const raw = await readJsonResponse<Record<string, unknown>>(response);
  const generation = normalizeGeneration(raw);
  console.log(
    `[Trellis] generation ${jobId} raw_status=${JSON.stringify(pickRawStatus(raw))} normalized=${generation.status}`
  );
  return generation;
}

async function getOutputUrl(jobId: string, outputFile: 'asset.glb' | 'preview.mp4'): Promise<string> {
  const response = await trellisFetch(
    `/v1/3d/generations/${encodeURIComponent(jobId)}/outputs/${outputFile}`,
    {
      method: 'GET',
      redirect: 'manual',
    }
  );

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) return location;
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Trellis output API returned HTTP ${response.status}`);
  }

  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const url = parsed.url || parsed.output_url || parsed.presigned_url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }

  const trimmed = text.trim().replace(/^"|"$/g, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  throw new Error(`Trellis did not return a usable URL for ${outputFile}`);
}

router.post(
  '/generations',
  validateFullAccess,
  requireContentEditor,
  uploadImage,
  async (req: Request, res: ExpressResponse) => {
    const requestId = (req as any).requestId;

    try {
      const uploaded = req.trellisFile;
      const validationError = validateImageUpload(uploaded);
      if (validationError) {
        const { statusCode, response } = errorResponse(
          'Validation error',
          validationError,
          ErrorCode.VALIDATION_ERROR,
          HTTP_STATUS.BAD_REQUEST,
          { requestId }
        );
        return res.status(statusCode).json(response);
      }

      const decimationTarget = parsePositiveInteger(req.body?.decimation_target, DEFAULT_DECIMATION_TARGET);
      const textureSize = parsePositiveInteger(req.body?.texture_size, DEFAULT_TEXTURE_SIZE);
      const form = new FormData();
      const imageBlob = new Blob([new Uint8Array(uploaded!.buffer)], { type: uploaded!.mimetype });
      form.append('image', imageBlob, uploaded!.originalname);
      form.append('decimation_target', String(decimationTarget));
      form.append('texture_size', String(textureSize));

      const response = await trellisFetch('/v1/3d/generations', {
        method: 'POST',
        body: form,
      });
      const generation = normalizeGeneration(await readJsonResponse<Record<string, unknown>>(response));

      return res.status(HTTP_STATUS.ACCEPTED).json(successResponse(
        {
          ...generation,
          decimation_target: decimationTarget,
          texture_size: textureSize,
        },
        {
          requestId,
          message: 'Trellis 2 generation job created',
        }
      ));
    } catch (error) {
      console.error(`[${requestId}] Trellis generation create error:`, externalErrorMessage(error, 'Unknown error'));
      const message = externalErrorMessage(error, 'Failed to create Trellis generation');
      const { statusCode, response } = errorResponse(
        'Trellis generation failed',
        message,
        message.includes('not configured') ? ErrorCode.SERVICE_UNAVAILABLE : ErrorCode.EXTERNAL_API_ERROR,
        message.includes('not configured') ? HTTP_STATUS.SERVICE_UNAVAILABLE : HTTP_STATUS.BAD_GATEWAY,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }
  }
);

router.get('/generations/:jobId', validateFullAccess, requireContentEditor, async (req: Request, res: ExpressResponse) => {
  const requestId = (req as any).requestId;

  try {
    const jobId = sanitizeJobId(req.params.jobId);
    const generation = await getGeneration(jobId);
    return res.status(HTTP_STATUS.OK).json(successResponse(generation, {
      requestId,
      message: 'Trellis 2 generation status retrieved',
    }));
  } catch (error) {
    console.error(`[${requestId}] Trellis generation status error:`, externalErrorMessage(error, 'Unknown error'));
    const { statusCode, response } = errorResponse(
      'Trellis status lookup failed',
      externalErrorMessage(error, 'Failed to retrieve Trellis status'),
      ErrorCode.EXTERNAL_API_ERROR,
      HTTP_STATUS.BAD_GATEWAY,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
});

router.post('/generations/:jobId/finalize', validateFullAccess, requireContentEditor, async (req: Request, res: ExpressResponse) => {
  const requestId = (req as any).requestId;

  try {
    const jobId = sanitizeJobId(req.params.jobId);
    const generation = await getGeneration(jobId);
    if (generation.status === 'failed') {
      const { statusCode, response } = errorResponse(
        'Trellis generation failed',
        'Trellis reported this generation as failed',
        ErrorCode.GENERATION_FAILED,
        HTTP_STATUS.CONFLICT,
        { requestId, details: generation }
      );
      return res.status(statusCode).json(response);
    }
    if (generation.status !== 'succeeded') {
      return res.status(HTTP_STATUS.ACCEPTED).json(successResponse(generation, {
        requestId,
        message: `Trellis generation is ${generation.status}`,
      }));
    }

    const chapterId = String(req.body?.chapterId || '').trim();
    const topicId = String(req.body?.topicId || '').trim();
    if (!chapterId || !topicId) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'chapterId and topicId are required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    const glbUrl = await getOutputUrl(jobId, 'asset.glb');
    const userId = String(req.body?.userId || (req as any).user?.uid || '').trim();
    const sourceFileName = String(req.body?.sourceFileName || '').trim();
    const decimationTarget = parsePositiveInteger(req.body?.decimationTarget, DEFAULT_DECIMATION_TARGET);
    const textureSize = parsePositiveInteger(req.body?.textureSize, DEFAULT_TEXTURE_SIZE);
    const name = String(req.body?.name || sourceFileName || `Trellis 2 asset ${jobId}`).trim();

    const finalizeInput: FinalizeGeneratedAssetInput = {
      sourceAssetId: jobId,
      sourceCollection: 'meshy_assets',
      chapterId,
      topicId,
      userId,
      name,
      prompt: name,
      aiModel: 'trellis-2',
      modelUrls: { glb: glbUrl },
      persistSourceModelUrls: false,
      metadata: {
        provider: 'trellis2',
        trellis_job_id: jobId,
        trellis_status: generation.status,
        decimation_target: decimationTarget,
        texture_size: textureSize,
        source_file_name: sourceFileName,
      },
    };

    const persisted = await finalizeGeneratedAsset(req, finalizeInput, userId);
    return res.status(HTTP_STATUS.OK).json(successResponse(persisted, {
      requestId,
      message: 'Trellis 2 asset finalized',
    }));
  } catch (error) {
    console.error(`[${requestId}] Trellis finalize error:`, externalErrorMessage(error, 'Unknown error'));
    const { statusCode, response } = errorResponse(
      'Trellis finalize failed',
      externalErrorMessage(error, 'Failed to finalize Trellis asset'),
      ErrorCode.EXTERNAL_API_ERROR,
      HTTP_STATUS.BAD_GATEWAY,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
});

export default router;
