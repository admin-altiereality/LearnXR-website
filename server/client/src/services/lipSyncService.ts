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

export interface VisemeFrame {
  viseme: VisemeType;
  startTime: number;
  duration: number;
}

/**
 * Get current viseme based on audio playback time
 */
export const getVisemeAtTime = (
  visemes: VisemeFrame[], 
  currentTime: number
): VisemeType => {
  for (const frame of visemes) {
    if (currentTime >= frame.startTime && 
        currentTime < frame.startTime + frame.duration) {
      return frame.viseme;
    }
  }
  return VisemeType.SILENCE;
};

/**
 * Default viseme blend shape names (adjust based on your avatar model)
 * These are common names used in VR avatar models
 */
export const VISEME_BLEND_SHAPE_NAMES: Record<number, string> = {
  0: 'viseme_sil',   // Silence
  1: 'viseme_aa',    // A
  2: 'viseme_E',     // E
  3: 'viseme_I',     // I
  4: 'viseme_O',     // O
  5: 'viseme_U',     // U
  6: 'viseme_FV',    // FV
  7: 'viseme_MBP',   // MBP
  8: 'viseme_TH',    // TH
  9: 'viseme_TD',    // TD
  10: 'viseme_KG',   // KG
  11: 'viseme_CHSH', // CHSH
  12: 'viseme_NNG',  // NNG
  13: 'viseme_L',    // L
  14: 'viseme_R',    // R
  15: 'viseme_SZ',   // SZ
};

