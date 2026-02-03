import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowRight, 
  FaArrowLeft,
  FaUserGraduate, 
  FaChalkboardTeacher, 
  FaSchool,
  FaGoogle,
  FaEnvelope,
  FaLock,
  FaUser,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaExclamationCircle
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { 
  requiresApproval,
  hasCompletedOnboarding,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS
} from '../../utils/rbac';
import FuturisticBackground from '../FuturisticBackground';
import { learnXRFontStyle, TrademarkSymbol } from '../LearnXRTypography';

export const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('role-select'); // 'role-select' | 'signup-form'
  const { signup, loginWithGoogle, user, profile, selectedRole, setSelectedRole } = useAuth();
  const navigate = useNavigate();

  // Role options for the selection screen
  const roleOptions = [
    {
      id: 'student',
      icon: FaUserGraduate,
      title: 'Student',
      description: 'Access lessons and complete interactive quizzes',
      gradient: 'from-emerald-500 to-teal-600',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]',
      features: [
        'Access all lessons',
        'Interactive quizzes',
        'Track your progress',
        'Certificate on completion'
      ],
      requiresApproval: false,
    },
    {
      id: 'teacher',
      icon: FaChalkboardTeacher,
      title: 'Teacher',
      description: 'Create and manage educational content',
      gradient: 'from-blue-500 to-indigo-600',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
      features: [
        'Create lessons & courses',
        'Manage student progress',
        'Analytics dashboard',
        'Content studio access'
      ],
      requiresApproval: true,
    },
  ];

  const secondaryOption = {
    id: 'school',
    icon: FaSchool,
    title: 'School Administrator',
    description: 'Manage school-wide content and teachers',
    gradient: 'from-purple-500 to-violet-600',
    bgGlow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    features: [
      'Multi-teacher management',
      'School-wide analytics',
      'Custom branding',
      'API access'
    ],
    requiresApproval: true,
  };

  // Handle user redirect based on profile
  useEffect(() => {
    const handleRedirect = async () => {
      if (!user || !profile) return;

      if (!hasCompletedOnboarding(profile)) {
        navigate('/onboarding');
        return;
      }
      
      if (requiresApproval(profile.role) && profile.approvalStatus === 'pending') {
        navigate('/approval-pending');
        return;
      }

      navigate(profile.role === 'student' ? '/lessons' : '/main');
    };

    handleRedirect();
  }, [user, profile, navigate]);

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setStep('signup-form');
  };

  const handleBackToRoleSelect = () => {
    setStep('role-select');
    setError('');
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      setError('');
      await signup(email, password, name, selectedRole || 'student');
    } catch (error) {
      setError('Failed to create account. ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      setError('');
      await loginWithGoogle(selectedRole);
    } catch (error) {
      setError('Failed to sign up with Google. ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: 0.1 + i * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
  };

  const getRoleInfo = () => {
    return roleOptions.find(r => r.id === selectedRole) || 
           (selectedRole === 'school' ? secondaryOption : roleOptions[0]);
  };

  const roleInfo = getRoleInfo();

  return (
    <FuturisticBackground>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              Join{' '}
              <span style={learnXRFontStyle} className="text-3xl tracking-[0.15rem]">
                <span className="text-white">Learn</span>
                <span className="text-purple-700">XR</span>
                <TrademarkSymbol className="ml-1" />
              </span>
            </h1>
            <p className="text-white/60">Start your immersive learning journey</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 'role-select' ? (
              /* Role Selection Screen */
              <motion.div
                key="role-select"
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
                  
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-white text-center mb-2">
                      Choose Your Role
                    </h2>
                    <p className="text-white/50 text-center mb-8">
                      Select how you'll be using LearnXR
                    </p>

                    {/* Primary Role Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {roleOptions.map((role, index) => (
                        <motion.button
                          key={role.id}
                          custom={index + 2}
                          variants={fadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          onClick={() => handleRoleSelect(role.id)}
                          className={`group relative p-6 rounded-2xl border-2 border-white/10 bg-white/[0.02] 
                                    hover:border-white/30 hover:bg-white/[0.05] transition-all duration-300 text-left
                                    ${role.bgGlow}`}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.gradient} 
                                        flex items-center justify-center mb-4 shadow-lg`}>
                            <role.icon className="text-2xl text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {role.title}
                          </h3>
                          <p className="text-sm text-white/50 mb-3">
                            {role.description}
                          </p>
                          
                          {/* Features list */}
                          <ul className="space-y-1.5">
                            {role.features.slice(0, 2).map((feature, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-white/40">
                                <FaCheck className="text-emerald-400/70 text-[10px]" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>

                          {role.requiresApproval && (
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-yellow-400/70">
                              <FaExclamationCircle className="text-[10px]" />
                              <span>Requires approval</span>
                            </div>
                          )}

                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FaArrowRight className="text-white/50" />
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    {/* Secondary Option (School) */}
                    <motion.button
                      custom={4}
                      variants={fadeUpVariants}
                      initial="hidden"
                      animate="visible"
                      onClick={() => handleRoleSelect('school')}
                      className={`group w-full p-4 rounded-xl border border-white/10 bg-white/[0.02] 
                                hover:border-purple-500/50 hover:bg-white/[0.04] transition-all duration-300
                                flex items-center gap-4 ${secondaryOption.bgGlow}`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${secondaryOption.gradient} 
                                    flex items-center justify-center shadow-md`}>
                        <secondaryOption.icon className="text-xl text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white">
                            {secondaryOption.title}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-medium">
                            Requires approval
                          </span>
                        </div>
                        <p className="text-xs text-white/50">{secondaryOption.description}</p>
                      </div>
                      <FaArrowRight className="text-white/30 group-hover:text-white/60 transition-colors" />
                    </motion.button>

                    {/* Sign In Link */}
                    <div className="mt-8 text-center">
                      <p className="text-white/50 text-sm">
                        Already have an account?{' '}
                        <Link
                          to="/login"
                          className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                        >
                          Sign In
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Signup Form */
              <motion.div
                key="signup-form"
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />

                <div className="relative z-10">
                  {/* Back Button */}
                  <button
                    onClick={handleBackToRoleSelect}
                    className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-6"
                  >
                    <FaArrowLeft className="text-sm" />
                    <span className="text-sm">Change role</span>
                  </button>

                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 mb-4">
                      <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center mr-2`}>
                        <roleInfo.icon className="text-white text-xs" />
                      </div>
                      <span className="text-xs font-medium text-white">{roleInfo.title}</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
                      Create Your Account
                    </h2>
                    {roleInfo.requiresApproval && (
                      <p className="text-yellow-400/80 text-xs flex items-center justify-center gap-1.5">
                        <FaExclamationCircle />
                        Account requires admin approval before full access
                      </p>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Google Signup Button */}
                  <motion.button
                    onClick={handleGoogleSignup}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-medium text-white 
                             bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] hover:border-white/20 
                             transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <FaGoogle className="text-lg" />
                    <span>Sign up with Google</span>
                  </motion.button>

                  {/* Divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-white/40 uppercase tracking-wider">or with email</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                        Full Name
                      </label>
                      <div className="relative">
                        <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your full name"
                          required
                          disabled={isLoading}
                          className="w-full rounded-xl bg-white/[0.03] pl-11 pr-4 py-3.5 border border-white/10 
                                   text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 
                                   focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                        Email
                      </label>
                      <div className="relative">
                        <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          disabled={isLoading}
                          className="w-full rounded-xl bg-white/[0.03] pl-11 pr-4 py-3.5 border border-white/10 
                                   text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 
                                   focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                        Password
                      </label>
                      <div className="relative">
                        <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          required
                          minLength={6}
                          disabled={isLoading}
                          className="w-full rounded-xl bg-white/[0.03] pl-11 pr-12 py-3.5 border border-white/10 
                                   text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 
                                   focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2 text-xs font-medium tracking-wide text-white/60 uppercase">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          required
                          disabled={isLoading}
                          className="w-full rounded-xl bg-white/[0.03] pl-11 pr-12 py-3.5 border border-white/10 
                                   text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 
                                   focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
                      )}
                    </div>

                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      className="group relative w-full rounded-xl py-3.5 font-semibold text-white overflow-hidden 
                               disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="relative flex items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Creating account...</span>
                          </>
                        ) : (
                          <>
                            <span>Create Account</span>
                            <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </span>
                    </motion.button>
                  </form>

                  {/* Sign In Link */}
                  <div className="mt-8 text-center">
                    <p className="text-white/50 text-sm">
                      Already have an account?{' '}
                      <Link
                        to="/login"
                        className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                      >
                        Sign In
                      </Link>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </FuturisticBackground>
  );
};
