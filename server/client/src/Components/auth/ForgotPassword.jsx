import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCube, FaArrowLeft, FaEnvelope } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import FuturisticBackground from '../FuturisticBackground';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage('');
      setError('');
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your inbox for further instructions');
    } catch (error) {
      setError('Failed to reset password. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.2 + i * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <FuturisticBackground>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-center gap-3 mb-8"
          >
            
          </motion.div>

          {/* Forgot Password Card */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden"
          >
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-sky-500/10 pointer-events-none" />

            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <FaEnvelope className="text-2xl text-white" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                  Reset Password
                </h2>
                <p className="text-white/60">
                  Enter your email to receive reset instructions
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {message && (
                <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {message}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3.5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full rounded-xl py-3.5 font-semibold text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </span>
                </motion.button>
              </form>

              {/* Footer Links */}
              <div className="mt-8 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors"
                >
                  <FaArrowLeft className="text-sm" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default ForgotPassword;
