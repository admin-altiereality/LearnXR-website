import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import fs from 'fs';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { requireStaffRole } from '../middleware/requireStaffRole';

const router = express.Router();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 25 * 1024 * 1024 },
});

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const SERVICE_ACCOUNT_KEYFILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE || 'service-account.json';

const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_KEYFILE,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    driveClient = google.drive({ version: 'v3', auth });
  } catch (err) {
    console.error('Failed to initialize Google Drive client:', err);
  }

  return driveClient;
}

router.use(verifyFirebaseToken);
router.use(requireStaffRole);

router.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'n8n proxy is running' });
});

router.get('/executions/:id', async (req, res) => {
  if (!N8N_API_URL || !N8N_API_KEY) {
    return res.status(500).json({
      message: 'N8N_API_URL or N8N_API_KEY is not configured on the server.',
    });
  }

  const { id } = req.params;
  const base = N8N_API_URL.replace(/\/$/, '');
  const url = `${base}/api/v1/executions/${encodeURIComponent(id)}`;

  try {
    const apiRes = await fetch(url, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
    });

    const body = await apiRes.text();
    res.status(apiRes.status);
    try {
      res.json(JSON.parse(body));
    } catch {
      res.send(body);
    }
  } catch (error) {
    console.error('Error proxying n8n execution:', error);
    res.status(500).json({ message: 'Failed to fetch execution from n8n.' });
  }
});

router.get('/executions', async (req, res) => {
  if (!N8N_API_URL || !N8N_API_KEY) {
    return res.status(500).json({
      message: 'N8N_API_URL or N8N_API_KEY is not configured on the server.',
    });
  }

  const limitRaw = req.query.limit;
  const parsed = typeof limitRaw === 'string' ? parseInt(limitRaw, 10) : NaN;
  const take = Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 10;
  const base = N8N_API_URL.replace(/\/$/, '');
  const url = `${base}/api/v1/executions?limit=${encodeURIComponent(take)}`;

  try {
    const apiRes = await fetch(url, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
    });

    const body = await apiRes.text();
    res.status(apiRes.status);
    try {
      res.json(JSON.parse(body));
    } catch {
      res.send(body);
    }
  } catch (error) {
    console.error('Error proxying n8n executions list:', error);
    res.status(500).json({ message: 'Failed to fetch executions list from n8n.' });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const drive = getDriveClient();
    if (!drive || !FOLDER_ID) {
      return res.status(500).json({
        message:
          'Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEYFILE and GOOGLE_DRIVE_FOLDER_ID.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Missing file' });
    }

    if (!ALLOWED_UPLOAD_MIME.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Unsupported file type' });
    }

    const filePath = req.file.path;
    const driveRes = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(filePath),
      },
      fields: 'id, webViewLink, webContentLink',
    });

    fs.unlink(filePath, () => {});

    res.json({
      fileId: driveRes.data.id,
      webViewLink: driveRes.data.webViewLink,
      webContentLink: driveRes.data.webContentLink,
    });
  } catch (err: any) {
    console.error('Upload to Drive failed:', err);
    res.status(500).json({
      message: 'Upload failed',
      error: err?.message || 'Unknown error',
    });
  }
});

export default router;
