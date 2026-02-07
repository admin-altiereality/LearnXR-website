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
  FaEye,
  FaEyeSlash,
  FaRocket
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDefaultPage,
  hasCompletedOnboarding,
  isGuestUser,
  requiresApproval
} from '../../utils/rbac';
import { learnXRFontStyle, TrademarkSymbol } from '../LearnXRTypography';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import FlowFieldBackground from '../ui/flow-field-background';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('role-select');
  const { login, loginWithGoogle, loginAsGuestStudent, user, profile, selectedRole, setSelectedRole } = useAuth();
  const navigate = useNavigate();

  const roleOptions = [
    {
      id: 'student',
      icon: FaUserGraduate,
      title: 'Student',
      description: 'Access lessons and complete interactive quizzes',
      variant: 'emerald',
    },
    {
      id: 'teacher',
      icon: FaChalkboardTeacher,
      title: 'Teacher',
      description: 'Create and manage educational content',
      variant: 'blue',
    },
  ];

  const secondaryOption = {
    id: 'school',
    icon: FaSchool,
    title: 'School Administrator',
    description: 'Manage school-wide content and teachers',
    variant: 'slate',
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

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <FlowFieldBackground
        className="absolute inset-0 min-h-screen"
        color="#8b5cf6"
        trailOpacity={0.1}
        particleCount={400}
        speed={0.8}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 md:py-16">
      <div className="w-full max-w-lg flex flex-col gap-6 sm:gap-8">
        <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center shrink-0"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-display">
              Welcome to{' '}
              <span style={learnXRFontStyle} className="text-2xl sm:text-3xl tracking-[0.15rem]">
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol className="ml-1" />
              </span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Immersive Education Platform</p>
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
                <Card className="w-full mx-auto bg-card/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 rounded-[calc(var(--radius)+0.125rem)] overflow-hidden">
                  <div className="p-6 pb-5 sm:p-8 sm:pb-6">
                    <CardHeader className="p-0 pb-4 sm:pb-5">
                      <CardTitle className="text-xl sm:text-2xl text-center">
                        How would you like to sign in?
                      </CardTitle>
                      <CardDescription className="text-center mt-1.5">
                        Select your role to continue
                      </CardDescription>
                    </CardHeader>
                    <div className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {roleOptions.map((role, index) => (
                        <motion.div key={role.id} custom={index + 2} variants={fadeUpVariants} initial="hidden" animate="visible" className="min-w-0">
                          <Button
                            variant="outline"
                            className="relative h-auto w-full flex flex-col items-start p-5 sm:p-6 pr-12 rounded-lg text-left overflow-visible whitespace-normal"
                            onClick={() => handleRoleSelect(role.id)}
                          >
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-3 sm:mb-4 shrink-0">
                              <role.icon className="text-xl sm:text-2xl text-primary" />
                            </div>
                            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 pr-2 shrink-0">{role.title}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-snug text-left w-full min-w-0 break-words">{role.description}</p>
                            <FaArrowRight className="absolute top-4 right-4 text-muted-foreground w-4 h-4 shrink-0 pointer-events-none" aria-hidden />
                          </Button>
                        </motion.div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full h-auto min-h-[4.5rem] py-4 px-5 flex items-center gap-4 justify-between rounded-lg text-left"
                      onClick={() => handleRoleSelect('school')}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <secondaryOption.icon className="text-xl text-primary" />
                        </div>
                        <div className="text-left min-w-0">
                          <h3 className="text-base font-semibold text-foreground">{secondaryOption.title}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">{secondaryOption.description}</p>
                        </div>
                      </div>
                      <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4" aria-hidden />
                    </Button>

                    <Separator className="my-2 bg-border" />
                    <Button
                      variant="outline"
                      className="w-full h-auto min-h-[4rem] py-4 px-5 flex items-center gap-4 justify-center rounded-lg border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <FaRocket className="text-xl text-primary" />
                      </div>
                      <div className="text-center min-w-0">
                        <h3 className="text-base font-semibold text-foreground">Explore as guest</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Try one lesson — no account or school code needed</p>
                      </div>
                      {isLoading ? (
                        <span className="animate-pulse text-sm text-muted-foreground">Starting...</span>
                      ) : (
                        <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4" aria-hidden />
                      )}
                    </Button>
                    </div>
                  </div>
                  <div className="bg-muted/50 border-t border-white/10 rounded-b-[calc(var(--radius)+0.125rem)] p-3">
                    <p className="text-muted-foreground text-center text-sm">
                      Don't have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium" asChild>
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
                className="w-full min-w-0"
              >
                <Card className="w-full max-w-sm mx-auto bg-card/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 rounded-[calc(var(--radius)+0.125rem)] overflow-hidden">
                  <div className="p-6 pb-5 sm:p-8 sm:pb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                      onClick={handleBackToRoleSelect}
                    >
                      <FaArrowLeft className="mr-2 h-4 w-4" />
                      Change role
                    </Button>

                    <div className="mb-1 mt-2">
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted/80 border border-white/10 mb-4">
                        <span className="text-xs text-muted-foreground">Signing in as</span>
                        <span className="ml-2 text-xs font-medium text-primary">{getRoleDisplayName()}</span>
                      </div>
                      <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
                      <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                      >
                        {error}
                      </motion.div>
                    )}

                    <div className="mt-6 grid grid-cols-1 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                      >
                        <FaGoogle className="h-4 w-4" />
                        <span>Google</span>
                      </Button>
                    </div>

                    <hr className="my-4 border-dashed border-border" />

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm">Email</Label>
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
                            className="pl-10 pr-4 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm">Password</Label>
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
                            className="pl-10 pr-12 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
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

                      <div className="flex justify-end pt-1">
                        <Link
                          to="/forgot-password"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Forgot Password?
                        </Link>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="animate-pulse">Signing in...</span>
                        ) : (
                          <>
                            Sign In
                            <FaArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </div>

                  <div className="bg-muted/50 border-t border-white/10 rounded-b-[calc(var(--radius)+0.125rem)] p-3">
                    <p className="text-muted-foreground text-center text-sm">
                      Don't have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium" asChild>
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
  );
};
