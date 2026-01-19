import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as THREE from "three";
import { ForgotPassword } from './Components/auth/ForgotPassword';
import { Login } from './Components/auth/Login';
import { ProtectedRoute } from './Components/auth/ProtectedRoute';
import { OnboardingGuard } from './Components/auth/OnboardingGuard';
import { Signup } from './Components/auth/Signup';
import ErrorBoundary from './Components/ErrorBoundary';
import Footer from './Components/Footer';
import Header from './Components/Header';
import MainSection from './Components/MainSection';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import { AssetGenerationProvider } from './contexts/AssetGenerationContext';
import { CreateGenerationProvider } from './contexts/CreateGenerationContext';
import { LessonProvider } from './contexts/LessonContext';
// Subscription removed
import BackgroundLoadingIndicator from './Components/BackgroundLoadingIndicator';
import Explore from './screens/Explore';
import History from './screens/History';
import Lessons from './screens/Lessons';
import Landing from './screens/Landing';
import Profile from './screens/Profile';
import SkyboxFullScreen from './screens/SkyboxFullScreen';
import Careers from './screens/Careers';
import Blog from './screens/Blog';
// Pricing removed
import PrivacyPolicy from './screens/PrivacyPolicy';
import TermsConditions from './screens/TermsConditions';
import RefundPolicy from './screens/RefundPolicy';
import ThreeDGenerate from './screens/MeshyGenerate';
import AssetGenerator from './screens/AssetGenerator';
import { PreviewScene } from './screens/PreviewScene';
import { PromptPanel } from './Components/PromptPanel';
import { MeshyTestPanel } from './Components/MeshyTestPanel';
import { MeshyDebugPanel } from './Components/MeshyDebugPanel';
import { ServiceStatusPanel } from './Components/ServiceStatusPanel';
import TeacherAvatarDemo from './pages/TeacherAvatarDemo';
import { LearnXRLessonScene } from './Components/LearnXRLessonScene';
import SystemStatus from './screens/SystemStatus';
import Onboarding from './screens/Onboarding';
import HelpChat from './screens/HelpChat';
// FloatingHelpButton removed - using integrated help instead
import SmoothScroll from './Components/SmoothScroll';
import DeveloperSettings from './screens/DeveloperSettings';
import ApiDocumentation from './screens/ApiDocumentation';
import N8nWorkflows from './screens/N8nWorkflows';
import ContentLibrary from './screens/studio/ContentLibrary';
import ChapterEditor from './screens/studio/ChapterEditor';
import VRLessonPlayer from './screens/VRLessonPlayer';

// Conditional Footer - hides on /main route
const ConditionalFooter = () => {
  const location = useLocation();
  const hideFooterRoutes = ['/main', '/vrlessonplayer'];
  
  if (hideFooterRoutes.includes(location.pathname)) {
    return null;
  }
  
  return (
    <div className="relative z-50">
      <Footer />
    </div>
  );
};

// Conditional Header - hides on /main route, teacher avatar pages, and studio pages
const ConditionalHeader = () => {
  const location = useLocation();
  const hideHeaderRoutes = ['/main', '/teacher-avatar-demo', '/learnxr/lesson', '/vrlessonplayer'];
  
  // Hide header on specific routes or paths starting with certain prefixes
  if (hideHeaderRoutes.includes(location.pathname) || 
      location.pathname.startsWith('/learnxr/') ||
      location.pathname.startsWith('/studio/')) {
    return null;
  }
  
  return <Header />;
};

const BackgroundSphere = ({ textureUrl }) => {
  const [texture, setTexture] = useState(null);
  const [error, setError] = useState(false);
  const sphereRef = useRef();
  const isDraggingRef = useRef(false);
  const startPointRef = useRef(new THREE.Vector2());
  const currentRotationRef = useRef(new THREE.Euler());
  const velocityRef = useRef(new THREE.Vector2());

  useEffect(() => {
    const loadTexture = async () => {
      try {
        if (typeof window === 'undefined') {
          console.warn('BackgroundSphere: Not in browser environment');
          setError(true);
          return;
        }

        const textureLoader = new THREE.TextureLoader();
        const loadedTexture = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Texture loading timeout'));
          }, 10000); // 10 second timeout

          textureLoader.load(
            textureUrl,
            (texture) => {
              clearTimeout(timeout);
              resolve(texture);
            },
            undefined,
            (error) => {
              clearTimeout(timeout);
              reject(error);
            }
          );
        });
        setTexture(loadedTexture);
      } catch (err) {
        console.warn('Failed to load background texture:', err);
        setError(true);
      }
    };

    loadTexture();
  }, [textureUrl]);

  const handlePointerDown = (event) => {
    isDraggingRef.current = true;
    startPointRef.current.set(event.clientX, event.clientY);
    velocityRef.current.set(0, 0);
  };

  const handlePointerMove = (event) => {
    if (!isDraggingRef.current) return;

    const deltaX = event.clientX - startPointRef.current.x;
    const deltaY = event.clientY - startPointRef.current.y;

    const rotationSpeed = 0.002;
    const rotationX = deltaY * rotationSpeed;
    const rotationY = deltaX * rotationSpeed;

    currentRotationRef.current.x += rotationX;
    currentRotationRef.current.y += rotationY;

    startPointRef.current.set(event.clientX, event.clientY);

    velocityRef.current.set(rotationY, rotationX);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    const animate = () => {
      if (!isDraggingRef.current && velocityRef.current.length() > 0) {
        currentRotationRef.current.x += velocityRef.current.y;
        currentRotationRef.current.y += velocityRef.current.x;

        velocityRef.current.multiplyScalar(0.95);
        if (velocityRef.current.length() < 0.001) {
          velocityRef.current.set(0, 0);
        }
      }

      if (sphereRef.current) {
        sphereRef.current.rotation.x = currentRotationRef.current.x;
        sphereRef.current.rotation.y = currentRotationRef.current.y;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  // If texture failed to load, use a simple gradient material
  if (error) {
    return (
      <mesh ref={sphereRef}>
        <sphereGeometry args={[500, 60, 40]} />
        <meshBasicMaterial color="#1e3a8a" side={THREE.BackSide} />
      </mesh>
    );
  }

  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

// Global Loading Indicator Component
const GlobalLoadingIndicator = () => {
  const { loadingState } = useLoading();
  
  return (
    <BackgroundLoadingIndicator
      isVisible={loadingState.isVisible}
      type={loadingState.type}
      progress={loadingState.progress}
      message={loadingState.message}
      stage={loadingState.stage}
    />
  );
};

// Component to conditionally show skybox background only on specific pages
const ConditionalBackground = ({ backgroundSkybox, backgroundKey }) => {
  const location = useLocation();
  const isMainPage = location.pathname === '/main';
  const isHistoryPage = location.pathname === '/history';
  
  // Only show background on /main and /history pages
  const shouldShowBackground = (isMainPage || isHistoryPage) && backgroundSkybox;
  
  if (!shouldShowBackground) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 w-full h-full z-[1]">
      <SkyboxFullScreen 
        key={backgroundKey}
        isBackground={true} 
        skyboxData={backgroundSkybox} 
        className="w-full h-full object-cover"
      />
    </div>
  );
};

// Component to conditionally render Canvas based on route
const ConditionalCanvas = ({ children, backgroundSkybox }) => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isMainPage = location.pathname === '/main';
  const isHistoryPage = location.pathname === '/history';
  
  // Pages where background should be shown
  const shouldShowBackground = isMainPage || isHistoryPage;
  
  // Don't render global Canvas on Landing page since it has its own Canvas components
  if (isLandingPage) {
    return children;
  }
  
  // Only show default Three.js background on /main and /history pages
  // On /main page without a generated skybox, show transparent background for DottedSurface
  const showDefaultBackground = shouldShowBackground && (!isMainPage || backgroundSkybox);
  
  // Use background skybox image if available, otherwise use default futuristic background
  const textureUrl = backgroundSkybox?.preview_url || backgroundSkybox?.image || 
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80";
  
  return (
    <div className="relative w-full min-h-screen bg-black">
      {/* Three.js Background - Only show on /main and /history pages */}
      {showDefaultBackground && (
        <div className="fixed inset-0 w-full h-full z-0">
          <Canvas 
            camera={{ position: [0, 0, 0.1], fov: 75 }}
            onError={(error) => {
              console.error('Three.js Canvas error:', error);
            }}
            onCreated={({ gl }) => {
              gl.setClearColor('#000000');
            }}
          >
            <BackgroundSphere textureUrl={textureUrl} />
            <OrbitControls 
              enableZoom={false} 
              enablePan={false} 
              autoRotate 
              autoRotateSpeed={0.5} 
            />
          </Canvas>
        </div>
      )}
      {children}
    </div>
  );
};

function checkRequiredEnvVars() {
  const required = [
    // Payment system removed - VITE_RAZORPAY_KEY_ID no longer required
    'VITE_API_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID'
  ];
  const missing = required.filter((key) => !import.meta.env[key]);
  return missing;
}

function App() {
  try {
    const missingEnv = checkRequiredEnvVars();
    if (missingEnv.length > 0) {
      return (
        <div style={{ color: 'red', padding: 40, fontFamily: 'monospace' }}>
          <h2>Missing Environment Variables</h2>
          <p>The following environment variables are missing:</p>
          <ul>
            {missingEnv.map((key) => <li key={key}>{key}</li>)}
          </ul>
          <p>Please check your <code>.env</code> file and rebuild the client.</p>
        </div>
      );
    }
    const [backgroundSkybox, setBackgroundSkybox] = useState("");
    const [key, setKey] = useState(0);
    const [threeJsError, setThreeJsError] = useState(false);

    // Load background from sessionStorage on mount (for persistence across navigation)
    useEffect(() => {
      const savedBackground = sessionStorage.getItem('appliedBackgroundSkybox');
      if (savedBackground) {
        try {
          const parsedBackground = JSON.parse(savedBackground);
          setBackgroundSkybox(parsedBackground);
        } catch (error) {
          console.error('Error parsing saved background:', error);
          sessionStorage.removeItem('appliedBackgroundSkybox');
        }
      }
    }, []);

    useEffect(() => {
      setKey(prev => prev + 1);
    }, [backgroundSkybox]);

    // Fallback background if Three.js fails
    if (threeJsError) {
      return (
        <AuthProvider>
          <LessonProvider>
          <AssetGenerationProvider>
            <CreateGenerationProvider>
              <LoadingProvider>
                  <Router>
              <SmoothScroll>
              <div className="relative w-full h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900">
              {/* Main Content Layer */}
              <div className="relative flex flex-col min-h-screen">
                {/* Header - fixed height - Hidden on /main route */}
                <div className="relative top-0 z-50 bg-black/30 backdrop-blur-sm border-b border-gray-800/50">
                  <ConditionalHeader />
                </div>

                {/* Main content - scrollable */}
                <main className="">
                  <div className="">
                    <Routes>
                      {/* Public routes - accessible to all users */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      
                      {/* Landing page - accessible to all users */}
                      <Route path="/" element={<Landing />} />
                      <Route path="/careers" element={<Careers />} />
                      <Route path="/blog" element={<Blog />} />
                      {/* Pricing removed */}
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/terms-conditions" element={<TermsConditions />} />
                      <Route path="/refund-policy" element={<RefundPolicy />} />
                      <Route path="/help" element={<HelpChat />} />
                      
                      {/* Onboarding for new authenticated users */}
                      <Route path="/onboarding" element={
                        <ProtectedRoute>
                          <Onboarding />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/3d-generate" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ThreeDGenerate />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />

                      {/* Protected routes - require authentication and onboarding */}
                      <Route path="/main" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <MainSection 
                              setBackgroundSkybox={setBackgroundSkybox}
                              backgroundSkybox={backgroundSkybox}
                              className="w-full px-6"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/gallery" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="gallery"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/styles" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="styles"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/tutorials" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="tutorials"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/community" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="community"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/trending" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="trending"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/skybox/:id" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SkyboxFullScreen 
                              className="w-full h-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/history" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <History 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/lessons" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Lessons 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Profile />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/developer" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <DeveloperSettings />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/api" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ApiDocumentation />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/n8n" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <N8nWorkflows />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Studio Content Editor Routes */}
                      <Route path="/studio/content" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ContentLibrary />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/studio/content/:chapterId" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ChapterEditor />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* VR Lesson Player */}
                      <Route path="/vrlessonplayer" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <VRLessonPlayer />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/asset-generator" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <AssetGenerator />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/unified-prompt" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <div className="min-h-screen bg-gray-900 p-4">
                              <div className="max-w-4xl mx-auto">
                                <PromptPanel 
                                  onAssetsGenerated={(jobId) => {
                                    // Navigate to preview after successful generation
                                    window.location.href = `/preview/${jobId}`;
                                  }}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/preview/:jobId" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <PreviewScene />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/service-status" element={<ServiceStatusPanel />} />
                      <Route path="/test-panel" element={<MeshyTestPanel />} />
                      <Route path="/debug-panel" element={<MeshyDebugPanel />} />
                      
                      {/* Teacher Avatar Routes */}
                      <Route path="/teacher-avatar-demo" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <TeacherAvatarDemo />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/learnxr/lesson" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <LearnXRLessonScene />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Redirect unknown routes to home */}
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </div>
                </main>

                {/* Footer - conditionally hidden on /main */}
                <ConditionalFooter />
              </div>
            </div>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
            {/* Floating Help Button removed */}
            {/* Global Background Loading Indicator */}
            <GlobalLoadingIndicator />
          </SmoothScroll>
          </Router>
        </LoadingProvider>
            </CreateGenerationProvider>
          </AssetGenerationProvider>
          </LessonProvider>
        {/* Subscription removed */}
      </AuthProvider>
      );
    }

    return (
      <ErrorBoundary>
        <AuthProvider>
          <LessonProvider>
          <AssetGenerationProvider>
            <CreateGenerationProvider>
              <LoadingProvider>
                  <Router>
              <SmoothScroll>
              <ConditionalCanvas backgroundSkybox={backgroundSkybox}>
              {/* Skybox Background Layer - Only shows on /main and /history pages */}
              <ConditionalBackground backgroundSkybox={backgroundSkybox} backgroundKey={key} />
              {/* Main Content Layer */}
              <div className="relative flex flex-col min-h-screen">
                {/* Header - fixed height - Hidden on /main route */}
                <ConditionalHeader />

                {/* Main content - scrollable */}
                <main className="">
                  <div className="">
                    <Routes>
                      {/* Public routes - accessible to all users */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      
                      {/* Landing page - accessible to all users */}
                      <Route path="/" element={<Landing />} />
                      <Route path="/careers" element={<Careers />} />
                      <Route path="/blog" element={<Blog />} />
                      {/* Pricing removed */}
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/terms-conditions" element={<TermsConditions />} />
                      <Route path="/refund-policy" element={<RefundPolicy />} />
                      <Route path="/help" element={<HelpChat />} />
                      
                      {/* Onboarding for new authenticated users */}
                      <Route path="/onboarding" element={
                        <ProtectedRoute>
                          <Onboarding />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/3d-generate" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ThreeDGenerate />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />

                      {/* Protected routes - require authentication and onboarding */}
                      <Route path="/main" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <MainSection 
                              setBackgroundSkybox={setBackgroundSkybox}
                              backgroundSkybox={backgroundSkybox}
                              className="w-full absolute inset-0 min-h-screen"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/gallery" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="gallery"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/styles" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="styles"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/tutorials" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="tutorials"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/community" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="community"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/trending" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="trending"
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/skybox/:id" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SkyboxFullScreen 
                              className="w-full h-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/history" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <History 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/lessons" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Lessons 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <Profile />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/developer" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <DeveloperSettings />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/api" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ApiDocumentation />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/n8n" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <N8nWorkflows />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Studio Content Editor Routes */}
                      <Route path="/studio/content" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ContentLibrary />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/studio/content/:chapterId" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <ChapterEditor />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* VR Lesson Player */}
                      <Route path="/vrlessonplayer" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <VRLessonPlayer />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/asset-generator" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <AssetGenerator />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/unified-prompt" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <div className="min-h-screen bg-gray-900 p-4">
                              <div className="max-w-4xl mx-auto">
                                <PromptPanel 
                                  onAssetsGenerated={(jobId) => {
                                    // Navigate to preview after successful generation
                                    window.location.href = `/preview/${jobId}`;
                                  }}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/preview/:jobId" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <PreviewScene />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/system-status" element={<SystemStatus />} />
                      
                      {/* Teacher Avatar Routes */}
                      <Route path="/teacher-avatar-demo" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <TeacherAvatarDemo />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/learnxr/lesson" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <LearnXRLessonScene />
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Redirect unknown routes to home */}
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </div>
                </main>

                {/* Footer - conditionally hidden on /main */}
                <ConditionalFooter />
              </div>
            </ConditionalCanvas>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
            {/* Floating Help Button removed */}
            {/* Global Background Loading Indicator */}
            <GlobalLoadingIndicator />
          </SmoothScroll>
          </Router>
        </LoadingProvider>
            </CreateGenerationProvider>
          </AssetGenerationProvider>
          </LessonProvider>
        {/* Subscription removed */}
      </AuthProvider>
    </ErrorBoundary>
    );
  } catch (err) {
    console.error('Error during App render:', err);
    return (
      <div style={{ color: 'red', padding: 40, fontFamily: 'monospace' }}>
        <h2>App Render Error</h2>
        <pre>{err && err.toString()}</pre>
        <p>Check the browser console for more details.</p>
      </div>
    );
  }
}

export default App;
