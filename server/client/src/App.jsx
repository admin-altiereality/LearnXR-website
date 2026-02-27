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
import { RoleGuard, TeacherGuard, AdminGuard, SuperAdminGuard, StudioGuard } from './Components/auth/RoleGuard';
import { SecretBackendLogin } from './Components/auth/SecretBackendLogin';
import { Signup } from './Components/auth/Signup';
import { ErrorBoundary } from './Components/ErrorBoundary';
import MinimalFooter from './Components/MinimalFooter';
import Sidebar from './Components/Sidebar';
import MainSection from './Components/MainSection';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider, useLoading } from './contexts/LoadingContext';
import { AssetGenerationProvider } from './contexts/AssetGenerationContext';
import { CreateGenerationProvider } from './contexts/CreateGenerationContext';
import { LessonProvider } from './contexts/LessonContext';
import { ClassSessionProvider } from './contexts/ClassSessionContext';
// Subscription removed
import BackgroundLoadingIndicator from './Components/BackgroundLoadingIndicator';
import Explore from './screens/Explore';
import History from './screens/History';
import Lessons from './screens/Lessons';
import Landing from './screens/Landing';
import Individual from './screens/Individual';
import School from './screens/School';
import Profile from './screens/Profile';
import SkyboxFullScreen from './screens/SkyboxFullScreen';
import ClassSceneViewer from './screens/ClassSceneViewer';
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
import ApprovalPending from './screens/ApprovalPending';
import Approvals from './screens/admin/Approvals';
import HelpChat from './screens/HelpChat';
// FloatingHelpButton removed - using integrated help instead
import SmoothScroll from './Components/SmoothScroll';
import DeveloperSettings from './screens/DeveloperSettings';
import ApiDocumentation from './screens/ApiDocumentation';
import N8nWorkflows from './screens/N8nWorkflows';
import ContentLibrary from './screens/studio/ContentLibrary';
import ChapterEditor from './screens/studio/ChapterEditor';
import FirestoreDebugScreen from './screens/studio/FirestoreDebugScreen';
import VRLessonPlayer from './screens/VRLessonPlayer';
import VRLessonPlayerKrpano from './screens/VRLessonPlayerKrpano';
import XRLessonPlayerV3 from './screens/XRLessonPlayerV3';
import StudentDashboard from './screens/dashboard/StudentDashboard';
import JoinClassPage from './screens/dashboard/JoinClassPage';
import TeacherDashboard from './screens/dashboard/TeacherDashboard';
import PrincipalDashboard from './screens/dashboard/PrincipalDashboard';
import SchoolDashboard from './screens/dashboard/SchoolDashboard';
import AssociateDashboard from './screens/dashboard/AssociateDashboard';
import ClassManagement from './screens/admin/ClassManagement';
import SchoolManagement from './screens/admin/SchoolManagement';
import ProductionLogs from './screens/admin/ProductionLogs';
import LessonEditRequests from './screens/admin/LessonEditRequests';
import TeacherApprovals from './screens/admin/TeacherApprovals';
import SchoolApprovals from './screens/admin/SchoolApprovals';
import PersonalizedLearning from './screens/ai/PersonalizedLearning';
// Conditional Footer - Shows minimal footer on all pages except VR player, studio, and /main
const ConditionalFooter = () => {
  const location = useLocation();
  const hideFooterRoutes = ['/vrlessonplayer', '/vrlessonplayer-krpano', '/xrlessonplayer', '/learnxr/lesson', '/main'];
  
  // Hide footer completely on immersive experiences and main (environment studio) page
  if (hideFooterRoutes.includes(location.pathname) || 
      location.pathname.startsWith('/studio/')) {
    return null;
  }
  
  // Show minimal footer everywhere
  return (
    <div className="relative z-40">
      <MinimalFooter />
    </div>
  );
};

// Conditional Sidebar - Shows on authenticated pages only
const ConditionalSidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  // Pages where sidebar should be hidden
  const hideSidebarRoutes = [
    '/login', '/signup', '/forgot-password', 
    '/onboarding', '/approval-pending',
    '/vrlessonplayer', '/vrlessonplayer-krpano', '/xrlessonplayer', '/learnxr/lesson'
  ];
  
  // Hide sidebar on auth pages, onboarding, and immersive experiences
  if (!user || hideSidebarRoutes.some(route => location.pathname.startsWith(route))) {
    return null;
  }
  
  // Also hide on public pages
  const publicPages = ['/', '/careers', '/blog', '/privacy-policy', '/terms-conditions', '/refund-policy', '/help'];
  if (publicPages.includes(location.pathname) && !user) {
    return null;
  }
  
  return <Sidebar />;
};

// Smart Landing - redirects authenticated users to /lessons, shows Landing for guests
const SmartLanding = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  // Redirect authenticated users to lessons
  if (user) {
    return <Navigate to="/lessons" replace />;
  }
  
  return <Landing />;
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
  // Hooks must be called unconditionally at the top (Rules of Hooks)
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

    // Fallback background if Three.js fails
    if (threeJsError) {
      return (
        <AuthProvider>
          <ThemeProvider>
          <LessonProvider>
          <AssetGenerationProvider>
            <CreateGenerationProvider>
              <LoadingProvider>
                  <Router>
                  <ClassSessionProvider>
              <SmoothScroll>
              <div className="relative w-full h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900">
              {/* Main Content Layer with Sidebar */}
              <div className="relative flex min-h-screen">
                {/* Sidebar Navigation */}
                <ConditionalSidebar />

                {/* Main content area – same background as sidebar for homogeneous look */}
                <div className="relative flex-1 flex flex-col min-h-screen bg-background overflow-hidden">
                <main className="flex-1 bg-background">
                  <div className="">
                    <Routes>
                      {/* Public routes - accessible to all users */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/secretbackend" element={<SecretBackendLogin />} />
                      
                      {/* Landing page - redirects authenticated users to /lessons */}
                      <Route path="/" element={<SmartLanding />} />
                      <Route path="/individual" element={<Individual />} />
                      <Route path="/school" element={<School />} />
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
                      
                      {/* Approval pending page for teachers/schools */}
                      <Route path="/approval-pending" element={
                        <ProtectedRoute>
                          <ApprovalPending />
                        </ProtectedRoute>
                      } />
                      
                      {/* SuperAdmin User Approvals Dashboard */}
                      <Route path="/admin/approvals" element={
                        <ProtectedRoute>
                          <SuperAdminGuard>
                            <Approvals />
                          </SuperAdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/3d-generate" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <ThreeDGenerate />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />

                      {/* Protected routes - require authentication and role-based access */}
                      <Route path="/main" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <MainSection 
                              setBackgroundSkybox={setBackgroundSkybox}
                              backgroundSkybox={backgroundSkybox}
                              className="w-full px-6"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      {/* Explore routes - Teachers, Schools, Admin only */}
                      <Route path="/explore" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/gallery" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="gallery"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/styles" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="styles"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/tutorials" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="tutorials"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/community" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="community"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/trending" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="trending"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/skybox/:id" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <SkyboxFullScreen 
                              className="w-full h-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/class-scene" element={
                        <ProtectedRoute>
                          <ClassSceneViewer />
                        </ProtectedRoute>
                      } />
                      <Route path="/history" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <History 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Lessons - All authenticated users can access */}
                      <Route path="/lessons" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <Lessons 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Profile - All authenticated users */}
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <Profile />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Developer / API Keys - admin and superadmin only */}
                      <Route path="/developer" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <DeveloperSettings />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/api" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <ApiDocumentation />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/n8n" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <N8nWorkflows />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Studio / Chapter Editor - admin and superadmin only (no school) */}
                      <Route path="/studio/content" element={
                        <ProtectedRoute>
                          <StudioGuard>
                            <ContentLibrary />
                          </StudioGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/studio/content/:chapterId" element={
                        <ProtectedRoute>
                          <StudioGuard>
                            <ChapterEditor />
                          </StudioGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/studio/firestore-debug" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <FirestoreDebugScreen />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* VR Lesson Player - All authenticated users */}
                      <Route path="/vrlessonplayer" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <VRLessonPlayer />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      {/* VR Lesson Player (krpano 360°) - All authenticated users */}
                      <Route path="/vrlessonplayer-krpano" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <VRLessonPlayerKrpano />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* XR Lesson Player (WebXR for Meta Quest) - All authenticated users */}
                      <Route path="/xrlessonplayer" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <XRLessonPlayerV3 />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Asset generation - Teachers and above */}
                      <Route path="/asset-generator" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <AssetGenerator />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/unified-prompt" element={
                        <ProtectedRoute>
                          <TeacherGuard>
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
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/preview/:jobId" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <PreviewScene />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/service-status" element={<ServiceStatusPanel />} />
                      <Route path="/test-panel" element={<MeshyTestPanel />} />
                      <Route path="/debug-panel" element={<MeshyDebugPanel />} />
                      
                      {/* Teacher Avatar Routes - Teachers and above */}
                      <Route path="/teacher-avatar-demo" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <TeacherAvatarDemo />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/learnxr/lesson" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <LearnXRLessonScene />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Redirect unknown routes to home */}
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </div>
                </main>

                {/* Footer - minimal footer everywhere */}
                <ConditionalFooter />
                </div>
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
          </ClassSessionProvider>
          </Router>
        </LoadingProvider>
            </CreateGenerationProvider>
          </AssetGenerationProvider>
          </LessonProvider>
          </ThemeProvider>
        {/* Subscription removed */}
      </AuthProvider>
      );
    }

    return (
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider>
          <LessonProvider>
          <AssetGenerationProvider>
            <CreateGenerationProvider>
              <LoadingProvider>
                  <Router>
                  <ClassSessionProvider>
              <SmoothScroll>
              <ConditionalCanvas backgroundSkybox={backgroundSkybox}>
              {/* Skybox Background Layer - Only shows on /main and /history pages */}
              <ConditionalBackground backgroundSkybox={backgroundSkybox} backgroundKey={key} />
              {/* Main Content Layer with Sidebar */}
              <div className="relative flex min-h-screen">
                {/* Sidebar Navigation */}
                <ConditionalSidebar />

                {/* Main content area – same background as sidebar for homogeneous look */}
                <div className="relative flex-1 flex flex-col min-h-screen bg-background overflow-hidden">
                <main className="flex-1 bg-background">
                  <div className="">
                    <Routes>
                      {/* Public routes - accessible to all users */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/secretbackend" element={<SecretBackendLogin />} />
                      
                      {/* Landing page - redirects authenticated users to /lessons */}
                      <Route path="/" element={<SmartLanding />} />
                      <Route path="/individual" element={<Individual />} />
                      <Route path="/school" element={<School />} />
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
                      
                      {/* Approval pending page for teachers/schools */}
                      <Route path="/approval-pending" element={
                        <ProtectedRoute>
                          <ApprovalPending />
                        </ProtectedRoute>
                      } />
                      
                      {/* SuperAdmin User Approvals Dashboard */}
                      <Route path="/admin/approvals" element={
                        <ProtectedRoute>
                          <SuperAdminGuard>
                            <Approvals />
                          </SuperAdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/3d-generate" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <ThreeDGenerate />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />

                      {/* Protected routes - require authentication and role-based access */}
                      <Route path="/main" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <MainSection 
                              setBackgroundSkybox={setBackgroundSkybox}
                              backgroundSkybox={backgroundSkybox}
                              className="w-full absolute inset-0 min-h-screen"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/gallery" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="gallery"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/styles" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="styles"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/tutorials" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="tutorials"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/community" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="community"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/explore/trending" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <Explore 
                              setBackgroundSkybox={setBackgroundSkybox}
                              category="trending"
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/skybox/:id" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <SkyboxFullScreen 
                              className="w-full h-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/class-scene" element={
                        <ProtectedRoute>
                          <ClassSceneViewer />
                        </ProtectedRoute>
                      } />
                      <Route path="/history" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <History 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Lessons - All authenticated users */}
                      <Route path="/lessons" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <Lessons 
                              setBackgroundSkybox={setBackgroundSkybox}
                              className="w-full"
                            />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Profile - All authenticated users */}
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <Profile />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* LMS Dashboards - Role-based */}
                      <Route path="/dashboard/student" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['student']}>
                            <StudentDashboard />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/join-class" element={<JoinClassPage />} />
                      <Route path="/dashboard/teacher" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['teacher']}>
                            <TeacherDashboard />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/dashboard/principal" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['principal']}>
                            <PrincipalDashboard />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/dashboard/school" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['school']}>
                            <SchoolDashboard />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/dashboard/associate" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['associate']}>
                            <AssociateDashboard />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Personalized Learning (AI) - Students only */}
                      <Route path="/personalized-learning" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['student']}>
                            <PersonalizedLearning />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* AI Teacher Support - Merged into Create page (/main), redirect for backward compatibility */}
                      <Route path="/teacher-support" element={<Navigate to="/main" replace />} />
                      
                      {/* Class Management - Teachers, School Administrator, Principal, Admin */}
                      <Route path="/admin/classes" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['teacher', 'school', 'principal', 'admin', 'superadmin']}>
                            <ClassManagement />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* School Management - Admin and Superadmin only */}
                      <Route path="/admin/schools" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['admin', 'superadmin']}>
                            <SchoolManagement />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Production Logs - Admin and Superadmin */}
                      <Route path="/admin/logs" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <ProductionLogs />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/lesson-edit-requests" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <LessonEditRequests />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Student Approvals - Teachers and Principals can approve students */}
                      <Route path="/teacher/approvals" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['teacher', 'principal']}>
                            <TeacherApprovals />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* School Approvals - Schools and Principals can approve teachers */}
                      <Route path="/school/approvals" element={
                        <ProtectedRoute>
                          <RoleGuard allowedRoles={['school', 'principal']}>
                            <SchoolApprovals />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Developer / API Keys - admin and superadmin only */}
                      <Route path="/developer" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <DeveloperSettings />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/api" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <ApiDocumentation />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/docs/n8n" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <N8nWorkflows />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Studio / Chapter Editor - admin and superadmin only (no school) */}
                      <Route path="/studio/content" element={
                        <ProtectedRoute>
                          <StudioGuard>
                            <ContentLibrary />
                          </StudioGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/studio/content/:chapterId" element={
                        <ProtectedRoute>
                          <StudioGuard>
                            <ChapterEditor />
                          </StudioGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/studio/firestore-debug" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <FirestoreDebugScreen />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* VR Lesson Player - All authenticated users */}
                      <Route path="/vrlessonplayer" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <VRLessonPlayer />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      {/* VR Lesson Player (krpano 360°) - All authenticated users */}
                      <Route path="/vrlessonplayer-krpano" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <VRLessonPlayerKrpano />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* XR Lesson Player (WebXR for Meta Quest) - All authenticated users */}
                      <Route path="/xrlessonplayer" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <XRLessonPlayerV3 />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Asset generation - Teachers and above */}
                      <Route path="/asset-generator" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <AssetGenerator />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/unified-prompt" element={
                        <ProtectedRoute>
                          <TeacherGuard>
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
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/preview/:jobId" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <PreviewScene />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/system-status" element={
                        <ProtectedRoute>
                          <AdminGuard>
                            <SystemStatus />
                          </AdminGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Teacher Avatar Routes - Teachers and above */}
                      <Route path="/teacher-avatar-demo" element={
                        <ProtectedRoute>
                          <TeacherGuard>
                            <TeacherAvatarDemo />
                          </TeacherGuard>
                        </ProtectedRoute>
                      } />
                      <Route path="/learnxr/lesson" element={
                        <ProtectedRoute>
                          <RoleGuard>
                            <LearnXRLessonScene />
                          </RoleGuard>
                        </ProtectedRoute>
                      } />
                      
                      {/* Redirect unknown routes to home */}
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </div>
                </main>

                {/* Footer - minimal footer everywhere */}
                <ConditionalFooter />
                </div>
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
          </ClassSessionProvider>
          </Router>
        </LoadingProvider>
            </CreateGenerationProvider>
          </AssetGenerationProvider>
          </LessonProvider>
          </ThemeProvider>
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
