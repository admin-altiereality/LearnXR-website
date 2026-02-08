import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
    FaArrowLeft,
    FaArrowRight,
    FaChalkboardTeacher,
    FaCheck,
    FaEnvelope,
    FaExclamationCircle,
    FaEye,
    FaEyeSlash,
    FaGoogle,
    FaLock,
    FaMoon,
    FaSchool,
    FaSun,
    FaUser,
    FaUserGraduate
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import {
    hasCompletedOnboarding,
    requiresApproval
} from '../../utils/rbac';
import { learnXRFontStyle, TrademarkSymbol } from '../LearnXRTypography';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import FuturisticBackground from '../FuturisticBackground';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('role-select');
  const { signup, loginWithGoogle, user, profile, selectedRole, setSelectedRole } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const roleOptions = [
    {
      id: 'student',
      icon: FaUserGraduate,
      title: 'Student',
      description: 'Access lessons and complete interactive quizzes',
      features: ['Access all lessons', 'Interactive quizzes', 'Track your progress', 'Certificate on completion'],
      requiresApproval: false,
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'teacher',
      icon: FaChalkboardTeacher,
      title: 'Teacher',
      description: 'Create and manage educational content',
      features: ['Create lessons & courses', 'Manage student progress', 'Analytics dashboard', 'Content studio access'],
      requiresApproval: true,
      gradient: 'from-blue-500 to-indigo-600',
    },
  ];

  const secondaryOption = {
    id: 'school',
    icon: FaSchool,
    title: 'School Administrator',
    description: 'Manage school-wide content and teachers',
    features: ['Multi-teacher management', 'School-wide analytics', 'Custom branding', 'API access'],
    requiresApproval: true,
    gradient: 'from-purple-500 to-violet-600',
  };

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
    } catch (err) {
      setError('Failed to create account. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      setError('');
      await loginWithGoogle(selectedRole);
    } catch (err) {
      setError('Failed to sign up with Google. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.25, 0.4, 0.25, 1] },
    }),
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
  };

  const getRoleInfo = () => {
    return roleOptions.find(r => r.id === selectedRole) ||
      (selectedRole === 'school' ? secondaryOption : roleOptions[0]);
  };

  const roleInfo = getRoleInfo();

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  return (
    <FuturisticBackground className="h-screen w-full flex flex-col">
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-4 right-4 z-[100] flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/90 backdrop-blur-md text-foreground hover:bg-accent hover:border-primary/50 transition-colors shadow-lg"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <FaSun className="h-5 w-5" /> : <FaMoon className="h-5 w-5" />}
      </button>
      <div className="relative z-10 flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center justify-center min-h-full w-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="w-full max-w-lg flex flex-col gap-4 sm:gap-5 shrink-0">
        <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center shrink-0 mb-0.5"
          >
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 font-display">
              Join{' '}
              <span style={learnXRFontStyle} className="text-xl sm:text-2xl tracking-[0.12rem]">
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol className="ml-1" />
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Start your immersive learning journey</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 'role-select' ? (
              <motion.div key="role-select" custom={1} variants={fadeUpVariants} initial="hidden" animate="visible" exit="exit" className="w-full min-w-0">
                <Card className="w-full mx-auto relative rounded-3xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                  <div className="relative z-10 p-4 sm:p-5 pb-4">
                    <CardHeader className="p-0 pb-3">
                      <CardTitle className="text-lg sm:text-xl text-center text-foreground">Choose Your Role</CardTitle>
                      <CardDescription className="text-center mt-1 text-sm text-muted-foreground">Select how you'll be using LearnXR</CardDescription>
                    </CardHeader>
                    <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {roleOptions.map((role, index) => (
                        <motion.button
                          key={role.id}
                          type="button"
                          custom={index + 2}
                          variants={fadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          onClick={() => handleRoleSelect(role.id)}
                          className="group relative p-4 pr-10 rounded-2xl border-2 border-border bg-card/50 text-left min-h-[8.5rem] hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 flex flex-col items-start w-full"
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-2 shrink-0 shadow-lg`}>
                            <role.icon className="text-lg text-white" />
                          </div>
                          <h3 className="text-base font-semibold text-foreground mb-0.5 pr-2 group-hover:text-primary transition-colors">{role.title}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-snug text-left w-full min-w-0 break-words">{role.description}</p>
                          <ul className="space-y-1 w-full min-w-0 mt-1">
                            {role.features.slice(0, 2).map((feature, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <FaCheck className="text-primary text-[10px] shrink-0 mt-0.5" />
                                <span className="min-w-0 break-words">{feature}</span>
                              </li>
                            ))}
                          </ul>
                          {role.requiresApproval && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500 shrink-0">
                              <FaExclamationCircle className="text-[10px] shrink-0" />
                              <span>Requires approval</span>
                            </div>
                          )}
                          <FaArrowRight className="absolute top-3 right-3 text-muted-foreground w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                        </motion.button>
                      ))}
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleRoleSelect('school')}
                      className="group w-full p-4 rounded-xl border-2 border-border bg-card/50 hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 flex items-center gap-4 text-left"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${secondaryOption.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                        <secondaryOption.icon className="text-lg text-white" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{secondaryOption.title}</h3>
                          <Badge variant="secondary" className="text-[10px]">Requires approval</Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">{secondaryOption.description}</p>
                      </div>
                      <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4 group-hover:opacity-100" aria-hidden />
                    </motion.button>

                    </div>
                  </div>
                  <div className="relative z-10 bg-muted/30 backdrop-blur-sm border-t border-border rounded-b-3xl p-2.5 sm:p-3">
                    <p className="text-muted-foreground text-center text-sm">
                      Already have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium hover:text-primary/90" asChild>
                        <Link to="/login">Sign In</Link>
                      </Button>
                    </p>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="signup-form" custom={1} variants={fadeUpVariants} initial="hidden" animate="visible" exit="exit" className="w-full min-w-0">
                <Card className="w-full max-w-sm mx-auto relative rounded-3xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                  <div className="relative z-10 p-4 sm:p-5 pb-4">
                    <button type="button" onClick={handleBackToRoleSelect} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 -ml-2 text-sm">
                      <FaArrowLeft className="h-4 w-4" />
                      Change role
                    </button>

                    <div className="mb-1 mt-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/80 border border-border mb-4">
                        <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${roleInfo.gradient || 'from-primary to-primary/80'} flex items-center justify-center shrink-0`}>
                          <roleInfo.icon className="text-white text-xs" />
                        </div>
                        <span className="text-xs font-medium text-foreground">{roleInfo.title}</span>
                      </div>
                      <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
                      <p className="text-sm text-muted-foreground mt-1">Welcome! Create an account to get started</p>
                      {roleInfo.requiresApproval && (
                        <p className="text-amber-500 text-xs flex items-center justify-center gap-1.5 mt-2">
                          <FaExclamationCircle />
                          Account requires admin approval before full access
                        </p>
                      )}
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                      >
                        {error}
                      </motion.div>
                    )}

                    <div className="mt-6 grid grid-cols-1 gap-3">
                      <motion.button
                        type="button"
                        onClick={handleGoogleSignup}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-medium bg-card border-2 border-border text-foreground hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <FaGoogle className="h-5 w-5" />
                        <span>Continue with Google</span>
                      </motion.button>
                    </div>

                    <div className="flex items-center gap-4 my-6">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">or with email</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="text-sm">Full name</Label>
                        <div className="relative">
                          <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="signup-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            disabled={isLoading}
                            className="pl-10 pr-4 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-sm">Email</Label>
                        <div className="relative">
                          <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="signup-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            disabled={isLoading}
                            className="pl-10 pr-4 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-sm">Password</Label>
                        <div className="relative">
                          <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="signup-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            required
                            minLength={6}
                            disabled={isLoading}
                            className="pl-10 pr-12 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                          />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 min-w-[2.5rem] px-3 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm" className="text-sm">Confirm password</Label>
                        <div className="relative">
                          <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="signup-confirm"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                            disabled={isLoading}
                            className="pl-10 pr-12 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                          />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 min-w-[2.5rem] px-3 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                            {showConfirmPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <p className="text-xs text-destructive">Passwords do not match</p>
                        )}
                      </div>

                      <motion.button type="submit" disabled={isLoading} className="relative w-full rounded-xl py-3.5 font-semibold text-primary-foreground overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:opacity-95 transition-opacity" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <span className="relative flex items-center justify-center gap-2">
                          {isLoading ? 'Creating account...' : <><span>Continue</span><FaArrowRight className="h-4 w-4" /></>}
                        </span>
                      </motion.button>
                    </form>
                  </div>

                  <div className="relative z-10 bg-muted/30 backdrop-blur-sm border-t border-border rounded-b-3xl p-2.5 sm:p-3">
                    <p className="text-muted-foreground text-center text-sm">
                      Already have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium hover:text-primary/90" asChild>
                        <Link to="/login">Sign In</Link>
                      </Button>
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
        </div>
      </div>
    </FuturisticBackground>
  );
};
