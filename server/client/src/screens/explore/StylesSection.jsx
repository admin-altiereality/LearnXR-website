import React from 'react';
import { motion } from 'framer-motion';

const STYLE_CATEGORIES = [
  {
    id: 'sci-fi',
    name: 'Sci-Fi Environments',
    description: 'Futuristic worlds, space stations, and advanced technology landscapes',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_futuristic_space_station_932592572_12806524.jpg?ver=1',
    examples: ['Cyberpunk Cities', 'Space Stations', 'Alien Worlds']
  },
  {
    id: 'nature',
    name: 'Natural Landscapes',
    description: 'Breathtaking outdoor scenes, from serene forests to majestic mountains',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_serene_forest_with_932592572_12806524.jpg?ver=1',
    examples: ['Forest Scenes', 'Mountain Vistas', 'Ocean Views']
  },
  {
    id: 'fantasy',
    name: 'Fantasy Realms',
    description: 'Magical environments filled with wonder and mystical elements',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_castle_in_932592572_12806524.jpg?ver=1',
    examples: ['Magical Castles', 'Enchanted Forests', 'Dragon Lairs']
  },
  {
    id: 'abstract',
    name: 'Abstract Designs',
    description: 'Non-representational artistic expressions and geometric patterns',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_Abstract_geometric_patterns_932592572_12806524.jpg?ver=1',
    examples: ['Geometric Patterns', 'Color Fields', 'Fractal Art']
  },
  {
    id: 'urban',
    name: 'Urban Environments',
    description: 'Modern cityscapes and architectural marvels',
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_modern_city_with_932592572_12806524.jpg?ver=1',
    examples: ['Modern Cities', 'Historic Towns', 'Industrial Zones']
  }
];

const StylesSection = ({ onSelect }) => {
  return (
    <div className="space-y-12">
      {/* Styles Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Style Categories</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Choose from our curated collection of style categories to create the perfect atmosphere
        </p>
      </div>

      {/* Style Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {STYLE_CATEGORIES.map((style, index) => (
          <motion.div
            key={style.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="relative group rounded-xl overflow-hidden backdrop-blur-md bg-white/5 border border-white/10"
          >
            {/* Style Image */}
            <div className="aspect-video relative overflow-hidden">
              <img
                src={style.image}
                alt={style.name}
                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
            </div>

            {/* Style Content */}
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <h3 className="text-2xl font-bold text-white mb-2">{style.name}</h3>
              <p className="text-gray-300 mb-4">{style.description}</p>
              
              {/* Example Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {style.examples.map(example => (
                  <span
                    key={example}
                    className="px-3 py-1 text-sm rounded-full backdrop-blur-md bg-white/10 text-white/90 border border-white/20"
                  >
                    {example}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(style)}
                className="w-full py-3 bg-gradient-to-r from-purple-500/50 to-blue-500/50 hover:from-purple-500/70 hover:to-blue-500/70 
                         text-white rounded-lg transition-all duration-200 backdrop-blur-md border border-white/20"
              >
                Use This Style
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Style Tips */}
      <div className="mt-12 p-6 rounded-xl backdrop-blur-md bg-white/5 border border-white/10">
        <h3 className="text-xl font-semibold text-white mb-4">Style Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-4 rounded-lg bg-white/5">
            <h4 className="text-lg font-medium text-white mb-2">Consistency</h4>
            <p className="text-gray-400">Maintain a consistent style throughout your scene for the most professional look</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5">
            <h4 className="text-lg font-medium text-white mb-2">Lighting</h4>
            <p className="text-gray-400">Pay attention to lighting direction and intensity to enhance the mood</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5">
            <h4 className="text-lg font-medium text-white mb-2">Details</h4>
            <p className="text-gray-400">Add small details to make your scenes more interesting and engaging</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StylesSection; 