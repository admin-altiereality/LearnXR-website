import React, { useState } from 'react';
import { motion } from 'framer-motion';

const COMMUNITY_SHOWCASES = [
  {
    id: 'showcase-1',
    title: 'Neon Metropolis',
    author: {
      name: 'CyberArtist',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CyberArtist',
      level: 'Pro Creator'
    },
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_cyberpunk_city_at_932592572_12806524.jpg?ver=1',
    description: 'A vibrant cyberpunk cityscape with neon lights and flying vehicles',
    likes: 1234,
    comments: 89,
    tags: ['Cyberpunk', 'City', 'Night']
  },
  {
    id: 'showcase-2',
    title: 'Enchanted Garden',
    author: {
      name: 'NatureMage',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NatureMage',
      level: 'Rising Star'
    },
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_garden_with_932592572_12806524.jpg?ver=1',
    description: 'Magical garden with floating lights and mystical creatures',
    likes: 956,
    comments: 67,
    tags: ['Fantasy', 'Nature', 'Magic']
  },
  {
    id: 'showcase-3',
    title: 'Desert Oasis',
    author: {
      name: 'SandArtist',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SandArtist',
      level: 'Featured Creator'
    },
    image: 'https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_desert_oasis_at_932592572_12806524.jpg?ver=1',
    description: 'Serene desert oasis under a starlit sky',
    likes: 845,
    comments: 52,
    tags: ['Desert', 'Night', 'Nature']
  }
];

const WEEKLY_CHALLENGES = [
  {
    id: 'challenge-1',
    title: 'Futuristic Cities',
    description: 'Create your vision of a city in the year 2150',
    participants: 234,
    daysLeft: 3,
    prize: '1000 Credits'
  },
  {
    id: 'challenge-2',
    title: 'Fantasy Realms',
    description: 'Design a magical world with unique elements',
    participants: 189,
    daysLeft: 5,
    prize: '800 Credits'
  }
];

const CommunitySection = () => {
  const [activeTab, setActiveTab] = useState('showcases');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Community Showcase</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Discover amazing creations from our community and share your own masterpieces
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center space-x-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab('showcases')}
          className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'showcases'
              ? 'text-white border-purple-500'
              : 'text-gray-400 border-transparent hover:text-white hover:border-white/20'
          }`}
        >
          Featured Showcases
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'challenges'
              ? 'text-white border-purple-500'
              : 'text-gray-400 border-transparent hover:text-white hover:border-white/20'
          }`}
        >
          Weekly Challenges
        </button>
      </div>

      {/* Content */}
      <div className="mt-8">
        {activeTab === 'showcases' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {COMMUNITY_SHOWCASES.map((showcase, index) => (
              <motion.div
                key={showcase.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="group rounded-xl overflow-hidden backdrop-blur-md bg-white/5 border border-white/10"
              >
                {/* Image */}
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={showcase.image}
                    alt={showcase.title}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Author */}
                  <div className="flex items-center space-x-3 mb-4">
                    <img
                      src={showcase.author.avatar}
                      alt={showcase.author.name}
                      className="w-10 h-10 rounded-full border-2 border-purple-500/30"
                    />
                    <div>
                      <h4 className="text-white font-medium">{showcase.author.name}</h4>
                      <span className="text-sm text-purple-400">{showcase.author.level}</span>
                    </div>
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-xl font-bold text-white mb-2">{showcase.title}</h3>
                  <p className="text-gray-400 mb-4">{showcase.description}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {showcase.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {showcase.likes}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {showcase.comments}
                      </span>
                    </div>
                    <button className="text-purple-400 hover:text-purple-300 transition-colors duration-200">
                      View Details
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {WEEKLY_CHALLENGES.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="p-6 rounded-xl backdrop-blur-md bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{challenge.title}</h3>
                    <p className="text-gray-400 mb-4">{challenge.description}</p>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-400">
                        {challenge.participants} Participants
                      </span>
                      <span className="text-yellow-400">
                        Prize: {challenge.prize}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                      <span className="text-2xl font-bold text-purple-400">{challenge.daysLeft}</span>
                    </div>
                    <span className="text-sm text-gray-400">Days Left</span>
                  </div>
                </div>

                <button className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500/50 to-blue-500/50 
                               hover:from-purple-500/70 hover:to-blue-500/70 text-white rounded-lg 
                               transition-all duration-200 backdrop-blur-md border border-white/20">
                  Join Challenge
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="mt-12 p-8 rounded-xl backdrop-blur-md bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-white/10">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Share Your Creation</h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Join our vibrant community and showcase your skybox creations to the world
          </p>
          <button className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg 
                         transition-all duration-200 backdrop-blur-md border border-white/20">
            Upload Your Skybox
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunitySection; 