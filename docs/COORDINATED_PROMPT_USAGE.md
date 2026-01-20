# Coordinated Prompt Generator Usage

This service generates coordinated skybox prompts, 3D asset prompts, and grounding metadata to ensure seamless integration between Skybox 360° environments and Meshy 3D assets.

## Features

- **Detailed Skybox Prompts**: Includes ground plane definition, texture details, lighting, shadows, and atmospheric information
- **Grounded 3D Asset Prompts**: Ensures assets sit naturally on the ground with proper base contact points
- **Grounding Metadata**: Provides integration data for Three.js/R3F to auto-place objects, generate shadows, and match lighting

## Usage

### Client-Side Service (Direct)

```typescript
import { coordinatedPromptGeneratorService } from './services/coordinatedPromptGeneratorService';

const userPrompt = "A medieval statue in a fantasy forest at sunset";

const output = coordinatedPromptGeneratorService.generate(userPrompt);

console.log(output);
// {
//   skybox_prompt: "360° panoramic forest environment, detailed dirt ground plane, ...",
//   asset_prompt: "medieval statue, sitting securely on a flat stable base, ...",
//   grounding_metadata: {
//     preferred_ground_material: "dirt",
//     ground_color_hint: "#8B6F47",
//     light_direction: "west",
//     shadow_type: "soft",
//     asset_base_contact_shape: "rectangular",
//     scale_reference_meters: 2.0
//   }
// }
```

### API Endpoint

```typescript
import { coordinatedPromptApiService } from './services/coordinatedPromptApiService';

const result = await coordinatedPromptApiService.generate("A sci-fi vehicle on a desert planet");

if (result.success && result.data) {
  const { skybox_prompt, asset_prompt, grounding_metadata } = result.data;
  // Use the prompts for generation
}
```

### HTTP API Call

```bash
POST /api/coordinated-prompt/generate
Content-Type: application/json

{
  "prompt": "A modern table in a minimalist room"
}
```

Response (JSON only):
```json
{
  "skybox_prompt": "360° panoramic interior environment, detailed wood ground plane, wooden floor with natural grain patterns, subtle knots, and realistic wood texture, clear horizon line, natural daylight, clear sky, soft natural shadows with realistic falloff, natural ambient color palette, realistic atmospheric depth, HDRI-like global illumination, realistic light bounce, natural color bleeding, modern aesthetic, contemporary design",
  "asset_prompt": "modern table, sitting securely on a flat stable base, grounded object with natural contact points, not floating, physically anchored to ground plane, rectangular footprint base, flat bottom surface, realistic materials, physically-based rendering, accurate surface properties, high-detail surface geometry, realistic texture mapping, proper UV unwrapping, natural surface imperfections, realistic wear patterns, authentic material properties, realistic scale and proportions, correct real-world dimensions, proper geometric topology, clean mesh structure, optimized polygon count, realistic style, natural appearance, believable design, object must have clear ground contact, no gaps between base and ground, stable center of gravity, physically plausible placement",
  "grounding_metadata": {
    "preferred_ground_material": "wood",
    "ground_color_hint": "#8B4513",
    "light_direction": "top",
    "shadow_type": "soft",
    "asset_base_contact_shape": "rectangular",
    "scale_reference_meters": 1.5
  }
}
```

## Integration with Three.js / React Three Fiber

```typescript
import { useMemo } from 'react';
import { coordinatedPromptGeneratorService } from './services/coordinatedPromptGeneratorService';

function Scene({ userPrompt }: { userPrompt: string }) {
  const { skybox_prompt, asset_prompt, grounding_metadata } = useMemo(() => {
    return coordinatedPromptGeneratorService.generate(userPrompt);
  }, [userPrompt]);

  // Use skybox_prompt for skybox generation
  // Use asset_prompt for Meshy 3D asset generation
  // Use grounding_metadata for:
  //   - Auto-placing object on ground (Y position = 0 + object height/2)
  //   - Generating contact shadows
  //   - Matching lighting direction
  //   - Scaling object correctly

  return (
    <Canvas>
      {/* Skybox */}
      <Skybox url={skyboxUrl} />
      
      {/* Ground plane with material from grounding_metadata */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color={grounding_metadata.ground_color_hint}
          roughness={0.8}
        />
      </mesh>
      
      {/* 3D Asset positioned using grounding metadata */}
      <primitive
        object={assetModel}
        position={[0, grounding_metadata.scale_reference_meters / 2, 0]}
        scale={grounding_metadata.scale_reference_meters}
      />
      
      {/* Lighting matching skybox */}
      <directionalLight
        position={getLightPosition(grounding_metadata.light_direction)}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      
      {/* Contact shadow */}
      <ContactShadow
        opacity={grounding_metadata.shadow_type === 'soft' ? 0.3 : 0.6}
        scale={grounding_metadata.scale_reference_meters * 1.5}
        blur={grounding_metadata.shadow_type === 'soft' ? 2 : 1}
      />
    </Canvas>
  );
}
```

## Output Structure

All outputs follow this JSON structure:

```typescript
{
  skybox_prompt: string;        // Detailed 360° skybox description
  asset_prompt: string;         // Grounded 3D asset description
  grounding_metadata: {
    preferred_ground_material: string;    // e.g., "sand", "dirt", "stone"
    ground_color_hint: string;            // Hex color for ground plane
    light_direction: string;              // "top", "east", "west", "moon"
    shadow_type: "soft" | "sharp";        // Shadow softness
    asset_base_contact_shape: string;     // "circular", "rectangular", etc.
    scale_reference_meters: number;       // Real-world scale estimate
  }
}
```

## Supported Environments

- Forest/Jungle (dirt ground)
- Desert/Beach (sand ground)
- Mountain/Cave (stone ground)
- City/Urban (concrete/asphalt ground)
- Interior/Room (wood ground)
- Park/Garden (grass ground)
- Space/Planet (rock/metal ground)
- Snow/Ice (snow/ice ground)

## Supported Asset Types

- Furniture (table, chair, desk, sofa, bed, etc.)
- Vehicles (car, bike, motorcycle, etc.)
- Statues/Sculptures
- Plants/Trees
- Buildings/Structures
- Decorative objects (lamp, vase, etc.)

## Notes

- All prompts are explicitly detailed to ensure proper generation
- Asset prompts always include grounding specifications to prevent floating
- Grounding metadata enables automatic integration in 3D viewers
- Compatible with Meshy API and Skybox (Blockade Labs) API

