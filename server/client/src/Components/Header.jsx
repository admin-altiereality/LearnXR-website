import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/AuthContext';
import SubscriptionModal from './SubscriptionModal';
import { subscriptionService } from '../services/subscriptionService';
import { razorpayService } from '../services/razorpayService';
import { SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Logo from "./Logo";
import UpgradeModal from './UpgradeModal';

const Header = () => {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showExploreDropdown, setShowExploreDropdown] = useState(false);

  useEffect(() => {
    const fetchProfileAndSubscription = async () => {
      if (user?.uid) {
        try {
          // Fetch profile data
          const profileRef = doc(db, 'users', user.uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data());
          }

          // Fetch subscription data
          const userSubscription = await subscriptionService.getUserSubscription(user.uid);
          console.log('Fetched subscription:', userSubscription);
          setSubscription(userSubscription);
        } catch (error) {
          console.error('Error fetching profile/subscription:', error);
          toast.error('Failed to load subscription data');
        }
      }
    };

    fetchProfileAndSubscription();
  }, [user?.uid]);

  // Debug log for subscription changes
  useEffect(() => {
    console.log('Current subscription state:', subscription);
  }, [subscription]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleUpgradeClick = async () => {
    try {
      if (!user || !user.email) {
        toast.error('Please sign in to upgrade your plan');
        return;
      }

      setShowUpgradeModal(true);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error handling upgrade:', error);
      toast.error('Failed to process upgrade. Please try again.');
    }
  };

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  // Debug log for render conditions
  console.log('Render conditions:', {
    userExists: !!user,
    subscriptionExists: !!subscription,
    isPlanFree: subscription?.planId === 'free'
  });

  return (
    <>
      <header className="bg-gray-900/40 backdrop-blur-sm border-b border-gray-800/50 sticky top-0 z-40">
        <nav className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
            
            {user && (
              <div className="flex items-center space-x-4">
                <Link
                  to="/main"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActivePath('/main')
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Generate
                </Link>
                
                <Link
                  to="/explore"
                  className={`group relative px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActivePath('/explore')
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                  onMouseEnter={() => setShowExploreDropdown(true)}
                  onMouseLeave={() => setShowExploreDropdown(false)}
                >
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Explore</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>

                  {/* Explore Dropdown */}
                  {showExploreDropdown && (
                    <div 
                      className="absolute left-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-md rounded-lg shadow-lg py-1 border border-gray-700/50"
                      onMouseEnter={() => setShowExploreDropdown(true)}
                      onMouseLeave={() => setShowExploreDropdown(false)}
                    >
                      <div className="py-1">
                        <Link
                          to="/explore/gallery"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Featured Gallery</span>
                          </div>
                        </Link>

                        <Link
                          to="/explore/styles"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            <span>Style Categories</span>
                          </div>
                        </Link>

                        <Link
                          to="/explore/tutorials"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <span>Tutorials & Resources</span>
                          </div>
                        </Link>

                        <Link
                          to="/explore/community"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>Community Showcase</span>
                          </div>
                        </Link>

                        <div className="border-t border-gray-700/50 my-1"></div>

                        <Link
                          to="/explore/trending"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span>Trending Now</span>
                          </div>
                        </Link>
                      </div>
                    </div>
                  )}
                </Link>

                {/* Upgrade Button - Show for free plan users */}
                {subscription?.planId === 'free' && (
                  <button
                    onClick={handleUpgradeClick}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 text-white rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-purple-500/30 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>Upgrade</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition-all duration-200"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                        {profile?.firstName?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <span className="hidden md:block">{profile?.firstName || user.email.split('@')[0]}</span>
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-md rounded-lg shadow-lg py-1 border border-gray-700/50">
                      <div className="px-4 py-3 border-b border-gray-700">
                        <p className="text-sm text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                      </div>

                      <div className="px-4 py-3 border-b border-gray-700/50">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Name</p>
                            <p className="text-sm text-white">{profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Company</p>
                            <p className="text-sm text-white">{profile?.company || 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Function</p>
                            <p className="text-sm text-white">{profile?.function || 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Phone</p>
                            <p className="text-sm text-white">{profile?.phoneNumber || 'Not set'}</p>
                          </div>
                        </div>
                        <Link
                          to="/profile"
                          className="mt-3 block text-center text-sm text-blue-400 hover:text-blue-300"
                          onClick={() => setShowDropdown(false)}
                        >
                          Edit Profile
                        </Link>
                      </div>

                      {subscription?.planId === 'free' && (
                        <div className="px-4 py-3 border-b border-gray-700/50">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Free Plan</span>
                              <span className="text-sm text-gray-400">
                                {subscription.usage.count}/{subscription.usage.limit} generations
                              </span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(subscription.usage.count / subscription.usage.limit) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="py-1">
                        <Link
                          to="/history"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                          onClick={() => setShowDropdown(false)}
                        >
                          History
                        </Link>
                        <Link
                          to="/updates"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                          onClick={() => setShowDropdown(false)}
                        >
                          Updates
                        </Link>
                      </div>

                      <div className="py-1 border-t border-gray-700">
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          Log Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="px-6 py-2 bg-gradient-to-r from-blue-500/50 to-purple-600/50 hover:from-blue-600/60 hover:to-purple-700/60 text-white rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-500/30"
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>

      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]">
        <div className="pointer-events-auto">
          <SubscriptionModal
            isOpen={showSubscriptionModal}
            onClose={() => setShowSubscriptionModal(false)}
            currentSubscription={subscription}
            onUpgrade={handleUpgradeClick}
          />
        </div>
      </div>

      {/* Modal Container */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[9999] isolate">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative h-full flex items-center justify-center">
            <UpgradeModal
              isOpen={showUpgradeModal}
              onClose={() => setShowUpgradeModal(false)}
              currentPlan={subscription?.planId || 'free'}
              onSubscriptionUpdate={(updatedSubscription) => setSubscription(updatedSubscription)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
