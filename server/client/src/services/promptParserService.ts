// Intelligent Prompt Parser Service
// Automatically detects 3D asset descriptions and skybox/background descriptions from a single prompt

export type PromptType = 'mesh' | 'skybox' | 'both' | 'unknown';

export interface ParsedPrompt {
  original: string;
  asset: string; // 3D asset description
  background: string; // Skybox/background description
  confidence: number; // 0-1, how confident we are in the split
  method: 'intelligent' | 'fallback' | 'manual';
  promptType: PromptType; // Whether prompt is primarily for mesh, skybox, or both
  meshScore: number; // 0-1, how likely this is a mesh prompt
  skyboxScore: number; // 0-1, how likely this is a skybox prompt
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

  // Common 3D mesh object keywords (things that are typically objects, not environments)
  private meshObjectKeywords = [
    // Furniture & Decor
    'table', 'chair', 'desk', 'lamp', 'vase', 'statue', 'sculpture',
    'furniture', 'sofa', 'bed', 'cabinet', 'shelf', 'stool', 'bench',
    'bookshelf', 'wardrobe', 'dresser', 'nightstand', 'ottoman',
    // Vehicles
    'car', 'vehicle', 'bike', 'motorcycle', 'plane', 'ship', 'boat',
    'truck', 'bus', 'train', 'helicopter', 'drone',
    // Characters & Figures
    'character', 'figure', 'model', 'doll', 'toy', 'action figure',
    'person', 'human', 'robot', 'android', 'creature', 'monster',
    // Weapons & Tools
    'weapon', 'sword', 'gun', 'shield', 'armor', 'helmet', 'axe',
    'hammer', 'tool', 'wrench', 'screwdriver',
    // Nature Objects (portable/individual)
    'plant', 'flower', 'potted plant', 'crystal', 'gem', 'rock', 'stone',
    'boulder', 'log', 'branch',
    // Art & Collectibles
    'artwork', 'painting', 'sculpture', 'bust', 'trophy', 'award',
    // Electronics & Devices
    'phone', 'computer', 'laptop', 'tablet', 'camera', 'speaker',
    // Containers & Items
    'box', 'crate', 'barrel', 'bottle', 'jar', 'can', 'container',
    // Architectural Elements (as objects)
    'column', 'pillar', 'arch', 'fountain', 'monument'
  ];

  // High-priority skybox keywords (strong indicators)
  private highPrioritySkyboxKeywords = [
    'cityscape', 'landscape', 'panorama', 'panoramic', '360', '360°', 
    'environment', 'skybox', 'scene', 'vista', 'view', 'surroundings'
  ];

  // Action verbs that indicate environment descriptions (not object descriptions)
  private environmentActionVerbs = [
    'flying', 'floating', 'reflecting', 'glowing', 'shimmering', 'dancing',
    'swaying', 'gathering', 'crashing', 'patting', 'falling', 'rising',
    'flowing', 'blowing', 'shining', 'casting', 'creating', 'forming'
  ];

  // Descriptive patterns that indicate environments
  private environmentDescriptivePatterns = [
    /with\s+(flying|floating|reflecting|glowing|shimmering|dancing|swaying)/i,
    /during\s+(a|an|the)?\s*(rain|storm|snow|fog|mist|wind|blizzard|sunset|sunrise|night|day|twilight)/i,
    /at\s+(sunset|sunrise|night|dawn|dusk|twilight|noon|midnight|morning|evening)/i,
    /in\s+(a|an|the)?\s*(rain|storm|snow|fog|mist|wind|blizzard)/i,
    /reflecting\s+in/i,
    /shimmering\s+in/i,
    /glowing\s+in/i
  ];

  // Skybox-specific keywords (environments, landscapes, rooms)
  private skyboxKeywords = [
    // Natural Environments
    'forest', 'jungle', 'desert', 'ocean', 'beach', 'mountain', 'valley',
    'cave', 'tunnel', 'canyon', 'cliff', 'shore', 'coast', 'island',
    'meadow', 'field', 'prairie', 'tundra', 'swamp', 'marsh',
    // Urban Environments
    'city', 'cityscape', 'street', 'alley', 'park', 'plaza', 'square', 'marketplace',
    'downtown', 'suburb', 'neighborhood', 'district',
    // Indoor Spaces
    'room', 'bedroom', 'kitchen', 'bathroom', 'living room', 'office',
    'studio', 'workshop', 'garage', 'basement', 'attic', 'hallway',
    'corridor', 'lobby', 'foyer', 'library', 'museum', 'gallery',
    // Architectural Spaces
    'house', 'building', 'tower', 'castle', 'palace', 'temple', 'church',
    'cathedral', 'monastery', 'fortress', 'dungeon', 'crypt',
    // Atmospheric Conditions
    'space', 'planet', 'asteroid', 'nebula', 'galaxy', 'starfield',
    'sky', 'clouds', 'sunset', 'sunrise', 'dawn', 'dusk', 'night', 'day',
    'twilight', 'noon', 'midnight', 'morning', 'evening',
    // Weather & Seasons
    'snow', 'rain', 'storm', 'fog', 'mist', 'wind', 'blizzard',
    'winter', 'summer', 'spring', 'autumn', 'fall',
    // Water Features
    'river', 'lake', 'pond', 'waterfall', 'stream', 'brook', 'creek',
    'harbor', 'port', 'dock', 'pier',
    // Skybox-specific terms
    'panorama', 'panoramic', '360', '360°', 'environment', 'scene',
    'landscape', 'vista', 'view', 'surroundings', 'ambience', 'atmosphere'
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
        method: 'fallback',
        promptType: 'unknown',
        meshScore: 0,
        skyboxScore: 0
      };
    }

    const trimmed = prompt.trim();
    
    // Calculate mesh and skybox scores first
    const { meshScore, skyboxScore, promptType } = this.analyzePromptType(trimmed);
    
    // If prompt is clearly a skybox (high confidence), don't try to split it
    if (promptType === 'skybox' && skyboxScore > 0.7 && meshScore < 0.4) {
      return {
        original: trimmed,
        asset: '', // No separate asset for pure skybox prompts
        background: trimmed, // Entire prompt is the skybox
        confidence: Math.min(skyboxScore + 0.2, 1),
        method: 'intelligent',
        promptType,
        meshScore,
        skyboxScore
      };
    }
    
    // If prompt is clearly a mesh (high confidence), don't try to split it
    if (promptType === 'mesh' && meshScore > 0.7 && skyboxScore < 0.4) {
      return {
        original: trimmed,
        asset: trimmed, // Entire prompt is the asset
        background: '', // No separate background for pure mesh prompts
        confidence: Math.min(meshScore + 0.2, 1),
        method: 'intelligent',
        promptType,
        meshScore,
        skyboxScore
      };
    }
    
    // Try intelligent parsing first
    const intelligentResult = this.intelligentParse(trimmed, { meshScore, skyboxScore, promptType });
    if (intelligentResult.confidence > 0.5) {
      return intelligentResult;
    }

    // Fallback: try simple pattern matching
    const patternResult = this.patternBasedParse(trimmed, { meshScore, skyboxScore, promptType });
    if (patternResult.confidence > 0.3) {
      return patternResult;
    }

    // Last resort: use the whole prompt for both (or based on type)
    if (promptType === 'skybox') {
      return {
        original: trimmed,
        asset: '',
        background: trimmed,
        confidence: Math.max(0.3, skyboxScore * 0.6),
        method: 'fallback',
        promptType,
        meshScore,
        skyboxScore
      };
    } else if (promptType === 'mesh') {
      return {
        original: trimmed,
        asset: trimmed,
        background: '',
        confidence: Math.max(0.3, meshScore * 0.6),
        method: 'fallback',
        promptType,
        meshScore,
        skyboxScore
      };
    }
    
    return {
      original: trimmed,
      asset: trimmed,
      background: trimmed,
      confidence: 0.1,
      method: 'fallback',
      promptType,
      meshScore,
      skyboxScore
    };
  }

  /**
   * Analyze prompt to determine if it's primarily for mesh, skybox, or both
   */
  private analyzePromptType(prompt: string): {
    meshScore: number;
    skyboxScore: number;
    promptType: PromptType;
  } {
    const lowerPrompt = prompt.toLowerCase();
    const words = lowerPrompt.split(/\s+/);
    
    // Multi-pass analysis for better accuracy
    const analysisResults = {
      meshScore: 0,
      skyboxScore: 0,
      factors: {
        keywordBased: { mesh: 0, skybox: 0 },
        phraseBased: { mesh: 0, skybox: 0 },
        structureBased: { mesh: 0, skybox: 0 },
        patternBased: { mesh: 0, skybox: 0 }
      }
    };
    
    // PASS 1: Keyword-based analysis with context awareness
    let meshMatches = 0;
    let meshWeight = 0;
    const meshKeywordPositions: number[] = [];
    
    for (const keyword of this.meshObjectKeywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      let match;
      while ((match = regex.exec(lowerPrompt)) !== null) {
        meshMatches++;
        const keywordLength = keyword.split(/\s+/).length;
        meshWeight += keywordLength;
        meshKeywordPositions.push(match.index);
        
        // Check if keyword is in environment context (e.g., "vehicles in cityscape")
        const contextWindow = 40;
        const beforeContext = lowerPrompt.substring(Math.max(0, match.index - contextWindow), match.index);
        const afterContext = lowerPrompt.substring(match.index + match[0].length, Math.min(lowerPrompt.length, match.index + match[0].length + contextWindow));
        
        // If surrounded by environment keywords, reduce weight (it's part of environment description)
        const hasEnvContext = this.skyboxKeywords.some(sk => 
          beforeContext.includes(sk) || afterContext.includes(sk)
        );
        
        // Check for environment action verbs nearby
        const hasEnvActionVerb = this.environmentActionVerbs.some(verb =>
          beforeContext.includes(verb) || afterContext.includes(verb)
        );
        
        if (hasEnvContext || hasEnvActionVerb) {
          meshWeight -= keywordLength * 0.7; // Significant reduction if in environment context
        }
      }
    }
    
    analysisResults.factors.keywordBased.mesh = Math.min(meshMatches / 4, 1) * 0.5 + Math.min(meshWeight / 10, 1) * 0.5;
    
    // Count skybox keywords with stronger weighting
    let skyboxMatches = 0;
    let skyboxWeight = 0;
    const skyboxKeywordPositions: number[] = [];
    
    for (const keyword of this.skyboxKeywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      let match;
      while ((match = regex.exec(lowerPrompt)) !== null) {
        skyboxMatches++;
        const keywordLength = keyword.split(/\s+/).length;
        let keywordWeight = keywordLength * 1.5;
        
        // Special boost for high-priority keywords
        if (this.highPrioritySkyboxKeywords.includes(keyword)) {
          keywordWeight += 3; // Extra boost for strong environment indicators
        }
        
        skyboxWeight += keywordWeight;
        skyboxKeywordPositions.push(match.index);
      }
    }
    
    analysisResults.factors.keywordBased.skybox = Math.min(skyboxMatches / 4, 1) * 0.5 + Math.min(skyboxWeight / 15, 1) * 0.5;
    
    // PASS 2: Phrase-level analysis (n-grams and patterns)
    const bigrams: string[] = [];
    const trigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    for (let i = 0; i < words.length - 2; i++) {
      trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    
    // Check for environment descriptive phrases
    let envPhraseScore = 0;
    for (const pattern of this.environmentDescriptivePatterns) {
      if (pattern.test(prompt)) {
        envPhraseScore += 0.3;
      }
    }
    
    // Check for environment action verb phrases
    const envActionVerbMatches = this.environmentActionVerbs.filter(verb => 
      lowerPrompt.includes(verb)
    ).length;
    envPhraseScore += Math.min(envActionVerbMatches * 0.15, 0.4);
    
    // Check for "environment/scene showing/featuring" patterns (strong skybox indicator)
    const envShowingPattern = /\b(environment|scene|landscape|cityscape|panorama|view|vista)\s+(showing|featuring|with|containing|including)/i.test(prompt);
    if (envShowingPattern) {
      envPhraseScore += 0.4;
    }
    
    // Check for environment keyword + "with" + objects pattern (very strong skybox signal)
    // e.g., "cityscape with vehicles", "landscape with trees"
    const envWithObjectsPattern = this.skyboxKeywords.some(sk => {
      const regex = new RegExp(`\\b${sk}\\s+with\\s+`, 'i');
      return regex.test(prompt);
    });
    if (envWithObjectsPattern) {
      envPhraseScore += 0.5; // Strong boost for this pattern
    }
    
    // Check for "in the background" patterns (objects are secondary)
    const backgroundPattern = /\b(in|on|at)\s+(the\s+)?(background|foreground|distance|horizon)/i.test(prompt);
    if (backgroundPattern) {
      envPhraseScore += 0.3;
    }
    
    analysisResults.factors.phraseBased.skybox = Math.min(envPhraseScore, 1);
    
    // Check for mesh-specific phrases
    const meshPhrasePatterns = [
      /\b(3d\s+)?(mesh|model|object|asset|item|thing)\b/i,
      /\b(detailed|high\s+poly|low\s+poly)\s+(mesh|model|object)/i,
      /\b(create|generate|make)\s+(a|an|the)?\s*(3d\s+)?(mesh|model|object)/i
    ];
    let meshPhraseScore = 0;
    for (const pattern of meshPhrasePatterns) {
      if (pattern.test(prompt)) {
        meshPhraseScore += 0.3;
      }
    }
    analysisResults.factors.phraseBased.mesh = Math.min(meshPhraseScore, 1);
    
    // PASS 3: Sentence structure analysis
    // Check if prompt starts with environment keywords (strong skybox indicator)
    const firstThreeWords = words.slice(0, 3).join(' ');
    
    const startsWithEnvKeyword = this.highPrioritySkyboxKeywords.some(sk => 
      firstThreeWords.includes(sk)
    ) || this.skyboxKeywords.some(sk => 
      firstThreeWords.startsWith(sk) || firstThreeWords.includes(` ${sk}`)
    );
    
    // Check for environment keyword followed by "with" (very strong skybox signal)
    const envWithPattern = this.skyboxKeywords.some(sk => {
      const index = lowerPrompt.indexOf(sk);
      if (index === -1) return false;
      const afterKeyword = lowerPrompt.substring(index + sk.length, index + sk.length + 10);
      return afterKeyword.includes(' with ') || afterKeyword.includes(' featuring ') || afterKeyword.includes(' showing ');
    });
    
    if (startsWithEnvKeyword) {
      analysisResults.factors.structureBased.skybox = 0.4;
    }
    if (envWithPattern) {
      analysisResults.factors.structureBased.skybox = Math.max(analysisResults.factors.structureBased.skybox, 0.5);
    }
    
    // Check if prompt starts with object description (strong mesh indicator)
    const startsWithObjectPattern = /^(a|an|the)\s+[a-z]+\s+(table|chair|car|statue|sculpture|weapon|character|figure|vase|lamp|desk|sofa|bed)/i.test(prompt);
    if (startsWithObjectPattern) {
      analysisResults.factors.structureBased.mesh = 0.4;
    }
    
    // Check for explicit object focus patterns
    const objectFocusPattern = /^(a|an|the)\s+(detailed|ornate|intricate|vintage|medieval|futuristic)\s+(table|chair|car|statue|sculpture|weapon|character|figure|vase|lamp)/i.test(prompt);
    if (objectFocusPattern) {
      analysisResults.factors.structureBased.mesh = Math.max(analysisResults.factors.structureBased.mesh, 0.5);
    }
    
    // PASS 4: Pattern-based analysis
    const hasMeshIndicators = /\b(3d\s+)?(mesh|model|object|asset|item|thing)\b/i.test(prompt);
    const hasSkyboxIndicators = /\b(360|panorama|panoramic|environment|skybox|scene|landscape|room|space|view|vista)\b/i.test(prompt);
    
    // Check for location prepositions (often indicate skybox)
    const hasLocationPreps = this.locationPrepositions.some(prep => 
      new RegExp(`\\b${prep}\\b`, 'i').test(lowerPrompt)
    );
    
    if (hasMeshIndicators) {
      analysisResults.factors.patternBased.mesh = 0.35;
    }
    if (hasSkyboxIndicators) {
      analysisResults.factors.patternBased.skybox = 0.35;
    }
    if (hasLocationPreps) {
      analysisResults.factors.patternBased.skybox += 0.25;
    }
    
    // Combine all analysis factors with weighted averaging
    const keywordWeight = 0.35;
    const phraseWeight = 0.25;
    const structureWeight = 0.20;
    const patternWeight = 0.20;
    
    let meshScore = 
      analysisResults.factors.keywordBased.mesh * keywordWeight +
      analysisResults.factors.phraseBased.mesh * phraseWeight +
      analysisResults.factors.structureBased.mesh * structureWeight +
      analysisResults.factors.patternBased.mesh * patternWeight;
    
    let skyboxScore = 
      analysisResults.factors.keywordBased.skybox * keywordWeight +
      analysisResults.factors.phraseBased.skybox * phraseWeight +
      analysisResults.factors.structureBased.skybox * structureWeight +
      analysisResults.factors.patternBased.skybox * patternWeight;
    
    // Position-based adjustments
    if (skyboxKeywordPositions.length > 0 && meshKeywordPositions.length > 0) {
      const firstSkyboxPos = Math.min(...skyboxKeywordPositions);
      const firstMeshPos = Math.min(...meshKeywordPositions);
      if (firstSkyboxPos < firstMeshPos && skyboxMatches >= meshMatches) {
        skyboxScore = Math.min(skyboxScore + 0.15, 1);
        meshScore = Math.max(meshScore - 0.08, 0);
      } else if (firstMeshPos < firstSkyboxPos && meshMatches >= skyboxMatches) {
        meshScore = Math.min(meshScore + 0.15, 1);
        skyboxScore = Math.max(skyboxScore - 0.08, 0);
      }
    }
    
    // Boost for starting with environment keywords
    if (startsWithEnvKeyword && skyboxScore > 0.3) {
      skyboxScore = Math.min(skyboxScore + 0.12, 1);
    }
    
    // Confidence boost for high scores
    if (skyboxScore > 0.7) {
      skyboxScore = Math.min(skyboxScore + 0.05, 1);
    }
    if (meshScore > 0.7) {
      meshScore = Math.min(meshScore + 0.05, 1);
    }
    
    // Determine prompt type with improved logic
    let promptType: PromptType = 'unknown';
    const threshold = 0.35;
    const bothThreshold = 0.4; // Higher threshold for "both" to avoid false positives
    
    // Special case: If one score is very high and the other is very low, choose the high one
    if (skyboxScore > 0.7 && meshScore < 0.3) {
      promptType = 'skybox';
    } else if (meshScore > 0.7 && skyboxScore < 0.3) {
      promptType = 'mesh';
    } else if (meshScore >= bothThreshold && skyboxScore >= bothThreshold) {
      // Both thresholds met - check if it's truly "both" or if one dominates
      const scoreDiff = Math.abs(meshScore - skyboxScore);
      if (scoreDiff < 0.15) {
        // Scores are close - it's truly "both"
        promptType = 'both';
      } else if (meshScore > skyboxScore) {
        // Mesh dominates
        promptType = meshScore >= threshold ? 'mesh' : 'both';
      } else {
        // Skybox dominates
        promptType = skyboxScore >= threshold ? 'skybox' : 'both';
      }
    } else if (meshScore >= threshold) {
      promptType = 'mesh';
    } else if (skyboxScore >= threshold) {
      promptType = 'skybox';
    } else {
      // If neither is clear, use heuristics
      if (words.length <= 3) {
        // Very short prompts are usually objects
        promptType = 'mesh';
        return { meshScore: 0.5, skyboxScore: 0.2, promptType };
      } else if (words.length >= 15) {
        // Very long prompts are usually environments
        promptType = 'skybox';
        return { meshScore: 0.2, skyboxScore: 0.5, promptType };
      } else {
        // Medium length - check for explicit indicators
        if (hasSkyboxIndicators && !hasMeshIndicators) {
          promptType = 'skybox';
          return { meshScore: 0.2, skyboxScore: 0.5, promptType };
        } else if (hasMeshIndicators && !hasSkyboxIndicators) {
          promptType = 'mesh';
          return { meshScore: 0.5, skyboxScore: 0.2, promptType };
        } else {
          promptType = 'unknown';
        }
      }
    }
    
    return { meshScore, skyboxScore, promptType };
  }

  /**
   * Intelligent parsing using linguistic patterns
   */
  private intelligentParse(
    prompt: string,
    typeAnalysis: { meshScore: number; skyboxScore: number; promptType: PromptType }
  ): ParsedPrompt {
    
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
          method: 'intelligent',
          promptType: typeAnalysis.promptType,
          meshScore: typeAnalysis.meshScore,
          skyboxScore: typeAnalysis.skyboxScore
        };
      }
    }

    // Pattern 2: "[Object] with [background context]" or "[Object], [background]"
    // But be careful - "cityscape with vehicles" is NOT "cityscape" as object
    const pattern2 = /^([^,]+?)(?:\s+with\s+|\s*,\s*)(.+)$/i;
    const match2 = prompt.match(pattern2);
    if (match2) {
      const part1 = match2[1].trim();
      const part2 = match2[2].trim();
      
      // Validate that part1 is a complete, meaningful object description
      // Reject if part1 is too short or incomplete (e.g., "A futuristic" is incomplete)
      const part1Words = part1.split(/\s+/);
      const isPart1Complete = part1Words.length >= 2 && 
                              !part1Words[part1Words.length - 1].match(/^(a|an|the|futuristic|ancient|modern|vintage|old|new|big|small|large|tiny)$/i);
      
      // If prompt type is clearly skybox, don't split on "with" - it's likely descriptive
      if (typeAnalysis.promptType === 'skybox' && typeAnalysis.skyboxScore > 0.6) {
        // Don't split skybox prompts - they're describing the environment
        // Skip this pattern for skybox-dominant prompts
      } else if (isPart1Complete && this.isLikelyObject(part1) && this.isLikelyBackground(part2)) {
        return {
          original: prompt,
          asset: part1,
          background: part2,
          confidence: 0.8,
          method: 'intelligent',
          promptType: typeAnalysis.promptType,
          meshScore: typeAnalysis.meshScore,
          skyboxScore: typeAnalysis.skyboxScore
        };
      }
      
      // Reverse check: maybe part2 is object and part1 is background
      // But only if part1 is actually a background keyword
      if (this.isLikelyObject(part2) && this.isLikelyBackground(part1) && 
          this.skyboxKeywords.some(sk => part1.toLowerCase().includes(sk))) {
        return {
          original: prompt,
          asset: part2,
          background: part1,
          confidence: 0.75,
          method: 'intelligent',
          promptType: typeAnalysis.promptType,
          meshScore: typeAnalysis.meshScore,
          skyboxScore: typeAnalysis.skyboxScore
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
          method: 'intelligent',
          promptType: typeAnalysis.promptType,
          meshScore: typeAnalysis.meshScore,
          skyboxScore: typeAnalysis.skyboxScore
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
            method: 'intelligent',
            promptType: typeAnalysis.promptType,
            meshScore: typeAnalysis.meshScore,
            skyboxScore: typeAnalysis.skyboxScore
          };
        }
      }
    }

    return {
      original: prompt,
      asset: '',
      background: '',
      confidence: 0,
      method: 'intelligent',
      promptType: typeAnalysis.promptType,
      meshScore: typeAnalysis.meshScore,
      skyboxScore: typeAnalysis.skyboxScore
    };
  }

  /**
   * Pattern-based parsing using keyword matching
   */
  private patternBasedParse(
    prompt: string,
    typeAnalysis: { meshScore: number; skyboxScore: number; promptType: PromptType }
  ): ParsedPrompt {
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
        method: 'intelligent',
        promptType: typeAnalysis.promptType,
        meshScore: typeAnalysis.meshScore,
        skyboxScore: typeAnalysis.skyboxScore
      };
    }

    // Try reverse: find object keywords first
    let objectEndIndex = -1;
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[^a-z]/g, '');
      if (this.meshObjectKeywords.some(obj => word.includes(obj) || obj.includes(word))) {
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
          method: 'intelligent',
          promptType: typeAnalysis.promptType,
          meshScore: typeAnalysis.meshScore,
          skyboxScore: typeAnalysis.skyboxScore
        };
      }
    }

    return {
      original: prompt,
      asset: '',
      background: '',
      confidence: 0,
      method: 'intelligent',
      promptType: typeAnalysis.promptType,
      meshScore: typeAnalysis.meshScore,
      skyboxScore: typeAnalysis.skyboxScore
    };
  }

  /**
   * Check if a phrase is likely describing a 3D object
   */
  private isLikelyObject(phrase: string): boolean {
    if (!phrase || phrase.length < 2) return false;
    
    const lower = phrase.toLowerCase();
    const words = lower.split(/\s+/);
    
    // Reject if phrase is too short or incomplete (e.g., "A futuristic" is incomplete)
    if (words.length < 2) return false;
    
    // Reject if it ends with an adjective (likely incomplete)
    const endsWithAdjective = /(futuristic|ancient|modern|vintage|old|new|big|small|large|tiny|beautiful|detailed|ornate|majestic)$/i.test(phrase.trim());
    if (endsWithAdjective && words.length <= 2) return false;
    
    // Check for object keywords
    const hasObjectKeyword = this.meshObjectKeywords.some(keyword => 
      lower.includes(keyword) || words.some(w => w.includes(keyword))
    );
    
    // Check for articles (a, an, the) which often precede objects
    const startsWithArticle = /^(a|an|the)\s+/i.test(phrase);
    
    // Check if it's short (objects are usually shorter descriptions)
    const isShort = words.length <= 6;
    
    // Check if it doesn't contain too many background keywords
    const hasBackgroundKeywords = this.skyboxKeywords.some(keyword => 
      lower.includes(keyword)
    );
    
    // If it contains strong skybox keywords, it's not an object
    const hasStrongSkyboxKeywords = ['cityscape', 'landscape', 'panorama', 'environment', 'scene', 'skybox'].some(sk => 
      lower.includes(sk)
    );
    
    return (hasObjectKeyword || startsWithArticle) && isShort && !hasBackgroundKeywords && !hasStrongSkyboxKeywords;
  }

  /**
   * Check if a phrase is likely describing a background/environment
   */
  private isLikelyBackground(phrase: string): boolean {
    if (!phrase || phrase.length < 2) return false;
    
    const lower = phrase.toLowerCase();
    const words = lower.split(/\s+/);
    
    // Check for skybox keywords (preferred over backgroundKeywords)
    const hasSkyboxKeyword = this.skyboxKeywords.some(keyword => 
      lower.includes(keyword) || words.some(w => w.includes(keyword))
    );
    
    // Check for background keywords
    const hasBackgroundKeyword = this.backgroundKeywords.some(keyword => 
      lower.includes(keyword) || words.some(w => w.includes(keyword))
    );
    
    // Check for location prepositions
    const hasLocationPreposition = this.locationPrepositions.some(prep => 
      words.includes(prep)
    );
    
    // Check for environmental descriptors
    const hasEnvironmentalWords = /(forest|jungle|desert|ocean|beach|mountain|city|room|space|sky|cloud|sunset|sunrise|night|day|snow|rain|storm|fog|cityscape|landscape|panorama|environment|scene)/i.test(lower);
    
    // Check for descriptive patterns that indicate environments
    const hasDescriptivePattern = /\b(with|featuring|showing|containing|including|during|at|in)\s+(flying|floating|reflecting|glowing|shimmering|dancing|swaying|gathering|crashing|patting)/i.test(phrase);
    
    // Backgrounds often have "the" before them, or start with environment words
    const startsWithThe = /^the\s+/i.test(phrase);
    const startsWithEnvWord = this.skyboxKeywords.some(sk => 
      lower.startsWith(sk) || lower.startsWith(`a ${sk}`) || lower.startsWith(`an ${sk}`)
    );
    
    return hasSkyboxKeyword || hasBackgroundKeyword || hasLocationPreposition || hasEnvironmentalWords || hasDescriptivePattern || startsWithThe || startsWithEnvWord;
  }

  /**
   * Preview what would be parsed (for UI display)
   */
  previewParse(prompt: string): {
    asset: string;
    background: string;
    confidence: number;
    method: string;
    promptType: PromptType;
    meshScore: number;
    skyboxScore: number;
  } {
    const parsed = this.parsePrompt(prompt);
    return {
      asset: parsed.asset,
      background: parsed.background,
      confidence: parsed.confidence,
      method: parsed.method,
      promptType: parsed.promptType,
      meshScore: parsed.meshScore,
      skyboxScore: parsed.skyboxScore
    };
  }

  /**
   * Test the analyzer with a set of prompts and return results
   * Useful for iterative improvement
   */
  testAnalyzer(testPrompts: Array<{
    prompt: string;
    expectedType: PromptType;
    description?: string;
  }>): {
    results: Array<{
      prompt: string;
      expected: PromptType;
      actual: PromptType;
      meshScore: number;
      skyboxScore: number;
      confidence: number;
      passed: boolean;
    }>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      accuracy: number;
    };
  } {
    const results = testPrompts.map(test => {
      const parsed = this.parsePrompt(test.prompt);
      const passed = parsed.promptType === test.expectedType;
      
      return {
        prompt: test.prompt,
        expected: test.expectedType,
        actual: parsed.promptType,
        meshScore: parsed.meshScore,
        skyboxScore: parsed.skyboxScore,
        confidence: parsed.confidence,
        passed
      };
    });

    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const accuracy = (passed / results.length) * 100;

    return {
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        accuracy
      }
    };
  }
}

export const promptParserService = new PromptParserService();


