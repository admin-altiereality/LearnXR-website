/**
 * avatarSpeak
 * -----------
 * Generates TTS audio + viseme frames for the TeacherAvatar in parallel and
 * pushes them through the avatar's imperative `speak()` handle.
 *
 * The Spiral (LKG) page uses this helper instead of `avatarRef.sendMessage()`
 * because the assistant message path on the Create page intentionally
 * disables audio playback. Here we explicitly want audio + lip-sync.
 *
 * Falls back to browser SpeechSynthesis if the server endpoints are
 * unavailable so the avatar still speaks (without lip-sync).
 */

import { isAxiosError } from 'axios';
import api from '../config/axios';
import type { VisemeFrame } from './lipSyncService';

export interface AvatarSpeakHandle {
  /** Optional: matches the additive method on TeacherAvatar's forwardRef. */
  speak?: (audioUrl: string, visemes: VisemeFrame[]) => void;
}

export interface AvatarSpeakOptions {
  /** OpenAI TTS voice name; default 'nova' (warm, female). */
  voice?: string;
}

export interface AvatarSpeakResult {
  audioUrl: string | null;
  visemes: VisemeFrame[];
  usedFallback: boolean;
}

async function fetchTts(text: string, voice: string): Promise<string | null> {
  try {
    const res = await api.post<{ audioUrl: string }>('/assistant/tts/generate', {
      text,
      voice,
    }, { __quiet: true } as any);
    return res.data?.audioUrl ?? null;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      // Quota / rate limit — use browser speech below; avoid noisy console warnings.
      return null;
    }
    console.warn('avatarSpeak: TTS request failed', err);
    return null;
  }
}

async function fetchVisemes(text: string): Promise<VisemeFrame[]> {
  try {
    const res = await api.post<{ visemes: VisemeFrame[] }>('/assistant/lipsync/generate', {
      text,
    });
    return res.data?.visemes ?? [];
  } catch (err) {
    console.warn('avatarSpeak: lipsync request failed', err);
    return [];
  }
}

function browserFallbackSpeak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.05;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn('avatarSpeak: browser SpeechSynthesis fallback failed', err);
  }
}

/**
 * Make the on-page avatar say `text` with lip-sync.
 * Resolves once the audio URL + visemes have been pushed to the avatar.
 */
export async function speakWithAvatar(
  text: string,
  avatarRef: React.RefObject<AvatarSpeakHandle | null> | null | undefined,
  options: AvatarSpeakOptions = {}
): Promise<AvatarSpeakResult> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { audioUrl: null, visemes: [], usedFallback: false };
  }

  const voice = options.voice || 'nova';

  const [audioUrl, visemes] = await Promise.all([
    fetchTts(trimmed, voice),
    fetchVisemes(trimmed),
  ]);

  const handle = avatarRef?.current ?? null;
  if (audioUrl && handle && typeof handle.speak === 'function') {
    handle.speak(audioUrl, visemes);
    return { audioUrl, visemes, usedFallback: false };
  }

  // No audio URL or no avatar handle — degrade gracefully so the kid still
  // hears a response.
  browserFallbackSpeak(trimmed);
  return { audioUrl, visemes, usedFallback: true };
}

export default speakWithAvatar;
