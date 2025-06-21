import { Box, Environment, Float, OrbitControls, Sphere } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { motion, useScroll, useTransform } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { FaCompass, FaFilm, FaGamepad, FaGraduationCap, FaVrCardboard } from 'react-icons/fa';
import { SiBlender, SiUnity, SiUnrealengine } from 'react-icons/si';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import { useAuth } from '../contexts/AuthContext';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Simple error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('R3F Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm">3D Scene Unavailable</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading component for Suspense
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full text-white">
    <div className="text-center">
      <div className="text-2xl mb-2">⏳</div>
      <div className="text-sm">Loading 3D Scene...</div>
    </div>
  </div>
);

// Animated Background Component
const AnimatedBackground = () => {
  const meshRef = useRef();
  const { viewport } = useThree();

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    meshRef.current.rotation.x = Math.sin(time * 0.5) * 0.1;
    meshRef.current.rotation.y = Math.sin(time * 0.3) * 0.1;
    meshRef.current.position.y = Math.sin(time * 0.2) * 0.1;
  });

  return (
    <group ref={meshRef}>
      {/* Procedural City */}
      {[...Array(50)].map((_, i) => (
        <Box
          key={i}
          position={[
            (Math.random() - 0.5) * 20,
            Math.random() * 5,
            (Math.random() - 0.5) * 20
          ]}
          args={[
            Math.random() * 2 + 0.5,
            Math.random() * 8 + 2,
            Math.random() * 2 + 0.5
          ]}
        >
          <meshStandardMaterial
            color={['#3B82F6', '#6366F1', '#06B6D4'][Math.floor(Math.random() * 3)]}
            transparent
            opacity={0.3}
            metalness={0.8}
            roughness={0.2}
          />
        </Box>
      ))}
      
      {/* Floating Spheres */}
      {[...Array(20)].map((_, i) => (
        <Float key={`sphere-${i}`} speed={1} rotationIntensity={0.5} floatIntensity={0.5}>
          <Sphere
            position={[
              (Math.random() - 0.5) * 15,
              Math.random() * 10,
              (Math.random() - 0.5) * 15
            ]}
            args={[Math.random() * 0.5 + 0.1]}
          >
            <meshStandardMaterial
              color={['#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 3)]}
              transparent
              opacity={0.6}
              emissive={['#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 3)]}
              emissiveIntensity={0.2}
            />
          </Sphere>
        </Float>
      ))}
    </group>
  );
};

// Morphing Avatar Component
const MorphingAvatar = () => {
  const avatarRef = useRef();
  const [currentStyle, setCurrentStyle] = useState(0);
  const styles = ['animation', 'gaming', 'comics', 'vfx'];

  useFrame((state) => {
    if (!avatarRef.current) return;
    const time = state.clock.getElapsedTime();
    avatarRef.current.rotation.y = Math.sin(time * 0.5) * 0.3;
    
    // Morph between styles
    if (Math.floor(time) % 3 === 0 && Math.floor(time) !== Math.floor(time - 0.016)) {
      setCurrentStyle((prev) => (prev + 1) % styles.length);
    }
  });

  return (
    <group ref={avatarRef} position={[0, 0, 0]}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Sphere args={[1.5, 32, 32]}>
          <meshStandardMaterial
            color={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][currentStyle]}
            transparent
            opacity={0.8}
            metalness={0.9}
            roughness={0.1}
            emissive={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][currentStyle]}
            emissiveIntensity={0.3}
          />
        </Sphere>
      </Float>
    </group>
  );
};

// Tech Stack Flow Component
const TechStackFlow = () => {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(time * 0.2) * 0.1;
  });

  const stages = [
    { name: 'Prompt', color: '#FF6B6B', position: [-6, 0, 0] },
    { name: 'AI Engine', color: '#4ECDC4', position: [-2, 0, 0] },
    { name: 'Asset Generator', color: '#45B7D1', position: [2, 0, 0] },
    { name: 'Integration', color: '#96CEB4', position: [6, 0, 0] }
  ];

  return (
    <group ref={groupRef}>
      {stages.map((stage, index) => (
        <group key={stage.name} position={stage.position}>
          <Box args={[1.5, 1.5, 1.5]}>
            <meshStandardMaterial
              color={stage.color}
              transparent
              opacity={0.8}
              metalness={0.8}
              roughness={0.2}
            />
          </Box>
          
          {/* Connection arrows */}
          {index < stages.length - 1 && (
            <group position={[1.25, 0, 0]}>
              <Box args={[0.5, 0.1, 0.1]}>
                <meshStandardMaterial color="#FFFFFF" />
              </Box>
            </group>
          )}
        </group>
      ))}
    </group>
  );
};

// Industry Panel Component
function RotatingBox({ color }) {
  const meshRef = React.useRef();
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    meshRef.current.rotation.y = Math.sin(time * 0.3) * 0.2;
  });
  return (
    <group ref={meshRef}>
      <Box args={[2, 2, 2]}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.7}
          metalness={0.8}
          roughness={0.2}
        />
      </Box>
    </group>
  );
}

const IndustryPanel = ({ icon: Icon, title, description, color }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="relative group"
    >
      <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 group-hover:scale-105">
        <div className="flex items-center mb-6">
          <div 
            className="w-16 h-16 rounded-xl flex items-center justify-center mr-4"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="text-3xl" style={{ color }} />
          </div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 leading-relaxed">{description}</p>
        {/* 3D Scene Preview */}
        <div className="mt-6 h-48 rounded-xl overflow-hidden">
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <RotatingBox color={color} />
            <OrbitControls enableZoom={false} enablePan={false} />
          </Canvas>
        </div>
      </div>
    </motion.div>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const containerRef = useRef();
  const heroRef = useRef();
  const { scrollYProgress } = useScroll();
  
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    // GSAP Animations
    const tl = gsap.timeline();
    
    tl.from('.hero-title', {
      duration: 1.5,
      y: 100,
      opacity: 0,
      ease: 'power3.out'
    })
    .from('.hero-subtitle', {
      duration: 1,
      y: 50,
      opacity: 0,
      ease: 'power2.out'
    }, '-=0.5')
    .from('.hero-description', {
      duration: 1,
      y: 30,
      opacity: 0,
      ease: 'power2.out'
    }, '-=0.3')
    .from('.hero-cta', {
      duration: 0.8,
      scale: 0,
      opacity: 0,
      ease: 'back.out(1.7)'
    }, '-=0.2');

    // Scroll-triggered animations
    gsap.from('.feature-card', {
      scrollTrigger: {
        trigger: '.features-section',
        start: 'top 80%',
        end: 'bottom 20%',
        scrub: 1
      },
      y: 100,
      opacity: 0,
      stagger: 0.2
    });

    gsap.from('.industry-panel', {
      scrollTrigger: {
        trigger: '.industries-section',
        start: 'top 80%',
        end: 'bottom 20%',
        scrub: 1
      },
      y: 100,
      opacity: 0,
      stagger: 0.3
    });

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const handleAction = () => {
    if (user) {
      navigate('/main');
    } else {
      navigate('/login');
    }
  };

  const industries = [
    {
      icon: FaGamepad,
      title: 'Gaming',
      description: 'Create immersive game worlds, characters, and assets with AI-powered generation.',
      color: '#FF6B6B'
    },
    {
      icon: FaFilm,
      title: 'VFX',
      description: 'Generate stunning visual effects, environments, and 3D assets for film and animation.',
      color: '#4ECDC4'
    },
    {
      icon: FaCompass,
      title: 'Comics',
      description: 'Transform text descriptions into dynamic comic panels and character designs.',
      color: '#45B7D1'
    },
    {
      icon: FaGraduationCap,
      title: 'Education',
      description: 'Interactive 3D learning environments and educational content generation.',
      color: '#96CEB4'
    },
    {
      icon: FaVrCardboard,
      title: 'XR',
      description: 'Build virtual and augmented reality experiences with AI-generated content.',
      color: '#FFE66D'
    }
  ];

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden bg-black">
      {/* Navbar */}
      <Navbar />

      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <AnimatedBackground />
            </Suspense>
          </ErrorBoundary>
          <Environment preset="night" />
        </Canvas>
      </div>

      {/* Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ y, opacity }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center max-w-6xl mx-auto">
          <h1 className="hero-title text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 mb-6 leading-tight">
            In3D.ai
          </h1>
          <p className="hero-subtitle text-3xl md:text-4xl text-blue-200 mb-8 font-light">
            Generative AI for Animation, VFX, Gaming, Comics & Extended Reality
          </p>
          <p className="hero-description text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform your creative vision into stunning 3D worlds with the power of artificial intelligence
          </p>
          
          {/* 3D Avatar */}
          <div className="max-w-2xl mx-auto mb-12 h-96">
            <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <MorphingAvatar />
                </Suspense>
              </ErrorBoundary>
              <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
          </div>

          <motion.button
            className="hero-cta group relative px-16 py-6 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 text-white rounded-full text-2xl font-bold overflow-hidden shadow-2xl hover:shadow-blue-500/50 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAction}
          >
            <span className="relative z-10">Start Building with AI</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-purple-600 to-blue-600"
              initial={{ x: "-100%" }}
              whileHover={{ x: 0 }}
              transition={{ duration: 0.3 }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </motion.button>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="features-section relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-8">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Everything you need to create stunning 3D content with AI
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              {
                title: 'Text to 3D Environment',
                description: 'Generate complete 3D environments from simple text descriptions',
                icon: '🌍'
              },
              {
                title: 'Mesh Generation',
                description: 'Create high-quality 3D models with multiple export formats (FBX, GLTF, USDZ)',
                icon: '🎯'
              },
              {
                title: 'Unity Integration',
                description: 'Seamless drag & drop functionality for Unity game development',
                icon: '🎮'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="feature-card backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-xl hover:shadow-blue-500/20 transition-all duration-500"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Speed, Affordability, No Coding */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Lightning Fast',
                description: 'Generate complex 3D scenes in seconds, not hours',
                color: 'from-green-400 to-emerald-400'
              },
              {
                title: 'Cost Effective',
                description: 'Professional-grade tools at a fraction of traditional costs',
                color: 'from-blue-400 to-cyan-400'
              },
              {
                title: 'No Coding Required',
                description: 'Intuitive interface designed for creators, not developers',
                color: 'from-purple-400 to-pink-400'
              }
            ].map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-xl"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <h3 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${benefit.color} mb-4`}>
                  {benefit.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="industries-section relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-8">
              Industries We Serve
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Empowering creators across multiple industries with AI-powered 3D generation
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {industries.map((industry, index) => (
              <IndustryPanel
                key={industry.title}
                {...industry}
                className="industry-panel"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-8">
              Our Technology Stack
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Advanced AI pipeline from prompt to production-ready assets
            </p>
          </motion.div>

          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-12 border border-white/10 shadow-2xl">
            <div className="h-64 mb-8">
              <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <TechStackFlow />
                  </Suspense>
                </ErrorBoundary>
                <OrbitControls enableZoom={false} enablePan={false} />
              </Canvas>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: SiUnity, name: 'Unity', color: '#000000' },
                { icon: SiUnrealengine, name: 'Unreal Engine', color: '#313131' },
                { icon: SiBlender, name: 'Blender', color: '#F5792A' }
              ].map((engine) => (
                <div key={engine.name} className="flex items-center justify-center p-6 backdrop-blur-xl bg-white/5 rounded-xl border border-white/10">
                  <engine.icon className="text-4xl mr-4" style={{ color: engine.color }} />
                  <span className="text-white font-semibold">{engine.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 mb-8">
              Ready to Transform Your Creativity?
            </h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Join thousands of creators who are already building the future with In3D.ai
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAction}
                className="group relative px-12 py-6 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 text-white rounded-full text-xl font-bold overflow-hidden shadow-2xl hover:shadow-blue-500/50 transition-all duration-300"
              >
                <span className="relative z-10">Start Building with AI</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-purple-600 to-blue-600"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="px-12 py-6 border-2 border-blue-400 text-blue-400 rounded-full text-xl font-bold hover:bg-blue-400 hover:text-black transition-all duration-300"
              >
                View Live Demo
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Landing;