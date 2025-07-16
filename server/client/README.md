# In3D.ai Neural Website

In3D.ai Neural Website is a React-based web application that allows users to create dynamic 3D skybox environments and 3D assets using AI. The application integrates with multiple AI providers (BlockadeLabs for skyboxes, Meshy.ai for 3D models) and provides a unified interface for simultaneous generation of both asset types.

## Features

- **Unified Prompt System**: Generate both skyboxes and 3D models from a single prompt using parallel API calls
- **Prompt-based Skybox Generation**: Generate 3D skybox environments by entering prompts and selecting styles
- **3D Model Generation**: Create 3D assets using Meshy.ai with various quality and style options
- **Dynamic Background Updates**: Preview and set generated skyboxes as the application background
- **Style Selection**: Choose from a variety of skybox styles fetched dynamically from the backend
- **Negative Prompting**: Optionally add negative prompts to refine the generated skyboxes
- **Real-time Generation Status**: Track the progress of both skybox and 3D model generation
- **3D Preview**: Interactive 3D preview showing skybox as environment with floating mesh
- **Individual Downloads**: Download skybox and 3D model assets separately with proper filenames
- **Responsive Design**: Optimized for various screen sizes with a clean and modern UI
- **Error Handling**: Comprehensive error handling with retry logic for failed API calls

## Unified Prompt System

The unified prompt system is the core feature that allows users to generate both skyboxes and 3D models simultaneously from a single prompt. This system provides:

### Key Components

1. **PromptPanel Component** (`/unified-prompt`)
   - Single textarea for prompt input
   - Checkbox toggles for skybox and 3D model generation
   - Advanced settings for quality, style, and format options
   - Real-time progress tracking for both generators
   - Individual download buttons for each asset type

2. **3D Preview Route** (`/preview/:jobId`)
   - Interactive 3D scene with orbit controls
   - Skybox rendered as environment mapping
   - 3D model floating and rotating at scene center
   - Fullscreen support and camera controls
   - Asset information panel

3. **Parallel API Processing**
   - Uses `Promise.allSettled()` to call both APIs concurrently
   - Handles partial failures gracefully (one provider fails, other succeeds)
   - Implements retry logic with exponential backoff
   - Provides detailed error messages for each provider

### Usage

1. Navigate to `/unified-prompt`
2. Enter a descriptive prompt (e.g., "A futuristic city with flying cars")
3. Select which assets to generate (skybox, 3D model, or both)
4. Configure advanced settings if needed
5. Click "Generate Assets" to start parallel generation
6. Monitor progress for both generators
7. Download assets individually or preview in 3D
8. Use "Preview in 3D" button to see assets in interactive scene

### Storage Structure

Generated assets are stored in Firebase Storage with organized paths:
```
/user/{userId}/{timestamp}/
├── skybox.{png|hdr}
└── mesh.{glb|usdz|obj|fbx}
```

### Environment Variables

Add these environment variables to your `.env` file:

```env
# Existing variables
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# API Keys
VITE_BLOCKADE_API_KEY=your_blockade_labs_api_key
VITE_MESHY_API_KEY=your_meshy_api_key

# API Base URLs
VITE_API_BASE_URL=https://your-domain.com/api
VITE_MESHY_API_BASE_URL=https://api.meshy.ai/v1

# Optional: Feature flags
VITE_ENABLE_3D_PREVIEW=true
VITE_ENABLE_ADVANCED_3D=true
VITE_MAX_ASSETS_PER_GENERATION=3
VITE_DEFAULT_QUALITY=medium
VITE_DEFAULT_FORMAT=glb
```

### Error Handling

The system includes comprehensive error handling:

- **Network errors**: Automatic retry with exponential backoff
- **API quota exceeded**: Clear user messaging with upgrade prompts
- **Service unavailable**: Graceful degradation and retry logic
- **Partial failures**: Success with one provider, failure with another
- **Circuit breaker**: Prevents cascade failures with repeated API failures

## Technologies Used

### Frontend

- **React**: Core framework for building the user interface.
- **React Router**: For managing application routes.
- **Axios**: For handling API requests.
- **TailwindCSS**: For responsive and modern styling.

### Backend

- The backend API is expected to be running locally on `${apiUrl}`. It includes endpoints for fetching skybox styles, generating skyboxes, and checking generation status.


## Folder Structure

```plaintext
src/
├── Components/
│   ├── Header.js        # Application header
│   ├── MainSection.js   # Main content area with prompt input and skybox generation
│   ├── Footer.js        # Footer component
├── screens/
│   ├── Explore.js       # Explore skybox styles
│   ├── History.js       # History of generated skyboxes
│   ├── SkyboxFullScreen.js # Full-screen skybox viewer
├── App.js               # Main application component
├── index.js             # Entry point of the application
├── styles/              # TailwindCSS configuration
```

## API Endpoints

### 1. Fetch Skybox Styles

**GET** `/api/skybox/getSkyboxStyles`

- Response: Array of available skybox styles.

### 2. Generate Skybox

**POST** `/api/imagine/generateImagine`

- Body: `{ prompt, skybox_style_id, negative_text (optional) }`
- Response: `{ id: <generated_image_id> }`

### 3. Get Skybox Generation Status

**GET** `/api/imagine/getImagineById`

- Query Parameters: `id=<generated_image_id>`
- Response: `{ status: 'complete' | 'failed', file_url, title, prompt }`

## Customization

- Modify **TailwindCSS** configurations in `tailwind.config.js` to update styles.
- Update API endpoints in `MainSection.js` or relevant components if backend URLs change.


## Acknowledgements

- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Axios](https://axios-http.com/)
- Special thanks to the backend team for providing the API integration

---


