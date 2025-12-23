import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiBaseUrl } from "../utils/apiConfig";

// API URL for backend calls - use production Firebase Functions
const apiUrl = getApiBaseUrl();

// Default skybox data for when no image is available
const DEFAULT_SKYBOX = {
  image: null,
  image_jpg: null,
  isDefault: true
};

const SkyboxFullscreen = ({ isBackground = false, skyboxData = null }) => {
  const { state } = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const [style, setStyle] = useState(skyboxData || state?.style || DEFAULT_SKYBOX);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isDraggingRef = useRef(false);
  const startPointRef = useRef(new THREE.Vector2());
  const currentRotationRef = useRef(new THREE.Euler());
  const velocityRef = useRef(new THREE.Vector2());

  useEffect(() => {
    const fetchStyle = async () => {
      if (!style && id) {
        try {
          const response = await fetch(`${apiUrl}/api/skybox/${id}`);
          if (!response.ok) throw new Error("Failed to fetch skybox data");
          const data = await response.json();
          setStyle(data);
        } catch (err) {
          console.error("Error fetching skybox:", err);
          setError("Failed to load skybox");
        }
      }
    };

    fetchStyle();
  }, [id, style]);

  useEffect(() => {
    if (skyboxData) {
      setStyle(skyboxData);
    }
  }, [skyboxData]);

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

      if (sceneRef.current) {
        sceneRef.current.rotation.x = currentRotationRef.current.x;
        sceneRef.current.rotation.y = currentRotationRef.current.y;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId;

    const initScene = async () => {
      try {
        // Create Scene
        sceneRef.current = new THREE.Scene();

        // Create and Setup Camera - Use a different approach to avoid permissions warnings
        const aspect = container.clientWidth / container.clientHeight;
        cameraRef.current = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        cameraRef.current.position.set(0, 0, 0.1);
        
        // Disable camera permissions by using a fixed position
        cameraRef.current.userData = { isVirtual: true };

        // Create and Setup Renderer
        rendererRef.current = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: "high-performance",
          precision: "highp",
          preserveDrawingBuffer: true,
          alpha: true
        });
        rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current.setSize(container.clientWidth, container.clientHeight);
        rendererRef.current.setClearColor(0x000000, 0);
        container.innerHTML = "";
        container.appendChild(rendererRef.current.domElement);

        // Create and Setup Controls
        controlsRef.current = new OrbitControls(
          cameraRef.current,
          rendererRef.current.domElement
        );
        controlsRef.current.enableZoom = false;
        controlsRef.current.enablePan = false;
        controlsRef.current.rotateSpeed = 0.5;
        if (isBackground) {
          controlsRef.current.autoRotate = true;
          controlsRef.current.autoRotateSpeed = 0.5;
        }

        let texture;

        // Check if we have a valid image or if we need to use default gradient
        if (style?.image || style?.image_jpg) {
          // Load Texture from URL
          const textureLoader = new THREE.TextureLoader();
          textureLoader.setCrossOrigin("anonymous");

          texture = await new Promise((resolve, reject) => {
            textureLoader.load(
              style.image || style.image_jpg,
              (tex) => {
                tex.minFilter = THREE.LinearMipMapLinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.format = THREE.RGBAFormat;
                tex.encoding = THREE.sRGBEncoding;
                resolve(tex);
              },
              undefined,
              reject
            );
          });
        } else {
          // Create default gradient texture
          const canvas = document.createElement('canvas');
          canvas.width = 1024;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');

          // Create a beautiful gradient skybox
          const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
          gradient.addColorStop(0, '#1e3a8a');   // Deep blue at top
          gradient.addColorStop(0.3, '#3b82f6'); // Blue
          gradient.addColorStop(0.6, '#60a5fa'); // Light blue
          gradient.addColorStop(0.8, '#93c5fd'); // Very light blue
          gradient.addColorStop(1, '#dbeafe');   // Pale blue at bottom

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Add some stars for a night sky effect
          for (let i = 0; i < 100; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height * 0.7; // Only in upper 70%
            const radius = Math.random() * 2 + 0.5;
            const opacity = Math.random() * 0.8 + 0.2;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fill();
          }

          // Create texture from canvas
          texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearMipMapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.format = THREE.RGBAFormat;
          texture.encoding = THREE.sRGBEncoding;
        }

        // Create Geometry
        const geometry = new THREE.SphereGeometry(500, 128, 128);
        geometry.scale(-1, 1, 1);

        // Create Material
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });

        // Create Mesh and Add to Scene
        const sphere = new THREE.Mesh(geometry, material);
        sceneRef.current.add(sphere);

        // Animation Loop
        const animate = () => {
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
          animationFrameId = requestAnimationFrame(animate);
        };

        animate();
        setLoading(false);

        // Handle Resize
        const handleResize = () => {
          const width = container.clientWidth;
          const height = container.clientHeight;
          
          if (cameraRef.current) {
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
          }
          if (rendererRef.current) {
            rendererRef.current.setSize(width, height);
          }
        };

        window.addEventListener("resize", handleResize);

        // Add pointer event listeners
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        // Cleanup Function
        return () => {
          window.removeEventListener("resize", handleResize);
          window.removeEventListener("pointerdown", handlePointerDown);
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          cancelAnimationFrame(animationFrameId);
          
          if (controlsRef.current) {
            controlsRef.current.dispose();
          }
          
          if (rendererRef.current) {
            rendererRef.current.dispose();
          }
          
          geometry.dispose();
          material.dispose();
          if (texture) {
            texture.dispose();
          }
          
          // Clear all references
          sceneRef.current = null;
          rendererRef.current = null;
          cameraRef.current = null;
          controlsRef.current = null;
        };
      } catch (err) {
        console.error("Error in initScene:", err);
        setError("Failed to initialize 3D environment");
        setLoading(false);
      }
    };

    const cleanup = initScene();

    return () => {
      if (cleanup && typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [style, isBackground]);

  if (error && !isBackground) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="text-xl mb-4">{error}</div>
        <button
          className="bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700"
          onClick={() => navigate("/explore")}
        >
          Return to Explore
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`relative ${isBackground ? 'w-full h-full' : 'w-full h-screen'} bg-black`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-xl">
          {style?.isDefault ? 'Loading default environment...' : 'Loading environment...'}
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      {!isBackground && (
        <button
          className="absolute top-4 left-4 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          onClick={() => navigate("/explore")}
        >
          Back to Explore
        </button>
      )}
    </div>
  );
};

export default SkyboxFullscreen;