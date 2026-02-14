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
    FaMoon,
    FaRocket,
    FaSchool,
    FaSun,
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
  const { login, loginWithGoogle, loginAsGuestStudent, user, profile, selectedRole, setSelectedRole } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

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
      navigate(getDefaultPage(profile.role));
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

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loginAsGuestStudent();
    } catch (err) {
      setError(err?.message || 'Could not start guest session. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <FuturisticBackground className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="fixed top-2 right-2 sm:top-4 sm:right-4 z-[100] flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-card/90 backdrop-blur-md text-foreground hover:bg-accent hover:border-primary/50 transition-colors shadow-lg"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <FaSun className="h-4 w-4 sm:h-5 sm:w-5" /> : <FaMoon className="h-4 w-4 sm:h-5 sm:w-5" />}
      </button>
      <div className="relative z-10 flex flex-1 min-h-0 w-full overflow-hidden py-2 sm:py-3">
        <div className="flex flex-col items-center justify-center flex-1 min-h-0 w-full px-3 sm:px-6">
      <div className="w-full max-w-lg flex flex-col flex-1 min-h-0 gap-1.5 sm:gap-2 justify-center max-h-[96dvh]">
        <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center shrink-0"
          >
            <h1 className="text-lg sm:text-xl font-bold text-foreground mb-0.5 font-display">
              Welcome to{' '}
              <span style={learnXRFontStyle} className="text-lg sm:text-xl tracking-[0.12rem]">
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol className="ml-1" />
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Immersive Education Platform</p>
          </motion.div>

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
                <Card className="w-full mx-auto relative rounded-2xl sm:rounded-3xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                  <div className="relative z-10 p-2.5 sm:p-3 pb-1.5 flex-1 min-h-0 flex flex-col">
                    <CardHeader className="p-0 pb-1.5 shrink-0">
                      <CardTitle className="text-base sm:text-lg text-center text-foreground">
                        How would you like to sign in?
                      </CardTitle>
                      <CardDescription className="text-center text-xs text-muted-foreground">
                        Select your role to continue
                      </CardDescription>
                    </CardHeader>
                    <div className="space-y-2 flex-1 min-h-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-stretch">
                      {roleOptions.map((role, index) => (
                        <motion.button
                          key={role.id}
                          type="button"
                          custom={index + 2}
                          variants={fadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          onClick={() => handleRoleSelect(role.id)}
                          className="group relative p-2.5 pr-8 rounded-xl border-2 border-border bg-card/50 text-left min-h-[4rem] sm:min-h-[4.5rem] hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 flex flex-col items-start h-full"
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-1 shrink-0 shadow-lg`}>
                            <role.icon className="text-sm sm:text-base text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground pr-2 group-hover:text-primary transition-colors">{role.title}</h3>
                          <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug text-left w-full min-w-0 break-words line-clamp-2">{role.description}</p>
                          <FaArrowRight className="absolute top-3 right-3 text-muted-foreground w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                        </motion.button>
                      ))}
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleRoleSelect('school')}
                      className="group w-full p-2.5 rounded-xl border-2 border-border bg-card/50 hover:border-primary/40 hover:bg-accent/50 transition-all duration-300 flex items-center gap-2.5 text-left shrink-0"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br ${secondaryOption.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                        <secondaryOption.icon className="text-sm sm:text-base text-white" />
                      </div>
                      <div className="text-left min-w-0 flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{secondaryOption.title}</h3>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">{secondaryOption.description}</p>
                      </div>
                      <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4 group-hover:opacity-100" aria-hidden />
                    </motion.button>

                    <Separator className="my-0.5 bg-border" />
                    <motion.button
                      type="button"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                      className="group w-full p-2.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all duration-300 flex items-center gap-2.5 text-left disabled:opacity-70 shrink-0"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-lg">
                        <FaRocket className="text-sm sm:text-base text-primary-foreground" />
                      </div>
                      <div className="text-left min-w-0 flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Explore as guest</h3>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">Try one lesson — no account or school code needed</p>
                      </div>
                      {isLoading ? (
                        <span className="animate-pulse text-sm text-muted-foreground shrink-0">Starting...</span>
                      ) : (
                        <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4" aria-hidden />
                      )}
                    </motion.button>
                    </div>
                  </div>
                  <div className="relative z-10 bg-muted/30 backdrop-blur-sm border-t border-border rounded-b-2xl sm:rounded-b-3xl p-1.5 sm:p-2 shrink-0">
                    <p className="text-muted-foreground text-center text-xs sm:text-sm">
                      Don't have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium hover:text-primary/90 text-xs sm:text-sm" asChild>
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
                <Card className="w-full max-w-sm mx-auto relative rounded-2xl sm:rounded-3xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden flex flex-col min-h-0 flex-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                  <div className="relative z-10 p-2.5 sm:p-3 pb-1.5 flex-1 min-h-0 flex flex-col">
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
                            className="pl-10 pr-4 rounded-xl border-border bg-card/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 focus-visible:border-primary/50"
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
                            className="pl-10 pr-12 rounded-xl border-border bg-card/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 focus-visible:border-primary/50"
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

                  <div className="relative z-10 bg-muted/30 backdrop-blur-sm border-t border-border rounded-b-2xl sm:rounded-b-3xl p-1.5 sm:p-2 shrink-0">
                    <p className="text-muted-foreground text-center text-xs sm:text-sm">
                      Don't have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium hover:text-primary/90 text-xs sm:text-sm" asChild>
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
