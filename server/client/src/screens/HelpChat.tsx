import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaQuestionCircle, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FuturisticBackground from '../Components/FuturisticBackground';

interface HelpChatProps {
  onClose?: () => void;
}

const HelpChat: React.FC<HelpChatProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const typeformContainerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  // Typeform ID from the embed code
  const typeformId = '01KD9Y9X57Q36CXE94N71KPJ28';

  useEffect(() => {
    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="embed.typeform.com"]');
    
    if (existingScript) {
      setScriptLoaded(true);
      // If script already exists, Typeform should auto-initialize
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return;
    }

    // Load Typeform embed script
    const script = document.createElement('script');
    script.src = 'https://embed.typeform.com/next/embed.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setScriptLoaded(true);
      // Give Typeform time to initialize and scan for data-tf-live elements
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    };

    script.onerror = () => {
      console.error('Failed to load Typeform embed script');
      setIsLoading(false);
    };

    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      // Cleanup: remove script if component unmounts
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
    };
  }, []);

  // Hide Typeform branding
  useEffect(() => {
    const hideBranding = () => {
      // Hide any external branding elements outside iframe
      const selectors = [
        'a[href*="typeform.com"]:not([href*="embed"]):not([href*="form.typeform.com"])',
        '[class*="typeform-powered"]',
        '[id*="typeform-powered"]',
        '[class*="powered-by"]',
        '[id*="powered-by"]',
        '.tf-v1-powered-by',
        '[data-tf-powered]'
      ];

      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const element = el as HTMLElement;
            const text = element.textContent?.toLowerCase() || '';
            if (text.includes('powered by') || text.includes('typeform') || selector.includes('powered')) {
              element.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; width: 0 !important; overflow: hidden !important;';
            }
          });
        } catch (e) {
          // Ignore errors
        }
      });

      // Try to hide branding in iframe (may fail due to CORS)
      const iframe = typeformContainerRef.current?.querySelector('iframe');
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const poweredBy = iframeDoc.querySelectorAll('a[href*="typeform.com"], .tf-v1-powered-by, [class*="powered"], [id*="powered"], footer a');
            poweredBy.forEach(el => {
              (el as HTMLElement).style.cssText = 'display: none !important; visibility: hidden !important;';
            });
          }
        } catch (e) {
          // Cross-origin restrictions - expected
        }
      }
    };

    // Run immediately and set up observer
    hideBranding();
    const interval = setInterval(hideBranding, 500);

    // Use MutationObserver to catch dynamically added elements
    const observer = new MutationObserver(() => {
      hideBranding();
    });

    if (typeformContainerRef.current) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });
    }

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  // Ensure Typeform initializes when both script and element are ready
  useEffect(() => {
    if (scriptLoaded && typeformContainerRef.current) {
      // Typeform script should auto-detect the element, but we can trigger a re-scan
      // by dispatching a custom event or checking if the embed was created
      const checkInterval = setInterval(() => {
        const typeformWidget = typeformContainerRef.current?.querySelector('iframe, [data-tf-widget]');
        if (typeformWidget) {
          setIsLoading(false);
          clearInterval(checkInterval);
        }
      }, 200);

      // Clear interval after 5 seconds to prevent infinite checking
      setTimeout(() => {
        clearInterval(checkInterval);
        setIsLoading(false);
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [scriptLoaded]);

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  return (
    <FuturisticBackground>
      <div className="min-h-screen text-white font-body py-20 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl pt-20 mx-auto">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-3xl p-8 mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-fuchsia-500/10 rounded-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.1),_transparent_55%)] rounded-3xl pointer-events-none" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sky-400/30 text-white/70 hover:text-white transition-all duration-300 backdrop-blur-xl"
              >
                <FaArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)]">
                    <FaQuestionCircle className="w-6 h-6 text-white" />
                  </div>
                  Help & Support
                </h1>
                <p className="text-white/60 text-base mt-1">
                  We're here to help! Fill out the form below and we'll get back to you soon.
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all duration-300 backdrop-blur-xl"
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
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.1),_transparent_55%)] pointer-events-none" />
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#030303]/80 backdrop-blur-sm z-10 rounded-3xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-14 w-14 border-2 border-sky-500/30 border-t-sky-400 mx-auto mb-4"></div>
                <p className="text-white/60 font-medium">Loading help form...</p>
              </div>
            </div>
          )}

          <div className="relative p-6" style={{ minHeight: '650px' }}>
            <style>{`
              /* Hide Typeform branding - comprehensive styles */
              [data-tf-live] iframe {
                border-radius: 1rem;
              }
              
              /* Hide all Typeform branding elements */
              a[href*="typeform.com"]:not([href*="embed"]):not([href*="form.typeform.com"]),
              .tf-v1-powered-by,
              [class*="typeform-powered"],
              [id*="typeform-powered"],
              [class*="powered-by"],
              [id*="powered-by"],
              [data-tf-powered],
              [data-tf-live] a[href*="typeform.com"]:not([href*="embed"]),
              [data-tf-live] .tf-v1-powered-by,
              [data-tf-live] [class*="powered"],
              [data-tf-live] [id*="powered"],
              [data-tf-live] footer a[href*="typeform"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
              }
              
              /* Additional selectors for Typeform widgets */
              .typeform-widget a[href*="typeform.com"],
              [data-tf-widget] a[href*="typeform.com"] {
                display: none !important;
              }
            `}</style>
            <div
              ref={typeformContainerRef}
              data-tf-live={typeformId}
              className="w-full typeform-container"
              style={{ minHeight: '650px' }}
            />
          </div>
        </motion.div>

        {/* Additional Help Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent rounded-2xl pointer-events-none" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-base font-display font-semibold text-white mb-2">Quick Response</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                We typically respond within 24 hours during business days.
              </p>
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-2xl pointer-events-none" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-base font-display font-semibold text-white mb-2">Account Information</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {user ? (
                  <span className="text-sky-400 font-medium">{user.email}</span>
                ) : (
                  'Please sign in for faster support'
                )}
              </p>
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent rounded-2xl pointer-events-none" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-base font-display font-semibold text-white mb-2">Other Resources</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Check out our blog and documentation for more help.
              </p>
            </div>
          </motion.div>
        </motion.div>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default HelpChat;

