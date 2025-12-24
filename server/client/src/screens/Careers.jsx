import React from 'react';
import { motion } from 'framer-motion';
import { 
  FaBriefcase, 
  FaCode, 
  FaPalette, 
  FaBrain, 
  FaHandshake,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaClock,
  FaUsers,
  FaArrowRight
} from 'react-icons/fa';
import FuturisticBackground from '../Components/FuturisticBackground';

const Careers = () => {
  const jobOpenings = [
    {
      id: 1,
      title: "Unity Developer",
      department: "Engineering",
      location: "Remote / Hybrid",
      type: "Full-time",
      experience: "2-5 years",
      icon: FaCode,
      description: "Join our team to develop cutting-edge 3D applications and experiences using Unity. You'll work on creating immersive environments and interactive experiences.",
      requirements: [
        "Strong experience with Unity 3D and C#",
        "Experience with 3D graphics programming",
        "Knowledge of game development principles",
        "Experience with version control systems"
      ],
      gradient: "from-sky-500 to-cyan-500"
    },
    {
      id: 2,
      title: "Blender Artist",
      department: "Creative",
      location: "Remote / Hybrid", 
      type: "Full-time",
      experience: "1-3 years",
      icon: FaPalette,
      description: "Create stunning 3D models, textures, and animations using Blender. You'll be responsible for creating high-quality assets for our AI training and user experiences.",
      requirements: [
        "Proficient in Blender 3D",
        "Strong understanding of 3D modeling principles",
        "Experience with texture creation and UV mapping",
        "Portfolio demonstrating 3D modeling skills"
      ],
      gradient: "from-violet-500 to-fuchsia-500"
    },
    {
      id: 3,
      title: "Machine Learning Engineer",
      department: "AI/ML",
      location: "Remote / Hybrid",
      type: "Full-time", 
      experience: "3-7 years",
      icon: FaBrain,
      description: "Develop and optimize machine learning models for 3D asset generation. You'll work on cutting-edge AI technologies to improve our generation capabilities.",
      requirements: [
        "Strong background in machine learning and deep learning",
        "Experience with PyTorch or TensorFlow",
        "Knowledge of computer vision and 3D graphics",
        "Experience with large-scale model training"
      ],
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      id: 4,
      title: "Business Development Manager",
      department: "Business",
      location: "Remote / Hybrid",
      type: "Full-time",
      experience: "3-5 years", 
      icon: FaHandshake,
      description: "Drive business growth by identifying new opportunities, building partnerships, and expanding our market presence in the 3D and AI space.",
      requirements: [
        "Experience in B2B sales and business development",
        "Knowledge of the gaming, AR/VR, or 3D industry",
        "Strong communication and negotiation skills",
        "Experience with partnership development"
      ],
      gradient: "from-amber-500 to-orange-500"
    }
  ];

  const handleApply = (jobTitle) => {
    const googleFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdGZ707XrJL5wqSupEXJt3au2UlT3f1ZRUrISlCG66adRLbOA/viewform?usp=sharing&ouid=105898882950181195355";
    window.open(googleFormUrl, '_blank');
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
              className="text-center"
            >
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
                <FaBriefcase className="text-rose-400 mr-2" />
                <span className="text-white/60 text-sm font-medium">Join Our Team</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                  Careers at
                </span>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300">
                  In3D.ai
                </span>
              </h1>
              
              <p className="text-lg text-white/60 mb-8 max-w-3xl mx-auto leading-relaxed">
                Help us shape the future of 3D AI generation. Join a team of passionate innovators 
                working on cutting-edge technology that's transforming how we create digital content.
              </p>
              
              <div className="flex flex-wrap justify-center gap-6 text-white/50">
                <div className="flex items-center space-x-2">
                  <FaUsers className="text-sky-400" />
                  <span>Growing Team</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FaMapMarkerAlt className="text-violet-400" />
                  <span>Remote First</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FaClock className="text-rose-400" />
                  <span>Flexible Hours</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Job Openings Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              custom={1}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-center mb-12"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                Open Positions
              </h2>
              <p className="text-lg text-white/50 max-w-2xl mx-auto">
                We're looking for talented individuals to join our mission of democratizing 3D content creation
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {jobOpenings.map((job, index) => (
                <motion.div
                  key={job.id}
                  custom={index + 2}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="group relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 hover:bg-white/[0.05] transition-all duration-300 hover:border-white/20 overflow-hidden"
                >
                  {/* Card glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-fuchsia-500/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    {/* Job Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${job.gradient} shadow-lg`}>
                          <job.icon className="text-2xl text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-2">{job.title}</h3>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-white/[0.05] text-white/70 text-sm rounded-full border border-white/10">
                              {job.department}
                            </span>
                            <span className="px-3 py-1 bg-white/[0.05] text-white/70 text-sm rounded-full border border-white/10">
                              {job.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Job Details */}
                    <div className="space-y-4 mb-6">
                      <div className="flex flex-wrap gap-4 text-sm text-white/50">
                        <div className="flex items-center space-x-2">
                          <FaMapMarkerAlt className="text-sky-400" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FaClock className="text-violet-400" />
                          <span>{job.experience} experience</span>
                        </div>
                      </div>
                      
                      <p className="text-white/70 leading-relaxed">
                        {job.description}
                      </p>
                    </div>

                    {/* Requirements */}
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-white mb-3">Key Requirements:</h4>
                      <ul className="space-y-2">
                        {job.requirements.map((requirement, reqIndex) => (
                          <li key={reqIndex} className="flex items-start space-x-3 text-white/60">
                            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-sm">{requirement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Apply Button */}
                    <motion.button
                      onClick={() => handleApply(job.title)}
                      className="group/btn relative w-full rounded-xl py-4 font-semibold text-white overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                      <span className="relative flex items-center justify-center space-x-2">
                        <span>Apply for {job.title}</span>
                        <FaExternalLinkAlt className="text-sm group-hover/btn:translate-x-1 transition-transform" />
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Join Us Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="relative rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.03] backdrop-blur-xl p-12 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.1),_transparent_55%)] pointer-events-none" />
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="text-center mb-12 relative z-10"
              >
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
                  Why Join In3D.ai?
                </h2>
                <p className="text-lg text-white/50 max-w-3xl mx-auto">
                  Be part of a team that's revolutionizing how 3D content is created and consumed
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {[
                  {
                    icon: FaBrain,
                    title: "Cutting-Edge AI",
                    description: "Work with the latest AI technologies and contribute to groundbreaking research",
                    gradient: "from-violet-500 to-purple-600"
                  },
                  {
                    icon: FaUsers,
                    title: "Collaborative Culture",
                    description: "Join a diverse team of passionate individuals from around the world",
                    gradient: "from-sky-500 to-cyan-600"
                  },
                  {
                    icon: FaCode,
                    title: "Technical Excellence",
                    description: "Build scalable systems that serve millions of users worldwide",
                    gradient: "from-emerald-500 to-teal-600"
                  },
                  {
                    icon: FaPalette,
                    title: "Creative Freedom",
                    description: "Express your creativity while solving complex technical challenges",
                    gradient: "from-rose-500 to-pink-600"
                  }
                ].map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="text-center p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300"
                  >
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                      <benefit.icon className="text-2xl text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{benefit.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom spacing */}
        <div className="h-16"></div>
      </div>
    </FuturisticBackground>
  );
};

export default Careers;
