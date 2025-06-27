import React, { useState, useEffect, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FaRocket, 
  FaBrain, 
  FaCube, 
  FaPlay, 
  FaArrowRight, 
  FaStar,
  FaUsers,
  FaShieldAlt,
  FaPalette,
  FaCode,
  FaGlobe
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere } from '@react-three/drei';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: FaBrain,
      title: "AI-Powered Generation",
      description: "Transform text prompts into stunning 3D assets with advanced AI technology"
    },
    {
      icon: FaCube,
      title: "Multiple Formats",
      description: "Export to FBX, OBJ, GLTF and more for seamless integration"
    },
    {
      icon: FaPalette,
      title: "Style Variety",
      description: "Choose from animation, gaming, comics, and VFX styles"
    },
    {
      icon: FaCode,
      title: "Developer Ready",
      description: "Perfect for game development, AR/VR, and 3D applications"
    }
  ];

  const stats = [
    { number: "10K+", label: "Assets Generated" },
    { number: "500+", label: "Happy Developers" },
    { number: "50+", label: "Export Formats" },
    { number: "24/7", label: "AI Processing" }
  ];

  const handleGetStarted = () => {
    if (user) {
      navigate('/explore');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white overflow-x-hidden">
      {/* Animated 3D Background for Hero */}
      <div className="absolute top-0 left-0 w-full h-[60vh] md:h-[70vh] z-0 pointer-events-none select-none">
        <Suspense fallback={null}>
          <HeroBackground3D />
        </Suspense>
      </div>
      {/* Animated Background Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>
      </div>
      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
              <FaRocket className="text-cyan-400 mr-2" />
              <span className="text-cyan-400 text-sm font-medium">Powered by Evoneural AI</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              In3D.ai
            </h1>
            
            <p className="text-xl sm:text-2xl lg:text-3xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
              Transform your ideas into stunning 3D assets with AI-powered generation
            </p>
            
            <p className="text-lg text-gray-400 mb-12 max-w-3xl mx-auto">
              Create professional 3D models, characters, and environments from simple text prompts. 
              Perfect for game developers, designers, and creators.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={handleGetStarted}
              className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full font-semibold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
            >
              <span className="flex items-center">
                Get Started Free
                <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            
            <button className="group px-8 py-4 border border-gray-600 rounded-full font-semibold text-lg hover:border-cyan-400 hover:text-cyan-400 transition-all duration-300 flex items-center">
              <FaPlay className="mr-2" />
              Watch Demo
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
              Why Choose In3D.ai?
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Experience the future of 3D asset creation with cutting-edge AI technology
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 hover:scale-105 ${
                  activeFeature === index
                    ? 'border-cyan-500 bg-gradient-to-br from-cyan-500/10 to-blue-500/10'
                    : 'border-gray-700 hover:border-cyan-500/50 bg-gray-800/50'
                }`}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${
                  activeFeature === index
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    : 'bg-gray-700 group-hover:bg-gray-600'
                }`}>
                  <feature.icon className={`text-2xl ${
                    activeFeature === index ? 'text-white' : 'text-cyan-400'
                  }`} />
                </div>
                
                <h3 className="text-xl font-semibold mb-3 text-white">
                  {feature.title}
                </h3>
                
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-800/50 to-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-cyan-400 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-400 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
              Ready to Create Amazing 3D Assets?
            </h2>
            
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Join thousands of developers and creators who are already using In3D.ai to bring their ideas to life
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleGetStarted}
                className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full font-semibold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
              >
                <span className="flex items-center">
                  Start Creating Now
                  <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              
              <div className="flex items-center text-gray-400">
                <div className="flex -space-x-2 mr-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 border-2 border-gray-900"
                    />
                  ))}
                </div>
                <span className="text-sm">Join 500+ creators</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <FaCube className="text-cyan-400 text-2xl mr-2" />
              <span className="text-xl font-bold text-white">In3D.ai</span>
            </div>
            
            <div className="flex items-center space-x-6 text-gray-400">
              <span className="text-sm">© 2024 Evoneural AI. All rights reserved.</span>
              <div className="flex items-center space-x-2">
                <FaStar className="text-yellow-400" />
                <span className="text-sm">Powered by Advanced AI</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Subtle 3D background for hero section
const HeroBackground3D = () => {
  // Animate a few floating, glowing spheres
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 5, 10]} intensity={0.7} color="#06b6d4" />
      {[...Array(5)].map((_, i) => (
        <Float
          key={i}
          speed={1 + i * 0.2}
          rotationIntensity={0.2}
          floatIntensity={0.8}
        >
          <Sphere args={[0.6 + i * 0.15, 32, 32]} position={[
            Math.sin(i) * 2.5,
            Math.cos(i) * 1.5 + (i % 2 === 0 ? 0.5 : -0.5),
            -1.5 + i * 0.5
          ]}>
            <meshStandardMaterial
              color={["#06b6d4", "#818cf8", "#f472b6", "#facc15", "#38bdf8"][i]}
              emissive={["#06b6d4", "#818cf8", "#f472b6", "#facc15", "#38bdf8"][i]}
              emissiveIntensity={0.5}
              transparent
              opacity={0.7}
              metalness={0.7}
              roughness={0.2}
            />
          </Sphere>
        </Float>
      ))}
    </Canvas>
  );
};

export default Landing;