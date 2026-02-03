import React from 'react';
import { motion } from 'framer-motion';
import { FaFileAlt, FaGavel, FaUserCheck, FaExclamationTriangle, FaHandshake, FaShieldAlt, FaBalanceScale } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../Components/LearnXRTypography';

const TermsConditions = () => {
  const lastUpdated = "January 15, 2025";

  const sections = [
    {
      title: "Acceptance of Terms",
      icon: FaUserCheck,
      content: [
        "By accessing and using LearnXR™, you accept and agree to be bound by these Terms and Conditions.",
        "If you do not agree to these terms, please do not use our services.",
        "We reserve the right to modify these terms at any time, with changes effective immediately upon posting.",
        "Your continued use of the service after changes constitutes acceptance of the new terms."
      ]
    },
    {
      title: "Service Description",
      icon: FaFileAlt,
      content: [
        "LearnXR™ by Altie Reality provides immersive VR/XR educational learning experiences and platforms.",
        "Users can access educational content, interactive lessons, and virtual reality learning environments.",
        "Services include lesson creation, student progress tracking, curriculum management, and VR/XR content delivery.",
        "We offer different subscription plans and institutional licenses with varying features and access levels."
      ]
    },
    {
      title: "User Accounts and Registration",
      icon: FaUserCheck,
      content: [
        "You must register for an account to access our services.",
        "You are responsible for maintaining the confidentiality of your account credentials.",
        "You must provide accurate and complete information during registration.",
        "You are responsible for all activities that occur under your account.",
        "You must notify us immediately of any unauthorized use of your account."
      ]
    },
    {
      title: "Acceptable Use Policy",
      icon: FaGavel,
      content: [
        "You may not use our services for any illegal or unauthorized purpose.",
        "You may not generate content that is harmful, offensive, or violates intellectual property rights.",
        "You may not attempt to reverse engineer or hack our systems.",
        "You may not use our services to generate content for commercial purposes without proper licensing.",
        "You must comply with all applicable laws and regulations."
      ]
    },
    {
      title: "Intellectual Property Rights",
      icon: FaShieldAlt,
      content: [
        "LearnXR™, including its name, logo, and brand identity, is a trademark of Altie Reality Private Limited.",
        "You retain ownership of educational content, lesson plans, and materials you create using our platform.",
        "We retain ownership of our platform, technology, VR/XR environments, software, and proprietary educational frameworks.",
        "You grant us a limited, non-exclusive license to use your created content for service improvement and platform enhancement.",
        "You may not claim ownership of our VR/XR technology, educational algorithms, or underlying platform infrastructure.",
        "All educational content provided by LearnXR™ remains the property of Altie Reality Private Limited or its licensors.",
        "You are responsible for ensuring you have rights to any content, images, or materials you upload or use in lessons."
      ]
    },
    {
      title: "Payment and Subscription",
      icon: FaHandshake,
      content: [
        "Subscription fees and institutional licenses are billed in advance on a recurring basis as per your selected plan.",
        "We offer a 30-day money-back guarantee for new individual subscriptions. See our Refund Policy for details.",
        "Institutional licenses may have different refund terms as specified in your institutional agreement.",
        "All payments are non-refundable after the applicable guarantee period except as required by law or as specified in your agreement.",
        "We may change our pricing with 30 days written notice to existing subscribers.",
        "You may cancel your subscription at any time through your account settings or by contacting support.",
        "Upon cancellation, access to premium features and content will continue until the end of your current billing period."
      ]
    },
    {
      title: "Limitation of Liability",
      icon: FaExclamationTriangle,
      content: [
        "Our services are provided 'as is' without warranties of any kind, express or implied.",
        "We are not liable for any indirect, incidental, special, or consequential damages arising from your use of LearnXR™.",
        "Our total liability is limited to the amount you paid for our services in the past 12 months.",
        "We are not responsible for any technical issues, data loss, or interruptions in VR/XR experiences beyond our reasonable control.",
        "We do not guarantee specific educational outcomes or learning results from using our platform.",
        "You use our services at your own risk and are responsible for ensuring appropriate supervision for minors."
      ]
    },
    {
      title: "Termination",
      icon: FaBalanceScale,
      content: [
        "We may terminate or suspend your account for violation of these terms.",
        "You may terminate your account at any time by contacting support.",
        "Upon termination, your access to services will cease immediately.",
        "We may retain certain data as required by law or for business purposes.",
        "Termination does not affect any provisions that should survive."
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
              <FaFileAlt className="text-cyan-400 mr-2" />
              <span className="text-cyan-400 text-sm font-medium">Legal Terms</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Terms & Conditions
            </h1>
            
            <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
              Please read these terms carefully before using our services. 
              These terms govern your use of <span style={learnXRFontStyle} className="text-xl"><span className="text-white">Learn</span><span className="text-purple-700">XR</span><TrademarkSymbol /></span> by Altie Reality and its features.
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

          {/* Important Notice */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-16 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl p-8 border border-orange-500/30"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-6">
                <FaExclamationTriangle className="text-2xl text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">Important Notice</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                These terms constitute a legally binding agreement between you and Altie Reality Private Limited, the provider of <span style={learnXRFontStyle} className="text-lg"><span className="text-white">Learn</span><span className="text-purple-700">XR</span><TrademarkSymbol /></span>. 
                By using our services, you acknowledge that you have read, understood, and agree to be bound by these terms.
              </p>
              
              <div className="text-gray-400 text-sm">
                <p><strong className="text-white">Service Provider:</strong> Altie Reality Private Limited</p>
                <p><strong className="text-white">Brand:</strong> <span style={learnXRFontStyle} className="text-sm"><span className="text-white">Learn</span><span className="text-purple-700">XR</span><TrademarkSymbol /></span> by Altie Reality</p>
                <p><strong className="text-white">Governing Law:</strong> These terms are governed by the laws of India.</p>
                <p><strong className="text-white">Dispute Resolution:</strong> Any disputes will be resolved through arbitration in Jaipur, Rajasthan, India.</p>
              </div>
            </div>
          </motion.div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-8 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-8 border border-cyan-500/30"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Questions About These Terms?</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                If you have any questions about these Terms & Conditions, please contact our legal team.
              </p>
              
              <div className="space-y-3 text-gray-400">
                <p><strong className="text-white">Email:</strong> legal@altiereality.com</p>
                <p><strong className="text-white">WhatsApp:</strong> +91 7023310122</p>
                <p><strong className="text-white">Address:</strong> Third Floor, Bhamashah Technohub, Sansthan Path, Malviya Nagar, Jaipur, Rajasthan, India</p>
                <p><strong className="text-white">Company:</strong> Altie Reality Private Limited</p>
              </div>
            </div>
          </motion.div>

          {/* Additional Information */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="mt-8 text-center"
          >
            <p className="text-gray-400 text-sm">
              These terms are effective as of {lastUpdated}. We encourage you to review these terms periodically 
              as they may be updated to reflect changes in our services or legal requirements.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default TermsConditions; 