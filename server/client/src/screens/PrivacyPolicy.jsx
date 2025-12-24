import React from 'react';
import { motion } from 'framer-motion';
import { FaShieldAlt, FaUser, FaDatabase, FaLock, FaEye, FaTrash, FaEnvelope } from 'react-icons/fa';

const PrivacyPolicy = () => {
  const lastUpdated = "January 15, 2025";

  const sections = [
    {
      title: "Information We Collect",
      icon: FaDatabase,
      content: [
        "Personal Information: Name, email address, and profile information when you create an account.",
        "Usage Data: Information about how you use our services, including generation history and preferences.",
        "Technical Data: IP address, browser type, device information, and usage analytics.",
        "Generated Content: 3D assets and models you create using our AI services."
      ]
    },
    {
      title: "How We Use Your Information",
      icon: FaUser,
      content: [
        "To provide and maintain our 3D AI generation services.",
        "To process payments and manage your subscription.",
        "To improve our AI models and service quality.",
        "To communicate with you about updates, support, and marketing (with your consent).",
        "To ensure security and prevent fraud."
      ]
    },
    {
      title: "Data Security",
      icon: FaLock,
      content: [
        "We implement industry-standard security measures to protect your data.",
        "All data transmission is encrypted using SSL/TLS protocols.",
        "We regularly update our security practices and conduct security audits.",
        "Access to your personal data is restricted to authorized personnel only."
      ]
    },
    {
      title: "Data Sharing and Disclosure",
      icon: FaEye,
      content: [
        "We do not sell, trade, or rent your personal information to third parties.",
        "We may share data with trusted service providers who assist in operating our platform.",
        "We may disclose information if required by law or to protect our rights and safety.",
        "Aggregated, anonymized data may be used for research and improvement purposes."
      ]
    },
    {
      title: "Your Rights",
      icon: FaShieldAlt,
      content: [
        "Access: You can request access to your personal data.",
        "Correction: You can update or correct your information through your account settings.",
        "Deletion: You can request deletion of your account and associated data.",
        "Portability: You can export your data in a machine-readable format.",
        "Opt-out: You can unsubscribe from marketing communications at any time."
      ]
    },
    {
      title: "Data Retention",
      icon: FaTrash,
      content: [
        "We retain your personal data as long as your account is active.",
        "Generated content is stored according to your subscription plan.",
        "We may retain certain data for legal, security, or business purposes.",
        "You can request data deletion by contacting our support team."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Header Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
              <FaShieldAlt className="text-cyan-400 mr-2" />
              <span className="text-cyan-400 text-sm font-medium">Privacy & Security</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Privacy Policy
            </h1>
            
            <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
              Your privacy is important to us. This policy explains how we collect, use, and protect your information.
            </p>
            
            <p className="text-sm text-gray-400">
              Last updated: {lastUpdated}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300"
              >
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                    <section.icon className="text-2xl text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                </div>
                
                <ul className="space-y-3">
                  {section.content.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start space-x-3 text-gray-300">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-16 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-8 border border-cyan-500/30"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mx-auto mb-6">
                <FaEnvelope className="text-2xl text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">Contact Us</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                If you have any questions about this Privacy Policy or our data practices, 
                please contact us using the information below.
              </p>
              
              <div className="space-y-3 text-gray-400 mb-4">
                <p><strong className="text-white">Company:</strong> Evoneural Artificial Intelligence OPC Private Limited</p>
                <p><strong className="text-white">Email:</strong> privacy@in3d.ai</p>
                <p><strong className="text-white">WhatsApp:</strong> +91 7023310122</p>
                <p><strong className="text-white">Address:</strong> Third Floor, Bhamashah Technohub, Sansthan Path, Malviya Nagar, Jaipur</p>
              </div>
            </div>
          </motion.div>

          {/* Additional Information */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-center"
          >
            <p className="text-gray-400 text-sm">
              This privacy policy is effective as of {lastUpdated} and will remain in effect except with respect to any changes in its provisions in the future, 
              which will be in effect immediately after being posted on this page.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy; 