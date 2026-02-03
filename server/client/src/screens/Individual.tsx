import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { learnXRFontStyle, TrademarkSymbol } from '../Components/LearnXRTypography';
import { 
  FaGraduationCap, 
  FaUser, 
  FaBook, 
  FaRocket, 
  FaBrain,
  FaChartLine,
  FaClock,
  FaAward
} from 'react-icons/fa';

// Import shaders
import vertexShader from '../shaders/vertex.glsl?raw';
import fragmentShader from '../shaders/fragment.glsl?raw';
import atmosphereVertexShader from '../shaders/atmosphereVertex.glsl?raw';
import atmosphereFragmentShader from '../shaders/atmosphereFragment.glsl?raw';

const Individual = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const mainRef = useRef(null);
  const cursorRef = useRef(null);

  const features = [
    {
      icon: FaBrain,
      title: 'Immersive Learning',
      description: 'Step into virtual worlds where complex concepts come to life. Experience science, history, and mathematics like never before.',
      color: 'from-purple-500 to-purple-700',
    },
    {
      icon: FaClock,
      title: 'Learn at Your Pace',
      description: 'No deadlines, no pressure. Study when it suits you and revisit lessons as many times as you need.',
      color: 'from-blue-500 to-blue-700',
    },
    {
      icon: FaBook,
      title: 'K-12 Curriculum',
      description: 'Comprehensive content library covering all subjects from kindergarten through 12th grade, aligned with educational standards.',
      color: 'from-emerald-500 to-emerald-700',
    },
    {
      icon: FaChartLine,
      title: 'Track Progress',
      description: 'Monitor your learning journey with detailed analytics and personalized insights to optimize your study sessions.',
      color: 'from-amber-500 to-amber-700',
    },
  ];

  const stats = [
    { number: '10K+', label: 'Interactive Lessons' },
    { number: '95%', label: 'Retention Rate' },
    { number: '24/7', label: 'Access Anytime' },
    { number: '100+', label: 'Subjects Covered' },
  ];

  // Initialize Three.js Earth scene
  useEffect(() => {
    if (!canvasRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const sphereGeometry = new THREE.SphereGeometry(5, 50, 50);
    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        globeTexture: { value: new THREE.TextureLoader().load('/img/earth.jpg') },
      },
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    const atmosphereGeometry = new THREE.SphereGeometry(5, 50, 50);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    atmosphere.scale.set(1.1, 1.1, 1.1);

    scene.add(atmosphere);
    const group = new THREE.Group();
    group.add(sphere);
    scene.add(group);

    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
      starVertices.push(
        (Math.random() - 0.5) * 1000,
        (Math.random() - 0.5) * 1000,
        -Math.random() * 10000
      );
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    scene.add(new THREE.Points(starGeometry, starMaterial));

    camera.position.z = 10;
    const mouse = { x: 0, y: 0 };

    const handleMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      sphere.rotation.y += 0.001;
      gsap.to(group.rotation, { x: -mouse.y * 0.1, y: mouse.x * 0.1, duration: 3 });
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (cursorRef.current) {
        gsap.to(cursorRef.current, { x: e.clientX - 40, y: e.clientY - 40, duration: 0.3 });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = () => {
    navigate('/login');
  };

  const handleGetStarted = () => {
    if (user) {
      navigate('/main');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen w-full relative">
      <div className="w-full fixed h-screen -z-10">
        <canvas ref={canvasRef}></canvas>
      </div>

      <div
        ref={cursorRef}
        className="fixed z-[100] w-20 h-20 opacity-30 bg-purple-600 rounded-full pointer-events-none"
        style={{ transform: 'translate(-50%, -50%)' }}
      ></div>

      <div
        ref={mainRef}
        className="absolute h-screen w-full bg-transparent overflow-y-scroll"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Hero Section */}
        <div className="w-full h-screen relative flex items-center justify-center">
          <div className="h-[100vmin] z-10 flex flex-col relative items-center justify-between w-full">
            <nav className="h-[100px] w-full flex items-center justify-between p-16 z-0">
              <Link to="/" className="text-white text-2xl font-semibold hover:text-purple-400 transition-colors" style={learnXRFontStyle}>
                <span className="text-white">Learn</span>
                <span className="text-purple-700">XR</span>
                <TrademarkSymbol className="ml-1" />
              </Link>
              <button
                onClick={handleLogin}
                className="px-6 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-medium transition-colors text-lg"
              >
                Login
              </button>
            </nav>

            <div className="flex flex-col items-center justify-center text-center px-8 relative w-full max-w-5xl">
              <motion.h1
                className="text-white text-[8rem] tracking-[0.6rem] leading-none mb-6"
                style={learnXRFontStyle}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <span className="text-white">Learn</span>
                <span className="text-purple-700">XR</span>
                <TrademarkSymbol className="ml-2" />
              </motion.h1>
              <motion.h2
                className="text-white text-5xl mb-4 font-medium leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                For Individuals
              </motion.h2>
              <motion.p
                className="text-white/80 text-xl max-w-3xl mb-8 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Transform your learning journey with immersive VR experiences. Access comprehensive K-12 curriculum content, learn at your own pace, and make education engaging and memorable.
              </motion.p>
              <motion.button
                onClick={handleGetStarted}
                className="px-10 py-4 rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-semibold text-lg transition-all shadow-lg hover:shadow-purple-500/50"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                Start Learning Now
              </motion.button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="w-full min-h-[40vh] flex items-center justify-center py-16 px-8 bg-black/20 backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl w-full">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="text-purple-700 text-5xl font-bold mb-2" style={learnXRFontStyle}>
                  {stat.number}
                </div>
                <div className="text-white/70 text-lg">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="w-full min-h-screen flex flex-col items-center justify-center py-20 px-8">
          <motion.h2
            className="text-white text-5xl mb-4 font-semibold text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Why Choose <span style={learnXRFontStyle}><span className="text-white">Learn</span><span className="text-purple-700">XR</span><TrademarkSymbol /></span>?
          </motion.h2>
          <motion.p
            className="text-white/70 text-xl mb-12 text-center max-w-2xl"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Experience the future of education with cutting-edge VR technology designed for individual learners
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl w-full">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="text-white text-2xl" />
                </div>
                <h3 className="text-white text-2xl mb-3 font-semibold">{feature.title}</h3>
                <p className="text-white/70 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="w-full min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-black/40 to-black/60 backdrop-blur-sm">
          <div className="text-center px-8 max-w-3xl">
            <motion.h2
              className="text-white text-5xl mb-6 font-medium"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Ready to Transform Your Learning?
            </motion.h2>
            <motion.p
              className="text-white/80 text-xl mb-8 leading-relaxed"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Join thousands of learners who are already experiencing the future of education with <span style={learnXRFontStyle}><span className="text-white">Learn</span><span className="text-purple-700">XR</span><TrademarkSymbol /></span>.
            </motion.p>
            <motion.button
              onClick={handleGetStarted}
              className="px-10 py-4 rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-semibold text-lg transition-all shadow-lg hover:shadow-purple-500/50"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              Get Started Today
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Individual;
