/**
 * Viseme types based on phonemes
 * These correspond to mouth shapes for lip sync
 */
export enum VisemeType {
  SILENCE = 0,    // Closed mouth
  A = 1,          // "ah" sound
  E = 2,          // "eh" sound
  I = 3,          // "ee" sound
  O = 4,          // "oh" sound
  U = 5,          // "oo" sound
  FV = 6,         // "f", "v" sounds
  MBP = 7,        // "m", "b", "p" sounds
  TH = 8,         // "th" sound
  TD = 9,         // "t", "d" sounds
  KG = 10,        // "k", "g" sounds
  CHSH = 11,      // "ch", "sh" sounds
  NNG = 12,       // "n", "ng" sounds
  L = 13,         // "l" sound
  R = 14,         // "r" sound
  SZ = 15         // "s", "z" sounds
}

/**
 * Phoneme to Viseme mapping
 */
const PHONEME_TO_VISEME: Record<string, VisemeType> = {
  // Vowels
  'AA': VisemeType.A, 'AE': VisemeType.A, 'AH': VisemeType.A,
  'AO': VisemeType.O, 'AW': VisemeType.O, 'AY': VisemeType.A,
  'EH': VisemeType.E, 'ER': VisemeType.R, 'EY': VisemeType.E,
  'IH': VisemeType.I, 'IY': VisemeType.I,
  'OW': VisemeType.O, 'OY': VisemeType.O,
  'UH': VisemeType.U, 'UW': VisemeType.U,
  
  // Consonants
  'B': VisemeType.MBP, 'P': VisemeType.MBP,
  'M': VisemeType.MBP,
  'F': VisemeType.FV, 'V': VisemeType.FV,
  'TH': VisemeType.TH, 'DH': VisemeType.TH,
  'T': VisemeType.TD, 'D': VisemeType.TD,
  'K': VisemeType.KG, 'G': VisemeType.KG,
  'CH': VisemeType.CHSH, 'JH': VisemeType.CHSH,
  'SH': VisemeType.CHSH, 'ZH': VisemeType.CHSH,
  'S': VisemeType.SZ, 'Z': VisemeType.SZ,
  'N': VisemeType.NNG, 'NG': VisemeType.NNG,
  'L': VisemeType.L,
  'R': VisemeType.R,
  'W': VisemeType.U, 'Y': VisemeType.I,
  'HH': VisemeType.A, // H sound
};

interface VisemeFrame {
  viseme: VisemeType;
  startTime: number;
  duration: number;
}

class LipSyncService {
  /**
   * Analyze audio and generate viseme timeline
   * This is a simplified version - for production, use Web Speech API or
   * a phoneme recognition library
   */
  async generateVisemesFromText(text: string): Promise<VisemeFrame[]> {
    // Simple word-based approximation
    // For production, use a proper phoneme analyzer
    const words = text.toLowerCase().split(/\s+/);
    const visemes: VisemeFrame[] = [];
    let currentTime = 0;
    const avgWordDuration = 0.3; // seconds per word

    for (const word of words) {
      const phonemes = this.wordToPhonemes(word);
      const phonemeDuration = avgWordDuration / Math.max(phonemes.length, 1);

      for (const phoneme of phonemes) {
        const viseme = PHONEME_TO_VISEME[phoneme] || VisemeType.A;
        visemes.push({
          viseme,
          startTime: currentTime,
          duration: phonemeDuration
        });
        currentTime += phonemeDuration;
      }

      // Add small pause between words
      visemes.push({
        viseme: VisemeType.SILENCE,
        startTime: currentTime,
        duration: 0.1
      });
      currentTime += 0.1;
    }

    return visemes;
  }

  /**
   * Simple word to phonemes converter
   * For production, use a library like 'cmu-pronouncing-dictionary' or
   * a phoneme recognition service
   */
  private wordToPhonemes(word: string): string[] {
    // Simplified mapping - replace with proper phoneme dictionary
    const phonemeMap: Record<string, string[]> = {
      'hello': ['HH', 'EH', 'L', 'OW'],
      'teacher': ['T', 'IY', 'CH', 'ER'],
      'student': ['S', 'T', 'UW', 'D', 'EH', 'N', 'T'],
      'science': ['S', 'AY', 'EH', 'N', 'S'],
      'math': ['M', 'AE', 'TH'],
      'history': ['HH', 'IH', 'S', 'T', 'ER', 'IY'],
      'english': ['IH', 'NG', 'G', 'L', 'IH', 'SH'],
      'explain': ['IH', 'K', 'S', 'P', 'L', 'EY', 'N'],
      'understand': ['AH', 'N', 'D', 'ER', 'S', 'T', 'AE', 'N', 'D'],
      'question': ['K', 'W', 'EH', 'S', 'CH', 'AH', 'N'],
      // Add more mappings as needed
    };

    if (phonemeMap[word]) {
      return phonemeMap[word];
    }

    // Fallback: simple character-based approximation
    return word.split('').map(char => {
      if ('aeiou'.includes(char)) return 'A';
      if ('fvpbm'.includes(char)) return 'MBP';
      if ('td'.includes(char)) return 'TD';
      if ('kg'.includes(char)) return 'KG';
      if ('sz'.includes(char)) return 'SZ';
      return 'A';
    });
  }

  /**
   * Get current viseme based on audio playback time
   */
  getVisemeAtTime(visemes: VisemeFrame[], currentTime: number): VisemeType {
    for (const frame of visemes) {
      if (currentTime >= frame.startTime && 
          currentTime < frame.startTime + frame.duration) {
        return frame.viseme;
      }
    }
    return VisemeType.SILENCE;
  }
}

export default LipSyncService;
export type { VisemeFrame };

