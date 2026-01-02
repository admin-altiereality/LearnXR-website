// Keyword Extraction Service for 3D Asset Generation
// This service analyzes user prompts to identify 3D objects that can be generated via Meshy.ai

export interface ExtractedObject {
  keyword: string;
  category: string;
  confidence: number;
  description: string;
  suggestedPrompt: string;
}

export interface ObjectCategory {
  name: string;
  keywords: string[];
  description: string;
  examples: string[];
}

// Predefined categories of 3D objects that can be generated
const OBJECT_CATEGORIES: ObjectCategory[] = [
  {
    name: 'vehicles',
    keywords: ['spaceship', 'ship', 'car', 'truck', 'motorcycle', 'bicycle', 'boat', 'airplane', 'helicopter', 'train', 'bus', 'tank', 'submarine', 'rocket', 'ufo', 'hovercraft'],
    description: 'Transportation and vehicle objects',
    examples: ['futuristic spaceship', 'alien ship', 'vintage car', 'military tank']
  },
  {
    name: 'structures',
    keywords: ['building', 'house', 'castle', 'tower', 'bridge', 'wall', 'gate', 'door', 'window', 'chimney', 'roof', 'stairs', 'ladder', 'fence', 'temple', 'church', 'mosque', 'skyscraper'],
    description: 'Architectural and structural elements',
    examples: ['medieval castle', 'modern skyscraper', 'ancient temple']
  },
  {
    name: 'furniture',
    keywords: ['chair', 'table', 'bed', 'sofa', 'desk', 'cabinet', 'shelf', 'lamp', 'mirror', 'clock', 'vase', 'plant', 'cushion', 'pillow', 'rug', 'curtain'],
    description: 'Furniture and decorative items',
    examples: ['wooden chair', 'modern lamp', 'antique clock']
  },
  {
    name: 'nature',
    keywords: ['tree', 'rock', 'boulder', 'crystal', 'flower', 'bush', 'grass', 'mushroom', 'coral', 'shell', 'stone', 'gem', 'diamond', 'emerald', 'ruby', 'totem', 'statue'],
    description: 'Natural objects and formations',
    examples: ['ancient totem', 'crystal formation', 'mossy rock']
  },
  {
    name: 'technology',
    keywords: ['computer', 'robot', 'drone', 'satellite', 'antenna', 'screen', 'console', 'panel', 'circuit', 'wire', 'cable', 'battery', 'generator', 'engine', 'pump', 'valve'],
    description: 'Technology and electronic devices',
    examples: ['futuristic robot', 'control panel', 'satellite dish']
  },
  {
    name: 'weapons',
    keywords: ['sword', 'gun', 'bow', 'arrow', 'shield', 'armor', 'helmet', 'dagger', 'axe', 'spear', 'staff', 'wand', 'blaster', 'laser', 'cannon', 'missile'],
    description: 'Weapons and combat equipment',
    examples: ['magical sword', 'laser blaster', 'ancient shield']
  },
  {
    name: 'creatures',
    keywords: ['dragon', 'monster', 'beast', 'creature', 'animal', 'bird', 'fish', 'insect', 'alien', 'demon', 'angel', 'ghost', 'skeleton', 'zombie', 'vampire', 'werewolf'],
    description: 'Living creatures and beings',
    examples: ['fire dragon', 'alien creature', 'mechanical beast']
  },
  {
    name: 'tools',
    keywords: ['hammer', 'screwdriver', 'wrench', 'saw', 'drill', 'shovel', 'pickaxe', 'axe', 'knife', 'scissors', 'pliers', 'clamp', 'vise', 'anvil', 'forge'],
    description: 'Tools and equipment',
    examples: ['ancient hammer', 'futuristic drill', 'magical staff']
  },
  {
    name: 'sports',
    keywords: ['bat', 'ball', 'racket', 'paddle', 'stick', 'club', 'puck', 'disc', 'frisbee', 'dart', 'arrow', 'javelin', 'shot', 'weight', 'dumbbell', 'barbell'],
    description: 'Sports equipment and athletic items',
    examples: ['cricket bat', 'tennis racket', 'baseball bat', 'hockey stick']
  }
];

// Enhanced keyword patterns for better detection
const KEYWORD_PATTERNS = [
  // Direct object mentions
  /\b(spaceship|ship|car|truck|motorcycle|bicycle|boat|airplane|helicopter|train|bus|tank|submarine|rocket|ufo|hovercraft)\b/gi,
  /\b(building|house|castle|tower|bridge|wall|gate|door|window|chimney|roof|stairs|ladder|fence|temple|church|mosque|skyscraper)\b/gi,
  /\b(chair|table|bed|sofa|desk|cabinet|shelf|lamp|mirror|clock|vase|plant|cushion|pillow|rug|curtain)\b/gi,
  /\b(tree|rock|boulder|crystal|flower|bush|grass|mushroom|coral|shell|stone|gem|diamond|emerald|ruby|totem|statue)\b/gi,
  /\b(computer|robot|drone|satellite|antenna|screen|console|panel|circuit|wire|cable|battery|generator|engine|pump|valve)\b/gi,
  /\b(sword|gun|bow|arrow|shield|armor|helmet|dagger|axe|spear|staff|wand|blaster|laser|cannon|missile)\b/gi,
  /\b(dragon|monster|beast|creature|animal|bird|fish|insect|alien|demon|angel|ghost|skeleton|zombie|vampire|werewolf)\b/gi,
  /\b(hammer|screwdriver|wrench|saw|drill|shovel|pickaxe|axe|knife|scissors|pliers|clamp|vise|anvil|forge)\b/gi,
  /\b(bat|ball|racket|paddle|stick|club|puck|disc|frisbee|dart|arrow|javelin|shot|weight|dumbbell|barbell)\b/gi,
  
  // Descriptive patterns
  /\b(ancient|medieval|futuristic|modern|vintage|antique|magical|mystical|mechanical|robotic|organic|crystalline)\s+\w+/gi,
  /\b(floating|flying|hovering|standing|sitting|lying|buried|hidden|broken|damaged|new|old)\s+\w+/gi,
  /\b(giant|huge|massive|tiny|small|large|enormous|miniature)\s+\w+/gi,
  /\b(glowing|shining|sparkling|dark|bright|colorful|metallic|wooden|stone|crystal)\s+\w+/gi
];

export class KeywordExtractionService {
  /**
   * Extract 3D object keywords from a prompt
   */
  extractObjects(prompt: string): ExtractedObject[] {
    const extractedObjects: ExtractedObject[] = [];
    const lowerPrompt = prompt.toLowerCase();
    
    console.log(`🔍 Analyzing prompt: "${prompt}"`);
    
    // Extract direct keyword matches
    OBJECT_CATEGORIES.forEach(category => {
      category.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = prompt.match(regex);
        
        if (matches) {
          // Calculate confidence based on context
          const confidence = this.calculateConfidence(prompt, keyword, category.name);
          
          if (confidence > 0.3) { // Minimum confidence threshold
            extractedObjects.push({
              keyword: keyword.toLowerCase(),
              category: category.name,
              confidence,
              description: category.description,
              suggestedPrompt: this.generateSuggestedPrompt(keyword, category.name, prompt)
            });
          }
        }
      });
    });
    
    // Extract pattern-based matches
    KEYWORD_PATTERNS.forEach(pattern => {
      const matches = prompt.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const keyword = match.toLowerCase().replace(/^(ancient|medieval|futuristic|modern|vintage|antique|magical|mystical|mechanical|robotic|organic|crystalline|floating|flying|hovering|standing|sitting|lying|buried|hidden|broken|damaged|new|old|giant|huge|massive|tiny|small|large|enormous|miniature|glowing|shining|sparkling|dark|bright|colorful|metallic|wooden|stone|crystal)\s+/, '');
          
          if (keyword && !extractedObjects.find(obj => obj.keyword === keyword)) {
            const category = this.findCategoryForKeyword(keyword);
            const confidence = this.calculateConfidence(prompt, keyword, category?.name || 'unknown');
            
            if (confidence > 0.3) {
              extractedObjects.push({
                keyword,
                category: category?.name || 'unknown',
                confidence,
                description: category?.description || 'Unknown object type',
                suggestedPrompt: this.generateSuggestedPrompt(keyword, category?.name || 'unknown', prompt)
              });
            }
          }
        });
      }
    });
    
    // Remove duplicates and sort by confidence
    const uniqueObjects = this.removeDuplicates(extractedObjects);
    const sortedObjects = uniqueObjects.sort((a, b) => b.confidence - a.confidence);
    
    console.log(`🎯 Found ${sortedObjects.length} objects:`, sortedObjects.map(obj => `${obj.keyword} (${obj.category}, ${Math.round(obj.confidence * 100)}%)`));
    
    return sortedObjects;
  }
  
  /**
   * Calculate confidence score for a keyword based on context
   */
  private calculateConfidence(prompt: string, keyword: string, category: string): number {
    let confidence = 0.5; // Base confidence
    
    const lowerPrompt = prompt.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // Exact match bonus
    if (lowerPrompt.includes(lowerKeyword)) {
      confidence += 0.3;
    }
    
    // Context indicators
    const contextIndicators = [
      'with', 'containing', 'featuring', 'including', 'surrounded by', 'next to', 'near', 'beside',
      'above', 'below', 'inside', 'outside', 'around', 'through', 'across', 'over', 'under'
    ];
    
    contextIndicators.forEach(indicator => {
      if (lowerPrompt.includes(`${indicator} ${lowerKeyword}`)) {
        confidence += 0.2;
      }
    });
    
    // Descriptive modifiers
    const descriptiveModifiers = [
      'ancient', 'medieval', 'futuristic', 'modern', 'vintage', 'antique', 'magical', 'mystical',
      'mechanical', 'robotic', 'organic', 'crystalline', 'floating', 'flying', 'hovering',
      'giant', 'huge', 'massive', 'tiny', 'small', 'large', 'enormous', 'miniature'
    ];
    
    descriptiveModifiers.forEach(modifier => {
      if (lowerPrompt.includes(`${modifier} ${lowerKeyword}`)) {
        confidence += 0.1;
      }
    });
    
    // Category-specific bonuses
    if (category === 'structures' && lowerPrompt.includes('landscape')) {
      confidence += 0.1;
    }
    
    if (category === 'vehicles' && lowerPrompt.includes('transport')) {
      confidence += 0.1;
    }
    
    if (category === 'nature' && lowerPrompt.includes('environment')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0); // Cap at 1.0
  }
  
  /**
   * Find the category for a given keyword
   */
  private findCategoryForKeyword(keyword: string): ObjectCategory | null {
    return OBJECT_CATEGORIES.find(category => 
      category.keywords.some(k => k.toLowerCase() === keyword.toLowerCase())
    ) || null;
  }
  
  /**
   * Generate a suggested prompt for Meshy.ai generation
   */
  private generateSuggestedPrompt(keyword: string, category: string, originalPrompt: string): string {
    const basePrompt = `${keyword}`;
    
    // Extract style context from original prompt
    const styleKeywords = ['sci-fi', 'fantasy', 'medieval', 'modern', 'futuristic', 'ancient', 'vintage', 'cyberpunk', 'steampunk'];
    const foundStyle = styleKeywords.find(style => originalPrompt.toLowerCase().includes(style));
    
    if (foundStyle) {
      return `${foundStyle} ${basePrompt}`;
    }
    
    return basePrompt;
  }
  
  /**
   * Remove duplicate objects based on keyword
   */
  private removeDuplicates(objects: ExtractedObject[]): ExtractedObject[] {
    const seen = new Set<string>();
    return objects.filter(obj => {
      if (seen.has(obj.keyword)) {
        return false;
      }
      seen.add(obj.keyword);
      return true;
    });
  }
  
  /**
   * Get all available object categories
   */
  getObjectCategories(): ObjectCategory[] {
    return OBJECT_CATEGORIES;
  }
  
  /**
   * Check if a prompt contains any 3D object keywords
   */
  has3DObjects(prompt: string): boolean {
    const objects = this.extractObjects(prompt);
    return objects.length > 0;
  }
  
  /**
   * Get a summary of extracted objects
   */
  getExtractionSummary(prompt: string): {
    hasObjects: boolean;
    objectCount: number;
    categories: string[];
    confidence: number;
  } {
    const objects = this.extractObjects(prompt);
    const categories = [...new Set(objects.map(obj => obj.category))];
    const avgConfidence = objects.length > 0 
      ? objects.reduce((sum, obj) => sum + obj.confidence, 0) / objects.length 
      : 0;
    
    return {
      hasObjects: objects.length > 0,
      objectCount: objects.length,
      categories,
      confidence: avgConfidence
    };
  }
}

export const keywordExtractionService = new KeywordExtractionService(); 