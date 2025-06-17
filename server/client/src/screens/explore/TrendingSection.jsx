import React from 'react';
import { motion } from 'framer-motion';

const TRENDING_ITEMS = [
  {
    id: 'trend-1',
    title: 'Neon Dreams',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_cyberpunk_night_932592572_12806524.jpg?ver=1',
    author: 'CyberArtist',
    likes: 2345,
    views: 12000,
    trend: '+156%',
    tags: ['Cyberpunk', 'Night', 'City']
  },
  {
    id: 'trend-2',
    title: 'Crystal Cave',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_crystal_cave_with_932592572_12806524.jpg?ver=1',
    author: 'CaveMaster',
    likes: 1890,
    views: 9500,
    trend: '+142%',
    tags: ['Fantasy', 'Cave', 'Crystal']
  },
  {
    id: 'trend-3',
    title: 'Space Station',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_space_station_with_932592572_12806524.jpg?ver=1',
    author: 'SpaceExplorer',
    likes: 1567,
    views: 8200,
    trend: '+128%',
    tags: ['Sci-Fi', 'Space', 'Technology']
  }
];

const STAFF_PICKS = [
  {
    id: 'staff-1',
    title: 'Ancient Temple',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_An_ancient_temple_with_932592572_12806524.jpg?ver=1',
    description: 'A mystical temple hidden in dense jungle',
    author: 'TempleSeeker',
    featured: true
  },
  {
    id: 'staff-2',
    title: 'Ocean Depths',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_An_underwater_scene_with_932592572_12806524.jpg?ver=1',
    description: 'Deep sea environment with bioluminescent creatures',
    author: 'OceanArtist',
    featured: true
  }
];

const TrendingSection = ({ onSelect }) => {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Trending Now</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Discover the most popular and trending skyboxes in our community
        </p>
      </div>

      {/* Trending Grid */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-6">Hot Right Now 🔥</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {TRENDING_ITEMS.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="group rounded-xl overflow-hidden backdrop-blur-md bg-white/5 border border-white/10"
            >
              {/* Image */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
                
                {/* Trending Badge */}
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium backdrop-blur-md border border-green-500/30">
                  {item.trend}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 mb-4">by {item.author}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4 text-gray-400">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {item.likes}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {item.views}
                    </span>
                  </div>
                  <button
                    onClick={() => onSelect(item)}
                    className="text-purple-400 hover:text-purple-300 transition-colors duration-200"
                  >
                    Use This
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Staff Picks */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-6">Staff Picks ⭐</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {STAFF_PICKS.map((pick, index) => (
            <motion.div
              key={pick.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="relative group rounded-xl overflow-hidden"
            >
              {/* Image */}
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={pick.image}
                  alt={pick.title}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
              </div>

              {/* Content */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 backdrop-blur-md border border-yellow-500/30">
                    Staff Pick
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{pick.title}</h3>
                <p className="text-gray-300 mb-4">{pick.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">by {pick.author}</span>
                  <button
                    onClick={() => onSelect(pick)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200"
                  >
                    Use This
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Rising Stars */}
      <div className="mt-12 p-8 rounded-xl backdrop-blur-md bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-white/10">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Become a Rising Star</h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Create and share your skyboxes to get featured in our trending section
          </p>
          <button className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg 
                         transition-all duration-200 backdrop-blur-md border border-white/20">
            Start Creating
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrendingSection; 