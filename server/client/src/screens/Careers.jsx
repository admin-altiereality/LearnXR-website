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
  FaUsers
} from 'react-icons/fa';

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
      color: "from-blue-500 to-cyan-500"
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
      color: "from-purple-500 to-pink-500"
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
      color: "from-green-500 to-emerald-500"
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
      color: "from-orange-500 to-red-500"
    }
  ];

  const handleApply = (jobTitle) => {
    const googleFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdGZ707XrJL5wqSupEXJt3au2UlT3f1ZRUrISlCG66adRLbOA/viewform?usp=sharing&ouid=105898882950181195355";
    window.open(googleFormUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Header Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
              <FaBriefcase className="text-cyan-400 mr-2" />
              <span className="text-cyan-400 text-sm font-medium">Join Our Team</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Careers at In3D.ai
            </h1>
            
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Help us shape the future of 3D AI generation. Join a team of passionate innovators 
              working on cutting-edge technology that's transforming how we create digital content.
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 text-gray-400">
              <div className="flex items-center space-x-2">
                <FaUsers className="text-cyan-400" />
                <span>Growing Team</span>
              </div>
              <div className="flex items-center space-x-2">
                <FaMapMarkerAlt className="text-cyan-400" />
                <span>Remote First</span>
              </div>
              <div className="flex items-center space-x-2">
                <FaClock className="text-cyan-400" />
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
              Open Positions
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              We're looking for talented individuals to join our mission of democratizing 3D content creation
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {jobOpenings.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                className="group relative p-8 rounded-2xl border border-gray-700 bg-gray-800/50 hover:bg-gray-800/70 transition-all duration-300 hover:border-cyan-500/50 hover:scale-[1.02]"
              >
                {/* Job Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-r ${job.color}`}>
                      <job.icon className="text-2xl text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{job.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 text-sm rounded-full">
                          {job.department}
                        </span>
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 text-sm rounded-full">
                          {job.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job Details */}
                <div className="space-y-4 mb-6">
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <FaMapMarkerAlt className="text-cyan-400" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FaClock className="text-cyan-400" />
                      <span>{job.experience} experience</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                {/* Requirements */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3">Key Requirements:</h4>
                  <ul className="space-y-2">
                    {job.requirements.map((requirement, reqIndex) => (
                      <li key={reqIndex} className="flex items-start space-x-3 text-gray-300">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => handleApply(job.title)}
                  className="group w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25 flex items-center justify-center space-x-2"
                >
                  <span>Apply for {job.title}</span>
                  <FaExternalLinkAlt className="text-sm group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Join Us Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
              Why Join In3D.ai?
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              Be part of a team that's revolutionizing how 3D content is created and consumed
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: FaBrain,
                title: "Cutting-Edge AI",
                description: "Work with the latest AI technologies and contribute to groundbreaking research"
              },
              {
                icon: FaUsers,
                title: "Collaborative Culture",
                description: "Join a diverse team of passionate individuals from around the world"
              },
              {
                icon: FaCode,
                title: "Technical Excellence",
                description: "Build scalable systems that serve millions of users worldwide"
              },
              {
                icon: FaPalette,
                title: "Creative Freedom",
                description: "Express your creativity while solving complex technical challenges"
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-6 rounded-xl border border-gray-700 bg-gray-800/50 hover:border-cyan-500/50 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="text-2xl text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Careers; 