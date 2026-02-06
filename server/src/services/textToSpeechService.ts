import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

class TextToSpeechService {
  private openai: OpenAI;
  private outputDir: string;

  /**
   * @param apiKey Optional. If not provided, uses process.env.OPENAI_API_KEY.
   *               Pass OPENAI_AVATAR_API_KEY (or fallback) for avatar/TTS flows.
   */
  constructor(apiKey?: string) {
    const key = (apiKey ?? process.env.OPENAI_API_KEY)?.trim();
    if (!key) {
      throw new Error('OpenAI API key is not configured (OPENAI_API_KEY or provided apiKey)');
    }
    this.openai = new OpenAI({ apiKey: key });
    this.outputDir = path.join(process.cwd(), 'server', 'public', 'audio');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
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
   * Generate speech and save to file
   */
  async generateSpeechFile(
    text: string,
    filename: string,
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  ): Promise<string> {
    const buffer = await this.textToSpeech(text, voice);
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, buffer);
    return `/audio/${filename}`;
  }
}

export default TextToSpeechService;

