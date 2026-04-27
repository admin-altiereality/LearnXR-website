/**
 * useVoiceInput
 * -------------
 * Reusable Web Speech API hook with:
 *  - secure-context detection (HTTPS or localhost)
 *  - getUserMedia() permission preflight
 *  - interim transcript streaming
 *  - 1.5s silence-based auto-stop
 *  - explicit start / stop / reset controls
 *
 * Originally extracted from `MainSection.jsx` so the same behavior can be
 * reused on the LKG-friendly `/spiral` page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((e: Event) => void) | null;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: ((e: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export interface UseVoiceInputOptions {
  /** ISO language code; defaults to en-US for LKG-grade English voice. */
  lang?: string;
  /** Auto-stop after this many ms of silence after the last interim result. Default 1500ms. */
  silenceTimeoutMs?: number;
  /** Called once a final transcript is available (auto-stop or explicit stop). */
  onFinalTranscript?: (text: string) => void;
}

export interface UseVoiceInputReturn {
  isSupported: boolean;
  isListening: boolean;
  status: 'idle' | 'unsupported' | 'permission' | 'starting' | 'listening' | 'no-speech' | 'error';
  /** Combined final + interim text for live UI feedback. */
  transcript: string;
  /** Only the locked-in final portion. */
  finalTranscript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const DEFAULT_SILENCE_MS = 1500;
const INITIAL_SILENCE_GRACE_MS = 4500;

const isSecureContext = () =>
  typeof window !== 'undefined' &&
  (window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    lang = 'en-US',
    silenceTimeoutMs = DEFAULT_SILENCE_MS,
    onFinalTranscript,
  } = options;

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [status, setStatus] = useState<UseVoiceInputReturn['status']>('idle');
  const [interim, setInterim] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const finalRef = useRef<string>('');
  const stopRequestedRef = useRef<boolean>(false);
  const heardAudioRef = useRef<boolean>(false);
  const onFinalRef = useRef<typeof onFinalTranscript>(onFinalTranscript);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      stopRequestedRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isSecureContext()) {
      setIsSupported(false);
      setStatus('unsupported');
      setError('Voice input requires HTTPS or localhost.');
      return;
    }

    const Ctor: SpeechRecognitionCtor | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Ctor) {
      setIsSupported(false);
      setStatus('unsupported');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setStatus('unsupported');
      setError('Microphone API not available in this browser.');
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setError(null);
      window.setTimeout(() => {
        if (recognitionRef.current && !heardAudioRef.current) {
          armSilenceTimer();
        }
      }, Math.min(INITIAL_SILENCE_GRACE_MS, Math.max(silenceTimeoutMs, 2500)));
    };

    recognition.onresult = (event: any) => {
      heardAudioRef.current = true;
      let interimChunk = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) {
          finalChunk += piece;
        } else {
          interimChunk += piece;
        }
      }
      if (finalChunk) {
        finalRef.current = (finalRef.current ? finalRef.current + ' ' : '') + finalChunk.trim();
        setFinalText(finalRef.current);
      }
      setInterim(interimChunk);
      armSilenceTimer();
    };

    recognition.onerror = (event: any) => {
      const code = event?.error;
      clearSilenceTimer();
      if (code === 'aborted' || code === 'no-speech') {
        setStatus('no-speech');
        if (!finalRef.current.trim()) {
          setError('I did not hear anything. Move closer and try again.');
        }
        return;
      }
      const messageMap: Record<string, string> = {
        'audio-capture': 'No microphone found. Please check your device.',
        'not-allowed':
          'Microphone access denied. Please allow microphone access in your browser settings.',
        network: 'Network error. Speech recognition is temporarily unavailable.',
        'service-not-allowed': 'Speech recognition service is not available right now.',
        'bad-grammar': 'Could not understand. Please try again.',
        'language-not-supported': 'Language not supported.',
      };
      setStatus(code === 'not-allowed' ? 'permission' : 'error');
      setError(messageMap[code] || `Voice recognition error: ${code || 'unknown'}`);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      const finalCaptured = finalRef.current.trim();
      setIsListening(false);
      setInterim('');
      setStatus(
        finalCaptured ? 'idle' : heardAudioRef.current ? 'idle' : 'no-speech'
      );
      if (finalCaptured && onFinalRef.current) {
        try {
          onFinalRef.current(finalCaptured);
        } catch (cbError) {
          console.error('useVoiceInput onFinalTranscript callback failed:', cbError);
        }
      }
      stopRequestedRef.current = false;
    };

    recognitionRef.current = recognition;
    setIsSupported(true);
    setStatus('idle');

    return () => {
      clearSilenceTimer();
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang, armSilenceTimer, clearSilenceTimer]);

  const start = useCallback(async () => {
    if (!recognitionRef.current) {
      setError('Voice recognition is not available in this browser.');
      setStatus('unsupported');
      return;
    }
    setError(null);
    setStatus('starting');
    finalRef.current = '';
    heardAudioRef.current = false;
    setFinalText('');
    setInterim('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch (permissionError: any) {
      const name = permissionError?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setStatus('permission');
        setError(
          'Microphone access denied. Please allow microphone access in your browser settings and reload the page.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setStatus('error');
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setStatus('error');
        setError('Failed to access microphone. Please check your device settings.');
      }
      return;
    }

    await new Promise((r) => setTimeout(r, 50));

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name === 'InvalidStateError') {
        try {
          recognitionRef.current.stop();
          await new Promise((r) => setTimeout(r, 200));
          recognitionRef.current.start();
        } catch (retryErr: any) {
          setError(
            retryErr?.message || 'Voice recognition is busy. Please wait a moment and try again.'
          );
          setStatus('error');
        }
      } else {
        setError(err?.message || 'Failed to start voice input. Please try again.');
        setStatus('error');
      }
    }
  }, []);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    setStatus('idle');
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    clearSilenceTimer();
    finalRef.current = '';
    setFinalText('');
    setInterim('');
    setError(null);
    setStatus('idle');
    heardAudioRef.current = false;
  }, [clearSilenceTimer]);

  const transcript = (finalText + (interim ? (finalText ? ' ' : '') + interim : '')).trim();

  return {
    isSupported,
    isListening,
    status,
    transcript,
    finalTranscript: finalText,
    error,
    start,
    stop,
    reset,
  };
}

export default useVoiceInput;
