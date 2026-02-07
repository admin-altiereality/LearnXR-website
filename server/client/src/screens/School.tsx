import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { learnXRFontStyle, TrademarkSymbol } from '../Components/LearnXRTypography';
import { 
  FaSchool, 
  FaUsers, 
  FaChalkboardTeacher, 
  FaAward, 
  FaLaptop,
  FaHeadset,
  FaChartBar,
  FaHandshake
} from 'react-icons/fa';

// Import shaders
import vertexShader from '../shaders/vertex.glsl?raw';
import fragmentShader from '../shaders/fragment.glsl?raw';
import atmosphereVertexShader from '../shaders/atmosphereVertex.glsl?raw';
import atmosphereFragmentShader from '../shaders/atmosphereFragment.glsl?raw';

const School = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const mainRef = useRef(null);
  const cursorRef = useRef(null);

  const benefits = [
    {
      icon: FaHeadset,
      title: 'Complete Lab Setup',
      description: 'Get a fully equipped LearnXR Lab with VR headsets, content library, and management tools designed for educational institutions.',
      color: 'from-purple-500 to-purple-700',
    },
    {
      icon: FaUsers,
      title: 'Multi-User Support',
      description: 'Manage multiple students and classes with our comprehensive dashboard and analytics tools for teachers and administrators.',
      color: 'from-blue-500 to-blue-700',
    },
    {
      icon: FaChalkboardTeacher,
      title: 'Teacher Training',
      description: 'Comprehensive training programs to help educators integrate VR learning into their curriculum effectively and confidently.',
      color: 'from-emerald-500 to-emerald-700',
    },
    {
      icon: FaChartBar,
      title: 'Analytics & Insights',
      description: 'Track student progress, engagement, and learning outcomes with detailed analytics and reporting tools.',
      color: 'from-amber-500 to-amber-700',
    },
    {
      icon: FaAward,
      title: 'Proven Results',
      description: 'Schools using LearnXR report improved student engagement, better retention, and enhanced learning outcomes.',
      color: 'from-rose-500 to-rose-700',
    },
    {
      icon: FaLaptop,
      title: 'Easy Integration',
      description: 'Seamlessly integrate with existing school infrastructure and curriculum with minimal setup required.',
      color: 'from-cyan-500 to-cyan-700',
    },
  ];

  const labFeatures = [
    { label: 'VR Headsets', value: 'Included' },
    { label: 'Content Library', value: '10K+ Lessons' },
    { label: 'Management Dashboard', value: 'Full Access' },
    { label: 'Teacher Training', value: 'Comprehensive' },
    { label: 'Technical Support', value: '24/7 Available' },
    { label: 'Curriculum Alignment', value: 'K-12 Standards' },
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

  const handleContact = () => {
    window.location.href = 'mailto:admin@altiereality.com?subject=LearnXR Labs Inquiry';
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
                <span className="text-primary">XR</span>
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
                <span className="text-primary">XR</span>
                <TrademarkSymbol className="ml-2" />
                <span className="text-white text-4xl ml-4">Labs</span>
              </motion.h1>
              <motion.h2
                className="text-white text-5xl mb-4 font-medium leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                For Schools
              </motion.h2>
              <motion.p
                className="text-white/80 text-xl max-w-3xl mb-8 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Transform your school with immersive VR learning labs. Provide students with cutting-edge educational experiences that enhance engagement, improve retention, and prepare them for the future.
              </motion.p>
              <motion.button
                onClick={handleContact}
                className="px-10 py-4 rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-semibold text-lg transition-all shadow-lg hover:shadow-purple-500/50"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                Contact Us for Lab Setup
              </motion.button>
            </div>
          </div>
        </div>

        {/* Lab Features Section */}
        <div className="w-full min-h-[50vh] flex items-center justify-center py-20 px-8 bg-black/20 backdrop-blur-sm">
          <div className="max-w-6xl w-full">
            <motion.h2
              className="text-white text-5xl mb-12 text-center font-semibold"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              What's Included in <span style={learnXRFontStyle}><span className="text-foreground">Learn</span><span className="text-primary">XR</span><TrademarkSymbol /></span> Labs
            </motion.h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {labFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <div className="text-purple-700 text-2xl font-semibold mb-2">{feature.value}</div>
                  <div className="text-white/70">{feature.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="w-full min-h-screen flex flex-col items-center justify-center py-20 px-8">
          <motion.h2
            className="text-white text-5xl mb-4 font-semibold text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Why Schools Choose <span style={learnXRFontStyle}><span className="text-foreground">Learn</span><span className="text-primary">XR</span><TrademarkSymbol /></span> Labs
          </motion.h2>
          <motion.p
            className="text-white/70 text-xl mb-12 text-center max-w-2xl"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Comprehensive solutions designed to transform education through immersive VR technology
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl w-full">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${benefit.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <benefit.icon className="text-white text-2xl" />
                </div>
                <h3 className="text-white text-2xl mb-3 font-semibold">{benefit.title}</h3>
                <p className="text-white/70 leading-relaxed">{benefit.description}</p>
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
              Ready to Transform Your School?
            </motion.h2>
            <motion.p
              className="text-white/80 text-xl mb-8 leading-relaxed"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Join leading educational institutions that are revolutionizing learning with <span style={learnXRFontStyle}><span className="text-foreground">Learn</span><span className="text-primary">XR</span><TrademarkSymbol /></span> Labs. Contact us today to set up your VR learning lab.
            </motion.p>
            <motion.div
              className="flex gap-4 justify-center flex-wrap"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <button
                onClick={handleContact}
                className="px-10 py-4 rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-semibold text-lg transition-all shadow-lg hover:shadow-purple-500/50"
              >
                Contact Us
              </button>
              <Link
                to="/"
                className="px-10 py-4 rounded-lg border-2 border-purple-700 hover:bg-purple-700/20 text-white font-semibold text-lg transition-all"
              >
                Learn More
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default School;
