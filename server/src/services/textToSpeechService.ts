import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

class TextToSpeechService {
  private openai: OpenAI;
  private outputDir: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.openai = new OpenAI({ apiKey });
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

