import React from 'react';
import { motion } from 'framer-motion';

const FEATURED_SKYBOXES = [
  {
    id: 'featured-1',
    name: 'Neon City Dreams',
    description: 'A vibrant cyberpunk cityscape with glowing neon lights and flying vehicles',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_futuristic_cityscape_at_932592572_12806524.jpg?ver=1',
    tags: ['Featured', 'Cyberpunk', 'Urban'],
    author: 'CyberArtist',
    likes: 1234
  },
  {
    id: 'featured-2',
    name: 'Ethereal Forest',
    description: 'Mystical woodland scene with floating particles and magical atmosphere',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_forest_with_932592572_12806524.jpg?ver=1',
    tags: ['Featured', 'Nature', 'Fantasy'],
    author: 'NatureMage',
    likes: 987
  },
  {
    id: 'featured-3',
    name: 'Space Station Alpha',
    description: 'Futuristic space station orbiting Earth with stunning planetary views',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_space_station_orbiting_932592572_12806524.jpg?ver=1',
    tags: ['Featured', 'Sci-Fi', 'Space'],
    author: 'SpaceExplorer',
    likes: 856
  }
];

const GallerySection = ({ onSelect }) => {
  return (
    <div className="space-y-8">
      {/* Featured Section Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Featured Skyboxes</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Discover our handpicked collection of stunning skyboxes created by talented artists
        </p>
      </div>

      {/* Featured Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {FEATURED_SKYBOXES.map((skybox, index) => (
          <motion.div
            key={skybox.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="relative group rounded-xl overflow-hidden"
          >
            {/* Image Container */}
            <div className="aspect-square relative overflow-hidden">
              <img
                src={skybox.image}
                alt={skybox.name}
                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Tags */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {skybox.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs rounded-full backdrop-blur-md bg-white/10 text-white/90 border border-white/20"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Content */}
            <div className="absolute inset-x-0 bottom-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <div className="backdrop-blur-md bg-black/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">{skybox.name}</h3>
                <p className="text-sm text-gray-300 mb-3">{skybox.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">by {skybox.author}</span>
                    <span className="text-sm text-gray-400">• {skybox.likes} likes</span>
                  </div>
                  <button
                    onClick={() => onSelect(skybox)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200"
                  >
                    Use This
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Categories Section */}
      <div className="mt-16">
        <h3 className="text-2xl font-bold text-white mb-6">Browse by Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {['Nature', 'Sci-Fi', 'Fantasy', 'Urban', 'Abstract', 'Space', 'Minimal', 'Artistic'].map((category) => (
            <motion.button
              key={category}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-lg backdrop-blur-md bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
            >
              <span className="text-white">{category}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GallerySection; 