import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FaBrain,
  FaCube,
  FaPalette,
  FaPlay,
  FaArrowRight,
  FaStar,
  FaUsers,
  FaShieldAlt,
  FaGlobe,
  FaDownload,
  FaBolt,
  FaCode
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';

const features = [
  {
    icon: FaBrain,
    title: "AI-Powered Generation",
    description: "Transform text prompts into cinematic 3D assets with state-of-the-art neural networks",
    gradient: "from-amber-500 to-orange-600"
  },
  {
    icon: FaCube,
    title: "Multiple Formats",
    description: "Export to FBX, OBJ, GLTF and more for seamless workflow integration",
    gradient: "from-emerald-500 to-teal-600"
  },
  {
    icon: FaPalette,
    title: "Style Variety",
    description: "Choose from animation, gaming, comics, and VFX artistic styles",
    gradient: "from-violet-500 to-purple-600"
  },
  {
    icon: FaCode,
    title: "Developer Ready",
    description: "Perfect for game development, AR/VR, and immersive experiences",
    gradient: "from-sky-500 to-blue-600"
  }
];

const stats = [
  { number: "10K+", label: "Assets Generated", icon: FaCube },
  { number: "500+", label: "Happy Creators", icon: FaUsers },
  { number: "50+", label: "Export Formats", icon: FaDownload },
  { number: "24/7", label: "AI Processing", icon: FaBolt }
];

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subscriptionLoading, isFreePlan } = useSubscription();
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setActiveFeature(0);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    if (authLoading || subscriptionLoading) {
      return;
    }

    if (user) {
      if (isFreePlan && !subscription) {
        navigate('/onboarding');
      } else {
        navigate('/main');
      }
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden font-body selection:bg-sky-500/30 selection:text-white pt-10">
      <HeroGeometric
        badge="Powered by Evoneural AI"
        title1="In3D.ai crafts worlds"
        title2="AI-powered 3D stories"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center"
        >
          <motion.button
            onClick={handleGetStarted}
            className="group relative px-10 py-4 rounded-2xl font-semibold text-lg overflow-hidden"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500" />
            <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 rounded-2xl shadow-[0_0_45px_rgba(139,92,246,0.4)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex items-center gap-2 text-white">
              Get Started Free
              <FaArrowRight className="text-sm" />
            </span>
          </motion.button>

          <motion.button
            className="group px-10 py-4 rounded-2xl font-semibold text-lg border border-white/20 hover:border-sky-400/60 transition-all duration-300 flex items-center gap-3 bg-white/5 backdrop-blur-2xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FaPlay className="text-sky-400" />
            </div>
            <span className="text-white/70">Watch Demo</span>
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-8 flex flex-wrap justify-center items-center gap-6 text-xs text-white/60 tracking-[0.3em]"
        >
          <div className="flex items-center gap-2">
            <FaShieldAlt className="text-emerald-400" />
            <span>Secure by design</span>
          </div>
          <div className="flex items-center gap-2">
            <FaGlobe className="text-sky-400" />
            <span>Global CDN</span>
          </div>
          <div className="flex items-center gap-2">
            <FaStar className="text-amber-400" />
            <span>99.9% uptime</span>
          </div>
        </motion.div>
      </HeroGeometric>

      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-sm font-medium mb-4">
              Powering 3D narratives
            </span>
            <h2 className="text-4xl sm:text-5xl font-display font-bold mb-4 text-white">
              Why developers trust In3D.ai
            </h2>
            <p className="text-lg text-white/60 max-w-3xl mx-auto">
              Intelligent generation, expressive style control, and production-ready exports baked into one AI assistant.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative rounded-3xl border bg-white/5 border-white/10 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all duration-500"
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={`absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-500 ${activeFeature === index ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-fuchsia-500/20 blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-col gap-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white shadow-lg`}>
                    <feature.icon className="text-2xl" />
                  </div>
                  <h3 className="text-2xl font-semibold">{feature.title}</h3>
                  <p className="text-white/70 leading-relaxed">{feature.description}</p>
                  <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold">
                    <span>Learn more</span>
                    <FaArrowRight className="text-[0.7rem]" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 backdrop-blur-3xl p-12 relative overflow-hidden shadow-[0_50px_120px_rgba(13,110,253,0.25)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_55%)] pointer-events-none" />
            <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center relative z-10"
                >
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-3 flex items-center justify-center">
                    <stat.icon className="text-sky-400" />
                  </div>
                  <div className="text-4xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-sky-300 mb-2">
                    {stat.number}
                  </div>
                  <div className="text-white/60 uppercase tracking-[0.3em] text-xs">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-3xl p-12 text-center overflow-hidden shadow-[0_40px_80px_rgba(15,118,255,0.25)]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 via-transparent to-fuchsia-500/10 pointer-events-none" />
            <h2 className="font-display text-4xl font-bold mb-6 text-white relative z-10">
              Ready to create the worlds you imagine?
            </h2>
            <p className="relative z-10 text-white/70 mb-10">
              Join thousands of creators debugging less and designing more with In3D.ai.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGetStarted}
                className="px-10 py-3 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 font-semibold text-white shadow-[0_20px_60px_rgba(14,165,233,0.45)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                Start creating now
              </button>
              <button
                className="px-10 py-3 rounded-full border border-white/30 text-white/80 hover:text-white transition-colors"
              >
                Schedule a call
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="relative z-10 py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)]">
              <FaCube className="text-white text-xl" />
            </div>
            <div>
              <p className="text-xl font-display font-semibold">In3D.ai</p>
              <p className="text-sm text-white/60">Â© 2024 Evoneural AI. All rights reserved.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All systems go</span>
            </div>
            <span className="text-xs tracking-[0.3em] uppercase">Crafted for creators</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
