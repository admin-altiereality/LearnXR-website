import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaQuestionCircle, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HelpChatProps {
  onClose?: () => void;
}

const HelpChat: React.FC<HelpChatProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  // Get Typeform ID from environment variable or use a default
  // Users should set VITE_TYPEFORM_ID in their .env file
  const typeformId = import.meta.env.VITE_TYPEFORM_ID || 'your-typeform-id';
  const typeformUrl = `https://form.typeform.com/to/${typeformId}?typeform-embed=embed-widget&typeform-source=website&typeform-medium=embed-sdk&typeform-medium-version=next`;

  useEffect(() => {
    // Set loading to false after a short delay to allow iframe to load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-transparent py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-6 mb-6"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none rounded-2xl" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-400 hover:text-white transition-all duration-300"
              >
                <FaArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <FaQuestionCircle className="w-6 h-6 text-cyan-400" />
                  Help & Support
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  We're here to help! Fill out the form below and we'll get back to you soon.
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-400 hover:text-white transition-all duration-300"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Typeform Embed Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none" />
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#141414]/90 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading help form...</p>
              </div>
            </div>
          )}

          <div className="relative" style={{ minHeight: '600px' }}>
            {typeformId === 'your-typeform-id' ? (
              <div className="p-12 text-center">
                <FaQuestionCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Typeform Not Configured</h2>
                <p className="text-gray-400 mb-6">
                  Please set up your Typeform ID in the environment variables.
                </p>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-left max-w-2xl mx-auto">
                  <p className="text-sm text-gray-300 mb-4">
                    To set up Typeform:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
                    <li>Create a form at <a href="https://www.typeform.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">typeform.com</a></li>
                    <li>Get your form ID from the form URL (e.g., <code className="bg-[#0a0a0a] px-2 py-1 rounded text-cyan-300">abc123</code> from <code className="bg-[#0a0a0a] px-2 py-1 rounded text-cyan-300">typeform.com/to/abc123</code>)</li>
                    <li>Add <code className="bg-[#0a0a0a] px-2 py-1 rounded text-cyan-300">VITE_TYPEFORM_ID=your-form-id</code> to your <code className="bg-[#0a0a0a] px-2 py-1 rounded text-cyan-300">.env</code> file</li>
                    <li>Restart your development server</li>
                  </ol>
                </div>
              </div>
            ) : (
              <iframe
                src={typeformUrl}
                style={{
                  width: '100%',
                  height: '600px',
                  border: 'none',
                  borderRadius: '1rem',
                }}
                title="Help & Support Form"
                onLoad={() => setIsLoading(false)}
                allow="camera; microphone; geolocation"
              />
            )}
          </div>
        </motion.div>

        {/* Additional Help Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Quick Response</h3>
            <p className="text-xs text-gray-400">
              We typically respond within 24 hours during business days.
            </p>
          </div>
          <div className="backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Account Information</h3>
            <p className="text-xs text-gray-400">
              {user ? `Logged in as: ${user.email}` : 'Please sign in for faster support'}
            </p>
          </div>
          <div className="backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Other Resources</h3>
            <p className="text-xs text-gray-400">
              Check out our blog and documentation for more help.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HelpChat;

