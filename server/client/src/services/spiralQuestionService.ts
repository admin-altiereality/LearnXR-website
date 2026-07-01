import api from '../config/axios';

export interface SpiralQuestionConfig {
  curriculum: string;
  class: string;
  subject: string;
}

const DEFAULT_SPIRAL_ANSWER =
  "I am having trouble answering right now. Try asking me to make a place or a 3D thing.";

export async function askSpiralQuestion(
  question: string,
  config: SpiralQuestionConfig
): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) return DEFAULT_SPIRAL_ANSWER;

  try {
    const res = await api.post<{ success?: boolean; answer?: string }>(
      '/assistant/simple-answer',
      {
        question: trimmed,
        curriculum: config.curriculum,
        class: config.class,
        subject: config.subject,
      },
      { __quiet: true } as any
    );
    const answer = res.data?.answer?.trim();
    if (answer) return answer;
  } catch (err) {
    if ((window.VITE_ENV?.DEV)) {
      console.warn('Spiral simple-answer failed:', err);
    }
  }

  return DEFAULT_SPIRAL_ANSWER;
}

