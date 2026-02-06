import OpenAI from 'openai';
import { getStorage } from 'firebase-admin/storage';

class TextToSpeechService {
  private openai: OpenAI;

  /**
   * @param apiKey Optional. If not provided, uses process.env.OPENAI_API_KEY.
   *               Pass process.env.OPENAI_AVATAR_API_KEY (or fallback) for avatar/TTS flows.
   */
  constructor(apiKey?: string) {
    const key = (apiKey ?? process.env.OPENAI_API_KEY)?.trim();
    if (!key) {
      throw new Error('OpenAI API key is not configured (OPENAI_API_KEY or provided apiKey)');
    }
    this.openai = new OpenAI({ apiKey: key });
  }

  /**
   * Convert text to speech and return audio buffer
   */
  async textToSpeech(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
  ): Promise<Buffer> {
    const mp3 = await this.openai.audio.speech.create({
      model: 'tts-1-hd', // or 'tts-1' for faster/cheaper
      voice: voice,
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  }

  /**
   * Generate speech and upload to Firebase Storage
   * Returns a public URL to the audio file
   */
  async generateSpeechFile(
    text: string,
    filename: string,
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  ): Promise<string> {
    const buffer = await this.textToSpeech(text, voice);
    
    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const file = bucket.file(`audio/${filename}`);
    
    await file.save(buffer, {
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000',
      },
      public: true,
    });

    // Make file publicly accessible
    await file.makePublic();
    
    // Return public URL
    return `https://storage.googleapis.com/${bucket.name}/audio/${filename}`;
  }
}

export default TextToSpeechService;

