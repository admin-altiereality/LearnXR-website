// AI Detection Route for Firebase Functions
// Handles AI-based prompt detection using OpenAI

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI (lazy loading to avoid issues if key is missing)
let openai: OpenAI | null = null;
let isConfigured = false;

const initializeOpenAI = () => {
  if (openai) return; // Already initialized
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    openai = new OpenAI({ apiKey });
    isConfigured = true;
    console.log('✅ OpenAI initialized in Firebase Functions');
  } else {
    console.warn('⚠️ OPENAI_API_KEY not found in Firebase Functions');
    isConfigured = false;
  }
};

/**
 * AI Detection endpoint
 * POST /api/ai-detection/detect
 */
router.post('/detect', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
        requestId
      });
    }

    console.log(`[${requestId}] AI Detection requested for prompt:`, prompt.substring(0, 50) + '...');

    // Initialize OpenAI if not already done
    initializeOpenAI();

    // If OpenAI is not configured, return fallback
    if (!isConfigured || !openai) {
      console.warn(`[${requestId}] OpenAI not configured, using fallback`);
      return res.status(200).json({
        success: true,
        data: {
          promptType: 'unknown',
          meshScore: 0.5,
          skyboxScore: 0.5,
          confidence: 0.3,
          reasoning: 'AI detection not available (OpenAI API key not configured). Using fallback detection.',
          shouldGenerateMesh: false,
          shouldGenerateSkybox: true
        },
        method: 'fallback',
        requestId
      });
    }

    // Use AI detection
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from AI');
    }

    const aiResult = JSON.parse(responseContent);

    // Validate and normalize
    const result = {
      promptType: ['mesh', 'skybox', 'both', 'unknown'].includes(aiResult.promptType)
        ? aiResult.promptType
        : 'unknown',
      meshScore: Math.max(0, Math.min(1, aiResult.meshScore || 0)),
      skyboxScore: Math.max(0, Math.min(1, aiResult.skyboxScore || 0)),
      confidence: Math.max(0, Math.min(1, aiResult.confidence || 0)),
      reasoning: aiResult.reasoning || 'No reasoning provided',
      meshDescription: aiResult.meshDescription || '',
      meshAssets: Array.isArray(aiResult.meshAssets) ? aiResult.meshAssets : 
                 (aiResult.meshDescription ? aiResult.meshDescription.split('|').map((s: string) => s.trim()).filter((s: string) => s) : []),
      skyboxDescription: aiResult.skyboxDescription || '',
      shouldGenerateMesh: aiResult.shouldGenerateMesh ?? (aiResult.meshScore > 0.5),
      shouldGenerateSkybox: aiResult.shouldGenerateSkybox ?? (aiResult.skyboxScore > 0.5)
    };

    console.log(`[${requestId}] AI Detection completed:`, {
      promptType: result.promptType,
      confidence: result.confidence
    });

    return res.status(200).json({
      success: true,
      data: result,
      method: 'ai',
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] AI Detection error:`, error);
    
    // Return fallback on error
    return res.status(200).json({
      success: true,
      data: {
        promptType: 'unknown',
        meshScore: 0.5,
        skyboxScore: 0.5,
        confidence: 0.3,
        reasoning: `AI detection failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback.`,
        shouldGenerateMesh: false,
        shouldGenerateSkybox: true
      },
      method: 'fallback',
      requestId
    });
  }
});

/**
 * Extract ONLY 3D asset phrases from prompt
 * POST /api/ai-detection/extract-assets
 */
router.post('/extract-assets', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(200).json({
        assets: [],
        success: true,
        requestId
      });
    }

    initializeOpenAI();

    if (!isConfigured || !openai) {
      console.warn(`[${requestId}] OpenAI not configured, returning empty assets`);
      return res.status(200).json({
        assets: [],
        success: true,
        method: 'fallback',
        requestId
      });
    }

    console.log(`[${requestId}] Asset extraction requested for prompt:`, prompt.substring(0, 50) + '...');

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

    const completion = await openai.chat.completions.create({
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
      return res.status(200).json({
        assets: [],
        success: true,
        requestId
      });
    }

    const aiResult = JSON.parse(responseContent);
    const assets = Array.isArray(aiResult.assets) 
      ? aiResult.assets.filter((asset: any) => typeof asset === 'string' && asset.trim().length > 0)
      : [];

    console.log(`[${requestId}] Asset extraction completed:`, {
      count: assets.length,
      assets: assets
    });

    return res.status(200).json({
      assets: assets,
      success: true,
      method: 'ai',
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Asset extraction error:`, error);
    
    return res.status(200).json({
      assets: [],
      success: false,
      error: error instanceof Error ? error.message : 'Asset extraction failed',
      requestId
    });
  }
});

/**
 * AI Prompt Enhancement endpoint
 * POST /api/ai-detection/enhance
 */
router.post('/enhance', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
        requestId
      });
    }

    console.log(`[${requestId}] AI Enhancement requested for prompt:`, prompt.substring(0, 50) + '...');

    // Initialize OpenAI if not already done
    initializeOpenAI();

    // If OpenAI is not configured, return error
    if (!isConfigured || !openai) {
      console.warn(`[${requestId}] OpenAI not configured for enhancement`);
      return res.status(503).json({
        success: false,
        error: 'AI enhancement is not available (OpenAI API key not configured)',
        requestId
      });
    }

    const systemPrompt = `You are an expert at enhancing prompts for In3D.ai, a 3D content generation platform.

Your task is to enhance user prompts by adding relevant details that will improve the quality of generated 3D environments and objects. 

ENHANCEMENT GUIDELINES:
1. Preserve the original intent and meaning of the prompt
2. Add appropriate details for:
   - Lighting conditions (e.g., "soft warm lighting", "dramatic shadows", "golden hour")
   - Mood and atmosphere (e.g., "peaceful and serene", "mysterious and eerie", "vibrant and energetic")
   - Time of day (e.g., "at sunset", "during golden hour", "at night", "at dawn")
   - Weather/atmospheric conditions if relevant (e.g., "with gentle rain", "foggy morning", "clear sky")
   - Additional descriptive details that enhance the scene
3. Keep the enhanced prompt concise but descriptive (max 600 characters)
4. Maintain natural language flow
5. Don't add redundant information already present in the prompt
6. For 3D objects, add descriptive adjectives if missing (e.g., "detailed", "intricate", "ornate")

Return ONLY the enhanced prompt text, nothing else. Do not include explanations, JSON, or any other formatting.`;

    const userPrompt = `Enhance this prompt for better 3D generation results: "${prompt.trim()}"`;

    console.log(`[${requestId}] Calling OpenAI API for prompt enhancement...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const enhancedPrompt = completion.choices[0]?.message?.content?.trim();
    
    if (!enhancedPrompt) {
      throw new Error('No enhanced prompt received from AI');
    }

    console.log(`[${requestId}] ✅ AI Enhancement successful`);

    return res.status(200).json({
      success: true,
      data: {
        originalPrompt: prompt.trim(),
        enhancedPrompt: enhancedPrompt,
        method: 'ai'
      },
      requestId
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ AI Enhancement error:`, error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to enhance prompt',
      requestId
    });
  }
});

export default router;


