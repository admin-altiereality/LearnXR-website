import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import image1 from '../../public/assests/Gearningupimg.jpg';
import image2 from '../../public/assests/Bitspilanis.jpg';
import image4 from '../../public/assests/evoneural.jpg';
import image5 from '../../public/assests/startup.jpg';
import { 
  FaTrophy, 
  FaRocket, 
  FaUsers, 
  FaCalendarAlt, 
  FaLinkedin, 
  FaExternalLinkAlt,
  FaStar,
  FaChartLine,
  FaGlobe,
  FaCode,
  FaHeart,
  FaComment,
  FaShare
} from 'react-icons/fa';
import FuturisticBackground from '../Components/FuturisticBackground';

const hardcodedBlogPosts = [
  {
    id: '1',
    title: 'Gearing Up for the Future of XR ',
    excerpt: "At Evoneural AI, innovation drives everything we do. We're currently gearing up to launch In3D.ai, an AI-powered platform that converts simple text into immersive 3D VR environments.",
    image: image1,
    date: '2025-07-01',
    readTime: '3 min read',
    category: 'technology',
    featured: true,
    achievements: ['Tech Innovation by Evoneural AI', 'Innovation in the AVGC-XR Space'],
    likes: 20,
    comments: "",
    shares: "",
    linkedInUrl: 'https://www.linkedin.com/posts/evoneural-ai-opc_ai-xr-vr-activity-7340623176650973184-aPgO?utm_source=share&utm_medium=member_desktop&rcm=ACoAADt7irUBQuGEa2JuaKPDgg5osTNrI_6WU20',
  },
  {
    id: '2',
    title: '🚀 Welcoming Bright Minds from BITS Pilani! 🎓✨',
    excerpt: "We're excited to announce that Evoneural AI | In3D.ai has welcomed an incredible group of Practice School 1 (PS-1) interns from Birla Institute of Technology and Science, Pilani Practice School -1 Pilani Campus, who joined us on May 26, 2025!",
    image: image2,
    date: '2025-05-26',
    readTime: '4 min read',
    category: 'company',
    featured: true,
    achievements: ['Prompt Engineering Interns', 'AI/ML Interns'],
    likes: 6,
    comments: "",
    shares: 1,
    linkedInUrl: 'https://www.linkedin.com/posts/evoneural-ai-opc_welcoming-bright-minds-from-bits-pilani-activity-7334510314740199425-cvwZ?utm_source=share&utm_medium=member_desktop&rcm=ACoAADt7irUBQuGEa2JuaKPDgg5osTNrI_6WU20',
  },
  {
    id: '3',
    title: 'Evoneural AI Selected for STPI OCP 6.0 OctaNE under CoE in Emerging Technologies (AR/VR),',
    excerpt: "We're excited to announce that Evoneural Artificial Intelligence has been selected for OCTANE 6.0, a distinguished program run by STPI - Software Technology Parks of India aimed at advancing India's deeptech innovation ecosystem.",
    image: image5,
    date: '2025-06-20',
    readTime: '2 min read',
    category: 'achievements',
    featured: false,
    achievements: ['Selected for STPI OCTANE 6.0','Recognized for Innovation in AI + XR'],
    likes: 3,
    comments: "",
    shares: "",
    linkedInUrl: 'https://www.linkedin.com/posts/evoneural-ai-opc_evoneuralai-octane-stpiindia-activity-7332008861211455488-8FDm?utm_source=share&utm_medium=member_desktop&rcm=ACoAADt7irUBQuGEa2JuaKPDgg5osTNrI_6WU20',
  },
  {
    id: '4',
    title: "Evoneural AI Joins Rajasthan's Thriving Tech Ecosystem",
    excerpt: "Through iStart Rajasthan, a program by the Government of Rajasthan to empower and elevate entrepreneurs, we have started our entrepreneurial adventure with our founder, JAGRATI SHARMA, at the helm. Through Bhamashah Technohub's incubation program, we're preparing to propel artificial intelligence innovation and provide AI-based solutions for the AVGC-XR sector.",
    image: image4,
    date: '2024-12-10',
    readTime: '2 min read',
    category: 'company',
    featured: false,
    achievements: ['Accepted into iStart Rajasthan Program','Incubated at Bhamashah Technohub, Jaipur'],
    likes: 18,
    comments: 4,
    shares: 1,
    linkedInUrl: 'https://www.linkedin.com/posts/evoneural-ai-opc_evoneuralai-istartrajasthan-innovation-activity-7259577034354376706-WcqX?utm_source=share&utm_medium=member_desktop&rcm=ACoAADt7irUBQuGEa2JuaKPDgg5osTNrI_6WU20',
  },
];

const Blog = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const blogPosts = hardcodedBlogPosts;

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
      <div className="min-h-screen text-white">
        {/* Header Section */}
        <section className="relative pt-32 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-center mb-12"
            >
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
                <FaRocket className="text-rose-400 mr-2" />
                <span className="text-white/60 text-sm font-medium">Company Blog</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                  In3D.ai
                </span>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300">
                  Blog
                </span>
              </h1>
              
              <p className="text-lg text-white/60 mb-8 max-w-3xl mx-auto leading-relaxed">
                Stay updated with our latest achievements, technological breakthroughs, 
                and company milestones as we revolutionize 3D content creation.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center space-x-2 text-white/50">
                  <FaTrophy className="text-amber-400" />
                  <span className="text-sm">Industry Awards</span>
                </div>
                <div className="flex items-center space-x-2 text-white/50">
                  <FaUsers className="text-sky-400" />
                  <span className="text-sm">Growing Community</span>
                </div>
                <div className="flex items-center space-x-2 text-white/50">
                  <FaChartLine className="text-emerald-400" />
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
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-white mb-4">Featured Stories</h2>
                <p className="text-white/50">Our most significant achievements and breakthroughs</p>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {featuredPosts.map((post, index) => (
                  <motion.article
                    key={post.id}
                    custom={index + 2}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="group relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300"
                  >
                    <div className="relative h-64 overflow-hidden">
                      <img 
                        src={post.image} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent"></div>
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-gradient-to-r from-sky-500 to-violet-500 text-white text-xs rounded-full font-medium shadow-lg">
                          Featured
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <div className="flex items-center space-x-4 text-sm text-white/50 mb-3">
                        <div className="flex items-center space-x-1">
                          <FaCalendarAlt className="w-3 h-3" />
                          <span>{post.date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FaStar className="w-3 h-3 text-amber-400" />
                          <span>{post.readTime}</span>
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-sky-400 transition-colors">
                        {post.title}
                      </h3>
                      
                      <p className="text-white/60 mb-4 leading-relaxed">
                        {post.excerpt}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.achievements.map((achievement, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 bg-sky-500/10 text-sky-300 text-xs rounded-full border border-sky-500/30"
                          >
                            {achievement}
                          </span>
                        ))}
                      </div>

                      {/* LinkedIn Engagement Stats */}
                      <div className="flex items-center space-x-4 mb-4 text-sm text-white/50">
                        {post.likes && (
                          <div className="flex items-center space-x-1">
                            <FaHeart className="w-3 h-3 text-rose-400" />
                            <span>{post.likes}</span>
                          </div>
                        )}
                        {post.comments && (
                          <div className="flex items-center space-x-1">
                            <FaComment className="w-3 h-3 text-sky-400" />
                            <span>{post.comments}</span>
                          </div>
                        )}
                        {post.shares && (
                          <div className="flex items-center space-x-1">
                            <FaShare className="w-3 h-3 text-emerald-400" />
                            <span>{post.shares}</span>
                          </div>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => handleReadMore(post)}
                        className="inline-flex items-center space-x-2 text-sky-400 hover:text-sky-300 transition-colors font-medium"
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
        <section className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
          <div className="max-w-7xl mx-auto">
            <motion.div
              custom={4}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap justify-center gap-3"
            >
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-lg shadow-violet-500/25'
                      : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white border border-white/10'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <category.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{category.name}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-6 border border-white/10">
                  <FaRocket className="text-2xl text-white/40" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No posts found</h3>
                <p className="text-white/50">No posts available for this category at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPosts.map((post, index) => (
                  <motion.article
                    key={post.id}
                    custom={index + 5}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="group rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={post.image} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#030303]/80 via-transparent to-transparent"></div>
                      {post.featured && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-1 bg-gradient-to-r from-sky-500 to-violet-500 text-white text-xs rounded-full font-medium">
                            Featured
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6">
                      <div className="flex items-center space-x-4 text-sm text-white/50 mb-3">
                        <div className="flex items-center space-x-1">
                          <FaCalendarAlt className="w-3 h-3" />
                          <span>{post.date}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FaStar className="w-3 h-3 text-amber-400" />
                          <span>{post.readTime}</span>
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white mb-3 group-hover:text-sky-400 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      
                      <p className="text-white/60 mb-4 leading-relaxed line-clamp-3 text-sm">
                        {post.excerpt}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.achievements.slice(0, 2).map((achievement, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 bg-violet-500/10 text-violet-300 text-xs rounded-full border border-violet-500/30"
                          >
                            {achievement}
                          </span>
                        ))}
                        {post.achievements.length > 2 && (
                          <span className="px-2 py-1 bg-white/[0.03] text-white/40 text-xs rounded-full border border-white/10">
                            +{post.achievements.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* LinkedIn Engagement Stats */}
                      <div className="flex items-center space-x-4 mb-4 text-sm text-white/50">
                        {post.likes && (
                          <div className="flex items-center space-x-1">
                            <FaHeart className="w-3 h-3 text-rose-400" />
                            <span>{post.likes}</span>
                          </div>
                        )}
                        {post.comments && (
                          <div className="flex items-center space-x-1">
                            <FaComment className="w-3 h-3 text-sky-400" />
                            <span>{post.comments}</span>
                          </div>
                        )}
                        {post.shares && (
                          <div className="flex items-center space-x-1">
                            <FaShare className="w-3 h-3 text-emerald-400" />
                            <span>{post.shares}</span>
                          </div>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => handleReadMore(post)}
                        className="inline-flex items-center space-x-2 text-sky-400 hover:text-sky-300 transition-colors font-medium text-sm"
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
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-12 text-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/30">
                  <FaLinkedin className="text-2xl text-white" />
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-4">Follow Our Journey</h2>
                <p className="text-white/60 mb-8 max-w-2xl mx-auto">
                  Stay connected with us on LinkedIn for real-time updates, behind-the-scenes content, 
                  and exclusive insights into our AI technology development.
                </p>
                
                <motion.button
                  onClick={handleLinkedInFollow}
                  className="group relative inline-flex items-center space-x-2 px-8 py-4 rounded-xl font-semibold text-white overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <FaLinkedin className="relative w-5 h-5" />
                  <span className="relative">Follow on LinkedIn</span>
                  <FaExternalLinkAlt className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Bottom spacing */}
        <div className="h-16"></div>
      </div>
    </FuturisticBackground>
  );
};

export default Blog;
