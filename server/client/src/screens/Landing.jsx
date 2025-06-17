import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CompanyScene3D from '../components/CompanyScene3D';
import Navbar from '../components/Navbar';
import { motion } from 'framer-motion';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleAction = () => {
    if (user) {
      navigate('/main');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* Navbar */}
      <Navbar />

      {/* Animated background */}
      <div className="fixed inset-0">
        {/* Base gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 opacity-90"></div>
        
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-800/20 via-indigo-800/20 to-cyan-800/20 animate-gradient-x"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
        
        {/* Radial gradient for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent"></div>
        
        {/* Animated glow effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full filter blur-3xl animate-pulse delay-300"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-600/20 rounded-full filter blur-3xl animate-pulse delay-700"></div>
        </div>
        
        {/* Noise texture */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
      </div>

      {/* Floating particles with enhanced colors */}
      <div className="fixed inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: `radial-gradient(circle, ${
                ['#3B82F6', '#6366F1', '#06B6D4', '#0EA5E9'][Math.floor(Math.random() * 4)]
              } 0%, transparent 70%)`,
              boxShadow: `0 0 10px ${
                ['#3B82F6', '#6366F1', '#06B6D4', '#0EA5E9'][Math.floor(Math.random() * 4)]
              }`,
            }}
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 mb-6">
              IN3D.ai
            </h1>
            <p className="text-4xl text-blue-200 mb-8 font-light">
              GenAI for XR
            </p>
            <p className="text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Create Metaverse with a Single Text Prompt
            </p>
            <div className="max-w-4xl mx-auto mb-12">
              <CompanyScene3D />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAction}
              className="group relative px-12 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-xl font-semibold overflow-hidden"
            >
              <span className="relative z-10">Try Now</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600"
                initial={{ x: "-100%" }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Content Sections */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-32">

          {/* Recognition Section */}
          <motion.section
            id="recognition"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-6">
                  Recognition:
                </h2>
                <p className="text-xl text-gray-300 leading-relaxed mb-8">
                  Welcome to EvoNeural AI Private Limited, a trailblazing technology firm dedicated to pushing the boundaries of artificial intelligence and extended reality, incubated by iStart Rajasthan.
                </p>
                <div className="w-48 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-white text-lg font-bold">iSTART Logo Placeholder</div>
              </div>
              <div className="flex justify-center items-center">
                <div className="w-64 h-64 bg-white/5 rounded-full flex items-center justify-center p-4 border border-white/10 shadow-lg">
                  <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-white text-center text-sm">
                    <img src="/logo.png" alt="EVONEURAL AI" className="w-48 h-48 object-contain"/>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Company Overview Section (from image 1) */}
          <motion.section
            id="company-overview"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
            className="backdrop-blur-xl bg-blue-950/50 rounded-2xl p-12 border border-blue-800/30 shadow-2xl"
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-8">
              Company Overview
            </h2>
            <div className="space-y-4 text-xl text-gray-300">
              <p><span className="font-semibold text-blue-300">Company Name:</span> EVONEURAL ARTIFICIAL INTELLIGENCE (OPC) PRIVATE LIMITED</p>
              <p><span className="font-semibold text-blue-300">Founded:</span> September, 2024</p>
              <p><span className="font-semibold text-blue-300">Headquarters:</span> Second Floor, Bhamashah Technohub, Sansthan Path, Malviya Nagar, Jaipur, Rajasthan</p>
              <p><span className="font-semibold text-blue-300">Website:</span> <a href="https://www.evoneural.ai" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">https://www.evoneural.ai</a></p>
              <p><span className="font-semibold text-blue-300">Mobile:</span> +91 7023310122</p>
            </div>
          </motion.section>

          {/* Problem & Solution Section */}
          <motion.section
            id="problem-solution"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              The Problem - The AVGC - XR Landscape Challenge
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl"
              >
                <span className="text-5xl font-bold text-red-400 mb-6 block">01</span>
                <h3 className="text-3xl font-bold text-white mb-4">Complexity and Cost</h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  The creation of virtual reality (VR) environments is traditionally a complex, time-intensive process, requiring significant technical expertise, making it prohibitively expensive for widespread adoption across various sectors.
                </p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl"
              >
                <span className="text-5xl font-bold text-red-400 mb-6 block">02</span>
                <h3 className="text-3xl font-bold text-white mb-4">Limited Accessibility</h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  The high barrier to entry restricts the integration of VR technology in key areas such as education, real estate, and gaming, thereby impacting potential growth and benefits of immersive experiences in these industries.
                </p>
              </motion.div>
            </div>
          </motion.section>

          {/* In3D.ai Platform Section */}
          <motion.section
            id="in3d-platform"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              In3D.ai Platform
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl">
              <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">Video Placeholder</div>
              <ul className="space-y-4 text-xl text-gray-300">
                <li className="flex items-start"><span className="text-green-400 mr-3">●</span>Text to VR environment, 3D asset, Mesh Generation</li>
                <li className="flex items-start"><span className="text-green-400 mr-3">●</span>Download generated asset in multiple format.</li>
                <li className="flex items-start"><span className="text-green-400 mr-3">●</span>AI tool for Metaverse</li>
                <li className="flex items-start"><span className="text-green-400 mr-3">●</span>Unity Plugin for Easy Integration</li>
                <li className="flex items-start"><span className="text-green-400 mr-3">●</span>MVP live</li>
              </ul>
            </div>
          </motion.section>

          {/* Unique Selling Proposition Section */}
          <motion.section
            id="unique-selling-proposition"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Unique Selling Proposition
            </h2>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl text-center"
            >
              <h3 className="text-3xl font-bold text-white mb-6">
                Speed and Affordability and <span className="text-purple-400">Management Using Unity Plugin</span>
              </h3>
              <p className="text-xl text-gray-300 leading-relaxed mb-8">
                In3D.ai stands out by enabling the rapid creation of VR environments at a fraction of the cost of traditional methods, without the need for specialized skills.
              </p>
              <div className="w-64 h-32 mx-auto bg-gray-700 rounded-lg flex items-center justify-center text-white">Image Placeholder</div>
            </motion.div>
          </motion.section>

          {/* Download Asset Section */}
          <motion.section
            id="download-asset"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              In3D.ai : Download Asset
            </h2>
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Download</h3>
                <button className="text-blue-400 hover:underline flex items-center">
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2"></path></svg>
                  Copy Embed Code
                </button>
              </div>
              <p className="text-gray-400 mb-6">Select the formats you would like to download</p>

              <div className="space-y-6">
                <div>
                  <p className="text-white font-semibold mb-3">Equirectangular</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🖼️</span> JPG</button>
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🏞️</span> PNG</button>
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold mb-3">Cube Map</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">📦</span> Default</button>
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🎮</span> Roblox</button>
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold mb-3">HDRI</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">💡</span> HDRI</button>
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🌟</span> EXR</button>
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold mb-3">Depth Map</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🗺️</span> Depth map</button>
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold mb-3">Video</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🎥</span> Landscape</button>
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🎞️</span> Portrait</button>
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🔲</span> Square</button>
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold mb-3">3D Mesh</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-gray-700 text-white px-5 py-2 rounded-full flex items-center"><span className="mr-2">🧊</span> Launch 3D Creator</button>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Transformative Technology Section */}
          <motion.section
            id="transformative-technology"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Transformative Technology
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl">
                <h3 className="text-3xl font-bold text-white mb-4">AI-Powered Platform</h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  In3D.ai harnesses the power of generative AI to convert text prompts into fully immersive VR environments, democratizing the creation process and making it accessible to a broader audience.
                </p>
              </div>
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl">
                <h3 className="text-3xl font-bold text-white mb-4">User-Friendly Interface</h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  The platform's intuitive design allows users, regardless of their technical background, to effortlessly create and personalize VR spaces, fostering innovation and creativity.
                </p>
              </div>
            </div>
          </motion.section>

          {/* Market Potential Section */}
          <motion.section
            id="market-potential"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              In3D.ai Market Potential and Strategy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex-shrink-0"></div>
                  <div>
                    <p className="text-4xl font-bold text-white">$50 Billion</p>
                    <p className="text-gray-300 text-lg">Total Available Market (TAM)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex-shrink-0"></div>
                  <div>
                    <p className="text-4xl font-bold text-white">$7.2 Billion</p>
                    <p className="text-gray-300 text-lg">Serviceable Available Market (SAM)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-full flex-shrink-0"></div>
                  <div>
                    <p className="text-4xl font-bold text-white">$960 Million</p>
                    <p className="text-gray-300 text-lg">Serviceable Obtainable Market for next 3 Years(SOM) gaming,real estate and education.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl text-center">
                <h3 className="text-3xl font-bold text-white mb-6">Size of Market</h3>
                <p className="text-gray-300 text-lg mb-4">
                  Source: <br/>
                  <a href="https://www.statista.com/statistics/591181/global-augmented-virtual-reality-market-size/" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">https://www.statista.com/statistics/591181/global-augmented-virtual-reality-market-size/</a><br/>
                  <a href="https://www.topias.com/topics/9725/animation-industry/#/content" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">https://www.topias.com/topics/9725/animation-industry/#/content</a>
                </p>
                <div className="w-full h-48 bg-gray-700 rounded-lg flex items-center justify-center text-white">Image Placeholder</div>
              </div>
            </div>
          </motion.section>

          {/* Subscription Pricing Section */}
          <motion.section
            id="subscription-pricing"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              In3D.ai: Subscription Pricing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Basic Plan */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col"
              >
                <h3 className="text-3xl font-bold text-white mb-4">Basic</h3>
                <p className="text-5xl font-bold text-blue-400 mb-6">₹1,200 <span className="text-xl text-gray-400">/month</span></p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full mb-6 transition-colors">SUBSCRIBE</button>
                <div className="space-y-4 flex-grow">
                  <p className="text-white font-semibold">GENERATIONS</p>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>100 generations per month</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Community licensing</li>
                  </ul>
                  <p className="text-white font-semibold mt-4">FEATURES</p>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Create and Remix skyboxes</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>10 environ. styles</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Prompt enhance</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Skybox animations (coming soon)</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Save and export skybox images</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Download assets as obj, gltf, fbx, & depth maps</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Image generation history</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Mark favorites</li>
                  </ul>
                </div>
              </motion.div>

              {/* Pro Plan */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col"
              >
                <h3 className="text-3xl font-bold text-white mb-4">Pro</h3>
                <p className="text-5xl font-bold text-purple-400 mb-6">₹4,999 <span className="text-xl text-gray-400">/month</span></p>
                <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full mb-6 transition-colors">SUBSCRIBE</button>
                <div className="space-y-4 flex-grow">
                  <p className="text-white font-semibold">GENERATIONS</p>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>250 generations per month</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Commercial licensing</li>
                  </ul>
                  <p className="text-white font-semibold mt-4">FEATURES</p>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Create and Remix skyboxes</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>50 environ. styles</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Prompt enhance</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Skybox animations (coming soon)</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Save and export skybox images</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Download assets as obj, gltf, fbx, & depth maps</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Image generation history</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Mark favorites</li>
                  </ul>
                </div>
              </motion.div>

              {/* Enterprise Plan */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">Best Value</div>
                <h3 className="text-3xl font-bold text-white mb-4">Enterprise</h3>
                <p className="text-5xl font-bold text-indigo-400 mb-6">₹9,999 <span className="text-xl text-gray-400">/month</span></p>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-full mb-6 transition-colors">SUBSCRIBE</button>
                <div className="space-y-4 flex-grow">
                  <p className="text-white font-semibold">GENERATIONS</p>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>UNLIMITED generations per month</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Priority support</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Commercial licensing</li>
                  </ul>
                  <p className="text-white font-semibold mt-4">FEATURES</p>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Create and Remix skyboxes</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Unlimited environ. styles</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Prompt enhance</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Skybox animations (coming soon)</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Early access to experimental styles</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Edit skyboxes (coming soon)</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Save and export skybox images</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Download assets as obj, gltf, fbx, & depth maps</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Image generation history</li>
                    <li className="flex items-center"><span className="text-green-400 mr-2">✓</span>Mark favorites</li>
                  </ul>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* Business Model Section */}
          <motion.section
            id="business-model"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Business Model
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-green-600 rounded-full mb-6 flex items-center justify-center text-white text-4xl">🎮</div>
                <h3 className="text-2xl font-bold text-white mb-4">Gaming</h3>
                <p className="text-lg text-gray-300 leading-relaxed">Revenue Source: Subscription-based SaaS for game developers, one-time licensing for custom AI models, and revenue share from co-developed games</p>
              </div>
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-blue-600 rounded-full mb-6 flex items-center justify-center text-white text-4xl">📚</div>
                <h3 className="text-2xl font-bold text-white mb-4">XR Education</h3>
                <p className="text-lg text-gray-300 leading-relaxed">Licensing fees for educational institutions, partnerships with EdTech platforms, and white-label solutions for AR/VR course creation.</p>
              </div>
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-purple-600 rounded-full mb-6 flex items-center justify-center text-white text-4xl">🎨</div>
                <h3 className="text-2xl font-bold text-white mb-4">AVGC-XR</h3>
                <p className="text-lg text-gray-300 leading-relaxed">SaaS subscriptions, pay-per-use model for 3D asset generation, and collaborations with studios on content production.</p>
              </div>
            </div>
          </motion.section>

          {/* Competitors Section */}
          <motion.section
            id="competitors"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Competitors
            </h2>
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl overflow-x-auto">
              <table className="w-full text-left table-auto border-collapse">
                <thead>
                  <tr className="text-gray-300 border-b border-gray-700">
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">Kaedim</th>
                    <th className="py-3 px-4">Scenario.gg</th>
                    <th className="py-3 px-4">3DFY.ai</th>
                    <th className="py-3 px-4">Masterpiece Studio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Funds Raised (₹)</td>
                    <td className="py-3 px-4 text-gray-300">₹16 crore</td>
                    <td className="py-3 px-4 text-gray-300">₹400 crore</td>
                    <td className="py-3 px-4 text-gray-300">₹120 crore</td>
                    <td className="py-3 px-4 text-gray-300">₹320 crore</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Funds Raised (USD)</td>
                    <td className="py-3 px-4 text-gray-300">$2 million</td>
                    <td className="py-3 px-4 text-gray-300">$50 million</td>
                    <td className="py-3 px-4 text-gray-300">$15 million</td>
                    <td className="py-3 px-4 text-gray-300">$40 million</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-white font-medium">Key Focus</td>
                    <td className="py-3 px-4 text-gray-300">2D-to-3D asset conversion</td>
                    <td className="py-3 px-4 text-gray-300">AI for gaming & 3D worlds</td>
                    <td className="py-3 px-4 text-gray-300">AI-based photogrammetry</td>
                    <td className="py-3 px-4 text-gray-300">AR/VR-ready 3D assets</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-400 text-center mt-8">While competitors like Blockade Labs, Tilt Brush, and Unity exist, In3D.ai differentiates itself with its text-based generation, rapid iteration capabilities, and cost efficiency.</p>
          </motion.section>

          {/* Financials for In3D.ai Section */}
          <motion.section
            id="financials"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Financials for In3D.ai
            </h2>
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl overflow-x-auto">
              <table className="w-full text-left table-auto border-collapse">
                <thead>
                  <tr className="text-gray-300 border-b border-gray-700">
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4">Basic Plan</th>
                    <th className="py-3 px-4">Standard Plan</th>
                    <th className="py-3 px-4">Premium Plan</th>
                    <th className="py-3 px-4">Average (All Plans)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Monthly Revenue (ARPU)</td>
                    <td className="py-3 px-4 text-gray-300">₹1,200</td>
                    <td className="py-3 px-4 text-gray-300">₹4,999</td>
                    <td className="py-3 px-4 text-gray-300">₹9,999</td>
                    <td className="py-3 px-4 text-gray-300">₹6,165</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Annual Revenue (ARPU)</td>
                    <td className="py-3 px-4 text-gray-300">₹14,400</td>
                    <td className="py-3 px-4 text-gray-300">₹59,988</td>
                    <td className="py-3 px-4 text-gray-300">₹119,988</td>
                    <td className="py-3 px-4 text-gray-300">₹73,980</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Customer Mix (%)</td>
                    <td className="py-3 px-4 text-gray-300">10%</td>
                    <td className="py-3 px-4 text-gray-300">70%</td>
                    <td className="py-3 px-4 text-gray-300">20%</td>
                    <td className="py-3 px-4 text-gray-300">100%</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Customer Acquisition Cost (CAC)</td>
                    <td className="py-3 px-4 text-gray-300">₹8,000</td>
                    <td className="py-3 px-4 text-gray-300">₹8,000</td>
                    <td className="py-3 px-4 text-gray-300">₹8,000</td>
                    <td className="py-3 px-4 text-gray-300">₹8,000</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Customer Lifetime</td>
                    <td className="py-3 px-4 text-gray-300">3 years</td>
                    <td className="py-3 px-4 text-gray-300">3 years</td>
                    <td className="py-3 px-4 text-gray-300">3 years</td>
                    <td className="py-3 px-4 text-gray-300">3 years</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">Lifetime Value (LTV)</td>
                    <td className="py-3 px-4 text-gray-300">₹43,200</td>
                    <td className="py-3 px-4 text-gray-300">₹179,964</td>
                    <td className="py-3 px-4 text-gray-300">₹359,964</td>
                    <td className="py-3 px-4 text-gray-300">₹2,21,940</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-white font-medium">LTV/CAC Ratio</td>
                    <td className="py-3 px-4 text-gray-300">5.4x</td>
                    <td className="py-3 px-4 text-gray-300">22.5 <span className="text-green-500">↓</span></td>
                    <td className="py-3 px-4 text-gray-300">45x</td>
                    <td className="py-3 px-4 text-gray-300">27.7x</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Core Team Section */}
          <motion.section
            id="core-team"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Core Team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: "Jagrati Sharma", role: "Director", desc: "BTech, Mechatronics" },
                { name: "Devendra Tyagi", role: "CMO", desc: "BTech Mechanical, 4 years Unity dev" },
                { name: "Namrata Purbia", role: "COO", desc: "BTech EEE, 6+ years in IT Ops" }
              ].map((member, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -10 }}
                  className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl text-center"
                >
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 p-1">
                    <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center text-white text-2xl">JP</div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{member.name}</h3>
                  <p className="text-blue-300 mb-2">{member.role}</p>
                  <p className="text-gray-300">{member.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Fund ASK Section */}
          <motion.section
            id="fund-ask"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              Fund ASK: <span className="text-white">Fund Utilization Plan – ₹50 Lakh</span>
            </h2>
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10 shadow-2xl overflow-x-auto">
              <table className="w-full text-left table-auto border-collapse">
                <thead>
                  <tr className="text-gray-300 border-b border-gray-700">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Amount (₹)</th>
                    <th className="py-3 px-4">Percentage</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">1. Salaries & Stipends</td>
                    <td className="py-3 px-4 text-gray-300">33,75,000</td>
                    <td className="py-3 px-4 text-gray-300">67.5%</td>
                    <td className="py-3 px-4 text-gray-300">For a larger and more experienced team of AI Developers, Unity/3D Developers, and interns.</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">2. Hardware</td>
                    <td className="py-3 px-4 text-gray-300">3,75,000</td>
                    <td className="py-3 px-4 text-gray-300">7.5%</td>
                    <td className="py-3 px-4 text-gray-300">Procurement of advanced XR devices, and upgraded equipment.</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">3. Software</td>
                    <td className="py-3 px-4 text-gray-300">2,50,000</td>
                    <td className="py-3 px-4 text-gray-300">5%</td>
                    <td className="py-3 px-4 text-gray-300">Expanded cloud credits, Unity Pro, Blender, and other paid licenses.</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">4. Business Travel & Event Participation</td>
                    <td className="py-3 px-4 text-gray-300">2,50,000</td>
                    <td className="py-3 px-4 text-gray-300">5%</td>
                    <td className="py-3 px-4 text-gray-300">Increased travel budget for international conferences, exhibitions, and clients.</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-white font-medium">5. Expert Consult & Professional Services</td>
                    <td className="py-3 px-4 text-gray-300">2,50,000</td>
                    <td className="py-3 px-4 text-gray-300">5%</td>
                    <td className="py-3 px-4 text-gray-300">Wider scope for consultants, outsourcing, and legal/accounting services.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-white font-medium">6. Other Indirect Expenses (Incl. Office)</td>
                    <td className="py-3 px-4 text-gray-300">3,75,000</td>
                    <td className="py-3 px-4 text-gray-300">7.5%</td>
                    <td className="py-3 px-4 text-gray-300">Larger office space, higher utilities, and admin costs.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* What is AVGC-XR? Section */}
          <motion.section
            id="avgc-xr"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center mb-12">
              What is AVGC-XR?
            </h2>
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-12 border border-white/10 shadow-2xl">
              <p className="text-3xl text-gray-300 leading-relaxed mb-8">
                AVGC-XR (Animation, VFX, Gaming, Comics & Extended Reality) is India's <span className="font-bold text-blue-400">fastest-growing digital content sector.</span>
              </p>
              <p className="text-3xl text-gray-300 leading-relaxed mb-12">
                Projected to reach <span className="font-bold text-blue-400">$26B by 2030</span>, it's driving innovation, immersive experiences, and high-value job creation across industries.
              </p>
              <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-8">
                How will it change the future?
              </h3>
              <ul className="space-y-4 text-xl text-gray-300">
                <li className="flex items-start"><span className="text-green-400 mr-2">●</span>Revolutionizes learning and work with immersive tech</li>
                <li className="flex items-start"><span className="text-green-400 mr-2">●</span>Makes education, healthcare, and retail more experiential</li>
                <li className="flex items-start"><span className="text-green-400 mr-2">●</span>Accelerates digital infrastructure adoption</li>
                <li className="flex items-start"><span className="text-green-400 mr-2">●</span>Unlocks new revenue streams and high-skilled employment</li>
              </ul>
            </div>
          </motion.section>

        {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, amount: 0.5 }}
            className="text-center py-24"
          >
            <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-8">
              Join Us to Build the Next Big Thing in AVGC-XR
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAction}
                className="group relative px-12 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-xl font-semibold overflow-hidden"
              >
                <span className="relative z-10">Get Started</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="https://www.evoneural.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-400 transition-colors duration-300 text-xl"
              >
                Visit our website →
              </motion.a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Landing;