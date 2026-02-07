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
  hasCompletedOnboarding
} from '../../utils/rbac';
import { learnXRFontStyle, TrademarkSymbol } from '../LearnXRTypography';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import FlowFieldBackground from '../ui/flow-field-background';

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

  const roleOptions = [
    {
      id: 'student',
      icon: FaUserGraduate,
      title: 'Student',
      description: 'Access lessons and complete interactive quizzes',
      features: ['Access all lessons', 'Interactive quizzes', 'Track your progress', 'Certificate on completion'],
      requiresApproval: false,
    },
    {
      id: 'teacher',
      icon: FaChalkboardTeacher,
      title: 'Teacher',
      description: 'Create and manage educational content',
      features: ['Create lessons & courses', 'Manage student progress', 'Analytics dashboard', 'Content studio access'],
      requiresApproval: true,
    },
  ];

  const secondaryOption = {
    id: 'school',
    icon: FaSchool,
    title: 'School Administrator',
    description: 'Manage school-wide content and teachers',
    features: ['Multi-teacher management', 'School-wide analytics', 'Custom branding', 'API access'],
    requiresApproval: true,
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
              Join{' '}
              <span style={learnXRFontStyle} className="text-2xl sm:text-3xl tracking-[0.15rem]">
                <span className="text-foreground">Learn</span>
                <span className="text-primary">XR</span>
                <TrademarkSymbol className="ml-1" />
              </span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Start your immersive learning journey</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 'role-select' ? (
              <motion.div key="role-select" custom={1} variants={fadeUpVariants} initial="hidden" animate="visible" exit="exit" className="w-full min-w-0">
                <Card className="w-full mx-auto bg-card/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 rounded-[calc(var(--radius)+0.125rem)] overflow-hidden">
                  <div className="p-6 pb-5 sm:p-8 sm:pb-6">
                    <CardHeader className="p-0 pb-4 sm:pb-5">
                      <CardTitle className="text-xl sm:text-2xl text-center">Choose Your Role</CardTitle>
                      <CardDescription className="text-center mt-1.5">Select how you'll be using LearnXR</CardDescription>
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
                            <ul className="space-y-1.5 w-full min-w-0">
                              {role.features.slice(0, 2).map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <FaCheck className="text-primary text-[10px] shrink-0 mt-0.5" />
                                  <span className="min-w-0 break-words">{feature}</span>
                                </li>
                              ))}
                            </ul>
                            {role.requiresApproval && (
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400 shrink-0">
                                <FaExclamationCircle className="text-[10px] shrink-0" />
                                <span>Requires approval</span>
                              </div>
                            )}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground">{secondaryOption.title}</h3>
                            <Badge variant="secondary" className="text-[10px]">Requires approval</Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">{secondaryOption.description}</p>
                        </div>
                      </div>
                      <FaArrowRight className="text-muted-foreground shrink-0 w-4 h-4" aria-hidden />
                    </Button>

                    </div>
                  </div>
                  <div className="bg-muted/50 border-t border-white/10 rounded-b-[calc(var(--radius)+0.125rem)] p-3">
                    <p className="text-muted-foreground text-center text-sm">
                      Already have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium" asChild>
                        <Link to="/login">Sign In</Link>
                      </Button>
                    </p>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="signup-form" custom={1} variants={fadeUpVariants} initial="hidden" animate="visible" exit="exit" className="w-full min-w-0">
                <Card className="w-full max-w-sm mx-auto bg-card/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 rounded-[calc(var(--radius)+0.125rem)] overflow-hidden">
                  <div className="p-6 pb-5 sm:p-8 sm:pb-6">
                    <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground" onClick={handleBackToRoleSelect}>
                      <FaArrowLeft className="mr-2 h-4 w-4" />
                      Change role
                    </Button>

                    <div className="mb-1 mt-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/80 border border-white/10 mb-4">
                        <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                          <roleInfo.icon className="text-primary text-xs" />
                        </div>
                        <span className="text-xs font-medium text-foreground">{roleInfo.title}</span>
                      </div>
                      <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
                      <p className="text-sm text-muted-foreground mt-1">Welcome! Create an account to get started</p>
                      {roleInfo.requiresApproval && (
                        <p className="text-amber-400 text-xs flex items-center justify-center gap-1.5 mt-2">
                          <FaExclamationCircle />
                          Account requires admin approval before full access
                        </p>
                      )}
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
                        onClick={handleGoogleSignup}
                        disabled={isLoading}
                      >
                        <FaGoogle className="h-4 w-4" />
                        <span>Google</span>
                      </Button>
                    </div>

                    <hr className="my-4 border-dashed border-border" />

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

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Creating account...' : <>Continue <FaArrowRight className="ml-2 h-4 w-4" /></>}
                      </Button>
                    </form>
                  </div>

                  <div className="bg-muted/50 border-t border-white/10 rounded-b-[calc(var(--radius)+0.125rem)] p-3">
                    <p className="text-muted-foreground text-center text-sm">
                      Already have an account?{' '}
                      <Button variant="link" className="px-1 h-auto text-primary font-medium" asChild>
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
  );
};
