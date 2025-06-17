import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Navbar = () => {
  const [companyOpen, setCompanyOpen] = useState(false);
  const [technologyOpen, setTechnologyOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const handleDropdownToggle = (setter, isOpen) => {
    setter(!isOpen);
  };

  const handleMouseEnter = (setter) => {
    setter(true);
  };

  const handleMouseLeave = (setter) => {
    setter(false);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="fixed top-0 left-0 right-0 z-50 bg-black bg-opacity-70 backdrop-blur-md shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 text-white text-3xl font-bold">
              IN3D.ai
            </Link>
            <div className="hidden md:block ml-10 space-x-8">
              <Link to="/" className="text-gray-300 hover:text-white transition-colors duration-300">
                Home
              </Link>

              {/* Company Dropdown */}
              <div
                className="relative inline-block text-left"
                onMouseEnter={() => handleMouseEnter(setCompanyOpen)}
                onMouseLeave={() => handleMouseLeave(setCompanyOpen)}
              >
                <button
                  type="button"
                  className="inline-flex justify-center items-center text-gray-300 hover:text-white transition-colors duration-300 focus:outline-none"
                  onClick={() => handleDropdownToggle(setCompanyOpen, companyOpen)}
                >
                  Company
                  <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {companyOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <a href="#recognition" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Recognition</a>
                      <a href="#company-overview" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Company Overview</a>
                      <a href="#core-team" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Core Team</a>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Technology Dropdown */}
              <div
                className="relative inline-block text-left"
                onMouseEnter={() => handleMouseEnter(setTechnologyOpen)}
                onMouseLeave={() => handleMouseLeave(setTechnologyOpen)}
              >
                <button
                  type="button"
                  className="inline-flex justify-center items-center text-gray-300 hover:text-white transition-colors duration-300 focus:outline-none"
                  onClick={() => handleDropdownToggle(setTechnologyOpen, technologyOpen)}
                >
                  Technology
                  <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {technologyOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <a href="#problem-solution" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Problem & Solution</a>
                      <a href="#in3d-platform" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">In3D.ai Platform</a>
                      <a href="#unique-selling-proposition" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Unique Selling Proposition</a>
                      <a href="#transformative-technology" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Transformative Technology</a>
                      <a href="#avgc-xr" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">What is AVGC-XR?</a>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Business Dropdown */}
              <div
                className="relative inline-block text-left"
                onMouseEnter={() => handleMouseEnter(setBusinessOpen)}
                onMouseLeave={() => handleMouseLeave(setBusinessOpen)}
              >
                <button
                  type="button"
                  className="inline-flex justify-center items-center text-gray-300 hover:text-white transition-colors duration-300 focus:outline-none"
                  onClick={() => handleDropdownToggle(setBusinessOpen, businessOpen)}
                >
                  Business
                  <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {businessOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <a href="#market-potential" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Market Potential</a>
                      <a href="#subscription-pricing" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Subscription Pricing</a>
                      <a href="#business-model" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Business Model</a>
                      <a href="#competitors" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Competitors</a>
                      <a href="#financials" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Financials</a>
                      <a href="#fund-ask" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Fund ASK</a>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Assets Dropdown */}
              <div
                className="relative inline-block text-left"
                onMouseEnter={() => handleMouseEnter(setAssetsOpen)}
                onMouseLeave={() => handleMouseLeave(setAssetsOpen)}
              >
                <button
                  type="button"
                  className="inline-flex justify-center items-center text-gray-300 hover:text-white transition-colors duration-300 focus:outline-none"
                  onClick={() => handleDropdownToggle(setAssetsOpen, assetsOpen)}
                >
                  Assets
                  <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {assetsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <a href="#download-asset" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">Download Asset</a>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <Link to="/get-started">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-md font-semibold overflow-hidden"
              >
                <span className="relative z-10">Get Started</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;