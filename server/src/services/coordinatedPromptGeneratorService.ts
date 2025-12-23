// Coordinated Prompt Generator Service (Server-side)
// Generates skybox prompts, 3D asset prompts, and grounding metadata
// for seamless integration between Skybox and Meshy 3D assets

export interface GroundingMetadata {
  preferred_ground_material: string;
  ground_color_hint: string;
  light_direction: string;
  shadow_type: "soft" | "sharp";
  asset_base_contact_shape: string;
  scale_reference_meters: number;
}

export interface CoordinatedGenerationOutput {
  skybox_prompt: string;
  asset_prompt: string;
  grounding_metadata: GroundingMetadata;
}

class CoordinatedPromptGeneratorService {
  // Ground material mappings
  private groundMaterialMap: { [key: string]: string } = {
    'forest': 'dirt',
    'jungle': 'mud',
    'desert': 'sand',
    'beach': 'sand',
    'ocean': 'sand',
    'mountain': 'stone',
    'cave': 'stone',
    'city': 'concrete',
    'street': 'asphalt',
    'room': 'wood',
    'house': 'wood',
    'building': 'concrete',
    'park': 'grass',
    'garden': 'grass',
    'space': 'metal',
    'planet': 'rock',
    'snow': 'snow',
    'ice': 'ice',
    'tile': 'tile',
    'marble': 'marble',
    'brick': 'brick',
    'cobblestone': 'stone',
    'dirt': 'dirt',
    'grass': 'grass',
    'sand': 'sand',
    'stone': 'stone',
    'metal': 'metal',
    'wood': 'wood',
    'concrete': 'concrete',
    'asphalt': 'asphalt'
  };

  // Ground color hints
  private groundColorMap: { [key: string]: string } = {
    'dirt': '#8B6F47',
    'mud': '#5C4033',
    'sand': '#F4A460',
    'stone': '#808080',
    'concrete': '#C0C0C0',
    'asphalt': '#2F2F2F',
    'wood': '#8B4513',
    'grass': '#228B22',
    'snow': '#FFFAFA',
    'ice': '#B0E0E6',
    'tile': '#E6E6FA',
    'marble': '#F5F5DC',
    'brick': '#B22222',
    'rock': '#696969',
    'metal': '#708090'
  };

  // Asset base contact shapes
  private contactShapeMap: { [key: string]: string } = {
    'table': 'rectangular',
    'chair': 'four-point',
    'desk': 'rectangular',
    'lamp': 'circular',
    'vase': 'circular',
    'statue': 'rectangular',
    'sculpture': 'irregular',
    'car': 'rectangular',
    'vehicle': 'rectangular',
    'bike': 'two-point',
    'motorcycle': 'two-point',
    'tree': 'circular',
    'plant': 'circular',
    'rock': 'irregular',
    'stone': 'irregular',
    'crystal': 'polygonal',
    'weapon': 'rectangular',
    'sword': 'rectangular',
    'furniture': 'rectangular',
    'sofa': 'rectangular',
    'bed': 'rectangular',
    'cabinet': 'rectangular',
    'shelf': 'rectangular',
    'toy': 'circular',
    'doll': 'circular',
    'figure': 'rectangular',
    'model': 'rectangular',
    'character': 'rectangular',
    'building': 'rectangular',
    'structure': 'rectangular',
    'tower': 'circular',
    'castle': 'rectangular',
    'house': 'rectangular',
    'monument': 'rectangular',
    'pillar': 'circular',
    'column': 'circular',
    'pedestal': 'rectangular',
    'platform': 'rectangular',
    'altar': 'rectangular',
    'shrine': 'rectangular'
  };

  /**
   * Generate coordinated prompts and metadata from user input
   */
  generate(userPrompt: string): CoordinatedGenerationOutput {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('User prompt is required');
    }

    const trimmed = userPrompt.trim().toLowerCase();
    
    // Analyze the prompt to extract context
    const context = this.analyzeContext(trimmed);
    
    // Generate skybox prompt with detailed ground plane information
    const skyboxPrompt = this.generateSkyboxPrompt(userPrompt.trim(), context);
    
    // Generate 3D asset prompt with grounding specifications
    const assetPrompt = this.generateAssetPrompt(userPrompt.trim(), context);
    
    // Generate grounding metadata
    const groundingMetadata = this.generateGroundingMetadata(context);

    return {
      skybox_prompt: skyboxPrompt,
      asset_prompt: assetPrompt,
      grounding_metadata: groundingMetadata
    };
  }

  /**
   * Analyze user prompt to extract context
   */
  private analyzeContext(prompt: string): {
    environment: string;
    groundType: string;
    timeOfDay: string;
    weather: string;
    style: string;
    assetType: string;
    lightDirection: string;
  } {
    const lower = prompt.toLowerCase();
    
    // Detect environment
    let environment = 'natural';
    let groundType = 'dirt';
    
    if (lower.includes('forest') || lower.includes('jungle')) {
      environment = 'forest';
      groundType = 'dirt';
    } else if (lower.includes('desert') || lower.includes('sand')) {
      environment = 'desert';
      groundType = 'sand';
    } else if (lower.includes('beach') || lower.includes('ocean') || lower.includes('shore')) {
      environment = 'beach';
      groundType = 'sand';
    } else if (lower.includes('mountain') || lower.includes('hill')) {
      environment = 'mountain';
      groundType = 'stone';
    } else if (lower.includes('cave') || lower.includes('cavern')) {
      environment = 'cave';
      groundType = 'stone';
    } else if (lower.includes('city') || lower.includes('urban') || lower.includes('street')) {
      environment = 'urban';
      groundType = 'concrete';
    } else if (lower.includes('room') || lower.includes('interior') || lower.includes('house') || lower.includes('building')) {
      environment = 'interior';
      groundType = 'wood';
    } else if (lower.includes('park') || lower.includes('garden') || lower.includes('meadow')) {
      environment = 'park';
      groundType = 'grass';
    } else if (lower.includes('space') || lower.includes('planet') || lower.includes('alien')) {
      environment = 'space';
      groundType = 'rock';
    } else if (lower.includes('snow') || lower.includes('winter') || lower.includes('arctic')) {
      environment = 'snow';
      groundType = 'snow';
    } else if (lower.includes('ice') || lower.includes('frozen')) {
      environment = 'ice';
      groundType = 'ice';
    }

    // Override ground type if explicitly mentioned
    for (const [key, value] of Object.entries(this.groundMaterialMap)) {
      if (lower.includes(key)) {
        groundType = value;
        break;
      }
    }

    // Detect time of day
    let timeOfDay = 'day';
    if (lower.includes('sunset') || lower.includes('dusk') || lower.includes('evening')) {
      timeOfDay = 'sunset';
    } else if (lower.includes('sunrise') || lower.includes('dawn') || lower.includes('morning')) {
      timeOfDay = 'sunrise';
    } else if (lower.includes('night') || lower.includes('midnight') || lower.includes('dark')) {
      timeOfDay = 'night';
    } else if (lower.includes('noon') || lower.includes('midday')) {
      timeOfDay = 'noon';
    }

    // Detect weather
    let weather = 'clear';
    if (lower.includes('rain') || lower.includes('rainy') || lower.includes('storm')) {
      weather = 'rainy';
    } else if (lower.includes('fog') || lower.includes('mist') || lower.includes('hazy')) {
      weather = 'foggy';
    } else if (lower.includes('cloud') || lower.includes('overcast')) {
      weather = 'cloudy';
    } else if (lower.includes('snow') || lower.includes('snowing')) {
      weather = 'snowy';
    }

    // Detect style
    let style = 'realistic';
    if (lower.includes('fantasy') || lower.includes('magical') || lower.includes('enchanted')) {
      style = 'fantasy';
    } else if (lower.includes('sci-fi') || lower.includes('futuristic') || lower.includes('cyberpunk')) {
      style = 'sci-fi';
    } else if (lower.includes('modern') || lower.includes('contemporary')) {
      style = 'modern';
    } else if (lower.includes('medieval') || lower.includes('ancient') || lower.includes('historical')) {
      style = 'medieval';
    } else if (lower.includes('cartoon') || lower.includes('stylized')) {
      style = 'cartoon';
    }

    // Detect asset type
    let assetType = 'object';
    for (const [key, _] of Object.entries(this.contactShapeMap)) {
      if (lower.includes(key)) {
        assetType = key;
        break;
      }
    }

    // Determine light direction based on time of day
    let lightDirection = 'top';
    if (timeOfDay === 'sunset') {
      lightDirection = 'west';
    } else if (timeOfDay === 'sunrise') {
      lightDirection = 'east';
    } else if (timeOfDay === 'noon') {
      lightDirection = 'top';
    } else if (timeOfDay === 'night') {
      lightDirection = 'moon';
    }

    return {
      environment,
      groundType,
      timeOfDay,
      weather,
      style,
      assetType,
      lightDirection
    };
  }

  /**
   * Truncate prompt to fit within API limits
   */
  private truncatePrompt(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) return prompt;
    
    // Try to truncate at sentence boundaries first
    const sentences = prompt.split(/[.,;]/);
    let truncated = '';
    for (const sentence of sentences) {
      if ((truncated + sentence).length + 1 <= maxLength - 10) {
        truncated += (truncated ? ', ' : '') + sentence.trim();
      } else {
        break;
      }
    }
    
    // If still too long, truncate at word boundaries
    if (truncated.length === 0 || truncated.length > maxLength) {
      truncated = prompt.substring(0, maxLength - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        truncated = truncated.substring(0, lastSpace);
      }
      truncated += '...';
    }
    
    return truncated;
  }

  /**
   * Generate detailed skybox prompt with ground plane information
   * Optimized to stay within 1000 character limit (Skybox API)
   */
  private generateSkyboxPrompt(userPrompt: string, context: any): string {
    const parts: string[] = [];
    
    // Base environment description
    parts.push(`360° panoramic ${context.environment} environment`);
    
    // Ground plane with detailed specifications
    const groundMaterial = this.groundMaterialMap[context.groundType] || context.groundType;
    parts.push(`detailed ${groundMaterial} ground plane`);
    
    // Ground texture details (concise)
    if (groundMaterial === 'sand') {
      parts.push('fine sand texture, wind patterns');
    } else if (groundMaterial === 'dirt') {
      parts.push('organic soil, natural variations, rocks');
    } else if (groundMaterial === 'stone') {
      parts.push('rough stone, cracks, weathering');
    } else if (groundMaterial === 'grass') {
      parts.push('lush grass, natural clumping');
    } else if (groundMaterial === 'concrete') {
      parts.push('smooth concrete, subtle texture, wear patterns');
    } else if (groundMaterial === 'wood') {
      parts.push('wooden floor, grain patterns');
    } else if (groundMaterial === 'snow') {
      parts.push('pristine snow, light reflections');
    } else if (groundMaterial === 'ice') {
      parts.push('smooth ice, transparency, reflections');
    } else {
      parts.push(`${groundMaterial} surface, realistic texture`);
    }
    
    // Horizon definition
    parts.push('clear horizon line');
    
    // Time of day and lighting (concise)
    if (context.timeOfDay === 'sunset') {
      parts.push('sunset lighting, warm golden, orange pink sky');
    } else if (context.timeOfDay === 'sunrise') {
      parts.push('sunrise lighting, soft morning light, blue orange sky');
    } else if (context.timeOfDay === 'night') {
      parts.push('night sky, moonlit, stars, cool lighting, deep shadows');
    } else if (context.timeOfDay === 'noon') {
      parts.push('midday sun, clear sky, strong lighting, sharp shadows');
    } else {
      parts.push('daylight, clear sky, soft shadows');
    }
    
    // Weather and atmosphere (concise)
    if (context.weather === 'foggy') {
      parts.push('atmospheric fog, depth');
    } else if (context.weather === 'rainy') {
      parts.push('overcast, wet surfaces, rain');
    } else if (context.weather === 'cloudy') {
      parts.push('cloudy sky, diffused lighting');
    } else if (context.weather === 'snowy') {
      parts.push('snowy atmosphere, falling snow');
    }
    
    // Global illumination
    parts.push('HDRI lighting, realistic bounce');
    
    // Style modifiers (concise)
    if (context.style === 'fantasy') {
      parts.push('fantasy, magical atmosphere');
    } else if (context.style === 'sci-fi') {
      parts.push('sci-fi, futuristic, technological');
    } else if (context.style === 'medieval') {
      parts.push('medieval, historical, aged textures');
    }
    
    // Additional context from user prompt
    const userContext = userPrompt
      .split(/\s+/)
      .filter(word => 
        word.length > 4 && 
        !['the', 'a', 'an', 'in', 'on', 'at', 'with', 'and', 'or'].includes(word.toLowerCase())
      )
      .slice(0, 5)
      .join(' ');
    
    if (userContext) {
      parts.push(userContext);
    }
    
    let prompt = parts.join(', ');
    
    // Truncate to fit Skybox API limit (1000 chars)
    if (prompt.length > 1000) {
      prompt = this.truncatePrompt(prompt, 1000);
    }
    
    return prompt;
  }

  /**
   * Generate 3D asset prompt with grounding specifications
   */
  private generateAssetPrompt(userPrompt: string, context: any): string {
    const parts: string[] = [];
    
    // Extract asset description from user prompt
    let assetDescription = userPrompt;
    
    // Remove environment context words to focus on the object
    const environmentWords = [
      'forest', 'jungle', 'desert', 'beach', 'mountain', 'cave', 'city', 'street',
      'room', 'house', 'building', 'park', 'garden', 'space', 'planet', 'snow',
      'ice', 'in', 'on', 'at', 'inside', 'outside', 'within', 'among', 'amidst'
    ];
    
    environmentWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      assetDescription = assetDescription.replace(regex, '');
    });
    
    assetDescription = assetDescription.trim().replace(/\s+/g, ' ');
    
    // If we removed too much, use original
    if (assetDescription.length < 3) {
      assetDescription = userPrompt;
    }
    
    // Base object description (keep original, it's essential for detection)
    parts.push(assetDescription);
    
    // Grounding specification - MUST sit on ground (concise)
    parts.push('sitting on flat stable base, grounded, not floating');
    
    // Base/contact shape (concise)
    const contactShape = this.contactShapeMap[context.assetType] || 'circular';
    if (contactShape === 'rectangular') {
      parts.push('rectangular base, flat bottom');
    } else if (contactShape === 'circular') {
      parts.push('circular base, flat bottom');
    } else if (contactShape === 'four-point') {
      parts.push('four-point base, stable legs');
    } else if (contactShape === 'two-point') {
      parts.push('two-point base, stable support');
    } else if (contactShape === 'irregular') {
      parts.push('irregular base, stable contact');
    } else if (contactShape === 'polygonal') {
      parts.push('polygonal base, flat facets');
    }
    
    // Material and PBR (concise)
    if (context.style === 'fantasy') {
      parts.push('fantasy materials, PBR');
    } else if (context.style === 'sci-fi') {
      parts.push('futuristic materials, metallic, PBR');
    } else {
      parts.push('realistic materials, PBR');
    }
    
    // Essential details (concise)
    parts.push('high detail, realistic texture, proper scale');
    parts.push('ground contact, no gaps, stable placement');
    
    let prompt = parts.join(', ');
    
    // Truncate to fit Meshy API limit (600 chars) - CRITICAL
    if (prompt.length > 600) {
      prompt = this.truncatePrompt(prompt, 600);
    }
    
    return prompt;
  }

  /**
   * Generate grounding metadata for integration
   */
  private generateGroundingMetadata(context: any): GroundingMetadata {
    const groundMaterial = this.groundMaterialMap[context.groundType] || context.groundType;
    const groundColor = this.groundColorMap[groundMaterial] || '#808080';
    const contactShape = this.contactShapeMap[context.assetType] || 'circular';
    
    // Determine shadow type based on time of day
    let shadowType: "soft" | "sharp" = "soft";
    if (context.timeOfDay === 'noon') {
      shadowType = "sharp";
    } else if (context.timeOfDay === 'night') {
      shadowType = "soft";
    }
    
    // Estimate scale (in meters)
    let scaleReference = 1.0;
    if (context.assetType === 'car' || context.assetType === 'vehicle') {
      scaleReference = 4.5;
    } else if (context.assetType === 'building' || context.assetType === 'structure' || context.assetType === 'tower') {
      scaleReference = 10.0;
    } else if (context.assetType === 'tree') {
      scaleReference = 5.0;
    } else if (context.assetType === 'table' || context.assetType === 'desk') {
      scaleReference = 1.5;
    } else if (context.assetType === 'chair') {
      scaleReference = 1.0;
    } else if (context.assetType === 'statue' || context.assetType === 'sculpture') {
      scaleReference = 2.0;
    } else if (context.assetType === 'lamp') {
      scaleReference = 0.5;
    } else if (context.assetType === 'vase') {
      scaleReference = 0.3;
    }
    
    return {
      preferred_ground_material: groundMaterial,
      ground_color_hint: groundColor,
      light_direction: context.lightDirection,
      shadow_type: shadowType,
      asset_base_contact_shape: contactShape,
      scale_reference_meters: scaleReference
    };
  }
}

export const coordinatedPromptGeneratorService = new CoordinatedPromptGeneratorService();

