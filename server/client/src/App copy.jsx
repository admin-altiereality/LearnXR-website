import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import Header from "./Components/Header";
import MainSection from "./Components/MainSection";
import Footer from "./Components/Footer";
import History from "./screens/History";
import Explore from "./screens/Explore";
import SkyboxFullScreen from "./screens/SkyboxFullScreen";

const BackgroundSphere = ({ textureUrl }) => {
  const texture = useTexture(textureUrl);
  
  return (
    <mesh>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

function App() {
  const [backgroundSkybox, setBackgroundSkybox] = useState("");
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey(prev => prev + 1);
  }, [backgroundSkybox]);

  return (
    <Router>
      <div className="relative w-full min-h-screen bg-gray-900">
        {/* Three.js Background */}
        <div className="fixed inset-0 w-full h-full">
        <Canvas camera={{ position: [0, 0, 0.1] }}>
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
                <Route 
                  path="/" 
                  element={
                    <MainSection 
                      setBackgroundSkybox={setBackgroundSkybox}
                      className="w-full px-6"
                    />
                  } 
                />
                <Route 
                  path="/explore" 
                  element={
                    <Explore 
                      setBackgroundSkybox={setBackgroundSkybox}
                      className="w-full" 
                    />
                  } 
                />
                <Route 
                  path="/skybox/:id" 
                  element={
                    <SkyboxFullScreen 
                      className="w-full h-full"
                    />
                  } 
                />
                <Route 
                  path="/history" 
                  element={
                    <History 
                      className="w-full"
                    />
                  } 
                />
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
  );
}

export default App;