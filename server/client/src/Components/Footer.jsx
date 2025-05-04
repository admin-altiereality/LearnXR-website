import React from "react";
import { FaTwitter, FaInstagram, FaTiktok, FaDiscord, FaYoutube, FaReddit } from 'react-icons/fa';

function Footer() {
  return (
    <footer className="bg-black bg-opacity-50 backdrop-blur-sm border-t border-gray-700/50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <p className="text-white text-sm">© 2025. In3D.AI | Evoneural Artifcial Intelligence OPC </p>
          <div className="flex space-x-4 mt-2 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              <FaTwitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              <FaDiscord className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              <FaInstagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
