import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FaStar } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../Components/LearnXRTypography';

// Import shaders as raw strings
import vertexShader from '../shaders/vertex.glsl?raw';
import fragmentShader from '../shaders/fragment.glsl?raw';
import atmosphereVertexShader from '../shaders/atmosphereVertex.glsl?raw';
import atmosphereFragmentShader from '../shaders/atmosphereFragment.glsl?raw';

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const canvasRef = useRef(null);
  const mainRef = useRef(null);
  const cursorRef = useRef(null);
  const sceneRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const contentSlides = [
    {
      image: '/img/lxrn4.png',
      title: 'STEM Lesson',
      description: 'Virtual reality transforms STEM learning by providing interactive experiences that enhance understanding of complex concepts in science, technology, engineering, and mathematics.',
    },
    {
      image: '/img/lxrn3.png',
      title: 'Humanities',
      description: 'VR revolutionizes humanities education with immersive, interactive experiences.',
    },
    {
      image: '/img/lxrn2.png',
      title: 'Immersive Learning',
      description: 'VR enables immersive learning through interactive, virtual experiences.',
    },
    {
      image: '/img/lxrn5.png',
      title: 'Field Trip',
      description: 'A virtual reality field trip offers immersive educational experiences, allowing students to explore diverse environments and historical sites without leaving the classroom.',
    },
  ];

  const testimonials = [
    {
      name: 'PK Mathur',
      role: 'Principal, SPSS nathadwara',
      image: '/img/testimonials-3.jpg',
      text: 'Kids loves the product and the lessons are engaging too. Looking to get a LearnXR Lab setup for my school',
    },
    {
      name: 'Nishant Gupta',
      role: 'Parent',
      image: '/img/testimonials-2.jpg',
      text: 'we needed a way through which our kid could get a clear understanding of Curosity Rover. LearnXR App\'s virtual tour made it all possible. Loved it.',
    },
    {
      name: 'Jay Kahchara',
      role: 'Class 6th, LBS Chittorgarh',
      image: '/img/testimonials-1.jpg',
      text: 'LearnXr App significantly improves information Retention. learning was never that much immersive before',
    },
    {
      name: 'Deepak Dadhich',
      role: 'Industry Expert',
      image: '/img/testimonials-4.jpg',
      text: 'AR/VR are the way forward for any learning solutionto make impact online. LearnXR is on the right track to achieve it.',
    },
    {
      name: 'Jyotsana Tyagi',
      role: 'Parent',
      image: '/img/testimonials-5.jpg',
      text: 'I love their educational app LearnXR that my kis uses for learning. Immersive by now technology is transforming the way of learning.',
    },
  ];

  // Initialize Three.js Earth scene
  useEffect(() => {
    if (!canvasRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Create Earth sphere with shaders
    const sphereGeometry = new THREE.SphereGeometry(5, 50, 50);
    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        globeTexture: {
          value: new THREE.TextureLoader().load('/img/earth.jpg'),
        },
      },
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    // Create atmosphere
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

    // Add stars
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 1000;
      const y = (Math.random() - 0.5) * 1000;
      const z = -Math.random() * 10000;
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    camera.position.z = 10;
    sceneRef.current = { scene, camera, renderer, group, sphere };

    const mouse = { x: 0, y: 0 };

    const handleMouseMove = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      if (sphere) sphere.rotation.y += 0.001;
      gsap.to(group.rotation, {
        x: -mouse.y * 0.1,
        y: mouse.x * 0.1,
        duration: 3,
      });
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

  // Cursor effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (cursorRef.current) {
        gsap.to(cursorRef.current, {
          x: e.clientX - 40,
          y: e.clientY - 40,
          duration: 0.3,
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // GSAP ScrollTrigger animations
  useEffect(() => {
    if (!mainRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    // Page 2 animations
    gsap.from('#page2 h1', {
      y: 150,
      stagger: 0.1,
      duration: 0.5,
      scrollTrigger: {
        trigger: '#page2',
        scroller: mainRef.current,
        start: '30% 80%',
        end: '30% 65%',
        scrub: 4,
      },
    });

    gsap.from('#page2 h4', {
      y: 150,
      stagger: 0.1,
      duration: 0.5,
      scrollTrigger: {
        trigger: '#page2',
        scroller: mainRef.current,
        start: '30% 80%',
        end: '30% 65%',
        scrub: 4,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const handleGetStarted = () => {
    if (authLoading) return;
    if (user) {
      navigate('/main');
    } else {
      navigate('/login');
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % contentSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + contentSlides.length) % contentSlides.length);
  };

  return (
    <div className="flex h-screen w-full relative" id="main2">
      {/* 3D Earth Canvas Background */}
      <div className="w-full fixed h-screen -z-10" id="canvasContainer">
        <canvas ref={canvasRef}></canvas>
      </div>

      {/* Custom Cursor */}
      <div
        ref={cursorRef}
        className="fixed z-[100] w-20 h-20 opacity-30 bg-purple-600 rounded-full flex items-center justify-center pointer-events-none"
        id="cursur"
        style={{ transform: 'translate(-50%, -50%)' }}
      ></div>

      {/* Main Content */}
      <div
        ref={mainRef}
        id="main"
        className="absolute h-screen w-full bg-transparent overflow-y-scroll"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Page 1: Hero Section */}
        <div id="page1" className="w-full h-screen relative">
          <div
            id="page1-content"
            className="h-[100vmin] z-10 flex flex-col relative items-center justify-between"
          >
            <nav className="h-[100px] w-full flex items-center justify-between p-16 z-0">
              <div className="h-15 w-20"></div>
              <button
                onClick={handleLogin}
                className="px-6 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-medium transition-colors duration-200 text-lg"
              >
                Login
              </button>
            </nav>

            <div className="absolute overflow-hidden">
              <motion.img
                id="vr-img"
                className="z-[9] h-[50vh] w-[40vw] translate-y-[0vh]"
                src="/img/vr image.png"
                alt="VR"
                loading="lazy"
                initial={{ y: 800 }}
                animate={{ y: 0 }}
                transition={{ duration: 2 }}
              />
            </div>
            <div className="absolute overflow-hidden top-[60vh] right-10">
              <motion.img
                id="vr-img2"
                className="w-[12vw] translate-y-[0vh]"
                src="/img/astro.png"
                alt="Astro"
                loading="lazy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2 }}
              />
            </div>

            <div
              id="heading"
              className="overflow-hidden flex flex-col items-center justify-center h-fit relative"
            >
              <h1 className="text-white text-[14rem] tracking-[0.9rem] inline-block overflow-hidden h-fit leading-none" style={learnXRFontStyle}>
                <motion.span initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0 }}>L</motion.span>
                <motion.span initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>e</motion.span>
                <motion.span initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>a</motion.span>
                <motion.span initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>r</motion.span>
                <motion.span initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>n</motion.span>
                <motion.span className="text-purple-700" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>X</motion.span>
                <motion.span className="text-purple-700" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>R</motion.span>
                <span id="tr" className="float-end ml-1">
                  <TrademarkSymbol className="text-white" />
                </span>
              </h1>
              <div className="hover-cont flex gap-10 mt-8">
                <div className="hover">
                  <Link to="/individual" className="text-white text-xl hover:text-purple-400 transition-colors font-medium">
                    LearnXR for Individuals
                  </Link>
                </div>
                <div className="hover">
                  <Link to="/school" className="text-white text-xl hover:text-purple-400 transition-colors font-medium">
                    LearnXR Labs for Schools
                  </Link>
                </div>
              </div>
            </div>
            <motion.p
              className="text-white text-xl font-medium tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Redefining Learning with XR + AI.
            </motion.p>
          </div>
        </div>

        {/* Page 2: Who We Are */}
        <div
          id="page2"
          className="w-full h-[90vmin] flex justify-center relative items-center flex-col"
        >
          <div className="absolute right-[1rem] bottom-0 w-[43vw]">
            <img
              id="vr-imgg3"
              className="w-[100%]"
              src="/img/vr image3.jpg"
              alt="VR Experience"
              loading="lazy"
            />
          </div>
          <div id="heading" className="overflow-hidden h-fit mb-4">
            <h1 className="text-[2rem] text-purple-700 z-10 font-semibold tracking-wide">WHO WE ARE</h1>
          </div>
          <div id="page2-para" className="">
            <div id="elem" className="text-white text-[3rem] overflow-hidden font-medium leading-tight">
              <h1>
                <span style={learnXRFontStyle}>LearnXR</span> by Altie Reality is proudly funded by Meta Inc
              </h1>
            </div>
            <div id="elem" className="text-white text-[3rem] overflow-hidden font-medium leading-tight">
              <h1>through Meta XR Startup program</h1>
            </div>
          </div>
          <div id="lower" className="overflow-hidden">
            <h4 className="text-white text-2xl mt-4 font-medium">
              In association with iStart & SPTBI
            </h4>
          </div>
        </div>

        {/* Page 3: Content Slider */}
        <div
          id="page3"
          className="w-full h-screen flex flex-col justify-center items-center"
        >
          <p className="text-purple-700 text-[2rem] font-semibold tracking-wide">CONTENT</p>
          <p className="text-white text-6xl pb-10 font-medium leading-tight">Content covered upto k-12</p>

          <div className="page3-slider-container w-full h-[100vmin] relative">
            <div className="left-arrow cursor-pointer" onClick={prevSlide}>
              <i className="fa fa-angle-left text-white text-2xl"></i>
            </div>
            <div className="page3-slider-content" id="slider-content">
              {contentSlides.map((slide, index) => (
                <div
                  key={index}
                  className={`slide ${index === currentSlide ? 'active' : ''}`}
                >
                  <div className="media">
                    <img
                      className="bg-cover w-full h-full object-cover"
                      src={slide.image}
                      alt={slide.title}
                      loading="lazy"
                    />
                  </div>
                  <div className="card-sections">
                    <div className="lower-section">
                      <div className="card-caption text-[5vmin] font-semibold">{slide.title}</div>
                      <h4 className="text-[2.2vmin] font-normal leading-relaxed">{slide.description}</h4>
                      <div className="card-button tracking-wide font-medium">learn more</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="right-arrow cursor-pointer" onClick={nextSlide}>
              <i className="fa fa-angle-right text-white text-2xl"></i>
            </div>
          </div>
        </div>

        {/* Page 4: Testimonials */}
        <div
          id="page4"
          className="h-fit flex justify-between px-[5vw] relative pt-[5rem]"
        >
          <div id="page4-left" className="w-[45%] h-fit sticky top-[10vh] left-0">
            <div className="overflow-hidden">
              <h3 className="text-purple-700 pb-6 overflow-hidden text-[2.2rem] font-semibold">TESTIMONIALS</h3>
            </div>
            <div className="overflow-hidden">
              <h1 className="text-white overflow-hidden text-6xl font-medium leading-tight">What they are saying about us</h1>
            </div>
            <img id="vr-img4" src="/img/vr-img3.png" alt="VR" loading="lazy" />
          </div>

          <div id="page4-right" className="flex flex-col">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-[1rem]">
                <div className="rounded-lg h-[37vh] w-[35vw] flex flex-col items-center justify-center p-4 bg-white/5 backdrop-blur-sm border border-white/10">
                  <div className="">
                    {[...Array(5)].map((_, i) => (
                      <FaStar key={i} className="text-yellow-400 inline" />
                    ))}
                  </div>
                  <p className="text-[2vmin] text-white text-center my-4 leading-relaxed">{testimonial.text}</p>
                  <img
                    src={testimonial.image}
                    className="w-20 h-20 rounded-full object-cover"
                    alt={testimonial.name}
                    loading="lazy"
                  />
                  <p className="text-[2vmin] text-white mt-2 font-medium">{testimonial.name}</p>
                  <p className="text-[1rem] font-thin text-white/70">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page 5: Partners */}
        <div
          id="page5"
          className="w-full h-fit flex flex-col relative items-center pt-[7rem]"
        >
          <p className="text-white text-[3rem] mt-10 mb-10 font-semibold tracking-wide">IN ASSOCIATION WITH</p>
          <div className="flex w-full justify-evenly pb-10">
            <img className="w-[11%] h-[11%] object-contain" src="/img/client-1.png" alt="Partner" loading="lazy" />
            <img className="w-[11%] h-[11%] object-contain" src="/img/client-2.png" alt="Partner" loading="lazy" />
            <img className="w-[11%] h-[11%] object-contain" src="/img/client-3.png" alt="Partner" loading="lazy" />
            <img className="w-[11%] h-[11%] object-contain" src="/img/client-4.png" alt="Partner" loading="lazy" />
            <img className="w-[11%] h-[13%] object-contain" src="/img/sptbilogo.png" alt="SPTBI" loading="lazy" />
          </div>
        </div>

        {/* Footer */}
        <div id="footer" className="w-full h-fit bg-black">
          <div className="flex flex-row justify-between py-[2.5vw] px-[5.5vw] w-full h-fit">
            <div id="footer1-left">
              <div className="overflow-hidden">
                <h1 className="text-purple-700 text-[2.5vw] font-semibold">Contact Us</h1>
              </div>
              <p className="text-white mt-4 text-[1.3rem] leading-relaxed">
                +91 8619953434<br />
                +91 9145822691
              </p>
            </div>
            <div id="footer-right" className="flex w-[25%] justify-center">
              <div className="flex flex-col justify-between gap-2">
                <a href="https://www.youtube.com/channel/UCXhsQN9jsazg4FDoIuSseBg" className="text-white text-[1.4rem] hover:text-purple-400 transition-colors" target="_blank" rel="noopener noreferrer">Youtube</a>
                <a href="https://www.facebook.com/altiereality" className="text-white text-[1.4rem] hover:text-purple-400 transition-colors" target="_blank" rel="noopener noreferrer">Facebook</a>
                <a href="https://www.instagram.com/learn__xr/" className="text-white text-[1.4rem] hover:text-purple-400 transition-colors" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://www.linkedin.com/company/altie-reality/mycompany/" className="text-white text-[1.4rem] hover:text-purple-400 transition-colors" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              </div>
            </div>
          </div>

          <div className="flex flex-row justify-between py-[2.5vw] px-[5.5vw]">
            <div id="footer2-left">
              <div className="overflow-hidden">
                <h3 className="text-purple-700 text-[2.5vw] font-semibold">Address</h3>
              </div>
              <p className="text-white text-[1.3rem] leading-relaxed">
                41,42 Bhamashah Technohub <br />
                , Santhan Path, Malviya Nagar , Jaipur 302007
              </p>
            </div>
            <div id="footer2-right">
              <div className="overflow-hidden">
                <h3 className="text-[2.5vw] text-purple-700 font-semibold">Email Us</h3>
              </div>
              <p className="text-white text-[1.3rem]">admin@altiereality.com</p>
            </div>
          </div>
          
          <p className="text-white flex items-center justify-center pb-4 text-2xl font-medium">Get it on</p>
          <div className="flex w-full justify-center items-center gap-10 mb-[5rem]">
            <a
              href="https://play.google.com/store/apps/details?id=com.altiereality1.lexrn&hl=en&gl=US&pli=1"
              className="text-white text-3xl hover:text-purple-400 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-brands fa-android"></i>
            </a>
            <a
              href="https://sidequestvr.com/app/17713/lexrn-app-for-students"
              className="text-white w-[3%] hover:opacity-80 transition-opacity"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/img/sidequest.png" alt="SideQuest" loading="lazy" />
            </a>
            <a href="" className="text-white text-3xl hover:text-purple-400 transition-colors">
              <i className="fa-brands fa-apple"></i>
            </a>
          </div>
          <p className="flex items-center justify-center text-white text-lg">&copy; Altie Reality 2020-2025</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
