import React, { useState } from "react";
import { motion } from 'framer-motion';
import { 
  FaTwitter, 
  FaInstagram, 
  FaFacebook, 
  FaLinkedin, 
  FaWhatsapp, 
  FaMapMarkerAlt, 
  FaGlobe,
  FaFileAlt,
  FaShieldAlt,
  FaPhone,
  FaEnvelope,
  FaRss,
  FaServer,
  FaWifi,
  FaDatabase,
  FaCog,
  FaMoneyBillWave
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { MeshyTestPanel } from './MeshyTestPanel';
import { MeshyDebugPanel } from './MeshyDebugPanel';

function Footer() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  const socialLinks = [
    {
      name: "Website",
      url: "https://www.evoneural.ai",
      icon: FaGlobe,
      color: "hover:text-amber-400"
    },
    {
      name: "Facebook",
      url: "https://www.facebook.com/profile.php?id=61565933257547",
      icon: FaFacebook,
      color: "hover:text-amber-400"
    },
    {
      name: "Twitter",
      url: "#", // Placeholder - update when available
      icon: FaTwitter,
      color: "hover:text-amber-400"
    },
    {
      name: "LinkedIn",
      url: "https://www.linkedin.com/company/evoneural-ai-opc/?viewAsMember=true",
      icon: FaLinkedin,
      color: "hover:text-amber-400"
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/evoneural.ai/",
      icon: FaInstagram,
      color: "hover:text-amber-400"
    },
    {
      name: "Blog",
      url: "/blog",
      icon: FaRss,
      color: "hover:text-amber-400"
    }
  ];

  const quickLinks = [
    {
      name: "Privacy Policy",
      url: "/privacy-policy",
      icon: FaShieldAlt
    },
    {
      name: "Terms & Conditions",
      url: "/terms-conditions",
      icon: FaFileAlt
    },
    {
      name: "Refund Policy",
      url: "/refund-policy",
      icon: FaMoneyBillWave
    }
  ];

  return (
    <footer className="relative bg-[#141414]/90 backdrop-blur-xl border-t border-[#262626] overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/[0.02] via-transparent to-transparent pointer-events-none"></div>
      
      <div className="relative container mx-auto px-4 py-6 lg:py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8 mb-6">
          
          {/* Company Info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-xl font-display font-bold text-white mb-2 tracking-tight">
                In3D.<span className="text-cyan-400">AI</span>
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed font-body">
                Powered by Evoneural Artificial Intelligence OPC Private Limited. 
                Transforming ideas into stunning 3D assets with AI-powered generation.
              </p>
            </div>
            
            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-start space-x-2 group">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:border-cyan-500/40 transition-colors mt-0.5">
                  <FaMapMarkerAlt className="w-3 h-3 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white text-xs font-display font-semibold mb-0.5">Company Address</p>
                  <a 
                    href="https://maps.app.goo.gl/bwU2obL3gJEnGruo9" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 text-xs hover:text-cyan-400 transition-colors font-body leading-relaxed"
                  >
                    Third Floor, Bhamashah Technohub<br />
                    Sansthan Path, Malviya Nagar<br />
                    Jaipur, Rajasthan, India
                  </a>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 group">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:border-cyan-500/40 transition-colors">
                  <FaWhatsapp className="w-3 h-3 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white text-xs font-display font-semibold mb-0.5">WhatsApp</p>
                  <a 
                    href="https://wa.me/917023310122" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 text-xs hover:text-cyan-400 transition-colors font-body"
                  >
                    +91 7023310122
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <h3 className="text-base font-display font-semibold text-white mb-3 tracking-tight">
              Quick <span className="text-cyan-400">Links</span>
            </h3>
            <div className="space-y-2">
              {quickLinks.map((link, index) => (
                <Link
                  key={link.name}
                  to={link.url}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-all duration-300 group p-1.5 -ml-1.5 rounded-lg hover:bg-white/[0.05]"
                >
                  <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                    <link.icon className="w-2.5 h-2.5 text-cyan-400" />
                  </div>
                  <span className="text-xs font-body">{link.name}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Services */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <h3 className="text-base font-display font-semibold text-white mb-3 tracking-tight">
              <span className="text-cyan-400">Services</span>
            </h3>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-[#0a0a0a]/30 border border-[#262626]">
                <p className="font-display font-semibold text-white mb-2 text-xs">AI-Powered 3D Generation</p>
                <ul className="space-y-1.5 text-xs font-body text-gray-400">
                  <li className="flex items-center">
                    <span className="text-cyan-400 mr-1.5 font-mono text-[10px]">→</span>
                    3D Model Creation
                  </li>
                  <li className="flex items-center">
                    <span className="text-cyan-400 mr-1.5 font-mono text-[10px]">→</span>
                    Character Design
                  </li>
                  <li className="flex items-center">
                    <span className="text-cyan-400 mr-1.5 font-mono text-[10px]">→</span>
                    Environment Building
                  </li>
                  <li className="flex items-center">
                    <span className="text-cyan-400 mr-1.5 font-mono text-[10px]">→</span>
                    Asset Export (FBX, OBJ, GLTF)
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Social Media */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <h3 className="text-base font-display font-semibold text-white mb-3 tracking-tight">
              Connect <span className="text-cyan-400">With Us</span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {socialLinks.map((social, index) => (
                social.name === "Blog" ? (
                  <motion.button
                    key={social.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                    onClick={() => navigate('/blog')}
                    className={`flex flex-col items-center p-2 rounded-lg bg-[#0a0a0a]/30 border border-[#262626] text-gray-400 transition-all duration-300 hover:border-cyan-500/40 hover:bg-[#0a0a0a]/50 hover:text-cyan-400 ${social.color} group`}
                    title={social.name}
                    type="button"
                  >
                    <social.icon className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] text-center font-body">{social.name}</span>
                  </motion.button>
                ) : (
                  <motion.a
                    key={social.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center p-2 rounded-lg bg-[#0a0a0a]/30 border border-[#262626] text-gray-400 transition-all duration-300 hover:border-cyan-500/40 hover:bg-[#0a0a0a]/50 hover:text-cyan-400 ${social.color} group`}
                    title={social.name}
                  >
                    <social.icon className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] text-center font-body">{social.name}</span>
                  </motion.a>
                )
              ))}
            </div>
          </motion.div>

          {/* Service Status */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <h3 className="text-base font-display font-semibold text-white mb-3 tracking-tight">
              Service <span className="text-cyan-400">Status</span>
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => navigate('/system-status?tab=system-status')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-all duration-300 group w-full p-1.5 rounded-lg hover:bg-white/[0.05] -ml-1.5"
              >
                <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                  <FaServer className="w-2.5 h-2.5 text-cyan-400" />
                </div>
                <span className="text-xs font-body">System Status</span>
              </button>
              <button
                onClick={() => navigate('/system-status?tab=test-panel')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-all duration-300 group w-full p-1.5 rounded-lg hover:bg-white/[0.05] -ml-1.5"
              >
                <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                  <FaWifi className="w-2.5 h-2.5 text-cyan-400" />
                </div>
                <span className="text-xs font-body">Test Panel</span>
              </button>
              <button
                onClick={() => navigate('/system-status?tab=debug-panel')}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-all duration-300 group w-full p-1.5 rounded-lg hover:bg-white/[0.05] -ml-1.5"
              >
                <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                  <FaCog className="w-2.5 h-2.5 text-cyan-400" />
                </div>
                <span className="text-xs font-body">Debug Panel</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="border-t border-[#262626] pt-4"
        >
          <div className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-gray-500 text-xs font-body">
                © {currentYear} In3D.AI | Evoneural Artificial Intelligence OPC Private Limited. All rights reserved.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
              <Link 
                to="/privacy-policy" 
                className="text-gray-400 hover:text-cyan-400 text-xs transition-colors font-body"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms-conditions" 
                className="text-gray-400 hover:text-cyan-400 text-xs transition-colors font-body"
              >
                Terms & Conditions
              </Link>
              <Link 
                to="/refund-policy" 
                className="text-gray-400 hover:text-cyan-400 text-xs transition-colors font-body"
              >
                Refund Policy
              </Link>
              <Link
                to="/3d-generate"
                className="px-4 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/50 font-display font-semibold text-xs transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                Generate 3D Asset
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

export default Footer;
