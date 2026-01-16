/**
 * Developer Settings Page
 * API Key management for the In3D Developer Portal
 * Redesigned with bold, editorial aesthetic
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  FaPlus, 
  FaBook,
  FaSync
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { fetchApiKeys, ApiKeyListItem } from '../services/apiKeyService';
import ApiKeyCreateModal from '../Components/developer/ApiKeyCreateModal';
import ApiKeyTable from '../Components/developer/ApiKeyTable';

const DeveloperSettings: React.FC = () => {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [regeneratedKeyResponse, setRegeneratedKeyResponse] = useState<any>(null);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  const handleKeyRegenerated = (response: any) => {
    setRegeneratedKeyResponse(response);
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Layered Background with Texture */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient - warm editorial dark */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0806] via-[#1a1612] to-[#0f0d0a]" />
        
        {/* Geometric grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px'
          }}
        />
        
        {/* Radial gradients for depth */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.1) 0%, transparent 70%)'
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-800/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-orange-900/5 rounded-full blur-3xl" />
        
        {/* Subtle noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }}
        />
      </div>

      <div className="relative py-12 sm:py-16 md:py-20 lg:py-28 px-4 sm:px-6 lg:px-8 mt-20">
        <div className="max-w-6xl mx-auto space-y-8 md:space-y-12">
          {/* Header - Editorial Style */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Decorative line element */}
            <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/40 via-amber-600/20 to-transparent" />
            
            <div className="pl-8 md:pl-12">
              {/* Category label */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-4"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                <span className="text-xs uppercase tracking-wider font-medium text-amber-400/70 font-display">
                  Developer Portal
                </span>
              </motion.div>

              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-8">
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight font-display tracking-tight">
                    API Keys
                  </h1>
                  <p className="text-lg md:text-xl text-amber-100/60 font-body max-w-2xl leading-relaxed">
                    Manage authentication credentials for programmatic access to In3D's generation APIs
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(true)}
                  className="group relative px-6 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all duration-300 font-display tracking-wide uppercase text-sm shadow-[0_4px_20px_rgba(217,119,6,0.3)] hover:shadow-[0_6px_30px_rgba(217,119,6,0.4)] border border-amber-500/30 hover:border-amber-400/50"
                >
                  <span className="relative flex items-center gap-2.5">
                    <FaPlus className="w-3.5 h-3.5" />
                    <span>Create Key</span>
                  </span>
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-amber-400/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300" />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Quick Links - Editorial Card Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
          >
            <Link
              to="/docs/api"
              className="group relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 backdrop-blur-sm border border-amber-900/30 hover:border-amber-700/50 transition-all duration-300 block"
            >
              {/* Background texture */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex items-start gap-5">
                <div className="w-12 h-12 flex items-center justify-center bg-amber-900/20 border border-amber-800/30 group-hover:bg-amber-900/30 group-hover:border-amber-700/40 transition-all duration-300">
                  <FaBook className="w-5 h-5 text-amber-400/80 group-hover:text-amber-300 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-2 font-display group-hover:text-amber-50 transition-colors">
                    API Documentation
                  </h3>
                  <p className="text-sm text-amber-100/50 font-body leading-relaxed">
                    Complete reference for integrating In3D's generation capabilities
                  </p>
                </div>
              </div>
            </Link>

            <Link
              to="/docs/n8n"
              className="group relative p-6 md:p-8 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 backdrop-blur-sm border border-orange-900/30 hover:border-orange-700/50 transition-all duration-300 block"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-950/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex items-start gap-5">
                <div className="w-12 h-12 flex items-center justify-center bg-orange-900/20 border border-orange-800/30 group-hover:bg-orange-900/30 group-hover:border-orange-700/40 transition-all duration-300">
                  <FaSync className="w-5 h-5 text-orange-400/80 group-hover:text-orange-300 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-2 font-display group-hover:text-orange-50 transition-colors">
                    n8n Workflows
                  </h3>
                  <p className="text-sm text-orange-100/50 font-body leading-relaxed">
                    Pre-built automation templates for seamless integration
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* API Keys Section - Editorial Layout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Section divider line */}
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-900/30 to-transparent" />
            
            <div className="pt-8 md:pt-12">
              {/* Section Header */}
              <div className="mb-8 md:mb-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-12 bg-gradient-to-b from-amber-500 to-amber-700/50" />
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                        Your API Keys
                      </h2>
                      <p className="text-sm text-amber-100/50 font-body mt-1">
                        {apiKeys.filter(k => !k.revoked).length} of 5 active keys
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={loadApiKeys}
                    disabled={loading}
                    className="p-3 bg-[#1a1612]/60 border border-amber-900/30 hover:border-amber-700/50 text-amber-400/70 hover:text-amber-300 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Refresh"
                  >
                    <FaSync className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </motion.button>
                </div>
              </div>

              {/* Table Content */}
              <div className="relative">
                {loading ? (
                  <div className="text-center py-16 md:py-20">
                    <div className="w-12 h-12 border-2 border-amber-800/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-amber-100/50 font-body">Loading API keys...</p>
                  </div>
                ) : (
                  <ApiKeyTable 
                    apiKeys={apiKeys} 
                    onRefresh={loadApiKeys}
                    onKeyRegenerated={handleKeyRegenerated}
                  />
                )}
              </div>
            </div>
          </motion.div>

          {/* Usage Info - Technical Reference Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative p-6 md:p-8 bg-[#0f0d0a]/60 border border-amber-900/20 backdrop-blur-sm"
          >
            {/* Decorative corner elements */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-800/30" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-800/30" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-800/30" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-800/30" />
            
            <div className="relative">
              <h3 className="text-sm uppercase tracking-wider font-semibold text-amber-400/70 mb-6 font-display">
                Authentication Reference
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">
                    Authorization Header
                  </p>
                  <code className="block p-3 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-xs leading-relaxed">
                    Authorization: Bearer<br />in3d_live_...
                  </code>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">
                    Custom Header
                  </p>
                  <code className="block p-3 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-xs leading-relaxed">
                    X-In3d-Key:<br />in3d_live_...
                  </code>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">
                    Base URL
                  </p>
                  <code className="block p-3 bg-[#0a0806] border border-amber-900/30 text-amber-300/90 font-mono text-xs leading-relaxed">
                    https://api.in3d.ai<br />/v1
                  </code>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Create Modal */}
      <ApiKeyCreateModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setRegeneratedKeyResponse(null);
        }}
        onKeyCreated={loadApiKeys}
        preCreatedKey={regeneratedKeyResponse}
      />
    </div>
  );
};

export default DeveloperSettings;
