// Intelligent Prompt Parser Service
// Automatically detects 3D asset descriptions and skybox/background descriptions from a single prompt

export interface ParsedPrompt {
  original: string;
  asset: string; // 3D asset description
  background: string; // Skybox/background description
  confidence: number; // 0-1, how confident we are in the split
  method: 'intelligent' | 'fallback' | 'manual';
}

class PromptParserService {
  // Common prepositions that indicate location/environment
  private locationPrepositions = [
    'in', 'on', 'at', 'inside', 'outside', 'within', 'among', 'amidst',
    'under', 'over', 'above', 'below', 'beside', 'near', 'around',
    'through', 'across', 'between', 'among', 'along', 'behind', 'beyond'
  ];

  // Common environment/background keywords
  private backgroundKeywords = [
    'forest', 'jungle', 'desert', 'ocean', 'beach', 'mountain', 'valley',
    'city', 'street', 'room', 'house', 'building', 'park', 'garden',
    'space', 'planet', 'sky', 'clouds', 'sunset', 'sunrise', 'night',
    'day', 'dawn', 'dusk', 'winter', 'summer', 'spring', 'autumn',
    'cave', 'tunnel', 'bridge', 'river', 'lake', 'waterfall',
    'snow', 'rain', 'storm', 'fog', 'mist', 'wind'
  ];

  // Common 3D object keywords (things that are typically objects, not environments)
  private objectKeywords = [
    'table', 'chair', 'desk', 'lamp', 'vase', 'statue', 'sculpture',
    'car', 'vehicle', 'bike', 'motorcycle', 'plane', 'ship', 'boat',
    'tree', 'plant', 'flower', 'rock', 'stone', 'crystal',
    'weapon', 'sword', 'gun', 'shield', 'armor',
    'furniture', 'sofa', 'bed', 'cabinet', 'shelf',
    'toy', 'doll', 'figure', 'model', 'character',
    'building', 'structure', 'tower', 'castle', 'house'
  ];

  /**
   * Parse a prompt to extract 3D asset and background descriptions
   */
  parsePrompt(prompt: string): ParsedPrompt {
    if (!prompt || !prompt.trim()) {
      return {
        original: prompt,
        asset: '',
        background: '',
        confidence: 0,
        method: 'fallback'
      };
    }

    const trimmed = prompt.trim();
    
    // Try intelligent parsing first
    const intelligentResult = this.intelligentParse(trimmed);
    if (intelligentResult.confidence > 0.5) {
      return intelligentResult;
    }

    // Fallback: try simple pattern matching
    const patternResult = this.patternBasedParse(trimmed);
    if (patternResult.confidence > 0.3) {
      return patternResult;
    }

    // Last resort: use the whole prompt for both
    return {
      original: trimmed,
      asset: trimmed,
      background: trimmed,
      confidence: 0.1,
      method: 'fallback'
    };
  }

  /**
   * Intelligent parsing using linguistic patterns
   */
  private intelligentParse(prompt: string): ParsedPrompt {
    const lowerPrompt = prompt.toLowerCase();
    
    // Pattern 1: "A [object] in [location]" - most common pattern
    // Example: "A table in the forest"
    const pattern1 = /^(a|an|the)\s+([^,]+?)\s+(in|on|at|inside|outside|within|among|amidst|under|over|above|below|beside|near|around|through|across|between|along|behind|beyond)\s+(.+)$/i;
    const match1 = prompt.match(pattern1);
    if (match1) {
      const asset = match1[2].trim();
      const background = match1[4].trim();
      
      // Validate that asset looks like an object and background looks like environment
      if (this.isLikelyObject(asset) && this.isLikelyBackground(background)) {
        return {
          original: prompt,
          asset: asset,
          background: background,
          confidence: 0.9,
          method: 'intelligent'
        };
      }
    }

    // Pattern 2: "[Object] with [background context]" or "[Object], [background]"
    const pattern2 = /^([^,]+?)(?:\s+with\s+|\s*,\s*)(.+)$/i;
    const match2 = prompt.match(pattern2);
    if (match2) {
      const part1 = match2[1].trim();
      const part2 = match2[2].trim();
      
      // Check if part1 is object-like and part2 is background-like
      if (this.isLikelyObject(part1) && this.isLikelyBackground(part2)) {
        return {
          original: prompt,
          asset: part1,
          background: part2,
          confidence: 0.8,
          method: 'intelligent'
        };
      }
      
      // Reverse check: maybe part2 is object and part1 is background
      if (this.isLikelyObject(part2) && this.isLikelyBackground(part1)) {
        return {
          original: prompt,
          asset: part2,
          background: part1,
          confidence: 0.75,
          method: 'intelligent'
        };
      }
    }

    // Pattern 3: "[Object] in a [environment]" or "[Object] on a [surface]"
    const pattern3 = /^([^,]+?)\s+(?:in|on|at)\s+(?:a|an|the)\s+(.+)$/i;
    const match3 = prompt.match(pattern3);
    if (match3) {
      const asset = match3[1].trim();
      const background = match3[2].trim();
      
      if (this.isLikelyObject(asset) && this.isLikelyBackground(background)) {
        return {
          original: prompt,
          asset: asset,
          background: background,
          confidence: 0.85,
          method: 'intelligent'
        };
      }
    }

    // Pattern 4: Find first noun phrase (likely object) and rest (likely background)
    const words = prompt.split(/\s+/);
    if (words.length >= 3) {
      // Try splitting at various points
      for (let i = 2; i < Math.min(words.length, 6); i++) {
        const assetPart = words.slice(0, i).join(' ');
        const backgroundPart = words.slice(i).join(' ');
        
        if (this.isLikelyObject(assetPart) && this.isLikelyBackground(backgroundPart)) {
          return {
            original: prompt,
            asset: assetPart,
            background: backgroundPart,
            confidence: 0.6,
            method: 'intelligent'
          };
        }
      }
    }

    return {
      original: prompt,
      asset: '',
      background: '',
      confidence: 0,
      method: 'intelligent'
    };
  }

  /**
   * Pattern-based parsing using keyword matching
   */
  private patternBasedParse(prompt: string): ParsedPrompt {
    const lowerPrompt = prompt.toLowerCase();
    const words = prompt.split(/\s+/);
    
    // Find background keywords
    let backgroundStartIndex = -1;
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[^a-z]/g, '');
      if (this.backgroundKeywords.some(bg => word.includes(bg) || bg.includes(word))) {
        backgroundStartIndex = i;
        break;
      }
      // Also check for location prepositions
      if (this.locationPrepositions.includes(word)) {
        backgroundStartIndex = i;
        break;
      }
    }

    if (backgroundStartIndex > 0 && backgroundStartIndex < words.length) {
      const asset = words.slice(0, backgroundStartIndex).join(' ');
      const background = words.slice(backgroundStartIndex).join(' ');
      
      return {
        original: prompt,
        asset: asset.trim(),
        background: background.trim(),
        confidence: 0.5,
        method: 'intelligent'
      };
    }

    // Try reverse: find object keywords first
    let objectEndIndex = -1;
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[^a-z]/g, '');
      if (this.objectKeywords.some(obj => word.includes(obj) || obj.includes(word))) {
        objectEndIndex = i + 1;
      } else if (objectEndIndex > 0 && this.locationPrepositions.includes(word)) {
        // Found object, then found location preposition
        const asset = words.slice(0, objectEndIndex).join(' ');
        const background = words.slice(objectEndIndex).join(' ');
        
        return {
          original: prompt,
          asset: asset.trim(),
          background: background.trim(),
          confidence: 0.45,
          method: 'intelligent'
        };
      }
    }

    return {
      original: prompt,
      asset: '',
      background: '',
      confidence: 0,
      method: 'intelligent'
    };
  }

  /**
   * Check if a phrase is likely describing a 3D object
   */
  private isLikelyObject(phrase: string): boolean {
    if (!phrase || phrase.length < 2) return false;
    
    const lower = phrase.toLowerCase();
    const words = lower.split(/\s+/);
    
    // Check for object keywords
    const hasObjectKeyword = this.objectKeywords.some(keyword => 
      lower.includes(keyword) || words.some(w => w.includes(keyword))
    );
    
    // Check for articles (a, an, the) which often precede objects
    const startsWithArticle = /^(a|an|the)\s+/i.test(phrase);
    
    // Check if it's short (objects are usually shorter descriptions)
    const isShort = words.length <= 5;
    
    // Check if it doesn't contain too many background keywords
    const hasBackgroundKeywords = this.backgroundKeywords.some(keyword => 
      lower.includes(keyword)
    );
    
    return (hasObjectKeyword || startsWithArticle) && isShort && !hasBackgroundKeywords;
  }

  /**
   * Check if a phrase is likely describing a background/environment
   */
  private isLikelyBackground(phrase: string): boolean {
    if (!phrase || phrase.length < 2) return false;
    
    const lower = phrase.toLowerCase();
    const words = lower.split(/\s+/);
    
    // Check for background keywords
    const hasBackgroundKeyword = this.backgroundKeywords.some(keyword => 
      lower.includes(keyword) || words.some(w => w.includes(keyword))
    );
    
    // Check for location prepositions
    const hasLocationPreposition = this.locationPrepositions.some(prep => 
      words.includes(prep)
    );
    
    // Check for environmental descriptors
    const hasEnvironmentalWords = /(forest|jungle|desert|ocean|beach|mountain|city|room|space|sky|cloud|sunset|sunrise|night|day|snow|rain|storm|fog)/i.test(lower);
    
    // Backgrounds often have "the" before them
    const startsWithThe = /^the\s+/i.test(phrase);
    
    return hasBackgroundKeyword || hasLocationPreposition || hasEnvironmentalWords || startsWithThe;
  }

  /**
   * Preview what would be parsed (for UI display)
   */
  previewParse(prompt: string): {
    asset: string;
    background: string;
    confidence: number;
    method: string;
  } {
    const parsed = this.parsePrompt(prompt);
    return {
      asset: parsed.asset,
      background: parsed.background,
      confidence: parsed.confidence,
      method: parsed.method
    };
  }
}

export const promptParserService = new PromptParserService();

