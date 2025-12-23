import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  FaRocket, 
  FaCube, 
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
  FaStar,
  FaBuilding,
  FaUserGraduate,
  FaUser,
  FaUsers,
  FaGamepad,
  FaFilm,
  FaPaintBrush,
  FaVrCardboard,
  FaEnvelope,
  FaBell,
  FaChartLine
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import FuturisticBackground from '../Components/FuturisticBackground';

interface OnboardingData {
  userType: 'company' | 'student' | 'individual' | '';
  teamSize: string;
  usageType: string[];
  newsletterSubscription: boolean;
  onboardingCompleted: boolean;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFreePlan } = useSubscription();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<OnboardingData>({
    userType: '',
    teamSize: '',
    usageType: [],
    newsletterSubscription: true,
    onboardingCompleted: false
  });

  const totalSteps = 3;

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.onboardingCompleted) {
            navigate('/main');
            return;
          }
          if (userData.userType || userData.teamSize || userData.usageType) {
            setFormData(prev => ({
              ...prev,
              userType: userData.userType || '',
              teamSize: userData.teamSize || '',
              usageType: userData.usageType || [],
              newsletterSubscription: userData.newsletterSubscription ?? true
            }));
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, navigate]);

  const userTypes = [
    {
      id: 'company',
      icon: FaBuilding,
      title: 'Company',
      description: 'Business or organization looking for 3D solutions',
      gradient: 'from-violet-500 to-purple-600'
    },
    {
      id: 'student',
      icon: FaUserGraduate,
      title: 'Student',
      description: 'Learning and exploring 3D design',
      gradient: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'individual',
      icon: FaUser,
      title: 'Individual',
      description: 'Freelancer or hobbyist creator',
      gradient: 'from-amber-500 to-orange-600'
    }
  ];

  const teamSizes = [
    { id: '1', label: 'Just me' },
    { id: '2-5', label: '2-5 people' },
    { id: '6-20', label: '6-20 people' },
    { id: '21-50', label: '21-50 people' },
    { id: '51-200', label: '51-200 people' },
    { id: '200+', label: '200+ people' }
  ];

  const usageTypes = [
    {
      id: 'game-development',
      icon: FaGamepad,
      title: 'Game Development',
      description: 'Creating assets for games'
    },
    {
      id: 'film-animation',
      icon: FaFilm,
      title: 'Film & Animation',
      description: 'Video production & motion graphics'
    },
    {
      id: 'art-design',
      icon: FaPaintBrush,
      title: 'Art & Design',
      description: 'Digital art and creative projects'
    },
    {
      id: 'ar-vr',
      icon: FaVrCardboard,
      title: 'AR/VR Experiences',
      description: 'Immersive virtual experiences'
    },
    {
      id: 'marketing',
      icon: FaChartLine,
      title: 'Marketing & Ads',
      description: 'Commercial and promotional content'
    },
    {
      id: 'other',
      icon: FaCube,
      title: 'Other',
      description: 'Something else entirely'
    }
  ];

  const handleUserTypeSelect = (type: 'company' | 'student' | 'individual') => {
    setFormData(prev => ({ ...prev, userType: type }));
  };

  const handleTeamSizeSelect = (size: string) => {
    setFormData(prev => ({ ...prev, teamSize: size }));
  };

  const handleUsageTypeToggle = (usageId: string) => {
    setFormData(prev => {
      const currentUsage = prev.usageType;
      if (currentUsage.includes(usageId)) {
        return { ...prev, usageType: currentUsage.filter(id => id !== usageId) };
      } else {
        return { ...prev, usageType: [...currentUsage, usageId] };
      }
    });
  };

  const handleNewsletterToggle = () => {
    setFormData(prev => ({ ...prev, newsletterSubscription: !prev.newsletterSubscription }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.userType !== '';
      case 2:
        if (formData.userType === 'company') {
          return formData.teamSize !== '';
        }
        return formData.usageType.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user?.uid) return;

    setSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const updateData = {
        userType: formData.userType,
        teamSize: formData.userType === 'company' ? formData.teamSize : null,
        usageType: formData.usageType,
        newsletterSubscription: formData.newsletterSubscription,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (userDoc.exists()) {
        await updateDoc(userDocRef, updateData);
      } else {
        await setDoc(userDocRef, {
          ...updateData,
          email: user.email,
          createdAt: new Date().toISOString()
        });
      }

      toast.success('Welcome aboard! Let\'s create something amazing.');
      navigate('/main');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate('/main');
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.2 + i * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  if (loading) {
    return (
      <FuturisticBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      </FuturisticBackground>
    );
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Tell us about yourself
              </h2>
              <p className="text-white/50">
                This helps us personalize your experience
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {userTypes.map((type) => (
                <motion.button
                  key={type.id}
                  onClick={() => handleUserTypeSelect(type.id as 'company' | 'student' | 'individual')}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group ${
                    formData.userType === type.id
                      ? 'border-sky-500/70 bg-sky-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {formData.userType === type.id && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center">
                      <FaCheck className="text-white text-xs" />
                    </div>
                  )}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <type.icon className="text-2xl text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{type.title}</h3>
                  <p className="text-white/50 text-sm">{type.description}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {formData.userType === 'company' ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                    How big is your team?
                  </h2>
                  <p className="text-white/50">
                    We'll recommend the best plan for your organization
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {teamSizes.map((size) => (
                    <motion.button
                      key={size.id}
                      onClick={() => handleTeamSizeSelect(size.id)}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                        formData.teamSize === size.id
                          ? 'border-violet-500/70 bg-violet-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {formData.teamSize === size.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                          <FaCheck className="text-white text-xs" />
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <FaUsers className="text-violet-400" />
                        <span className="text-white font-medium">{size.label}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-semibold text-white mb-4 text-center">
                    What will you use In3D.ai for?
                  </h3>
                  <p className="text-white/50 text-center mb-6 text-sm">
                    Select all that apply
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {usageTypes.map((usage) => (
                      <motion.button
                        key={usage.id}
                        onClick={() => handleUsageTypeToggle(usage.id)}
                        className={`relative p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                          formData.usageType.includes(usage.id)
                            ? 'border-fuchsia-500/70 bg-fuchsia-500/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {formData.usageType.includes(usage.id) && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center">
                            <FaCheck className="text-white text-xs" />
                          </div>
                        )}
                        <usage.icon className="text-xl text-fuchsia-400 mb-2" />
                        <h4 className="text-white font-medium text-sm">{usage.title}</h4>
                        <p className="text-white/40 text-xs mt-1">{usage.description}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                    What will you create?
                  </h2>
                  <p className="text-white/50">
                    Select all the ways you plan to use In3D.ai
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {usageTypes.map((usage) => (
                    <motion.button
                      key={usage.id}
                      onClick={() => handleUsageTypeToggle(usage.id)}
                      className={`relative p-5 rounded-xl border-2 transition-all duration-300 text-left ${
                        formData.usageType.includes(usage.id)
                          ? 'border-fuchsia-500/70 bg-fuchsia-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {formData.usageType.includes(usage.id) && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center">
                          <FaCheck className="text-white text-xs" />
                        </div>
                      )}
                      <usage.icon className="text-2xl text-fuchsia-400 mb-3" />
                      <h4 className="text-white font-semibold">{usage.title}</h4>
                      <p className="text-white/40 text-sm mt-1">{usage.description}</p>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Stay in the loop
              </h2>
              <p className="text-white/50">
                Get the latest updates, tips, and exclusive content
              </p>
            </div>

            <motion.div
              className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                formData.newsletterSubscription
                  ? 'border-sky-500/70 bg-sky-500/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaEnvelope className="text-2xl text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">Newsletter Subscription</h3>
                  <p className="text-white/50 text-sm mb-4">
                    Receive weekly updates on new features, 3D creation tips, and exclusive tutorials delivered straight to your inbox.
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Feature Updates
                    </span>
                    <span className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      Pro Tips
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Tutorials
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleNewsletterToggle}
                  className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${
                    formData.newsletterSubscription ? 'bg-sky-500' : 'bg-white/20'
                  }`}
                >
                  <motion.div
                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md"
                    animate={{ x: formData.newsletterSubscription ? 28 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </motion.div>

            {/* Summary */}
            <div className="mt-8 p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FaRocket className="text-sky-400" />
                Your Profile Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    {formData.userType === 'company' && <FaBuilding className="text-violet-400" />}
                    {formData.userType === 'student' && <FaUserGraduate className="text-emerald-400" />}
                    {formData.userType === 'individual' && <FaUser className="text-amber-400" />}
                  </div>
                  <span className="text-white/80 capitalize">{formData.userType}</span>
                  {formData.userType === 'company' && formData.teamSize && (
                    <span className="text-white/40">• {teamSizes.find(s => s.id === formData.teamSize)?.label}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                    <FaCube className="text-fuchsia-400" />
                  </div>
                  <span className="text-white/80">
                    {formData.usageType.length > 0 
                      ? formData.usageType.map(id => usageTypes.find(u => u.id === id)?.title).join(', ')
                      : 'No usage selected'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <FaBell className={formData.newsletterSubscription ? 'text-sky-400' : 'text-white/30'} />
                  </div>
                  <span className={formData.newsletterSubscription ? 'text-sky-300' : 'text-white/40'}>
                    {formData.newsletterSubscription ? 'Subscribed to newsletter' : 'Not subscribed'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <FuturisticBackground>
      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-4xl mx-auto">
          {/* Logo & Welcome Badge */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.4)]">
                <FaCube className="text-white text-xl" />
              </div>
              <span className="text-2xl font-bold text-white">In3D.ai</span>
            </div>
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]">
              <FaRocket className="text-rose-400 mr-2" />
              <span className="text-white/60 text-sm">
                Welcome, {user?.email?.split('@')[0] || 'User'}!
              </span>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/50">Step {step} of {totalSteps}</span>
              <button
                onClick={handleSkip}
                className="text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Skip for now
              </button>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500"
                initial={{ width: 0 }}
                animate={{ width: `${(step / totalSteps) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>

          {/* Form Card */}
          <motion.div
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden"
          >
            {/* Card glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
            
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between mt-10 pt-6 border-t border-white/10"
              >
                <button
                  onClick={handleBack}
                  disabled={step === 1}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                    step === 1
                      ? 'opacity-0 pointer-events-none'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] text-white/70 border border-white/10'
                  }`}
                >
                  <FaArrowLeft />
                  Back
                </button>

                {step < totalSteps ? (
                  <motion.button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className={`group relative flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all duration-300 overflow-hidden ${
                      canProceed()
                        ? 'text-white'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
                    whileHover={canProceed() ? { scale: 1.02 } : {}}
                    whileTap={canProceed() ? { scale: 0.98 } : {}}
                  >
                    {canProceed() && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </>
                    )}
                    <span className="relative">Continue</span>
                    <FaArrowRight className="relative group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="group relative flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={!submitting ? { scale: 1.02 } : {}}
                    whileTap={!submitting ? { scale: 0.98 } : {}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {submitting ? (
                      <>
                        <div className="relative animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="relative">Saving...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative">Get Started</span>
                        <FaRocket className="relative" />
                      </>
                    )}
                  </motion.button>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Free Plan Info */}
          {isFreePlan && (
            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="mt-8 p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm"
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <FaStar className="text-amber-400" />
                <h3 className="text-lg font-semibold text-amber-300">
                  Free Plan Active
                </h3>
              </div>
              <div className="space-y-2 text-left max-w-md mx-auto">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <FaCheck className="text-emerald-400" />
                  <span>5 generations per month</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <FaCheck className="text-emerald-400" />
                  <span>1 asset per generation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <FaCheck className="text-emerald-400" />
                  <span>Community support</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/pricing')}
                className="mt-4 w-full py-2 rounded-xl border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors text-sm"
              >
                View upgrade options
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default Onboarding;
