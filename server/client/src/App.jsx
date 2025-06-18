import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as THREE from "three";
import { ForgotPassword } from './Components/auth/ForgotPassword';
import { Login } from './Components/auth/Login';
import { ProtectedRoute } from './Components/auth/ProtectedRoute';
import { PublicRoute } from './Components/auth/PublicRoute';
import { Signup } from './Components/auth/Signup';
import Footer from './Components/Footer';
import Header from './Components/Header';
import MainSection from './Components/MainSection';
import { AuthProvider } from './contexts/AuthContext';
import Explore from './screens/Explore';
import History from './screens/History';
import Landing from './screens/Landing';
import Profile from './screens/Profile';
import SkyboxFullScreen from './screens/SkyboxFullScreen';
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
        const textureLoader = new THREE.TextureLoader();
        const loadedTexture = await new Promise((resolve, reject) => {
          textureLoader.load(
            textureUrl,
            resolve,
            undefined,
            reject
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

function App() {
  const [backgroundSkybox, setBackgroundSkybox] = useState("");
  const [key, setKey] = useState(0);
  const [threeJsError, setThreeJsError] = useState(false);

  useEffect(() => {
    setKey(prev => prev + 1);
  }, [backgroundSkybox]);

  // Fallback background if Three.js fails
  if (threeJsError) {
    return (
      <AuthProvider>
        <Router>
          <div className="relative w-full h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900">
            {/* Main Content Layer */}
            <div className="relative flex flex-col min-h-screen">
              {/* Header - fixed height */}
              <div className="sticky top-0 z-50 bg-black/30 backdrop-blur-sm border-b border-gray-800/50">
                <Header />
              </div>

              {/* Main content - scrollable */}
              <main className="flex-grow w-full mx-auto max-w-[1920px] px-4 sm:px-6 lg:px-8">
                <div className="">
                  <Routes>
                    {/* Public routes - redirect authenticated users to /main */}
                    <Route path="/login" element={
                      <PublicRoute>
                        <Login />
                      </PublicRoute>
                    } />
                    <Route path="/signup" element={
                      <PublicRoute>
                        <Signup />
                      </PublicRoute>
                    } />
                    <Route path="/forgot-password" element={
                      <PublicRoute>
                        <ForgotPassword />
                      </PublicRoute>
                    } />
                    
                    {/* Landing page - accessible to all users */}
                    <Route path="/" element={<Landing />} />

                    {/* Protected routes - require authentication */}
                    <Route path="/main" element={
                      <ProtectedRoute>
                        <MainSection 
                          setBackgroundSkybox={setBackgroundSkybox}
                          className="w-full px-6"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/explore" element={
                      <ProtectedRoute>
                        <Explore 
                          setBackgroundSkybox={setBackgroundSkybox}
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/explore/gallery" element={
                      <ProtectedRoute>
                        <Explore 
                          setBackgroundSkybox={setBackgroundSkybox}
                          category="gallery"
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/explore/styles" element={
                      <ProtectedRoute>
                        <Explore 
                          setBackgroundSkybox={setBackgroundSkybox}
                          category="styles"
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/explore/tutorials" element={
                      <ProtectedRoute>
                        <Explore 
                          setBackgroundSkybox={setBackgroundSkybox}
                          category="tutorials"
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/explore/community" element={
                      <ProtectedRoute>
                        <Explore 
                          setBackgroundSkybox={setBackgroundSkybox}
                          category="community"
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/explore/trending" element={
                      <ProtectedRoute>
                        <Explore 
                          setBackgroundSkybox={setBackgroundSkybox}
                          category="trending"
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/skybox/:id" element={
                      <ProtectedRoute>
                        <SkyboxFullScreen 
                          className="w-full h-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/history" element={
                      <ProtectedRoute>
                        <History 
                          setBackgroundSkybox={setBackgroundSkybox}
                          className="w-full"
                        />
                      </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    } />
                    
                    {/* Redirect unknown routes to home */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </div>
              </main>

              {/* Footer - fixed height */}
              <footer className="relative z-50 backdrop-blur-md bg-gray-900/80 border-t border-gray-800">
                <Footer />
              </footer>
            </div>
          </div>
        </Router>
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
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <div className="relative w-full h-screen bg-black">
          {/* Three.js Background */}
          <div className="fixed inset-0 w-full h-full">
            <Canvas 
              camera={{ position: [0, 0, 0.1], fov: 75 }}
              onError={() => setThreeJsError(true)}
            >
              <BackgroundSphere 
                textureUrl="https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_futuristic_cityscape_at_932592572_12806524.jpg?ver=1" 
              />
              <OrbitControls 
                enableZoom={false} 
                enablePan={false} 
                autoRotate 
                autoRotateSpeed={0.5} 
              />
            </Canvas>
          </div>

          {/* Skybox Background Layer */}
          {backgroundSkybox && (
            <div className="fixed inset-0 w-full h-full">
              <SkyboxFullScreen 
                key={key}
                isBackground={true} 
                skyboxData={backgroundSkybox} 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {/* Main Content Layer */}
          <div className="relative flex flex-col min-h-screen">
            {/* Header - fixed height */}
            <div className="sticky top-0 z-50 bg-black/30 backdrop-blur-sm border-b border-gray-800/50">
              <Header />
            </div>

            {/* Main content - scrollable */}
            <main className="flex-grow w-full mx-auto max-w-[1920px] px-4 sm:px-6 lg:px-8">
              <div className="">
                <Routes>
                  {/* Public routes - redirect authenticated users to /main */}
                  <Route path="/login" element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  } />
                  <Route path="/signup" element={
                    <PublicRoute>
                      <Signup />
                    </PublicRoute>
                  } />
                  <Route path="/forgot-password" element={
                    <PublicRoute>
                      <ForgotPassword />
                    </PublicRoute>
                  } />
                  
                  {/* Landing page - accessible to all users */}
                  <Route path="/" element={<Landing />} />

                  {/* Protected routes - require authentication */}
                  <Route path="/main" element={
                    <ProtectedRoute>
                      <MainSection 
                        setBackgroundSkybox={setBackgroundSkybox}
                        className="w-full px-6"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore" element={
                    <ProtectedRoute>
                      <Explore 
                        setBackgroundSkybox={setBackgroundSkybox}
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore/gallery" element={
                    <ProtectedRoute>
                      <Explore 
                        setBackgroundSkybox={setBackgroundSkybox}
                        category="gallery"
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore/styles" element={
                    <ProtectedRoute>
                      <Explore 
                        setBackgroundSkybox={setBackgroundSkybox}
                        category="styles"
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore/tutorials" element={
                    <ProtectedRoute>
                      <Explore 
                        setBackgroundSkybox={setBackgroundSkybox}
                        category="tutorials"
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore/community" element={
                    <ProtectedRoute>
                      <Explore 
                        setBackgroundSkybox={setBackgroundSkybox}
                        category="community"
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore/trending" element={
                    <ProtectedRoute>
                      <Explore 
                        setBackgroundSkybox={setBackgroundSkybox}
                        category="trending"
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/skybox/:id" element={
                    <ProtectedRoute>
                      <SkyboxFullScreen 
                        className="w-full h-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/history" element={
                    <ProtectedRoute>
                      <History 
                        setBackgroundSkybox={setBackgroundSkybox}
                        className="w-full"
                      />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  
                  {/* Redirect unknown routes to home */}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </div>
            </main>

            {/* Footer - fixed height */}
            <footer className="relative z-50 backdrop-blur-md bg-gray-900/80 border-t border-gray-800">
              <Footer />
            </footer>
          </div>
        </div>
      </Router>
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
    </AuthProvider>
  );
}

export default App;
