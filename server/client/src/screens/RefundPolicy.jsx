import { motion } from 'framer-motion';
import React from 'react';
import { FaCheckCircle, FaClock, FaEnvelope, FaExclamationTriangle, FaHandshake, FaMoneyBillWave, FaTimesCircle } from 'react-icons/fa';

const RefundPolicy = () => {
  const lastUpdated = "January 15, 2025";

  const sections = [
    {
      title: "30-Day Money-Back Guarantee",
      icon: FaHandshake,
      content: [
        "We offer a 30-day money-back guarantee for all paid subscription plans.",
        "If you are not satisfied with our service within 30 days of your initial purchase, you may request a full refund.",
        "Refund requests must be submitted within 30 days of the original purchase date.",
        "Refunds will be processed to the original payment method within 5-10 business days."
      ]
    },
    {
      title: "Eligibility for Refunds",
      icon: FaCheckCircle,
      content: [
        "Refunds are available for new subscriptions within 30 days of the initial purchase.",
        "Refunds apply to the first subscription payment only.",
        "Subsequent renewals are not eligible for refunds unless there is a service failure on our part.",
        "Free plan users are not eligible for refunds as no payment is required.",
        "Refunds are not available for unused generation credits or partial subscription periods."
      ]
    },
    {
      title: "Non-Refundable Items",
      icon: FaTimesCircle,
      content: [
        "Refunds are not available for subscription renewals after the initial 30-day period.",
        "Refunds are not available for unused generation credits or features.",
        "Refunds are not available if the service has been used extensively (more than 50% of monthly generation limits).",
        "Refunds are not available for accounts that have violated our Terms & Conditions.",
        "Refunds are not available for custom enterprise plans unless specifically agreed upon in writing."
      ]
    },
    {
      title: "How to Request a Refund",
      icon: FaMoneyBillWave,
      content: [
        "Contact our support team via email at support@in3d.ai or WhatsApp at +91 7023310122.",
        "Include your account email address and subscription details in your refund request.",
        "Provide a brief explanation for the refund request.",
        "Our support team will review your request and respond within 2-3 business days.",
        "Once approved, refunds will be processed within 5-10 business days to your original payment method."
      ]
    },
    {
      title: "Processing Time",
      icon: FaClock,
      content: [
        "Refund requests are reviewed within 2-3 business days of submission.",
        "Approved refunds are processed within 5-10 business days.",
        "Refunds will appear in your account based on your payment provider's processing time.",
        "Credit card refunds typically take 5-7 business days.",
        "UPI and bank transfer refunds may take up to 10 business days."
      ]
    },
    {
      title: "Service Failures and Technical Issues",
      icon: FaExclamationTriangle,
      content: [
        "If our service experiences a significant outage or technical failure, we will provide appropriate compensation.",
        "Compensation may include service credits, extended subscription periods, or refunds at our discretion.",
        "Service failures must be reported within 7 days of the incident.",
        "We are not responsible for issues caused by user error, third-party services, or network problems outside our control."
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
              <FaMoneyBillWave className="text-cyan-400 mr-2" />
              <span className="text-cyan-400 text-sm font-medium">Refund Policy</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Refund Policy
            </h1>
            
            <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
              Your satisfaction is our priority. This policy outlines our refund process and terms.
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
                This refund policy is provided by Evoneural Artificial Intelligence OPC Private Limited. 
                By purchasing a subscription, you acknowledge that you have read, understood, and agree to this refund policy.
              </p>
              
              <div className="text-gray-400 text-sm">
                <p><strong className="text-white">Governing Law:</strong> This policy is governed by the laws of India.</p>
                <p><strong className="text-white">Company:</strong> Evoneural Artificial Intelligence OPC Private Limited</p>
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
              <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mx-auto mb-6">
                <FaEnvelope className="text-2xl text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">Need Help with a Refund?</h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                If you have any questions about our refund policy or need to request a refund, 
                please contact our support team using the information below.
              </p>
              
              <div className="space-y-3 text-gray-400">
                <p><strong className="text-white">Email:</strong> support@in3d.ai</p>
                <p><strong className="text-white">WhatsApp:</strong> +91 7023310122</p>
                <p><strong className="text-white">Address:</strong> Third Floor, Bhamashah Technohub, Sansthan Path, Malviya Nagar, Jaipur</p>
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
              This refund policy is effective as of {lastUpdated}. We reserve the right to modify this policy at any time, 
              with changes effective immediately upon posting. We encourage you to review this policy periodically.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default RefundPolicy;

