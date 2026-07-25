import express from 'express';
import { requireRole } from '../middleware/rbac';

const router = express.Router();

const N8N_API_URL: string | undefined = process.env.N8N_API_URL;
const N8N_API_KEY: string | undefined = process.env.N8N_API_KEY;

const requireStaff = requireRole(['admin', 'superadmin', 'associate']);

router.get('/', requireStaff, (_req, res) => {
  res.json({ status: 'ok', message: 'n8n proxy is running' });
});

router.get('/executions/:id', requireStaff, async (req, res): Promise<void> => {
  if (!N8N_API_URL || !N8N_API_KEY) {
    res.status(500).json({
      message: 'N8N_API_URL or N8N_API_KEY is not configured on the server.',
    });
    return;
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

router.get('/executions', requireStaff, async (req, res): Promise<void> => {
  if (!N8N_API_URL || !N8N_API_KEY) {
    res.status(500).json({
      message: 'N8N_API_URL or N8N_API_KEY is not configured on the server.',
    });
    return;
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

export default router;
