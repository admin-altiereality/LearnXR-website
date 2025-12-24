import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { 
  FaImages, 
  FaPalette, 
  FaBook, 
  FaUsers, 
  FaFire,
  FaCube
} from 'react-icons/fa';
import CommunitySection from './explore/CommunitySection';
import GallerySection from './explore/GallerySection';
import StylesSection from './explore/StylesSection';
import TrendingSection from './explore/TrendingSection';
import TutorialsSection from './explore/TutorialsSection';
import FuturisticBackground from '../Components/FuturisticBackground';
import AnimatedSection from '../Components/AnimatedSection';

const TABS = [
  {
    id: 'gallery',
    label: 'Featured Gallery',
    icon: FaImages,
    gradient: 'from-sky-500 to-cyan-500'
  },
  {
    id: 'styles',
    label: 'Style Categories',
    icon: FaPalette,
    gradient: 'from-violet-500 to-purple-500'
  },
  {
    id: 'tutorials',
    label: 'Tutorials',
    icon: FaBook,
    gradient: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'community',
    label: 'Community',
    icon: FaUsers,
    gradient: 'from-rose-500 to-pink-500'
  },
  {
    id: 'trending',
    label: 'Trending Now',
    icon: FaFire,
    gradient: 'from-amber-500 to-orange-500'
  }
];

const Explore = ({ setBackgroundSkybox }) => {
  const [activeTab, setActiveTab] = useState('gallery');

  const handleSkyboxSelect = (skybox) => {
    if (setBackgroundSkybox) {
      setBackgroundSkybox(skybox);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.2 + i * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <FuturisticBackground>
      <div className="min-h-screen text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <AnimatedSection animation="fadeUp" delay={0.1}>
            <div className="text-center pt-20 mb-12">
              <div className="flex items-center justify-center gap-3 mb-6">
                
              </div>
              
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
                <FaCube className="text-rose-400 mr-2" />
                <span className="text-white/60 text-sm font-medium">Explore</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                  Discover
                </span>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300">
                  Amazing 3D Worlds
                </span>
              </h1>
              
              <p className="text-lg text-white/60 max-w-3xl mx-auto leading-relaxed">
                Browse our gallery, explore different styles, learn from tutorials, 
                and connect with the community of 3D creators.
              </p>
            </div>
          </AnimatedSection>

          {/* Navigation Tabs */}
          <AnimatedSection animation="fadeUp" delay={0.2}>
            <div className="flex items-center justify-center mb-12">
              <nav className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-2 shadow-[0_20px_60px_-15px_rgba(139,92,246,0.2)]">
                <div className="flex flex-wrap justify-center gap-2">
                  {TABS.map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group relative flex items-center space-x-2 px-5 py-3 rounded-xl transition-all duration-300 overflow-hidden ${
                          activeTab === tab.id
                            ? 'text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeTab"
                            className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-xl`}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                        <IconComponent className={`relative z-10 w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                        <span className="relative z-10 font-medium text-sm sm:text-base">{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </nav>
            </div>
          </AnimatedSection>

          {/* Content */}
          <AnimatedSection animation="fadeUp" delay={0.3}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                className="relative rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 sm:p-8 overflow-hidden"
              >
                {/* Content glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
                
                <div className="relative z-10">
                  {activeTab === 'gallery' && (
                    <GallerySection 
                      onSelect={handleSkyboxSelect} 
                      setBackgroundSkybox={setBackgroundSkybox} 
                    />
                  )}
                  {activeTab === 'styles' && (
                    <StylesSection onSelect={handleSkyboxSelect} />
                  )}
                  {activeTab === 'tutorials' && (
                    <TutorialsSection />
                  )}
                  {activeTab === 'community' && (
                    <CommunitySection />
                  )}
                  {activeTab === 'trending' && (
                    <TrendingSection onSelect={handleSkyboxSelect} />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </AnimatedSection>

          {/* Bottom spacing */}
          <div className="h-16"></div>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default Explore;
