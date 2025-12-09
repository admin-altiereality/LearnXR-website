# 🎨 Meshy.ai 3D Asset Generation Integration Guide

This guide explains the integration of Meshy.ai's 3D asset generation system into the In3D.ai application, providing automatic 3D object generation from skybox prompts.

## 🚀 Overview

The Meshy.ai integration automatically analyzes user prompts for 3D object keywords and generates corresponding 3D assets (.glb/.usdz files) that can be placed within the generated skybox environments.

### Key Features

- **Automatic Keyword Extraction**: Analyzes prompts for 3D object references
- **Parallel Generation**: Generates 3D assets alongside skybox generation
- **Firebase Storage**: Caches generated assets with metadata
- **User Management**: Links assets to users and skybox generations
- **Quality Control**: Multiple quality and style options
- **Cost Tracking**: Monitors generation costs and usage

## 🔧 Technical Architecture

### Components

1. **KeywordExtractionService** (`keywordExtractionService.ts`)
   - Analyzes prompts for 3D object keywords
   - Uses predefined categories and pattern matching
   - Calculates confidence scores for detected objects

2. **MeshyApiService** (`meshyApiService.ts`)
   - Handles communication with Meshy.ai API
   - Manages generation requests and status polling
   - Provides cost and time estimates

3. **AssetStorageService** (`assetStorageService.ts`)
   - Manages Firebase Storage for 3D assets
   - Handles Firestore metadata storage
   - Provides asset querying and management

4. **AssetGenerationService** (`assetGenerationService.ts`)
   - Orchestrates the complete generation pipeline
   - Manages progress tracking and error handling
   - Provides unified interface for asset generation

5. **AssetGenerationPanel** (`AssetGenerationPanel.tsx`)
   - React component for user interface
   - Shows prompt analysis and generation progress
   - Manages asset downloads and deletion

### Data Flow

```
User Prompt → Keyword Extraction → Meshy.ai API → Firebase Storage → Asset Management
     ↓              ↓                    ↓              ↓                ↓
  Skybox Gen    Object Detection   3D Generation   File Storage    User Interface
```

## 🛠️ Setup Instructions

### 1. Get Meshy.ai API Key

1. Visit [Meshy.ai](https://www.meshy.ai/)
2. Sign up for an account
3. Navigate to API settings
4. Generate an API key
5. Copy the key for configuration

### 2. Configure Environment Variables

#### Client-side (.env)
```env
# Meshy.ai 3D Asset Generation API
VITE_MESHY_API_KEY=your_meshy_api_key_here
```

#### Server-side (.env) - Optional
```env
# Meshy.ai API Key (for server-side operations)
MESHY_API_KEY=your_meshy_api_key_here
```

### 3. Install Dependencies

```bash
cd server/client
npm install uuid @types/uuid
```

### 4. Update Firebase Configuration

Ensure Firebase Storage is enabled in your Firebase project:

1. Go to Firebase Console
2. Navigate to Storage
3. Enable Storage if not already enabled
4. Set up security rules (see below)

### 5. Update Firestore Rules

The integration automatically adds the necessary Firestore rules for the `3d_assets` collection.

## 📊 Object Categories

The system recognizes the following 3D object categories:

### Vehicles
- **Keywords**: spaceship, car, truck, motorcycle, bicycle, boat, airplane, helicopter, train, bus, tank, submarine, rocket, ufo, hovercraft
- **Examples**: "futuristic spaceship", "vintage car", "military tank"

### Structures
- **Keywords**: building, house, castle, tower, bridge, wall, gate, door, window, chimney, roof, stairs, ladder, fence, temple, church, mosque, skyscraper
- **Examples**: "medieval castle", "modern skyscraper", "ancient temple"

### Furniture
- **Keywords**: chair, table, bed, sofa, desk, cabinet, shelf, lamp, mirror, clock, vase, plant, cushion, pillow, rug, curtain
- **Examples**: "wooden chair", "modern lamp", "antique clock"

### Nature
- **Keywords**: tree, rock, boulder, crystal, flower, bush, grass, mushroom, coral, shell, stone, gem, diamond, emerald, ruby, totem, statue
- **Examples**: "ancient totem", "crystal formation", "mossy rock"

### Technology
- **Keywords**: computer, robot, drone, satellite, antenna, screen, console, panel, circuit, wire, cable, battery, generator, engine, pump, valve
- **Examples**: "futuristic robot", "control panel", "satellite dish"

### Weapons
- **Keywords**: sword, gun, bow, arrow, shield, armor, helmet, dagger, axe, spear, staff, wand, blaster, laser, cannon, missile
- **Examples**: "magical sword", "laser blaster", "ancient shield"

### Creatures
- **Keywords**: dragon, monster, beast, creature, animal, bird, fish, insect, alien, demon, angel, ghost, skeleton, zombie, vampire, werewolf
- **Examples**: "fire dragon", "alien creature", "mechanical beast"

### Tools
- **Keywords**: hammer, screwdriver, wrench, saw, drill, shovel, pickaxe, axe, knife, scissors, pliers, clamp, vise, anvil, forge
- **Examples**: "ancient hammer", "futuristic drill", "magical staff"

## 🎯 Usage Examples

### Basic Usage

1. **Enter a prompt with 3D objects**:
   ```
   "A sci-fi jungle with alien structures, floating crystals, and a crashed spaceship"
   ```

2. **System automatically detects objects**:
   - "alien structures" → Structures category
   - "floating crystals" → Nature category  
   - "crashed spaceship" → Vehicles category

3. **Generate 3D assets**:
   - Click "Generate 3D Assets" button
   - System generates up to 3 assets (configurable)
   - Assets are stored in Firebase with metadata

### Advanced Configuration

#### Quality Settings
- **Low**: Fast generation, basic quality (~30 seconds)
- **Medium**: Balanced quality and speed (~60 seconds)
- **High**: High quality, slower generation (~120 seconds)

#### Style Options
- **Realistic**: Photorealistic 3D models
- **Stylized**: Artistic, non-photorealistic
- **Anime**: Japanese anime style
- **Cartoon**: Cartoon/animated style
- **Low-Poly**: Geometric, low-polygon models
- **Voxel**: Blocky, Minecraft-style models

#### Output Formats
- **GLB**: Binary glTF format (recommended)
- **USDZ**: Apple's Universal Scene Description

## 💰 Cost Management

### Pricing Structure
- **Low Quality**: $0.01 per generation
- **Medium Quality**: $0.02 per generation
- **High Quality**: $0.05 per generation

### Cost Tracking
- All generation costs are tracked in asset metadata
- Users can view cost history in their asset library
- System provides cost estimates before generation

## 🔒 Security & Privacy

### Data Protection
- All API keys are stored securely in environment variables
- User data is isolated by user ID
- Assets are stored in user-specific Firebase Storage folders

### Access Control
- Users can only access their own generated assets
- Admin users have access to all assets for moderation
- Asset deletion is restricted to asset owners and admins

## 🚨 Error Handling

### Common Issues

1. **API Key Not Configured**
   - Error: "Meshy API key not configured"
   - Solution: Add `VITE_MESHY_API_KEY` to environment variables

2. **No Objects Detected**
   - Error: "No 3D objects found in prompt"
   - Solution: Modify prompt to include recognizable 3D objects

3. **Generation Timeout**
   - Error: "Generation timed out"
   - Solution: Try lower quality setting or check network connection

4. **Storage Quota Exceeded**
   - Error: "Storage quota exceeded"
   - Solution: Delete unused assets or upgrade Firebase plan

### Debugging

Enable debug logging by setting:
```env
VITE_DEBUG_MESHY=true
```

## 📈 Performance Optimization

### Caching Strategy
- Generated assets are cached in Firebase Storage
- Metadata is stored in Firestore for fast queries
- Duplicate generation prevention based on prompt hash

### Batch Processing
- Multiple assets can be generated in parallel
- Progress tracking for each asset individually
- Graceful failure handling for partial completions

### Storage Management
- Automatic cleanup of orphaned assets
- Size-based storage quotas
- Compression for large asset files

## 🔄 Integration with Existing Systems

### Skybox Generation
- 3D asset generation runs parallel to skybox generation
- Assets are linked to skybox generations via `skyboxId`
- Users can generate assets for any skybox in their history

### User Management
- Assets are tied to user accounts
- Subscription limits apply to asset generation
- Usage tracking integrated with existing subscription system

### Download System
- Assets can be downloaded in original format
- Preview images available for all generated assets
- Batch download support for multiple assets

## 🧪 Testing

### Unit Tests
```bash
npm test -- --testPathPattern=meshy
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing
1. Enter prompts with various object types
2. Test different quality and style settings
3. Verify asset storage and retrieval
4. Test download functionality
5. Check error handling scenarios

## 📚 API Reference

### AssetGenerationService

#### Methods
- `generateAssetsFromPrompt(request, onProgress)`: Generate assets from prompt
- `generateSingleAsset(prompt, userId, skyboxId, quality)`: Generate single asset
- `getAssetsForSkybox(skyboxId)`: Get assets for specific skybox
- `getUserAssets(userId, limit)`: Get user's assets
- `deleteAsset(assetId)`: Delete asset
- `previewExtraction(prompt)`: Preview object extraction
- `estimateCost(prompt, quality)`: Estimate generation cost

### MeshyApiService

#### Methods
- `generateAsset(request)`: Generate 3D asset
- `getGenerationStatus(generationId)`: Get generation status
- `pollForCompletion(generationId)`: Poll for completion
- `validateRequest(request)`: Validate generation request
- `estimateGenerationTime(quality)`: Estimate generation time
- `getCostEstimate(quality)`: Estimate generation cost

## 🔮 Future Enhancements

### Planned Features
- **AI-Powered Placement**: Automatic positioning of assets in skybox
- **Asset Variants**: Generate multiple variations of the same object
- **Custom Categories**: User-defined object categories
- **Batch Operations**: Bulk asset management
- **Asset Marketplace**: Share and sell generated assets
- **Real-time Collaboration**: Multi-user asset generation

### Technical Improvements
- **WebGL Preview**: In-browser 3D asset preview
- **Asset Optimization**: Automatic LOD generation
- **Format Conversion**: Support for additional 3D formats
- **Cloud Rendering**: Server-side rendering for complex assets
- **Machine Learning**: Improved keyword detection accuracy

## 📞 Support

For technical support or questions about the Meshy.ai integration:

1. **Documentation**: Check this guide and inline code comments
2. **Issues**: Create an issue in the project repository
3. **Meshy.ai Support**: Contact Meshy.ai for API-specific issues
4. **Community**: Join the In3D.ai community for discussions

## 📄 License

This integration is part of the In3D.ai project and follows the same licensing terms. Meshy.ai API usage is subject to Meshy.ai's terms of service and pricing.

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Compatibility**: React 18+, Node.js 16+, Firebase 9+ 