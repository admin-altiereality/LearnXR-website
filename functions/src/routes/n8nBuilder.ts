import express from 'express';
import {
  cancelQueuedJob,
  enqueueJobsForUser,
  listJobsForUser,
  syncUserQueue,
} from '../services/n8nLessonBuilderQueue';

const router = express.Router();

router.get('/jobs', async (req, res) => {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  const userId = user?.uid;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const limitRaw = req.query.limit;
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 50;

  try {
    const jobs = await listJobsForUser(userId, Number.isFinite(limit) ? limit : 50);
    return res.json({ jobs });
  } catch (error) {
    console.error('Failed to list n8n builder jobs:', error);
    return res.status(500).json({ message: 'Failed to load builder queue.' });
  }
});

router.post('/jobs', async (req, res) => {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  const userId = user?.uid;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const { items, webhookUrl, prompt, language, curriculum, classLevel, subject } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one uploaded PDF is required.' });
  }

  if (typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
    return res.status(400).json({ message: 'A valid n8n webhook URL is required.' });
  }

  if (typeof language !== 'string' || !language.trim()) {
    return res.status(400).json({ message: 'Language is required.' });
  }

  try {
    const created = await enqueueJobsForUser(
      userId,
      user?.email,
      items.map((item: any) => ({
        webhookUrl,
        file: {
          storagePath: String(item?.storagePath ?? ''),
          fileName: String(item?.fileName ?? ''),
          sizeBytes: Number(item?.sizeBytes ?? 0),
          contentType: String(item?.contentType ?? 'application/pdf'),
        },
        prompt: typeof prompt === 'string' ? prompt : '',
        language,
        curriculum: typeof curriculum === 'string' ? curriculum : '',
        classLevel: typeof classLevel === 'string' ? classLevel : '',
        subject: typeof subject === 'string' ? subject : '',
      })),
    );

    const jobs = await syncUserQueue(userId);
    return res.status(201).json({ created, jobs });
  } catch (error) {
    console.error('Failed to enqueue n8n builder jobs:', error);
    return res.status(500).json({ message: 'Failed to enqueue PDFs for automation.' });
  }
});

router.post('/refresh', async (req, res) => {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  const userId = user?.uid;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const jobs = await syncUserQueue(userId);
    return res.json({ jobs });
  } catch (error) {
    console.error('Failed to refresh n8n builder queue:', error);
    return res.status(500).json({ message: 'Failed to refresh builder queue.' });
  }
});

router.post('/jobs/:id/cancel', async (req, res) => {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  const userId = user?.uid;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    await cancelQueuedJob(userId, req.params.id);
    const jobs = await listJobsForUser(userId);
    return res.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel queue item.';
    return res.status(400).json({ message });
  }
});

export default router;
