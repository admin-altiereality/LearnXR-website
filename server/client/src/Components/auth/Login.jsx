import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { FaCube, FaArrowRight } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
// Subscription removed
import { db } from '../../config/firebase';
import FuturisticBackground from '../FuturisticBackground';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const { login, loginWithGoogle, user } = useAuth();
  // Subscription removed
  const navigate = useNavigate();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user || checkingOnboarding) return;

      setCheckingOnboarding(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Check if onboarding is completed
          if (!userData.onboardingCompleted) {
            // First-time user: redirect to onboarding
            navigate('/onboarding');
            return;
          }
          
          // Onboarding completed: go to main
          navigate('/main');
        } else {
          // New user: redirect to onboarding
          navigate('/onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        navigate('/onboarding');
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user, navigate, checkingOnboarding]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await login(email, password);
    } catch (error) {
      setError('Failed to login. ' + error.message);
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

          {/* Login Card */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden"
          >
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />

            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                  Welcome Back
                </h2>
                <p className="text-white/60">
                  Sign in to continue creating
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3.5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3.5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </div>

                <motion.button
                  type="submit"
                  className="group relative w-full rounded-xl py-3.5 font-semibold text-white overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    Sign In
                    <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/40 uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Google Login */}
              <motion.button
                onClick={loginWithGoogle}
                className="w-full rounded-xl py-3.5 font-medium text-white bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                Continue with Google
              </motion.button>

              {/* Footer Links */}
              <div className="mt-8 text-center space-y-3 text-sm">
                <p className="text-white/50">
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  >
                    Sign Up
                  </Link>
                </p>
                <p>
                  <Link
                    to="/forgot-password"
                    className="text-white/40 hover:text-white/60 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </FuturisticBackground>
  );
};
