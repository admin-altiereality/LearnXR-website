// AI-Based Prompt Detection Service
// Uses LLM API (OpenAI/Anthropic) to intelligently detect 3D assets vs skybox environments

import OpenAI from 'openai';

export interface AIDetectionResult {
  promptType: 'mesh' | 'skybox' | 'both' | 'unknown';
  meshScore: number; // 0-1
  skyboxScore: number; // 0-1
  confidence: number; // 0-1
  reasoning: string; // AI's explanation
  meshDescription?: string; // What 3D asset should be generated (exact text from prompt, pipe-separated for multiple)
  meshAssets?: string[]; // Array of exact phrases from prompt that are 3D assets
  skyboxDescription?: string; // What skybox environment should be generated
  shouldGenerateMesh: boolean;
  shouldGenerateSkybox: boolean;
}

interface AIDetectionRequest {
  prompt: string;
}

class AIPromptDetectionService {
  private openai: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
      console.log('✅ AI Prompt Detection Service initialized with OpenAI');
    } else {
      console.warn('⚠️ OpenAI API key not found. AI detection will use fallback method.');
      this.isConfigured = false;
    }
  }

  /**
   * Check if AI service is configured
   */
  isAIConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Detect prompt type using AI
   */
  async detectPromptType(prompt: string): Promise<AIDetectionResult> {
    if (!this.isConfigured || !this.openai) {
      throw new Error('AI detection service is not configured. Please set OPENAI_API_KEY.');
    }

    if (!prompt || !prompt.trim()) {
      return {
        promptType: 'unknown',
        meshScore: 0,
        skyboxScore: 0,
        confidence: 0,
        reasoning: 'Empty prompt provided',
        shouldGenerateMesh: false,
        shouldGenerateSkybox: false
      };
    }

    try {
      const systemPrompt = `You are an expert at analyzing prompts for In3D.ai, a 3D content generation platform that creates:
- 3D MESH OBJECTS using Meshy API (standalone 3D models that can be placed in environments)
- SKYBOX ENVIRONMENTS using Blockade Labs API (360° panoramic environments)

YOUR TASK: Determine whether a prompt describes a 3D mesh object, a skybox environment, or both.

=== 3D MESH OBJECTS (for Meshy API) ===
These are standalone 3D models that can be placed in environments:
- Furniture: table, chair, desk, sofa, bed, cabinet, shelf, lamp, vase, mirror, clock
- Vehicles: car, bike, motorcycle, plane, ship, boat, truck, bus, train, helicopter, drone, spaceship
- Characters & Figures: character, figure, model, doll, robot, android, creature, monster, person, human
- Weapons & Tools: sword, gun, shield, armor, helmet, axe, hammer, wrench, screwdriver
- Statues & Sculptures: statue, sculpture, bust, monument, totem
- Nature Objects: plant, flower, crystal, gem, rock, stone, boulder, log, branch
- Decorative Items: artwork, painting, trophy, award, chandelier
- Electronics: phone, computer, laptop, tablet, camera, speaker
- Containers: box, crate, barrel, bottle, jar, can

Examples of MESH prompts:
- "A detailed medieval fantasy sword with intricate runic engravings"
- "A vintage 1950s red convertible car, highly detailed 3D model"
- "An ornate crystal vase with intricate patterns"
- "A robotic character model with mechanical joints and LED eyes"
- "A wooden chair with carved details and leather upholstery"
- "A car" (short object description)

=== SKYBOX ENVIRONMENTS (for Blockade Labs API) ===
These are 360° panoramic environments where objects are PART OF the scene:
- Natural: forest, jungle, desert, ocean, beach, mountain, valley, cave, canyon, meadow, field
- Urban: city, cityscape, street, alley, park, plaza, downtown, neighborhood
- Indoor: room, bedroom, kitchen, bathroom, living room, office, studio, library, museum, gallery
- Architectural: house, building, tower, castle, palace, temple, church, cathedral
- Atmospheric: space, planet, nebula, sky, clouds, sunset, sunrise, night, day, dawn, dusk
- Weather: snow, rain, storm, fog, mist, wind, blizzard
- Water: river, lake, pond, waterfall, stream, harbor, port, dock

Examples of SKYBOX prompts:
- "A futuristic cityscape with flying vehicles and neon signs reflecting in puddles during a cyberpunk rainstorm at night"
- "360° panoramic view of a mystical forest at sunset with ancient oak trees"
- "A cozy library room with floor-to-ceiling bookshelves and warm fireplace"
- "Panoramic landscape of a desert at dawn with sand dunes stretching to the horizon"
- "A cyberpunk street scene at night with neon lights and holographic advertisements"
- "Flying vehicles in a futuristic city" (vehicles are PART OF the environment, not standalone)
- "A room with furniture" (room is primary, furniture is descriptive detail)

=== BOTH (object IN environment) ===
When a prompt describes a specific object placed IN a specific environment:
- "A majestic stone statue of a dragon warrior standing on a pedestal in the center of an ancient temple courtyard"
- "A vintage 1950s red convertible car parked on a beach at sunset"
- "A medieval table in a fantasy forest at sunset"
- "A crystal chandelier hanging in a grand ballroom with marble floors"
- "A car on a beach" (specific object in specific location)

=== CRITICAL RULES ===
1. Objects AS PART OF environment = SKYBOX
   - "cityscape with flying vehicles" → SKYBOX (vehicles are scene elements)
   - "room with furniture" → SKYBOX (furniture describes the room)
   - "forest with trees" → SKYBOX (trees are part of forest)

2. Standalone object = MESH
   - "a detailed sword" → MESH
   - "a car" → MESH
   - "a wooden chair" → MESH

3. Specific object IN specific environment = BOTH
   - "a car on a beach" → BOTH (car is object, beach is environment)
   - "a statue in a temple" → BOTH (statue is object, temple is environment)

4. Environment keywords that start the prompt usually indicate SKYBOX
   - cityscape, landscape, panorama, environment, scene, room, forest, desert, etc.

5. Explicit 3D model mentions usually indicate MESH
   - "3D model of...", "detailed 3D...", "highly detailed 3D model"

6. Location prepositions (in, on, at) can indicate BOTH if both object and environment are specific
   - "a table in a room" → BOTH
   - "a car in a city" → BOTH (if car is the focus)

7. Descriptive objects in environment descriptions = SKYBOX
   - "cityscape with neon signs" → SKYBOX (signs are descriptive)
   - "forest with ancient trees" → SKYBOX (trees are descriptive)

Analyze the prompt and respond with JSON:
{
  "promptType": "mesh" | "skybox" | "both" | "unknown",
  "meshScore": 0-1 (likelihood of 3D mesh object),
  "skyboxScore": 0-1 (likelihood of skybox environment),
  "confidence": 0-1 (how confident in analysis),
  "reasoning": "brief explanation",
  "meshDescription": "EXACT text from the prompt that describes the 3D asset(s). Use the exact words/phrases from the original prompt. For multiple assets, list them separated by '|'. Example: 'alien ship|cricket bat' (empty if not applicable)",
  "meshAssets": ["array of exact phrases from prompt that are 3D assets, e.g. ['alien ship', 'cricket bat']"],
  "skyboxDescription": "what skybox to generate (empty if not applicable)",
  "shouldGenerateMesh": true/false,
  "shouldGenerateSkybox": true/false
}

CRITICAL: For meshDescription and meshAssets, extract the EXACT text/phrases from the original prompt that represent 3D objects. Do not paraphrase or modify. Preserve the original wording, capitalization, and spacing.

IMPORTANT EXTRACTION RULES:
1. Extract ONLY the object names, NOT environment words (beach, desert, forest, room, city, space, etc.)
2. Extract EACH object separately - if multiple objects exist, return them as separate array items
3. If prompt is "A vintage red convertible car, a wooden chair, and a crystal vase in a modern living room":
   - CORRECT: meshAssets: ["vintage red convertible car", "wooden chair", "crystal vase"]
   - WRONG: meshAssets: ["vintage red convertible car, wooden chair, crystal vase"] (must be separate items)
   - WRONG: meshAssets: ["modern living room"] (environment, not object)
4. If prompt is "jupiter with alien ship and the cricket bat":
   - CORRECT: meshAssets: ["alien ship", "cricket bat"]
   - WRONG: meshAssets: ["jupiter with alien ship", "cricket bat"] (don't include "jupiter")
5. If prompt is "A detailed wooden table and ornate crystal chandelier in a grand ballroom":
   - CORRECT: meshAssets: ["detailed wooden table", "ornate crystal chandelier"]
   - WRONG: meshAssets: ["A detailed wooden", "chandelier"] (extract complete phrases)
   - WRONG: meshAssets: ["grand ballroom"] (environment, not object)
6. If prompt is "A vintage red convertible car parked on a desert road":
   - CORRECT: meshAssets: ["vintage red convertible car"] or ["car"]
   - WRONG: meshAssets: ["A vintage red"] (extract complete object name)
   - WRONG: meshAssets: ["desert road"] (environment, not object)

Examples:
- Prompt: "A vintage red convertible car, a wooden chair, and a crystal vase in a modern living room"
  → meshDescription: "vintage red convertible car|wooden chair|crystal vase"
  → meshAssets: ["vintage red convertible car", "wooden chair", "crystal vase"]
  
- Prompt: "jupiter with alien ship and the cricket bat"
  → meshDescription: "alien ship|cricket bat"
  → meshAssets: ["alien ship", "cricket bat"]
  
- Prompt: "A medieval sword and shield on a beach at sunset"
  → meshDescription: "medieval sword|shield"
  → meshAssets: ["medieval sword", "shield"]
  
- Prompt: "A detailed wooden table and ornate crystal chandelier in a grand ballroom"
  → meshDescription: "detailed wooden table|ornate crystal chandelier"
  → meshAssets: ["detailed wooden table", "ornate crystal chandelier"]

Be precise: scores should reflect the actual content. For "both", both scores can be high.`;

      const userPrompt = `Analyze this prompt: "${prompt.trim()}"`;

      console.log('🤖 Calling OpenAI API for prompt detection...');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using mini for cost efficiency, can upgrade to gpt-4 if needed
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 500
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from AI');
      }

      const aiResult = JSON.parse(responseContent) as AIDetectionResult;

      // Validate and normalize the result
      const validatedResult: AIDetectionResult = {
        promptType: ['mesh', 'skybox', 'both', 'unknown'].includes(aiResult.promptType)
          ? aiResult.promptType
          : 'unknown',
        meshScore: Math.max(0, Math.min(1, aiResult.meshScore || 0)),
        skyboxScore: Math.max(0, Math.min(1, aiResult.skyboxScore || 0)),
        confidence: Math.max(0, Math.min(1, aiResult.confidence || 0)),
        reasoning: aiResult.reasoning || 'No reasoning provided',
        meshDescription: aiResult.meshDescription || '',
        meshAssets: Array.isArray(aiResult.meshAssets) ? aiResult.meshAssets : 
                   (aiResult.meshDescription ? aiResult.meshDescription.split('|').map(s => s.trim()).filter(s => s) : []),
        skyboxDescription: aiResult.skyboxDescription || '',
        shouldGenerateMesh: aiResult.shouldGenerateMesh ?? (aiResult.meshScore > 0.5),
        shouldGenerateSkybox: aiResult.shouldGenerateSkybox ?? (aiResult.skyboxScore > 0.5)
      };

      console.log('✅ AI Detection Result:', {
        promptType: validatedResult.promptType,
        meshScore: validatedResult.meshScore,
        skyboxScore: validatedResult.skyboxScore,
        confidence: validatedResult.confidence,
        meshAssets: validatedResult.meshAssets,
        meshDescription: validatedResult.meshDescription?.substring(0, 50),
        skyboxDescription: validatedResult.skyboxDescription?.substring(0, 50)
      });

      return validatedResult;
    } catch (error) {
      console.error('❌ AI Detection error:', error);
      throw new Error(`AI detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract ONLY 3D asset phrases from prompt (simplified extraction)
   */
  async extractAssetsOnly(prompt: string): Promise<{ assets: string[] }> {
    if (!this.isConfigured || !this.openai) {
      return { assets: [] };
    }

    if (!prompt || !prompt.trim()) {
      return { assets: [] };
    }

    try {
      const systemPrompt = `You are an expert at extracting 3D object names from prompts for In3D.ai.

YOUR TASK: Extract ONLY the exact phrases from the prompt that describe 3D objects/assets that can be created as standalone 3D models. NEVER extract environment/skybox words.

=== 3D OBJECTS TO EXTRACT (standalone models) ===
- Furniture: table, chair, desk, sofa, bed, cabinet, shelf, lamp, vase, mirror, clock
- Vehicles: car, bike, motorcycle, plane, ship, boat, truck, bus, train, helicopter, drone, spaceship
- Characters & Figures: character, figure, model, doll, robot, android, creature, monster, person, human
- Weapons & Tools: sword, gun, shield, armor, helmet, axe, hammer, wrench, screwdriver
- Statues & Sculptures: statue, sculpture, bust, monument, totem
- Nature Objects: plant, flower, crystal, gem, rock, stone, boulder, log, branch
- Decorative Items: artwork, painting, trophy, award, chandelier
- Electronics: phone, computer, laptop, tablet, camera, speaker
- Containers: box, crate, barrel, bottle, jar, can

=== NEVER EXTRACT (these are environments/skyboxes, NOT 3D objects) ===
- Locations: beach, desert, forest, jungle, ocean, mountain, valley, cave, canyon, meadow, field
- Urban: city, cityscape, street, alley, park, plaza, downtown, neighborhood
- Indoor: room, bedroom, kitchen, bathroom, living room, office, studio, library, museum, gallery, ballroom
- Architectural: house, building, tower, castle, palace, temple, church, cathedral, ruins
- Atmospheric: space, planet, nebula, sky, clouds, sunset, sunrise, night, day, dawn, dusk
- Weather: snow, rain, storm, fog, mist, wind, blizzard
- Water: river, lake, pond, waterfall, stream, harbor, port, dock
- Roads: road, street, path, highway, bridge
- Background elements: background, horizon, landscape, scenery

=== CRITICAL RULES ===
1. Extract EXACT phrases from the original prompt - preserve original wording
2. NEVER include environment/skybox words (see list above)
3. NEVER include location prepositions (in, on, at, with) unless they're part of the object name
4. Extract complete object names, not partial phrases
5. If multiple objects exist, extract EACH one separately as a separate array item
6. Objects IN an environment = extract the objects, NOT the environment
7. Objects that ARE the environment = do NOT extract (e.g., "cityscape with vehicles" = no extraction)

=== EXAMPLES ===
Prompt: "A vintage red convertible car, a wooden chair, and a crystal vase in a modern living room"
→ Extract: ["vintage red convertible car", "wooden chair", "crystal vase"]
→ Do NOT extract: "modern living room" (environment)

Prompt: "A medieval sword and shield on a beach at sunset"
→ Extract: ["medieval sword", "shield"]
→ Do NOT extract: "beach" or "sunset" (environment)

Prompt: "jupiter with alien ship and the cricket bat"
→ Extract: ["alien ship", "cricket bat"]
→ Do NOT extract: "jupiter" (environment/planet)

Prompt: "A detailed wooden table and ornate crystal chandelier in a grand ballroom"
→ Extract: ["detailed wooden table", "ornate crystal chandelier"]
→ Do NOT extract: "grand ballroom" (environment)

Prompt: "A futuristic cityscape with flying vehicles"
→ Extract: [] (vehicles are part of environment description, not standalone objects)

Prompt: "A vintage red convertible car parked on a desert road at sunset"
→ Extract: ["vintage red convertible car"] or ["car"]
→ Do NOT extract: "desert road" or "sunset" (environment)

Respond with JSON:
{
  "assets": ["array of exact phrases from prompt that are 3D objects"]
}

If no 3D objects found, return empty array: {"assets": []}`;

      const userPrompt = `Extract 3D object phrases from this prompt: "${prompt.trim()}"`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        return { assets: [] };
      }

      const aiResult = JSON.parse(responseContent);
      const assets = Array.isArray(aiResult.assets) 
        ? aiResult.assets.filter((asset: any) => typeof asset === 'string' && asset.trim().length > 0)
        : [];

      console.log('✅ Asset Extraction Result:', {
        count: assets.length,
        assets: assets
      });

      return { assets };
    } catch (error) {
      console.error('❌ Asset extraction error:', error);
      return { assets: [] };
    }
  }

  /**
   * Fallback detection using rule-based method (when AI is not available)
   */
  fallbackDetection(prompt: string): AIDetectionResult {
    // This would use the existing promptParserService
    // For now, return a basic result
    return {
      promptType: 'unknown',
      meshScore: 0.5,
      skyboxScore: 0.5,
      confidence: 0.3,
      reasoning: 'Using fallback detection method (AI not available)',
      shouldGenerateMesh: false,
      shouldGenerateSkybox: false
    };
  }
}

export const aiPromptDetectionService = new AIPromptDetectionService();

