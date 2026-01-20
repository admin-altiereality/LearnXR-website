import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  FaClock, 
  FaEnvelope, 
  FaSignOutAlt, 
  FaCheck,
  FaChalkboardTeacher,
  FaSchool,
  FaUser,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaUserGraduate,
  FaExchangeAlt
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { 
  requiresApproval, 
  getDefaultPage,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  APPROVAL_STATUS_DISPLAY
} from '../utils/rbac';
import FuturisticBackground from '../Components/FuturisticBackground';
import { toast } from 'react-toastify';

const ApprovalPending = () => {
  const navigate = useNavigate();
  const { user, profile, logout, refreshProfile } = useAuth();
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      navigate('/login');
      return;
    }

    // Redirect if profile doesn't require approval
    if (profile && !requiresApproval(profile.role)) {
      navigate(getDefaultPage(profile.role));
      return;
    }

    // Redirect if already approved
    if (profile?.approvalStatus === 'approved') {
      navigate(getDefaultPage(profile.role));
      return;
    }
  }, [user, profile, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Switch to student role (only allowed when approval is pending)
  const handleSwitchToStudent = async () => {
    if (!user?.uid || profile?.approvalStatus !== 'pending') return;
    
    setSwitching(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: 'student',
        approvalStatus: null, // Students don't need approval
        previousRole: profile?.role, // Keep track of previous role
        roleSwitchedAt: new Date().toISOString(),
        onboardingCompleted: false, // Require student onboarding
      });
      
      toast.success('Switched to student account! Please complete your profile.');
      
      // Refresh profile and redirect to onboarding
      await refreshProfile();
      navigate('/onboarding');
    } catch (error) {
      console.error('Error switching role:', error);
      toast.error('Failed to switch role. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: 0.1 + i * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  const isRejected = profile?.approvalStatus === 'rejected';
  const RoleIcon = profile?.role === 'teacher' ? FaChalkboardTeacher : FaSchool;
  const roleColors = profile?.role ? ROLE_COLORS[profile.role] : ROLE_COLORS.teacher;

  return (
    <FuturisticBackground>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Header */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center mb-6">
              <div className={`w-20 h-20 rounded-2xl ${isRejected ? 'bg-red-500/20 border-red-500/30' : 'bg-yellow-500/20 border-yellow-500/30'} border-2 flex items-center justify-center shadow-lg`}>
                {isRejected ? (
                  <FaExclamationTriangle className="text-red-400 text-3xl" />
                ) : (
                  <FaClock className="text-yellow-400 text-3xl animate-pulse" />
                )}
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {isRejected ? 'Application Rejected' : 'Pending Approval'}
            </h1>
            <p className="text-white/60">
              {isRejected 
                ? 'Unfortunately, your application was not approved'
                : 'Your account is being reviewed by our admin team'}
            </p>
          </motion.div>

          {/* Main Card */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className={`relative rounded-3xl border ${isRejected ? 'border-red-500/20' : 'border-yellow-500/20'} bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${isRejected ? 'from-red-500/5' : 'from-yellow-500/5'} via-transparent to-violet-500/5 pointer-events-none`} />
            
            <div className="relative z-10">
              {/* Status Badge */}
              <div className="flex justify-center mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isRejected ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'} border`}>
                  {isRejected ? <FaExclamationTriangle className="text-sm" /> : <FaClock className="text-sm" />}
                  <span className="text-sm font-medium">
                    {isRejected ? 'Application Rejected' : 'Awaiting Review'}
                  </span>
                </div>
              </div>

              {/* Profile Card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-6">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${roleColors.bg} ${roleColors.border} border flex items-center justify-center flex-shrink-0`}>
                    <RoleIcon className={`text-xl ${roleColors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {profile?.name || profile?.displayName || 'User'}
                    </h3>
                    <p className="text-white/50 text-sm truncate">{profile?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${roleColors.bg} ${roleColors.text} ${roleColors.border} border`}>
                        {profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'User'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Section */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <FaCalendarAlt className="text-white/40 mt-0.5" />
                  <div>
                    <p className="text-white/80 text-sm font-medium">Account Created</p>
                    <p className="text-white/50 text-xs">
                      {profile?.createdAt 
                        ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Recently'}
                    </p>
                  </div>
                </div>
              </div>

              {/* What's Next Section */}
              {!isRejected && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-6">
                  <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <FaEnvelope className="text-cyan-400" />
                    What happens next?
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FaCheck className="text-emerald-400 text-xs" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm">Application Submitted</p>
                        <p className="text-white/40 text-xs">Your registration is complete</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                        <FaClock className="text-yellow-400 text-xs" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm">Under Review</p>
                        <p className="text-white/40 text-xs">Our admin team is reviewing your profile</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white/40 text-xs">3</span>
                      </div>
                      <div>
                        <p className="text-white/50 text-sm">Approval & Access</p>
                        <p className="text-white/30 text-xs">Once approved, you'll have full access</p>
                      </div>
                    </li>
                  </ul>
                </div>
              )}

              {/* Rejected Message */}
              {isRejected && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 mb-6">
                  <h3 className="text-base font-semibold text-red-400 mb-2">
                    Why was my application rejected?
                  </h3>
                  <p className="text-white/60 text-sm mb-4">
                    Your application may have been rejected for various reasons. Common reasons include:
                  </p>
                  <ul className="space-y-2 text-sm text-white/50">
                    <li>• Incomplete or invalid information</li>
                    <li>• Unable to verify credentials</li>
                    <li>• Duplicate account detected</li>
                  </ul>
                  <p className="text-white/60 text-sm mt-4">
                    If you believe this was a mistake, please contact our support team at{' '}
                    <a href="mailto:admin@altiereality.com" className="text-cyan-400 hover:text-cyan-300">
                      admin@altiereality.com
                    </a>
                  </p>
                </div>
              )}

              {/* Switch to Student Option (only for pending approval) */}
              {profile?.approvalStatus === 'pending' && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <FaUserGraduate className="text-emerald-400 text-xl" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white mb-1">
                        Want to start learning now?
                      </h3>
                      <p className="text-white/50 text-sm mb-3">
                        While waiting for approval, you can switch to a student account and start accessing lessons immediately.
                      </p>
                      <motion.button
                        onClick={handleSwitchToStudent}
                        disabled={switching}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 
                                 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {switching ? (
                          <>
                            <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                            <span>Switching...</span>
                          </>
                        ) : (
                          <>
                            <FaExchangeAlt />
                            <span>Switch to Student</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Support */}
              <div className="text-center mb-6">
                <p className="text-white/50 text-sm">
                  Questions? Contact us at{' '}
                  <a href="mailto:admin@altiereality.com" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                    admin@altiereality.com
                  </a>
                </p>
              </div>

              {/* Logout Button */}
              <motion.button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-medium text-white 
                         bg-white/[0.05] border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400
                         transition-all duration-300"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <FaSignOutAlt />
                <span>Sign Out</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Footer Note */}
          <motion.p
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="text-center text-white/30 text-xs mt-6"
          >
            This page will automatically update when your status changes.
          </motion.p>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default ApprovalPending;
