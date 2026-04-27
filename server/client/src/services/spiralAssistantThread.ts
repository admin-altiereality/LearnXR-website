/**
 * Deduplicate assistant thread creation for /spiral across React 18 StrictMode
 * (double useEffect) and remounts. One cached thread per session is enough.
 */
import api from '../config/axios';

let cachedThreadId: string | null = null;
let inFlight: Promise<string | null> | null = null;

export async function getOrCreateSpiralThread(config: {
  curriculum: string;
  class: string;
  subject: string;
}): Promise<string | null> {
  if (cachedThreadId) return cachedThreadId;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await api.post<{ threadId: string }>('/assistant/create-thread', {
        curriculum: config.curriculum,
        class: config.class,
        subject: config.subject,
        useAvatarKey: true,
      });
      if (res.data?.threadId) {
        cachedThreadId = res.data.threadId;
        return cachedThreadId;
      }
    } catch (err) {
      console.warn('Spiral: assistant create-thread failed', err);
    }
    return null;
  })()
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
