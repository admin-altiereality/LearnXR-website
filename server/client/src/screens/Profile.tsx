import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUser, 
  FaEnvelope, 
  FaBuilding, 
  FaBriefcase, 
  FaPhone, 
  FaEdit, 
  FaCheck, 
  FaTimes,
  FaCrown,
  FaChartLine,
  FaCheckCircle,
  FaArrowRight,
  FaStar,
  FaShieldAlt,
  FaRocket,
  FaCreditCard,
  FaCalendarAlt,
  FaExternalLinkAlt,
  FaGlobe
} from 'react-icons/fa';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { SUBSCRIPTION_PLANS, subscriptionService } from '../services/subscriptionService';
// @ts-ignore - UpgradeModal is a JSX file
import UpgradeModal from '../Components/UpgradeModal';

const Profile = () => {
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading, isFreePlan, refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    function: '',
    phoneNumber: '',
    email: user?.email || ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) return;
      
      try {
        setLoading(true);
        
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setProfile(profileData);
          setFormData({
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            company: profileData.company || '',
            function: profileData.function || '',
            phoneNumber: profileData.phoneNumber || '',
            email: profileData.email || user.email || ''
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load profile data');
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    
    try {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        ...formData,
        updatedAt: new Date()
      });
      
      setProfile((prev: any) => ({
        ...prev,
        ...formData
      }));
      
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    }
  };

  const handleManageBilling = async () => {
    if (!subscription) return;
    
    setIsLoadingPortal(true);
    
    try {
      const portalUrl = await subscriptionService.getBillingPortalUrl(user?.uid || '');
      
      if (portalUrl) {
        // Paddle - open customer portal
        window.open(portalUrl, '_blank');
      } else if (subscription.provider === 'razorpay') {
        // Razorpay doesn't have a portal - show our management UI
        toast.info('Use the options below to manage your subscription');
      } else {
        toast.error('Unable to open billing portal. Please contact support.');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !user?.uid) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.'
    );
    
    if (!confirmed) return;
    
    setIsCancelling(true);
    
    try {
      await subscriptionService.cancelSubscription(user.uid, true);
      toast.success('Your subscription has been scheduled for cancellation at the end of the billing period.');
      await refreshSubscription();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription. Please contact support.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    if (profile?.firstName) {
      return profile.firstName[0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  const getPlanBadgeStyles = () => {
    if (!subscription) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    const planId = subscription.planId;
    switch (planId) {
      case 'pro':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'team':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'enterprise':
        return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const getUsagePercentage = () => {
    if (!subscription) return 0;
    const used = subscription.usage?.skyboxGenerations || 0;
    const limit = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId)?.limits.skyboxGenerations || 5;
    if (limit === Infinity) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getCurrentUsage = () => {
    return subscription?.usage?.skyboxGenerations || 0;
  };

  const getCurrentLimit = () => {
    if (!subscription) return 5;
    const limit = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId)?.limits.skyboxGenerations || 5;
    return limit === Infinity ? '∞' : limit;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getProviderLabel = () => {
    if (!subscription?.provider) return 'Standard';
    return subscription.provider === 'razorpay' ? 'Razorpay (India)' : 'Paddle (International)';
  };

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-cyan-500 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-sm sm:text-base text-red-400 mb-4 break-words">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-red-500/20 hover:bg-red-600/30 text-red-300 rounded-lg sm:rounded-xl transition-all border border-red-500/30 active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === subscription?.planId) || SUBSCRIPTION_PLANS[0];

  return (
    <div className="min-h-screen bg-transparent py-8 sm:py-12 md:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none rounded-xl sm:rounded-2xl" />
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
              {/* Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg shadow-cyan-500/20 flex-shrink-0">
                {getInitials()}
              </div>
              
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2 truncate">
                  {profile?.firstName && profile?.lastName
                    ? `${profile.firstName} ${profile.lastName}`
                    : profile?.firstName || user?.email?.split('@')[0] || 'User'}
                </h1>
                <p className="text-sm sm:text-base text-gray-400 flex items-center gap-2 truncate">
                  <FaEnvelope className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </p>
                <div className="mt-2 sm:mt-3">
                  <span className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider border ${getPlanBadgeStyles()}`}>
                    {subscription?.planId === 'free' ? (
                      <>
                        <FaStar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        Free Plan
                      </>
                    ) : (
                      <>
                        <FaCrown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {currentPlan.name} Plan
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {activeTab === 'profile' && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                {isEditing ? (
                  <>
                    <FaTimes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-sm sm:text-base">Cancel</span>
                  </>
                ) : (
                  <>
                    <FaEdit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-sm sm:text-base">Edit Profile</span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="border-b border-[#262626]">
            <nav className="flex overflow-x-auto scrollbar-hide" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('profile')}
                className={`relative py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'profile'
                    ? 'text-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <FaUser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Profile Information</span>
                  <span className="sm:hidden">Profile</span>
                </span>
                {activeTab === 'profile' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500"
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`relative py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'subscription'
                    ? 'text-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <FaCrown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Subscription
                </span>
                {activeTab === 'subscription' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500"
                  />
                )}
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 md:p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' ? (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <FaUser className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            First Name
                          </label>
                          <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <FaUser className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                            placeholder="Enter last name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <FaBuilding className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            Company
                          </label>
                          <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                            placeholder="Enter company name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <FaBriefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            Function
                          </label>
                          <input
                            type="text"
                            value={formData.function}
                            onChange={(e) => setFormData(prev => ({ ...prev, function: e.target.value }))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                            placeholder="Enter your function"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <FaPhone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <FaEnvelope className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            Email
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a]/50 border border-[#2a2a2a] text-gray-400 cursor-not-allowed backdrop-blur-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 sm:pt-6">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] hover:bg-[#222] text-gray-300 border border-[#2a2a2a] transition-all duration-300 active:scale-95"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                        >
                          <FaCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          Save Changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 sm:grid-cols-2">
                      {[
                        { icon: FaUser, label: 'First Name', value: profile?.firstName || 'Not set' },
                        { icon: FaUser, label: 'Last Name', value: profile?.lastName || 'Not set' },
                        { icon: FaBuilding, label: 'Company', value: profile?.company || 'Not set' },
                        { icon: FaBriefcase, label: 'Function', value: profile?.function || 'Not set' },
                        { icon: FaPhone, label: 'Phone Number', value: profile?.phoneNumber || 'Not set' },
                        { icon: FaEnvelope, label: 'Email', value: user?.email || 'Not set' }
                      ].map((field, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-cyan-500/30 transition-all duration-300"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 mb-2">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                              <field.icon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                            </div>
                            <h3 className="text-xs sm:text-sm font-medium text-gray-400 truncate">{field.label}</h3>
                          </div>
                          <p className="text-sm sm:text-base text-white font-medium break-words">{field.value}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="subscription"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Current Plan Card */}
                  <div className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.05] via-transparent to-purple-500/[0.05] pointer-events-none" />
                    <div className="relative">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-2">
                            <FaCrown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />
                            <span className="truncate">Current Plan</span>
                          </h3>
                          <p className="text-sm sm:text-base text-gray-400 truncate">{currentPlan.name} Plan</p>
                        </div>
                        <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold uppercase tracking-wider border flex-shrink-0 ${getPlanBadgeStyles()}`}>
                          {subscription?.status === 'active' ? 'Active' : 
                           subscription?.status === 'past_due' ? 'Past Due' :
                           subscription?.status === 'canceled' ? 'Cancelled' : 'Inactive'}
                        </span>
                      </div>

                      {/* Billing Info */}
                      {!isFreePlan && subscription && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                          <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]">
                            <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm mb-1">
                              <FaCalendarAlt className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">Renewal Date</span>
                            </div>
                            <p className="text-sm sm:text-base text-white font-medium break-words">
                              {subscription.cancelAtPeriodEnd 
                                ? `Ends: ${formatDate(subscription.currentPeriodEnd)}`
                                : formatDate(subscription.currentPeriodEnd)}
                            </p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]">
                            <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm mb-1">
                              <FaCreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">Payment Provider</span>
                            </div>
                            <p className="text-sm sm:text-base text-white font-medium break-words">{getProviderLabel()}</p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm mb-1">
                              <FaGlobe className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">Status</span>
                            </div>
                            <p className="text-sm sm:text-base text-white font-medium">
                              {subscription.cancelAtPeriodEnd ? (
                                <span className="text-amber-400">Cancelling at period end</span>
                              ) : (
                                <span className="text-green-400">Active</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Usage Stats */}
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2 gap-2">
                            <span className="text-xs sm:text-sm text-gray-400 flex items-center gap-1.5 sm:gap-2">
                              <FaChartLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">Generations Used</span>
                            </span>
                            <span className="text-xs sm:text-sm text-gray-300 tabular-nums flex-shrink-0">
                              {getCurrentUsage()} / {getCurrentLimit() === '∞' ? '∞' : getCurrentLimit()}
                            </span>
                          </div>
                          <div className="w-full h-2.5 sm:h-3 rounded-full bg-[#1a1a1a] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${getUsagePercentage()}%` }}
                              transition={{ duration: 0.5 }}
                              className={`h-full rounded-full ${
                                getUsagePercentage() > 80
                                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 sm:mt-6 space-y-3">
                          {isFreePlan ? (
                            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/30">
                              <p className="text-xs sm:text-sm text-amber-300 mb-3">
                                Upgrade to unlock unlimited generations and premium features!
                              </p>
                              <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="w-full px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
                              >
                                <FaRocket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                Upgrade Plan
                                <FaArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Manage Billing Button */}
                              <button
                                onClick={handleManageBilling}
                                disabled={isLoadingPortal}
                                className="w-full px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 font-semibold transition-all duration-300 border border-cyan-500/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoadingPortal ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-cyan-300"></div>
                                    <span>Loading...</span>
                                  </>
                                ) : (
                                  <>
                                    <FaCreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="truncate">Manage Billing</span>
                                    <FaExternalLinkAlt className="w-3 h-3 flex-shrink-0" />
                                  </>
                                )}
                              </button>

                              {/* Change Plan Button */}
                              <button
                                onClick={() => navigate('/pricing')}
                                className="w-full px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-[#1a1a1a] hover:bg-[#222] text-gray-300 font-semibold transition-all duration-300 border border-[#2a2a2a] flex items-center justify-center gap-2 active:scale-95"
                              >
                                <FaCrown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="truncate">Change Plan</span>
                              </button>

                              {/* Cancel Subscription Button */}
                              {!subscription?.cancelAtPeriodEnd && (
                                <button
                                  onClick={handleCancelSubscription}
                                  disabled={isCancelling}
                                  className="sm:col-span-2 w-full px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold transition-all duration-300 border border-red-500/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isCancelling ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-red-400"></div>
                                      <span>Cancelling...</span>
                                    </>
                                  ) : (
                                    <>
                                      <FaTimes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      <span>Cancel Subscription</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Plan Features */}
                  <div className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-6 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/[0.05] via-transparent to-cyan-500/[0.05] pointer-events-none" />
                    <div className="relative">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                        <FaShieldAlt className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                        <span>Plan Features</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {currentPlan.features.map((feature, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-start gap-2 sm:gap-3 p-3 rounded-lg sm:rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-cyan-500/30 transition-all duration-300"
                          >
                            <FaCheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm sm:text-base text-gray-300 break-words">{feature}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative h-full flex items-center justify-center p-3 sm:p-4">
            <UpgradeModal
              isOpen={showUpgradeModal}
              onClose={() => setShowUpgradeModal(false)}
              currentPlan={subscription?.planId || 'free'}
              onSubscriptionUpdate={refreshSubscription}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
