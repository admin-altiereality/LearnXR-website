import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
    FaArrowLeft,
    FaArrowRight,
    FaChalkboardTeacher,
    FaEnvelope,
    FaEye,
    FaEyeSlash,
    FaGoogle,
    FaLock,
    FaRocket,
    FaSchool,
    FaUserGraduate
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import {
    getDefaultPage,
    hasCompletedOnboarding,
    isGuestUser,
    requiresApproval
} from '../../utils/rbac';
import { isMetaQuestBrowser } from '../../utils/vrDetection';
import { learnXRFontStyle, TrademarkSymbol } from '../LearnXRTypography';
import { Button } from '../ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import FuturisticBackground from '../FuturisticBackground';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('role-select');
  const [isVRDevice, setIsVRDevice] = useState(false);
  const { login, loginWithGoogle, user, profile, selectedRole, setSelectedRole } = useAuth();
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  useEffect(() => {
    setIsVRDevice(isMetaQuestBrowser());
  }, []);

  const roleOptions = [
    {
      id: 'student',
      icon: FaUserGraduate,
      title: 'Student',
      description: 'Access lessons and complete interactive quizzes',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'teacher',
      icon: FaChalkboardTeacher,
      title: 'Teacher',
      description: 'Create and manage educational content',
      gradient: 'from-blue-500 to-indigo-600',
    },
  ];

  const secondaryOption = {
    id: 'school',
    icon: FaSchool,
    title: 'School Administrator',
    description: 'Manage school-wide content and teachers',
    gradient: 'from-purple-500 to-violet-600',
  };

  useEffect(() => {
    const handleRedirect = async () => {
      if (!user || !profile) return;
      if (!hasCompletedOnboarding(profile)) {
        navigate('/onboarding');
        return;
      }
      if (!isGuestUser(profile) && requiresApproval(profile.role) && profile.approvalStatus === 'pending') {
        navigate('/approval-pending');
        return;
      }
      navigate(getDefaultPage(profile.role, profile));
    };
    handleRedirect();
  }, [user, profile, navigate]);

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setStep('login-form');
  };

  const handleBackToRoleSelect = () => {
    setStep('role-select');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setError('');
      await login(email, password);
    } catch (err) {
      setError('Failed to login. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      setError('');
      await loginWithGoogle(selectedRole);
    } catch (err) {
      setError('Failed to login with Google. ' + err.message);
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

  const getRoleDisplayName = () => {
    const role = roleOptions.find(r => r.id === selectedRole) ||
      (selectedRole === 'school' ? secondaryOption : null);
    return role?.title || 'User';
  };

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  // Login and onboarding: dark mode only, no toggle
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  const compact = isVRDevice;
  return (
    <FuturisticBackground className="min-h-[100dvh] w-screen flex flex-col overflow-x-hidden">
      <div className={`relative z-10 flex flex-1 w-full min-h-0 ${compact ? 'py-2' : 'py-4 sm:py-6 md:py-8'}`}>
        <div className={`flex flex-col md:flex-row md:items-center md:justify-center flex-1 min-h-0 w-full gap-6 md:gap-10 lg:gap-14 ${compact ? 'px-3' : 'px-4 sm:px-6 md:px-8'}`}>
          {/* Welcome / branding: top on mobile, left column on desktop */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className={`shrink-0 text-center md:text-left ${compact ? 'mb-0' : 'mb-2 md:mb-0'}`}
          >
            <h1 className={`font-bold text-foreground font-display ${compact ? 'text-base' : 'text-xl sm:text-2xl md:text-3xl mb-1'}`}>
              Welcome to{' '}
              <span style={learnXRFontStyle} className={compact ? 'text-base' : 'text-xl sm:text-2xl md:text-3xl tracking-[0.12rem]'}>
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol className="ml-1" />
              </span>
            </h1>
            <p className={compact ? 'text-[10px] text-muted-foreground' : 'text-sm text-muted-foreground'}>Immersive Education Platform</p>
          </motion.div>

          <div className={`w-full flex flex-col flex-1 min-h-0 justify-center ${compact ? 'max-w-md' : 'max-w-md sm:max-w-lg md:max-w-xl'} mx-auto md:mx-0`}>
          <AnimatePresence mode="wait">
            {step === 'role-select' ? (
              <motion.div
                key="role-select"
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full min-w-0"
              >
                <Card className={`w-full relative border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden flex flex-col ${compact ? 'rounded-xl' : 'rounded-2xl sm:rounded-3xl'}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                  <div className={`relative z-10 flex flex-col ${compact ? 'p-2.5 pb-1' : 'p-4 sm:p-5 md:p-6 pb-2'}`}>
                    <CardHeader className="p-0 pb-3 sm:pb-4 shrink-0">
                      <CardTitle className={`text-foreground ${compact ? 'text-sm' : 'text-lg sm:text-xl'}`}>
                        How would you like to sign in?
                      </CardTitle>
                      <CardDescription className={`text-muted-foreground mt-1 ${compact ? 'text-[10px]' : 'text-sm'}`}>
                        Select your role to continue
                      </CardDescription>
                    </CardHeader>
                    <div className={compact ? 'space-y-1.5' : 'space-y-3 sm:space-y-4'}>
                    <div className={`grid grid-cols-1 items-stretch ${compact ? 'gap-1.5 sm:grid-cols-2' : 'sm:grid-cols-2 gap-3 sm:gap-4'}`}>
                      {roleOptions.map((role, index) => (
                        <motion.button
                          key={role.id}
                          type="button"
                          custom={index + 2}
                          variants={fadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          onClick={() => handleRoleSelect(role.id)}
                          className={`group relative rounded-xl border-2 border-border bg-card/50 text-left hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 flex flex-col items-start h-full ${compact ? 'p-2.5 pr-7 min-h-[3.5rem]' : 'p-3 sm:p-4 pr-9 min-h-[4.5rem] sm:min-h-[5rem]'}`}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-1.5 shrink-0 shadow-lg`}>
                            <role.icon className="text-base text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground pr-2 group-hover:text-primary transition-colors">{role.title}</h3>
                          <p className="text-xs text-muted-foreground leading-snug text-left w-full min-w-0 break-words line-clamp-2">{role.description}</p>
                          <FaArrowRight className="absolute top-3 right-3 text-muted-foreground w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                        </motion.button>
                      ))}
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleRoleSelect('school')}
                      className={`group w-full rounded-xl border-2 border-border bg-card/50 hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 flex items-center gap-3 text-left shrink-0 ${compact ? 'p-2.5' : 'p-3 sm:p-4'}`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br ${secondaryOption.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                        <secondaryOption.icon className="text-base text-white" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{secondaryOption.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">{secondaryOption.description}</p>
                      </div>
                      <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4 group-hover:opacity-100" aria-hidden />
                    </motion.button>
                    </div>
                  </div>
                  <div className={`relative z-10 bg-muted/30 backdrop-blur-sm border-t border-border rounded-b-2xl sm:rounded-b-3xl shrink-0 ${compact ? 'p-2' : 'p-3 sm:p-4'}`}>
                    <p className="text-muted-foreground text-center text-sm">
                      Don't have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium hover:text-primary/90 text-sm" asChild>
                        <Link to="/signup">Create Account</Link>
                      </Button>
                    </p>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full min-w-0 flex-1 min-h-0 flex flex-col"
              >
                <Card className="w-full mx-auto relative rounded-2xl sm:rounded-3xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                  <div className={`relative z-10 flex flex-col ${compact ? 'p-2.5 pb-1.5' : 'p-4 sm:p-5 md:p-6 pb-2'}`}>
                    <button
                      type="button"
                      onClick={handleBackToRoleSelect}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-2 -ml-1 text-xs shrink-0"
                    >
                      <FaArrowLeft className="h-3.5 w-3.5" />
                      Change role
                    </button>

                    <div className="mb-1 shrink-0">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted/80 border border-border mb-1.5">
                        <span className="text-[11px] text-muted-foreground">Signing in as</span>
                        <span className="ml-1.5 text-[11px] font-medium text-primary">{getRoleDisplayName()}</span>
                      </div>
                      <h1 className="text-lg font-semibold text-foreground">Welcome back</h1>
                      <p className="text-xs text-muted-foreground mt-0.5">Enter your credentials to continue</p>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0"
                      >
                        {error}
                      </motion.div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <motion.button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-medium bg-card border-2 border-border text-foreground hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <FaGoogle className="h-5 w-5" />
                        <span>Continue with Google</span>
                      </motion.button>
                    </div>

                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or with email</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-2 flex-1 min-h-0 flex flex-col min-h-0">
                      <div className="space-y-1.5">
                        <Label htmlFor="login-email" className="text-xs">Email</Label>
                        <div className="relative">
                          <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            disabled={isLoading}
                            className="pl-10 pr-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="login-password" className="text-xs">Password</Label>
                        <div className="relative">
                          <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            disabled={isLoading}
                            className="pl-10 pr-12 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full w-10 min-w-[2.5rem] px-3 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-end pt-0.5">
                        <Link
                          to="/forgot-password"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Forgot Password?
                        </Link>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        className="relative w-full rounded-xl py-3 font-semibold text-sm text-primary-foreground overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:opacity-95 transition-opacity shrink-0"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="relative flex items-center justify-center gap-2">
                          {isLoading ? (
                            <span className="animate-pulse">Signing in...</span>
                          ) : (
                            <>
                              <span>Sign In</span>
                              <FaArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </span>
                      </motion.button>
                    </form>
                  </div>

                  <div className={`relative z-10 bg-muted/30 backdrop-blur-sm border-t border-border rounded-b-2xl sm:rounded-b-3xl shrink-0 ${compact ? 'p-2' : 'p-3 sm:p-4'}`}>
                    <p className="text-muted-foreground text-center text-sm">
                      Don't have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium hover:text-primary/90 text-sm" asChild>
                        <Link to="/signup">Create Account</Link>
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
