import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { subscriptionService, SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import SubscriptionModal from '../Components/SubscriptionModal';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'subscription'
  const [isEditing, setIsEditing] = useState(false);
  const [subscription, setSubscription] = useState(() => {
    const freePlan = SUBSCRIPTION_PLANS.find(plan => plan.id === 'free');
    return {
      planId: 'free',
      status: 'active',
      usage: {
        count: 0,
        limit: 10
      },
      features: freePlan?.features || [
        'Generate up to 10 skyboxes',
        'Basic styles available',
        'Standard quality output',
        'Community support'
      ]
    };
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    function: '',
    phoneNumber: '',
    email: user?.email || ''
  });

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const handleUpgradeClick = async (planId) => {
    try {
      // Razorpay integration will go here
      const options = {
        key: process.env.RAZORPAY_KEY_ID,
        amount: SUBSCRIPTION_PLANS.find(plan => plan.id === planId)?.price * 100,
        currency: "INR",
        name: "Skybox AI",
        description: `Upgrade to ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
        handler: async (response) => {
          console.log('Payment successful:', response);
          toast.success('Subscription upgraded successfully');
          // Refresh subscription data
          const userSubscription = await subscriptionService.getUserSubscription(user.uid);
          setSubscription(userSubscription);
        },
        prefill: {
          email: user.email,
          contact: profile?.phoneNumber
        },
        theme: {
          color: "#3B82F6"
        }
      };
      
      console.log('Upgrading to plan:', planId);
      // Razorpay initialization will go here
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment. Please try again.');
    }
  };

  useEffect(() => {
    const fetchProfileAndUsage = async () => {
      try {
        setLoading(true);
        
        // Fetch profile data
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
            email: profileData.email || user.email
          });
        }

        // Fetch subscription data
        const userSubscription = await subscriptionService.getUserSubscription(user.uid);
        if (userSubscription) {
          setSubscription(userSubscription);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load profile data');
        setLoading(false);
      }
    };

    if (user?.uid) {
      fetchProfileAndUsage();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        ...formData,
        updatedAt: new Date()
      });
      
      setProfile(prev => ({
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

  const renderSubscriptionContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30"
          >
            Retry
          </button>
        </div>
      );
    }

    const currentPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === subscription.planId) || SUBSCRIPTION_PLANS[0];

    return (
      <div className="space-y-6">
        <div className="bg-gray-800/30 rounded-lg p-6 backdrop-blur-sm border border-gray-700/50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium text-white">Current Plan</h3>
              <p className="text-sm text-gray-400">
                {currentPlan.name} Plan
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              subscription.usage.count >= subscription.usage.limit 
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : subscription.status === 'active'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
            }`}>
              {subscription.usage.count >= subscription.usage.limit ? 'LIMIT REACHED' : subscription.status.toUpperCase()}
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400">Skybox Generations</p>
              <div className="mt-2 relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-700/50">
                  <div
                    style={{ width: `${Math.min((subscription.usage.count / subscription.usage.limit) * 100, 100)}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      subscription.usage.count >= subscription.usage.limit 
                        ? 'bg-red-500/50'
                        : subscription.usage.count >= subscription.usage.limit * 0.8
                          ? 'bg-yellow-500/50'
                          : 'bg-blue-500/50'
                    }`}
                  ></div>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-400">
                    {subscription.usage.count} / {subscription.usage.limit} skyboxes generated
                  </p>
                  {subscription.usage.count >= subscription.usage.limit && (
                    <p className="text-xs text-red-400">Limit reached</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4">
              {subscription.usage.count >= subscription.usage.limit && subscription.planId === 'free' ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-400">
                    You've reached the free tier limit. Upgrade your plan to generate more skyboxes.
                  </p>
                  <button
                    onClick={() => setShowSubscriptionModal(true)}
                    className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30"
                  >
                    Upgrade Plan
                  </button>
                </div>
              ) : subscription.planId === 'free' ? (
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30"
                >
                  Upgrade for Unlimited Generations
                </button>
              ) : (
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30"
                >
                  Manage Subscription
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-800/30 rounded-lg p-6 backdrop-blur-sm border border-gray-700/50">
          <h3 className="text-lg font-medium text-white mb-4">Plan Features</h3>
          <ul className="space-y-3">
            {currentPlan.features.map((feature, index) => (
              <li key={index} className="flex items-center text-gray-300">
                <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-t-2 border-b-2 border-blue-400 rounded-full animate-spin"></div>
          <p className="text-blue-300">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900/40 backdrop-blur-md rounded-lg shadow-xl border border-gray-700/50">
          {/* Profile Header */}
          <div className="px-6 py-8 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Account Settings</h1>
                <p className="mt-1 text-sm text-gray-400">{user.email}</p>
              </div>
              {activeTab === 'profile' && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30"
                >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-700/50">
            <nav className="flex px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Profile Information
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`ml-8 py-4 px-4 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === 'subscription'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Subscription
              </button>
            </nav>
          </div>

          {/* Content Section */}
          <div className="p-6">
            {activeTab === 'profile' ? (
              isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-300">First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="mt-1 block w-full bg-gray-800/30 border border-gray-700/50 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        className="mt-1 block w-full bg-gray-800/30 border border-gray-700/50 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Company</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                        className="mt-1 block w-full bg-gray-800/30 border border-gray-700/50 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Function</label>
                      <input
                        type="text"
                        value={formData.function}
                        onChange={(e) => setFormData(prev => ({ ...prev, function: e.target.value }))}
                        className="mt-1 block w-full bg-gray-800/30 border border-gray-700/50 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        className="mt-1 block w-full bg-gray-800/30 border border-gray-700/50 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        disabled
                        className="mt-1 block w-full bg-gray-800/30 border border-gray-700/50 rounded-md shadow-sm py-2 px-3 text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">First Name</h3>
                    <p className="mt-1 text-white">{profile?.firstName || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Last Name</h3>
                    <p className="mt-1 text-white">{profile?.lastName || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Company</h3>
                    <p className="mt-1 text-white">{profile?.company || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Function</h3>
                    <p className="mt-1 text-white">{profile?.function || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Phone Number</h3>
                    <p className="mt-1 text-white">{profile?.phoneNumber || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Email</h3>
                    <p className="mt-1 text-white">{profile?.email}</p>
                  </div>
                </div>
              )
            ) : (
              renderSubscriptionContent()
            )}
          </div>
        </div>
      </div>
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        currentSubscription={subscription}
        onUpgrade={handleUpgradeClick}
      />
    </div>
  );
};

export default Profile; 