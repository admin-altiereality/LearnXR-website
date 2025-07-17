import React, { useState } from "react";
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
  FaCog
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
      color: "hover:text-blue-400"
    },
    {
      name: "Facebook",
      url: "https://www.facebook.com/profile.php?id=61565933257547",
      icon: FaFacebook,
      color: "hover:text-blue-600"
    },
    {
      name: "Twitter",
      url: "#", // Placeholder - update when available
      icon: FaTwitter,
      color: "hover:text-blue-400"
    },
    {
      name: "LinkedIn",
      url: "https://www.linkedin.com/company/evoneural-ai-opc/?viewAsMember=true",
      icon: FaLinkedin,
      color: "hover:text-blue-700"
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/evoneural.ai/",
      icon: FaInstagram,
      color: "hover:text-pink-500"
    },
    {
      name: "Blog",
      url: "#", // Placeholder - update when available
      icon: FaRss,
      color: "hover:text-orange-500"
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
    }
  ];

  return (
    <footer className="bg-gray-900/90 backdrop-blur-xl border-t border-gray-800/50">
      <div className="container mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          
          {/* Company Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">In3D.AI</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Powered by Evoneural Artificial Intelligence OPC. 
                Transforming ideas into stunning 3D assets with AI-powered generation.
              </p>
            </div>
            
            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <FaMapMarkerAlt className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">Company Address</p>
                  <a 
                    href="https://maps.app.goo.gl/bwU2obL3gJEnGruo9" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 text-sm hover:text-cyan-400 transition-colors"
                  >
                    Third Floor, Bhamashah Technohub<br />
                    Sansthan Path, Malviya Nagar<br />
                    Jaipur, Rajasthan, India
                  </a>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <FaWhatsapp className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">WhatsApp</p>
                  <a 
                    href="https://wa.me/917023310122" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 text-sm hover:text-green-400 transition-colors"
                  >
                    +91 7023310122
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
            <div className="space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.url}
                  className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors group"
                >
                  <link.icon className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
                  <span className="text-sm">{link.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
            <div className="space-y-3">
              <div className="text-gray-400 text-sm">
                <p className="font-medium text-white mb-2">AI-Powered 3D Generation</p>
                <ul className="space-y-1 text-xs">
                  <li>• 3D Model Creation</li>
                  <li>• Character Design</li>
                  <li>• Environment Building</li>
                  <li>• Asset Export (FBX, OBJ, GLTF)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Connect With Us</h3>
            <div className="grid grid-cols-3 gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-400 transition-all duration-300 hover:border-cyan-500/50 hover:bg-gray-800/70 ${social.color}`}
                  title={social.name}
                >
                  <social.icon className="w-5 h-5 mb-1" />
                  <span className="text-xs text-center">{social.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Service Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Service Status</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/service-status')}
                className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors group w-full"
              >
                <FaServer className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
                <span className="text-sm">System Status</span>
              </button>
              <button
                onClick={() => navigate('/test-panel')}
                className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors group w-full"
              >
                <FaWifi className="w-4 h-4 text-green-400 group-hover:text-green-300" />
                <span className="text-sm">Test Panel</span>
              </button>
              <button
                onClick={() => navigate('/debug-panel')}
                className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors group w-full"
              >
                <FaCog className="w-4 h-4 text-yellow-400 group-hover:text-yellow-300" />
                <span className="text-sm">Debug Panel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800/50 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-gray-400 text-sm">
                © {currentYear} In3D.AI | Evoneural Artificial Intelligence OPC. All rights reserved.
              </p>
            </div>
            
            <div className="flex items-center space-x-6">
              <Link 
                to="/privacy-policy" 
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms-conditions" 
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Terms & Conditions
              </Link>
              <Link
                to="/3d-generate"
                className="ml-4 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow transition-all duration-200"
              >
                Generate 3D Asset
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
