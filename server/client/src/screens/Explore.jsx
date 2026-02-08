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
import AnimatedSection from '../Components/AnimatedSection';
import { PageLayout } from '../Components/PageLayout';

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
    <PageLayout>
      {/* Header Section */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="text-center pt-4 sm:pt-6 mb-8 sm:mb-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-card/80 border border-border backdrop-blur-md mb-6 shadow-lg"
          >
            <FaCube className="text-primary mr-2.5 text-sm" />
            <span className="text-muted-foreground text-sm font-semibold tracking-wide">Explore Gallery</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight text-foreground"
          >
            <span className="block mb-2">Discover</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-pink-400 block">
              Amazing 3D Worlds
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed"
          >
            Browse our curated gallery, explore different styles, learn from tutorials,
            and connect with the community of 3D creators.
          </motion.p>
        </div>
      </AnimatedSection>

      {/* Navigation Tabs */}
      <AnimatedSection animation="fadeUp" delay={0.2}>
        <div className="flex items-center justify-center mb-8 sm:mb-10">
          <nav className="relative rounded-2xl sm:rounded-3xl border border-border bg-card/50 backdrop-blur-xl p-1.5 sm:p-2 w-full max-w-5xl">
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
              {TABS.map((tab, index) => {
                const IconComponent = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 * index }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative flex items-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all duration-300 overflow-hidden ${
                      activeTab === tab.id
                        ? 'text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-xl shadow-lg`}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <IconComponent className={`relative z-10 w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${activeTab === tab.id ? 'text-white scale-110' : 'group-hover:scale-110'}`} />
                    <span className="relative z-10 font-semibold text-xs sm:text-sm md:text-base whitespace-nowrap">{tab.label}</span>
                    {activeTab === tab.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-2 h-2 bg-primary-foreground rounded-full shadow-lg"
                      />
                    )}
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
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="relative rounded-2xl sm:rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-4 sm:p-6 lg:p-8 overflow-hidden shadow-xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

            {/* Content */}
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

      <div className="h-12 sm:h-16" />
    </PageLayout>
  );
};

export default Explore;
