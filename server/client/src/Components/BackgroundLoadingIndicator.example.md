# Background Loading Indicator - Usage Guide

This guide shows how to use the beautiful background loading indicator in your components.

## Basic Usage

### 1. Using the Context Hook (Recommended)

The easiest way to use the loading indicator is through the `useLoading` hook:

```tsx
import { useLoading } from '../contexts/LoadingContext';

const MyComponent = () => {
  const { showLoading, hideLoading, updateProgress } = useLoading();

  const handleGenerate = async () => {
    // Show loading indicator
    showLoading({
      type: 'skybox',
      message: 'Starting generation...',
      progress: 0
    });

    try {
      // Simulate progress updates
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        updateProgress(i, `Processing... ${i}%`, 'generating');
      }

      // Hide loading indicator when done
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error(error);
    }
  };

  return <button onClick={handleGenerate}>Generate</button>;
};
```

### 2. Direct Component Usage

You can also use the component directly if you need more control:

```tsx
import BackgroundLoadingIndicator from './Components/BackgroundLoadingIndicator';

const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <>
      <button onClick={() => setIsLoading(true)}>Start</button>
      
      <BackgroundLoadingIndicator
        isVisible={isLoading}
        type="skybox"
        progress={progress}
        message="Generating your skybox..."
        stage="processing"
      />
    </>
  );
};
```

## Integration Example for MainSection.jsx

Here's how to integrate it into your MainSection component:

```jsx
import { useLoading } from '../contexts/LoadingContext';

const MainSection = ({ setBackgroundSkybox }) => {
  const { showLoading, hideLoading, updateProgress } = useLoading();
  const [isGenerating, setIsGenerating] = useState(false);
  const [skyboxProgress, setSkyboxProgress] = useState(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Show the beautiful loading indicator
    showLoading({
      type: 'skybox',
      message: 'Creating your environment...',
      progress: 0,
      stage: 'initializing'
    });

    try {
      // Your generation logic here
      // Update progress as you go
      updateProgress(10, 'Starting generation...', 'initializing');
      
      // ... generation code ...
      
      updateProgress(50, 'Processing skybox...', 'generating');
      setSkyboxProgress(50);
      
      // ... more generation code ...
      
      updateProgress(100, 'Finalizing...', 'completing');
      setSkyboxProgress(100);
      
      // Hide when done
      hideLoading();
      setIsGenerating(false);
    } catch (error) {
      hideLoading();
      setIsGenerating(false);
      // Handle error
    }
  };

  // ... rest of your component
};
```

## Available Types

The loading indicator supports different types with unique styling:

- `'skybox'` - For skybox/environment generation (sky-blue gradient)
- `'3d-asset'` - For 3D asset generation (purple-pink gradient)
- `'unified'` - For unified generation (violet-purple-sky gradient)
- `'general'` - General purpose (default, sky-purple-emerald gradient)

## Features

- ✨ Beautiful glassmorphism design matching your website
- 🎨 Animated gradient particles and waves
- 📊 Progress bar with shimmer effect
- 🎯 Type-specific icons and colors
- 📱 Fully responsive
- ⚡ Smooth animations and transitions
- 🎭 Customizable messages and stages

## API Reference

### useLoading Hook

```tsx
const {
  loadingState,      // Current loading state
  showLoading,      // Show loading indicator
  hideLoading,      // Hide loading indicator
  updateProgress    // Update progress, message, or stage
} = useLoading();
```

### showLoading Parameters

```tsx
showLoading({
  type?: 'skybox' | '3d-asset' | 'unified' | 'general',
  progress?: number,  // 0-100
  message?: string,   // Display message
  stage?: string      // Current stage (e.g., 'initializing', 'generating', 'completing')
});
```

### updateProgress Parameters

```tsx
updateProgress(
  progress: number,   // 0-100
  message?: string,   // Optional message update
  stage?: string      // Optional stage update
);
```

## Tips

1. **Always hide loading on errors**: Make sure to call `hideLoading()` in your catch blocks
2. **Update progress frequently**: Users appreciate seeing progress updates
3. **Use descriptive messages**: Help users understand what's happening
4. **Match the type**: Use the correct type for better visual consistency
5. **Don't block UI**: The loading indicator is non-blocking, so users can still interact with other parts of the app if needed

