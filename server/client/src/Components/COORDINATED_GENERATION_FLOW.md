# Coordinated Generation Flow - What Happens When You Generate with 3D Assets

## Overview

When you generate something in the create page (`/main`) that contains 3D assets, the system now uses **coordinated prompt generation** to ensure seamless integration between Skybox 360° environments and Meshy 3D assets.

## Step-by-Step Flow

### 1. **User Enters Prompt**
   - User types a prompt like: `"A medieval statue in a fantasy forest at sunset"`
   - The system detects if 3D objects are present in the prompt

### 2. **Intelligent Prompt Parsing**
   - The `promptParserService` analyzes the prompt
   - Separates asset descriptions from background/environment descriptions
   - Provides confidence score for the parsing

### 3. **Coordinated Prompt Generation** (NEW!)
   - **If 3D objects are detected** AND Meshy is configured:
     - The `coordinatedPromptGeneratorService` generates:
       - **Enhanced Skybox Prompt**: Detailed 360° environment with ground plane specifications
       - **Grounded Asset Prompt**: 3D asset description that ensures proper grounding
       - **Grounding Metadata**: Integration data for Three.js/R3F
   
   - **Example Output:**
     ```json
     {
       "skybox_prompt": "360° panoramic forest environment, detailed dirt ground plane, rich organic soil with natural variations, small rocks, and organic debris, clear horizon line, warm golden sunset lighting from the west...",
       "asset_prompt": "medieval statue, sitting securely on a flat stable base, grounded object with natural contact points, not floating, physically anchored to ground plane, rectangular footprint base...",
       "grounding_metadata": {
         "preferred_ground_material": "dirt",
         "ground_color_hint": "#8B6F47",
         "light_direction": "west",
         "shadow_type": "soft",
         "asset_base_contact_shape": "rectangular",
         "scale_reference_meters": 2.0
       }
     }
     ```

### 4. **Skybox Generation**
   - Uses the **coordinated skybox prompt** (if available) instead of basic parsing
   - The enhanced prompt includes:
     - Detailed ground plane definition (sand, stone, tile, grass, etc.)
     - Ground texture details (roughness, reflectivity, imperfections)
     - Horizon height
     - Sun/light direction
     - Shadow softness
     - Ambient color and atmospheric depth
     - Global illumination style (HDRI-like)
   
   - **Result**: Skybox with proper ground plane that 3D assets can sit on

### 5. **3D Asset Generation** (Automatic)
   - After skybox completes, if 3D objects were detected:
     - Uses the **coordinated asset prompt** (if available)
     - The enhanced prompt ensures:
       - Object sits securely on ground (not floating)
       - Flat, stable base or natural contact points
       - Materials and PBR attributes match skybox style
       - Correct scale and proportion
       - Ground contact with no gaps
   
   - **Grounding metadata is stored** with the generated asset
   - **Result**: 3D asset that naturally sits inside the skybox

### 6. **3D Viewer Integration**
   - When viewing the 3D asset with skybox:
     - Grounding metadata is available for:
       - Auto-placing object on ground (Y position calculation)
       - Generating contact shadows
       - Matching lighting direction
       - Scaling object correctly
       - Rendering ground plane with correct material/color

## Benefits

### Before (Without Coordinated Prompts)
- ❌ 3D assets might float above ground
- ❌ Skybox and asset prompts weren't coordinated
- ❌ No metadata for proper integration
- ❌ Manual positioning required

### After (With Coordinated Prompts)
- ✅ 3D assets naturally sit on ground
- ✅ Skybox and asset prompts are perfectly coordinated
- ✅ Grounding metadata enables automatic integration
- ✅ Blockade-level realism and quality

## Console Logging

The system logs detailed information about prompt usage:

```
🌅 Generating skybox variation: {
  usingCoordinated: true,  // Using coordinated prompts
  skyboxPrompt: "360° panoramic forest environment..."
}

🎯 Generating 3D asset with coordinated prompts: {
  usingCoordinated: true,  // Using coordinated prompts
  assetPrompt: "medieval statue, sitting securely on a flat stable base...",
  groundingMetadata: { ... }
}

📐 Grounding metadata attached to asset: {
  preferred_ground_material: "dirt",
  ground_color_hint: "#8B6F47",
  ...
}
```

## Fallback Behavior

If coordinated prompts cannot be generated:
- Falls back to intelligent prompt parsing
- Still works, but without enhanced grounding specifications
- Basic integration still functions

## Technical Details

### When Coordinated Prompts Are Generated
- User prompt contains 3D objects (detected by `has3DObjects`)
- Meshy API is configured (`assetGenerationService.isMeshyConfigured()`)
- Prompt is non-empty

### When Coordinated Prompts Are Used
- **Skybox Generation**: Always uses coordinated skybox prompt if available
- **3D Asset Generation**: Always uses coordinated asset prompt if available
- **Manual Regeneration**: Also uses coordinated prompts

### Grounding Metadata Usage
- Stored in `asset.groundingMetadata`
- Available in 3D viewer components
- Can be used for:
  - Automatic ground plane rendering
  - Object positioning
  - Shadow generation
  - Lighting setup

## Example Scenarios

### Scenario 1: "A table in a modern room"
- **Skybox**: Modern interior with wood floor, clear lighting
- **Asset**: Table with rectangular base, sitting on floor
- **Metadata**: `ground_material: "wood"`, `contact_shape: "rectangular"`

### Scenario 2: "A car on a desert road"
- **Skybox**: Desert environment with sand ground, bright sun
- **Asset**: Car with rectangular footprint, grounded on road
- **Metadata**: `ground_material: "sand"`, `contact_shape: "rectangular"`, `scale: 4.5m`

### Scenario 3: "A statue in a fantasy forest at sunset"
- **Skybox**: Fantasy forest with dirt ground, sunset lighting
- **Asset**: Statue with rectangular base, sitting on ground
- **Metadata**: `ground_material: "dirt"`, `contact_shape: "rectangular"`, `light: "west"`

## Integration Points

1. **MainSection.jsx** - Main generation flow
2. **coordinatedPromptGeneratorService.ts** - Prompt generation logic
3. **AssetViewerWithSkybox.tsx** - 3D viewer (can use grounding metadata)
4. **assetGenerationService.ts** - 3D asset generation

## Future Enhancements

- Use grounding metadata in `AssetViewerWithSkybox` for automatic positioning
- Generate procedural ground planes based on metadata
- Auto-generate contact shadows
- Match lighting direction automatically

