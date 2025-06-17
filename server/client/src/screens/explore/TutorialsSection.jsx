import React, { useState } from 'react';
import { motion } from 'framer-motion';

const TUTORIALS = [
  {
    id: 'getting-started',
    title: 'Getting Started Guide',
    description: 'Learn the basics of creating stunning skyboxes',
    type: 'guide',
    difficulty: 'Beginner',
    duration: '15 mins',
    topics: ['Basics', 'Interface', 'Tools'],
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    id: 'advanced-techniques',
    title: 'Advanced Techniques',
    description: 'Master complex effects and professional workflows',
    type: 'tutorial',
    difficulty: 'Advanced',
    duration: '30 mins',
    topics: ['Effects', 'Workflow', 'Optimization'],
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
  {
    id: 'best-practices',
    title: 'Best Practices',
    description: 'Tips and tricks for creating high-quality skyboxes',
    type: 'guide',
    difficulty: 'Intermediate',
    duration: '20 mins',
    topics: ['Quality', 'Standards', 'Tips'],
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  },
  {
    id: 'style-guidelines',
    title: 'Style Guidelines',
    description: 'Understanding different artistic approaches',
    type: 'reference',
    difficulty: 'All Levels',
    duration: '25 mins',
    topics: ['Art Style', 'Design', 'Composition'],
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )
  }
];

const TutorialsSection = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filteredTutorials = selectedFilter === 'all' 
    ? TUTORIALS 
    : TUTORIALS.filter(tutorial => tutorial.type === selectedFilter);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Tutorials & Resources</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Learn how to create amazing skyboxes with our comprehensive guides and tutorials
        </p>
      </div>

      {/* Filters */}
      <div className="flex justify-center space-x-4">
        {['all', 'guide', 'tutorial', 'reference'].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              selectedFilter === filter
                ? 'bg-white/20 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Tutorials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTutorials.map((tutorial, index) => (
          <motion.div
            key={tutorial.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="relative group p-6 rounded-xl backdrop-blur-md bg-white/5 border border-white/10
                     hover:bg-white/10 transition-all duration-300"
          >
            <div className="flex items-start space-x-4">
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 
                          flex items-center justify-center text-white">
                {tutorial.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-white">{tutorial.title}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    tutorial.type === 'guide' ? 'bg-blue-500/20 text-blue-300' :
                    tutorial.type === 'tutorial' ? 'bg-green-500/20 text-green-300' :
                    'bg-purple-500/20 text-purple-300'
                  }`}>
                    {tutorial.type}
                  </span>
                </div>
                <p className="text-gray-400 mb-4">{tutorial.description}</p>
                
                {/* Meta Info */}
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {tutorial.duration}
                  </span>
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {tutorial.difficulty}
                  </span>
                </div>

                {/* Topics */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {tutorial.topics.map(topic => (
                    <span
                      key={topic}
                      className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/70"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                className="flex-shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 
                         text-white transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Resources Section */}
      <div className="mt-12 p-6 rounded-xl backdrop-blur-md bg-white/5 border border-white/10">
        <h3 className="text-xl font-semibold text-white mb-6">Additional Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a href="#" className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200">
            <h4 className="text-lg font-medium text-white mb-2">Documentation</h4>
            <p className="text-gray-400">Complete API reference and documentation</p>
          </a>
          <a href="#" className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200">
            <h4 className="text-lg font-medium text-white mb-2">Community Forum</h4>
            <p className="text-gray-400">Connect with other creators and share knowledge</p>
          </a>
          <a href="#" className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200">
            <h4 className="text-lg font-medium text-white mb-2">Video Library</h4>
            <p className="text-gray-400">Watch tutorial videos and demonstrations</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TutorialsSection; 