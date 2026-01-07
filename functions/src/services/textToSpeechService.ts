import OpenAI from 'openai';
import { getStorage } from 'firebase-admin/storage';

class TextToSpeechService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.openai = new OpenAI({ apiKey });
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

