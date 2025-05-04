import React, { useEffect, useState, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useNavigate } from "react-router-dom";
import { useInView } from 'react-intersection-observer';
import { motion } from 'framer-motion';

const Explore = ({ setBackgroundSkybox }) => {
  const [styles, setStyles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const renderers = useRef({});
  const controls = useRef({});
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const ITEMS_PER_PAGE = 9;

  const { ref: scrollRef, inView } = useInView({
    threshold: 0.1,
    delay: 100,
  });

  const fetchStyles = useCallback(async (pageNum) => {
    try {
      setLoading(true);
      console.log(`Fetching styles from page ${pageNum}`);
      
      const response = await fetch(
        `${apiUrl}/api/skybox/getSkyboxStyles?page=${pageNum}&limit=${ITEMS_PER_PAGE}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received data:', data);
      
      if (Array.isArray(data)) {
        setStyles(prevStyles => 
          pageNum === 1 ? data : [...prevStyles, ...data]
        );
        setHasMore(data.length >= ITEMS_PER_PAGE);
      } else if (data && Array.isArray(data.styles)) {
        setStyles(prevStyles => 
          pageNum === 1 ? data.styles : [...prevStyles, ...data.styles]
        );
        setHasMore(data.hasMore);
      } else {
        console.warn('Invalid data format received:', data);
        setStyles([]);
        setHasMore(false);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching styles:", err);
      setError("Failed to load styles");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('Initial fetch triggered');
    fetchStyles(1);
    
    return () => {
      Object.values(renderers.current).forEach((renderer) => {
        if (renderer && typeof renderer.dispose === 'function') {
          renderer.dispose();
        }
      });
      Object.values(controls.current).forEach((control) => {
        if (control && typeof control.dispose === 'function') {
          control.dispose();
        }
      });
    };
  }, [fetchStyles]);

  useEffect(() => {
    if (inView && hasMore && !loading) {
      console.log('Loading more styles...');
      setPage(prev => prev + 1);
      fetchStyles(page + 1);
    }
  }, [inView, hasMore, loading, fetchStyles, page]);

  useEffect(() => {
    if (!styles || styles.length === 0) return;

    const loadScenes = async () => {
      for (let i = 0; i < styles.length; i++) {
        const style = styles[i];
        const imageUrl = style.image || style.image_jpg;
        
        if (imageUrl) {
          try {
            await new Promise(resolve => setTimeout(resolve, i * 100)); // Stagger loading
            await initScene(i, imageUrl);
          } catch (error) {
            console.error(`Failed to initialize scene ${i}:`, error);
          }
        }
      }
    };

    loadScenes();

    // Cleanup function
    return () => {
      Object.values(renderers.current).forEach(renderer => {
        if (renderer && renderer.dispose) renderer.dispose();
      });
      Object.values(controls.current).forEach(control => {
        if (control && control.dispose) control.dispose();
      });
    };
  }, [styles]);

  const initScene = async (index, imageUrl) => {
    const container = document.getElementById(`skybox-${index}`);
    if (!container) {
      console.error('Container not found for index:', index);
      return;
    }

    // Clean up existing renderer and controls
    if (renderers.current[index]) {
      renderers.current[index].dispose();
      delete renderers.current[index];
    }
    if (controls.current[index]) {
      controls.current[index].dispose();
      delete controls.current[index];
    }

    // Show initial loading state
    container.innerHTML = `
      <div class="absolute inset-0 flex items-center justify-center bg-gray-900/50">
        <div class="w-8 h-8 border-t-2 border-b-2 border-blue-400 rounded-full animate-spin"></div>
      </div>
    `;

    try {
      // First, verify the image can be loaded
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image'));
        image.src = imageUrl;
      });

      console.log('Image loaded successfully:', imageUrl);

      // Create and setup scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );

      // Create and setup renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        alpha: true
      });

      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      renderers.current[index] = renderer;

      // Create and setup controls
      const control = new OrbitControls(camera, renderer.domElement);
      control.enableZoom = false;
      control.enablePan = false;
      control.rotateSpeed = 0.5;
      control.autoRotate = true;
      control.autoRotateSpeed = 0.5;
      controls.current[index] = control;

      // Create texture from the loaded image
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      texture.encoding = THREE.sRGBEncoding;

      // Create sphere geometry
      const geometry = new THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1);

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });

      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);
      camera.position.set(0, 0, 0.1);

      // Animation loop
      let frameId;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        control.update();
        renderer.render(scene, camera);
      };

      animate();

      // Handle resize
      const handleResize = () => {
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);

      // Return cleanup function
      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(frameId);
        geometry.dispose();
        material.dispose();
        texture.dispose();
        renderer.dispose();
      };

    } catch (err) {
      console.error("Error in initScene:", err, "for image:", imageUrl);
      
      // Fallback to static image with error handling
      container.innerHTML = `
        <div class="relative w-full h-full bg-gray-900/50">
          <div class="absolute inset-0 flex flex-col items-center justify-center p-4">
            <img 
              src="${imageUrl}" 
              alt="skybox preview" 
              class="max-w-full max-h-full object-contain rounded-lg opacity-50"
              crossorigin="anonymous"
              loading="lazy"
              onerror="this.style.display='none'"
            />
            <span class="text-red-300 text-sm mt-2">Failed to load 3D preview</span>
          </div>
        </div>
      `;
    }
  };

  const handleClick = (style) => {
    setSelectedStyle(style);
    sessionStorage.setItem('fromExplore', 'true');
    sessionStorage.setItem('selectedSkyboxStyle', JSON.stringify(style));
    sessionStorage.setItem('preserveBackground', 'true');
    navigate('/');
  };

  const renderStyles = () => {
    return styles.map((style, index) => {
      const uniqueKey = `style-${style.id}-${index}`;
      
      return (
        <motion.div
          key={uniqueKey}
          className="relative group rounded-xl overflow-hidden backdrop-blur-md 
                    bg-white/5 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]
                    hover:bg-white/10 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]
                    transition-all duration-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <div className="aspect-square relative">
            <div 
              id={`canvas-container-${index}`} 
              className="absolute inset-0"
            />
          </div>
          
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-20 pb-4 px-4">
            <h3 className="text-lg font-semibold text-white/90 mb-1">
              {style.name || `Style ${index + 1}`}
            </h3>
            <p className="text-sm text-white/70 line-clamp-2">
              {style.description || 'A beautiful skybox style'}
            </p>
          </div>

          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleClick(style)}
              className="backdrop-blur-md bg-white/10 hover:bg-white/20 
                       text-white/90 rounded-full p-2.5
                       shadow-[0_4px_12px_0_rgba(31,38,135,0.37)]
                       border border-white/20
                       transition-all duration-300"
            >
              <span className="sr-only">Select style</span>
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            </button>
          </div>
        </motion.div>
      );
    });
  };

  if (error) {
    return (
      <div className="flex-1 bg-transparent min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8 p-4 bg-red-500/10 backdrop-blur-sm rounded-lg border border-red-500/20">
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900/90 to-gray-800/90 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {renderStyles()}
        </div>

        {loading && (
          <div className="flex justify-center mt-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white/90" />
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => {
                setPage(prev => prev + 1);
                fetchStyles(page + 1);
              }}
              className="px-6 py-2.5 backdrop-blur-md bg-white/10 hover:bg-white/20 
                       text-white/90 rounded-lg 
                       shadow-[0_4px_12px_0_rgba(31,38,135,0.37)]
                       border border-white/20
                       transition-all duration-300"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;