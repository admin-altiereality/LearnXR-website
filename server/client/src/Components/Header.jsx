import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { db } from '../config/firebase';
import { useAuth, useModal } from '../contexts/AuthContext';
import { SUBSCRIPTION_PLANS, subscriptionService } from '../services/subscriptionService';
import Logo from "./Logo";
import SubscriptionModal from './SubscriptionModal';
import UpgradeModal from './UpgradeModal';

const Header = () => {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [profile, setProfile] = useState(null);

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
          setSubscription(userSubscription);
        } catch (error) {
          console.error('Error fetching profile/subscription:', error);
          toast.error('Failed to load subscription data');
        }
      }
    };

    fetchProfileAndSubscription();
  }, [user?.uid]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
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

  const isExploreActive = () => {
    return location.pathname.startsWith('/explore');
  };

  const getCurrentPlan = () => {
    if (!subscription) return null;
    return SUBSCRIPTION_PLANS.find(plan => plan.id === subscription.planId);
  };

  const getUsagePercentage = () => {
    if (!subscription || !getCurrentPlan()) return 0;
    const plan = getCurrentPlan();
    const used = subscription.usage?.skyboxGenerations || 0;
    const limit = plan?.limits.skyboxGenerations || 10;
    return limit === Infinity ? 0 : Math.min((used / limit) * 100, 100);
  };

  const getRemainingGenerations = () => {
    if (!subscription || !getCurrentPlan()) return 0;
    const plan = getCurrentPlan();
    const used = subscription.usage?.skyboxGenerations || 0;
    const limit = plan?.limits.skyboxGenerations || 10;
    return limit === Infinity ? '∞' : Math.max(0, limit - used);
  };

  // Get current usage for display
  const getCurrentUsage = () => {
    return subscription?.usage?.skyboxGenerations || 0;
  };

  // Get current limit for display
  const getCurrentLimit = () => {
    const plan = getCurrentPlan();
    return plan?.limits.skyboxGenerations || 10;
  };

  // Mobile nav links (including Careers and Blog)
  const mobileNavLinks = (
    <>
      <Link
        to="/main"
        className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActivePath('/main')
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        onClick={() => setShowMobileMenu(false)}
      >
        Create
      </Link>
      <Link
        to="/3d-generate"
        className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActivePath('/3d-generate')
            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-lg'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        onClick={() => setShowMobileMenu(false)}
      >
        3D Assets
      </Link>
      <Link
        to="/careers"
        className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActivePath('/careers')
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        onClick={() => setShowMobileMenu(false)}
      >
        Careers
      </Link>
      <Link
        to="/blog"
        className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActivePath('/blog')
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-lg'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        onClick={() => setShowMobileMenu(false)}
      >
        Blog
      </Link>
      <Link
        to="/explore"
        className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isExploreActive()
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-lg'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        onClick={() => setShowMobileMenu(false)}
      >
        Explore
      </Link>
      <Link
        to="/history"
        className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActivePath('/history')
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        onClick={() => setShowMobileMenu(false)}
      >
        History
      </Link>
    </>
  );

  // Mobile user actions
  const mobileUserActions = user ? (
    <>
      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
            {profile?.firstName?.[0] || user.email[0].toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-white">{profile?.firstName || user.email.split('@')[0]}</div>
            <div className="text-xs text-gray-400">{user.email}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${
            subscription?.planId === 'free' 
              ? 'bg-gray-700/50 text-gray-300' 
              : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30'
          }`}>
            {getCurrentPlan()?.name || 'Free'} Plan
          </span>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Generations Used</span>
          <span className="text-sm text-gray-300">
            {getCurrentUsage()}/{getCurrentLimit() === Infinity ? '∞' : getCurrentLimit()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Remaining</span>
          <span className="text-sm text-gray-300">
            {getRemainingGenerations()} {getCurrentLimit() === Infinity ? '' : 'left'}
          </span>
        </div>
        {getCurrentLimit() !== Infinity && (
          <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getUsagePercentage()}%` }}
            />
          </div>
        )}
        {subscription?.planId === 'free' && (
          <button
            onClick={handleUpgradeClick}
            className="w-full mt-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
          >
            Upgrade for Unlimited
          </button>
        )}
      </div>
      <div className="py-1 border-b border-gray-700/50">
        <Link
          to="/profile"
          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white"
          onClick={() => setShowMobileMenu(false)}
        >
          Profile Settings
        </Link>
        <Link
          to="/history"
          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white"
          onClick={() => setShowMobileMenu(false)}
        >
          Generation History
        </Link>
      </div>
      <div className="py-1">
        <button
          onClick={handleLogout}
          className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white"
        >
          Sign Out
        </button>
      </div>
    </>
  ) : (
    <Link
      to="/login"
      className="block w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 font-medium shadow-lg text-center mt-4"
      onClick={() => setShowMobileMenu(false)}
    >
      Sign In
    </Link>
  );

  return (
    <>
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50 sticky top-0 z-50">
        <nav className="container mx-auto flex items-center justify-between px-4 sm:px-6 py-4 relative">
          {/* Left Section - Logo */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
          </div>

          {/* Desktop Nav - hidden on mobile */}
          <div className="hidden md:flex items-center space-x-8">
            {user && (
              <div className="flex items-center space-x-1">
                <Link
                  to="/main"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isActivePath('/main')
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create</span>
                  </div>
                </Link>
                
                <Link
                  to="/3d-generate"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isActivePath('/3d-generate')
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span>3D Assets</span>
                  </div>
                </Link>
                
                <Link
                  to="/careers"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isActivePath('/careers')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                    </svg>
                    <span>Careers</span>
                  </div>
                </Link>
                
                <Link
                  to="/explore"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isExploreActive()
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Explore</span>
                  </div>
                </Link>

                <Link
                  to="/history"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isActivePath('/history')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>History</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Desktop User Actions - hidden on mobile */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                {/* Generation Counter */}
                <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm text-gray-300">
                      {getRemainingGenerations()} {getCurrentPlan()?.limits.skyboxGenerations === Infinity ? '' : 'left'}
                    </span>
                  </div>
                  {getCurrentPlan()?.limits.skyboxGenerations !== Infinity && (
                    <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${getUsagePercentage()}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Upgrade Button - Show for free plan users */}
                {subscription?.planId === 'free' && (
                  <button
                    onClick={handleUpgradeClick}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-purple-500/30 flex items-center space-x-2 font-medium shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>Upgrade</span>
                  </button>
                )}

                {/* User Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center space-x-3 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition-all duration-200 border border-gray-700/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                      {profile?.firstName?.[0] || user.email[0].toUpperCase()}
                    </div>
                    <span className="hidden md:block font-medium">{profile?.firstName || user.email.split('@')[0]}</span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl py-2 border border-gray-700/50">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-700/50">
                        <p className="text-sm text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                        <div className="mt-2 flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            subscription?.planId === 'free' 
                              ? 'bg-gray-700/50 text-gray-300' 
                              : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {getCurrentPlan()?.name || 'Free'} Plan
                          </span>
                        </div>
                      </div>

                      {/* Usage Stats */}
                      <div className="px-4 py-3 border-b border-gray-700/50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Generations Used</span>
                            <span className="text-sm text-gray-300">
                              {getCurrentUsage()}/{getCurrentLimit() === Infinity ? '∞' : getCurrentLimit()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Remaining</span>
                            <span className="text-sm text-gray-300">
                              {getRemainingGenerations()} {getCurrentLimit() === Infinity ? '' : 'left'}
                            </span>
                          </div>
                          {getCurrentLimit() !== Infinity && (
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${getUsagePercentage()}%`
                                }}
                              />
                            </div>
                          )}
                          {subscription?.planId === 'free' && (
                            <button
                              onClick={handleUpgradeClick}
                              className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                            >
                              Upgrade for Unlimited
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Profile Settings</span>
                          </div>
                        </Link>
                        <Link
                          to="/history"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Generation History</span>
                          </div>
                        </Link>
                      </div>

                      {/* Logout */}
                      <div className="py-1 border-t border-gray-700/50">
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign Out</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/careers"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isActivePath('/careers')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                    </svg>
                    <span>Careers</span>
                  </div>
                </Link>
                
                <Link
                  to="/blog"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                    isActivePath('/blog')
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Blog</span>
                  </div>
                </Link>
                
                <Link
                  to="/login"
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-500/30 font-medium shadow-lg"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Hamburger for mobile */}
          <div className="md:hidden flex items-center">
            <button
              aria-label="Open menu"
              aria-controls="mobile-menu"
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((prev) => !prev)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500"
            >
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div
              ref={mobileMenuRef}
              id="mobile-menu"
              className="absolute top-full left-0 w-full bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 shadow-2xl z-50 md:hidden animate-fade-in"
              role="menu"
              aria-label="Mobile navigation"
            >
              <div className="py-4 flex flex-col space-y-2">
                {mobileNavLinks}
                <div className="border-t border-gray-700/50 my-2" />
                {mobileUserActions}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Modals */}
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
