/**
 * MinimalFooter - Compact footer for logged-in users
 * Shows only essential links: Privacy, Terms, Company name
 */

import React from "react";
import { Link } from 'react-router-dom';

function MinimalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-3 px-4 bg-[#0a0a0a]/80 backdrop-blur-sm border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Company Info */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-400">In3D.AI</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">© {currentYear} Evoneural AI</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 text-xs">
          <Link 
            to="/privacy-policy" 
            className="text-gray-500 hover:text-cyan-400 transition-colors"
          >
            Privacy
          </Link>
          <span className="text-gray-700">|</span>
          <Link 
            to="/terms-conditions" 
            className="text-gray-500 hover:text-cyan-400 transition-colors"
          >
            Terms
          </Link>
          <span className="text-gray-700">|</span>
          <a 
            href="https://www.evoneural.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-cyan-400 transition-colors"
          >
            Evoneural.ai
          </a>
        </div>
      </div>
    </footer>
  );
}

export default MinimalFooter;
