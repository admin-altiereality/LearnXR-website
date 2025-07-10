import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaTrophy, 
  FaRocket, 
  FaUsers, 
  FaAward, 
  FaCalendarAlt, 
  FaLinkedin, 
  FaExternalLinkAlt,
  FaStar,
  FaLightbulb,
  FaChartLine,
  FaGlobe,
  FaCode,
  FaHeart,
  FaComment,
  FaShare,
  FaSpinner
} from 'react-icons/fa';
import linkedinScraperService from '../services/linkedinScraperService';

const Blog = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [blogPosts, setBlogPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const posts = await linkedinScraperService.fetchLinkedInPosts();
      setBlogPosts(posts);
    } catch (err) {
      console.error('Error fetching blog posts:', err);
      setError('Failed to load blog posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Posts', icon: FaGlobe },
    { id: 'achievements', name: 'Achievements', icon: FaTrophy },
    { id: 'technology', name: 'Technology', icon: FaCode },
    { id: 'company', name: 'Company News', icon: FaRocket },
    { id: 'partnerships', name: 'Partnerships', icon: FaUsers }
  ];

  const filteredPosts = selectedCategory === 'all' 
    ? blogPosts 
    : blogPosts.filter(post => post.category === selectedCategory);

  const featuredPosts = blogPosts.filter(post => post.featured);

  const handleReadMore = (post) => {
    if (post.linkedInUrl) {
      window.open(post.linkedInUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLinkedInFollow = () => {
    window.open('https://www.linkedin.com/company/evoneural-ai-opc/?viewAsMember=true', '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading blog posts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <FaRocket className="text-2xl text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Oops! Something went wrong</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={fetchBlogPosts}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl font-semibold transition-all duration-300"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Header Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
              <FaRocket className="text-cyan-400 mr-2" />
              <span className="text-cyan-400 text-sm font-medium">Company Blog</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              In3D.AI Blog
            </h1>
            
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Stay updated with our latest achievements, technological breakthroughs, 
              and company milestones as we revolutionize 3D content creation.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center space-x-2 text-gray-400">
                <FaTrophy className="text-cyan-400" />
                <span className="text-sm">Industry Awards</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <FaUsers className="text-cyan-400" />
                <span className="text-sm">Growing Community</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <FaChartLine className="text-cyan-400" />
                <span className="text-sm">Rapid Growth</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Posts Section */}
      {featuredPosts.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">Featured Stories</h2>
              <p className="text-gray-400">Our most significant achievements and breakthroughs</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {featuredPosts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="group relative bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-cyan-500/90 text-white text-xs rounded-full font-medium">
                        Featured
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                      <div className="flex items-center space-x-1">
                        <FaCalendarAlt className="w-3 h-3" />
                        <span>{post.date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FaStar className="w-3 h-3" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors">
                      {post.title}
                    </h3>
                    
                    <p className="text-gray-300 mb-4 leading-relaxed">
                      {post.excerpt}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.achievements.map((achievement, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full border border-cyan-500/30"
                        >
                          {achievement}
                        </span>
                      ))}
                    </div>

                    {/* LinkedIn Engagement Stats */}
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-400">
                      {post.likes && (
                        <div className="flex items-center space-x-1">
                          <FaHeart className="w-3 h-3 text-red-400" />
                          <span>{post.likes}</span>
                        </div>
                      )}
                      {post.comments && (
                        <div className="flex items-center space-x-1">
                          <FaComment className="w-3 h-3 text-blue-400" />
                          <span>{post.comments}</span>
                        </div>
                      )}
                      {post.shares && (
                        <div className="flex items-center space-x-1">
                          <FaShare className="w-3 h-3 text-green-400" />
                          <span>{post.shares}</span>
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleReadMore(post)}
                      className="inline-flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                    >
                      <span>Read on LinkedIn</span>
                      <FaExternalLinkAlt className="w-3 h-3" />
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category Filter */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  selectedCategory === category.id
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700/50'
                }`}
              >
                <category.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{category.name}</span>
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-xl bg-gray-800/50 flex items-center justify-center mx-auto mb-6">
                <FaRocket className="text-2xl text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No posts found</h3>
              <p className="text-gray-400">No posts available for this category at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                  className="group bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    {post.featured && (
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-1 bg-cyan-500/90 text-white text-xs rounded-full font-medium">
                          Featured
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                      <div className="flex items-center space-x-1">
                        <FaCalendarAlt className="w-3 h-3" />
                        <span>{post.date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FaStar className="w-3 h-3" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    
                    <p className="text-gray-300 mb-4 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.achievements.slice(0, 2).map((achievement, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full border border-cyan-500/30"
                        >
                          {achievement}
                        </span>
                      ))}
                      {post.achievements.length > 2 && (
                        <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-full">
                          +{post.achievements.length - 2} more
                        </span>
                      )}
                    </div>

                    {/* LinkedIn Engagement Stats */}
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-400">
                      {post.likes && (
                        <div className="flex items-center space-x-1">
                          <FaHeart className="w-3 h-3 text-red-400" />
                          <span>{post.likes}</span>
                        </div>
                      )}
                      {post.comments && (
                        <div className="flex items-center space-x-1">
                          <FaComment className="w-3 h-3 text-blue-400" />
                          <span>{post.comments}</span>
                        </div>
                      )}
                      {post.shares && (
                        <div className="flex items-center space-x-1">
                          <FaShare className="w-3 h-3 text-green-400" />
                          <span>{post.shares}</span>
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleReadMore(post)}
                      className="inline-flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors font-medium text-sm"
                    >
                      <span>Read on LinkedIn</span>
                      <FaExternalLinkAlt className="w-3 h-3" />
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mx-auto mb-6">
              <FaLinkedin className="text-2xl text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">Follow Our Journey</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Stay connected with us on LinkedIn for real-time updates, behind-the-scenes content, 
              and exclusive insights into our AI technology development.
            </p>
            
            <button
              onClick={handleLinkedInFollow}
              className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
            >
              <FaLinkedin className="w-5 h-5" />
              <span>Follow on LinkedIn</span>
              <FaExternalLinkAlt className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Blog; 