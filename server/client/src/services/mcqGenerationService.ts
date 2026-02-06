/**
 * MCQ Generation API client
 * Calls the server to generate MCQs from learning objective or script text.
 */

import api from '../config/axios';

export interface GeneratedMcq {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface GenerateMcqParams {
  chapterId: string;
  topicId: string;
  subject?: string;
  classLevel?: string;
  curriculum?: string;
  learningObjective?: string;
  scriptText?: string;
  count?: number;
  language?: string;
}

export interface GenerateMcqResponse {
  chapterId: string;
  topicId: string;
  mcqs: GeneratedMcq[];
}

export async function generateMcqs(params: GenerateMcqParams): Promise<GenerateMcqResponse> {
  try {
    const response = await api.post<{ success: boolean; data?: GenerateMcqResponse; error?: string; message?: string }>(
      '/ai-education/generate-mcq',
      params
    );
    const data = response.data;
    if (!data.success || !data.data) {
      const msg = data.error ?? data.message ?? 'Failed to generate MCQs';
      throw new Error(msg);
    }
    return data.data;
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
    const serverMsg = ax.response?.data?.error ?? ax.response?.data?.message;
    if (serverMsg) throw new Error(serverMsg);
    if (err instanceof Error) throw err;
    throw new Error(typeof err === 'string' ? err : 'Failed to generate MCQs');
  }
}
