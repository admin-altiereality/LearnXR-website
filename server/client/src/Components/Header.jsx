/**
 * Header - Glassmorphism Navigation Header
 * 
 * Modern, sleek header with:
 * - Glassmorphism backdrop blur effect
 * - Soft shadows and smooth transitions
 * - Clean minimal aesthetic matching the Create page
 */

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
          const profileRef = doc(db, 'users', user.uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data());
          }

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

  const getCurrentUsage = () => {
    return subscription?.usage?.skyboxGenerations || 0;
  };

  const getCurrentLimit = () => {
    const plan = getCurrentPlan();
    return plan?.limits.skyboxGenerations || 5;
  };

  const getPlanBadgeStyles = () => {
    const planId = subscription?.planId || 'free';
    switch (planId) {
      case 'pro':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'enterprise':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  // Navigation Links Component
  const NavLink = ({ to, label, icon, isActive, activeColor = 'sky' }) => {
    const colorClasses = {
      sky: 'bg-sky-500/20 text-sky-300 border-sky-500/30 shadow-sky-500/10',
      orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30 shadow-orange-500/10',
      emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10',
      purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-purple-500/10',
    };

    return (
      <Link
        to={to}
        className={`
          px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
          flex items-center gap-2
          ${isActive 
            ? `${colorClasses[activeColor]} border shadow-lg` 
            : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }
        `}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          {/* Glassmorphism container - removed overflow-hidden to allow dropdown to show */}
          <nav className="
            relative
            backdrop-blur-xl
            bg-[#141414]/90
            border border-[#262626]
            rounded-2xl
            shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            px-5 py-3
          ">
            {/* Subtle gradient overlay - contained within nav with its own overflow handling */}
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none rounded-2xl overflow-hidden" />
            
            <div className="relative flex items-center justify-between">
              {/* Left Section - Logo & Nav */}
              <div className="flex items-center gap-6">
                {/* Logo with traffic lights */}
                <Link to="/" className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  </div>
                  <Logo />
                </Link>

                {/* Desktop Navigation */}
                {user && (
                  <div className="hidden lg:flex items-center gap-1">
                    <NavLink
                      to="/main"
                      label="Create"
                      isActive={isActivePath('/main')}
                      activeColor="sky"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      }
                    />
                    <NavLink
                      to="/3d-generate"
                      label="3D Assets"
                      isActive={isActivePath('/3d-generate')}
                      activeColor="orange"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      }
                    />
                    <NavLink
                      to="/explore"
                      label="Explore"
                      isActive={isExploreActive()}
                      activeColor="purple"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      }
                    />
                    <NavLink
                      to="/history"
                      label="History"
                      isActive={isActivePath('/history')}
                      activeColor="emerald"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    />
                  </div>
                )}
              </div>

              {/* Right Section - User Actions */}
              <div className="hidden md:flex items-center gap-3">
                {user ? (
                  <>
                    {/* Usage Stats Pill */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
                      <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getPlanBadgeStyles()}`}>
                          {getCurrentPlan()?.name || 'Free'} Plan
                        </span>
                      </div>
                      
                      {getCurrentPlan()?.limits.skyboxGenerations !== Infinity && (
                        <div className="flex items-center gap-2 pl-3 border-l border-[#333]">
                          <div className="w-20 h-1.5 rounded-full bg-[#252525] overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${
                                getUsagePercentage() > 80 
                                  ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                                  : 'bg-gradient-to-r from-emerald-500 to-sky-400'
                              }`}
                              style={{ width: `${getUsagePercentage()}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                            {getCurrentUsage()}/{getCurrentLimit()} used
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Upgrade Button */}
                    {subscription?.planId === 'free' && (
                      <button
                        onClick={handleUpgradeClick}
                        className="
                          flex items-center gap-2
                          px-4 py-2 rounded-xl
                          bg-gradient-to-r from-violet-500 to-purple-600
                          hover:from-violet-400 hover:to-purple-500
                          text-white text-xs font-semibold uppercase tracking-wider
                          shadow-lg shadow-purple-500/25
                          transition-all duration-300
                          hover:shadow-purple-500/40 hover:scale-[1.02]
                          border border-purple-400/20
                        "
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Upgrade</span>
                      </button>
                    )}

                    {/* User Profile Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="
                          flex items-center gap-3 
                          px-3 py-2 
                          bg-[#1a1a1a] hover:bg-[#222] 
                          border border-[#2a2a2a] hover:border-[#3a3a3a]
                          rounded-xl 
                          transition-all duration-300
                        "
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-sky-500/20">
                          {profile?.firstName?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <span className="hidden lg:block text-sm font-medium text-gray-200">
                          {profile?.firstName || user.email.split('@')[0]}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown Menu - positioned with higher z-index to show above everything */}
                      {showDropdown && (
                        <div className="
                          absolute right-0 mt-2 w-80 
                          backdrop-blur-xl bg-[#141414]/95 
                          border border-[#2a2a2a]
                          rounded-2xl 
                          shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                          py-2 
                          overflow-hidden
                          z-[100]
                        ">
                          {/* User Info */}
                          <div className="px-4 py-4 border-b border-[#2a2a2a]">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white text-lg font-semibold shadow-lg shadow-sky-500/20">
                                {profile?.firstName?.[0] || user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {profile?.firstName || user.email.split('@')[0]}
                                </p>
                                <p className="text-xs text-gray-400 truncate max-w-[180px]">{user.email}</p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${getPlanBadgeStyles()}`}>
                                {getCurrentPlan()?.name || 'Free'} Plan
                              </span>
                            </div>
                          </div>

                          {/* Usage Stats */}
                          <div className="px-4 py-4 border-b border-[#2a2a2a] space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">Generations</span>
                              <span className="text-xs text-gray-200 tabular-nums">
                                {getCurrentUsage()} / {getCurrentLimit() === Infinity ? '∞' : getCurrentLimit()}
                              </span>
                            </div>
                            {getCurrentLimit() !== Infinity && (
                              <div className="h-2 rounded-full bg-[#252525] overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 rounded-full ${
                                    getUsagePercentage() > 80 
                                      ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                                      : 'bg-gradient-to-r from-emerald-500 to-sky-400'
                                  }`}
                                  style={{ width: `${getUsagePercentage()}%` }}
                                />
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">Remaining</span>
                              <span className="text-xs text-emerald-400 font-medium">
                                {getRemainingGenerations()} {getCurrentLimit() === Infinity ? '' : 'left'}
                              </span>
                            </div>
                            {subscription?.planId === 'free' && (
                              <button
                                onClick={handleUpgradeClick}
                                className="
                                  w-full mt-2 px-4 py-2.5 
                                  bg-gradient-to-r from-violet-500 to-purple-600 
                                  hover:from-violet-400 hover:to-purple-500 
                                  text-white text-xs font-semibold uppercase tracking-wider
                                  rounded-xl transition-all duration-300
                                  shadow-lg shadow-purple-500/20
                                "
                              >
                                Upgrade for More
                              </button>
                            )}
                          </div>

                          {/* Menu Items */}
                          <div className="py-2">
                            <Link
                              to="/profile"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>Profile Settings</span>
                            </Link>
                            <Link
                              to="/history"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Generation History</span>
                            </Link>
                            <Link
                              to="/careers"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span>Careers</span>
                            </Link>
                            <Link
                              to="/blog"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>Blog</span>
                            </Link>
                          </div>

                          {/* Logout */}
                          <div className="pt-2 border-t border-[#2a2a2a]">
                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <NavLink
                      to="/careers"
                      label="Careers"
                      isActive={isActivePath('/careers')}
                      activeColor="emerald"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      }
                    />
                    <NavLink
                      to="/blog"
                      label="Blog"
                      isActive={isActivePath('/blog')}
                      activeColor="purple"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      }
                    />
                    <Link
                      to="/login"
                      className="
                        flex items-center gap-2
                        px-5 py-2.5 rounded-xl
                        bg-gradient-to-r from-sky-500 to-indigo-600
                        hover:from-sky-400 hover:to-indigo-500
                        text-white text-sm font-semibold
                        shadow-lg shadow-sky-500/25
                        transition-all duration-300
                        hover:shadow-sky-500/40 hover:scale-[1.02]
                        border border-sky-400/20
                      "
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign In</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <div className="md:hidden">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="
                    p-2 rounded-xl 
                    bg-[#1a1a1a] border border-[#2a2a2a]
                    text-gray-400 hover:text-white
                    transition-colors
                  "
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showMobileMenu ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            {showMobileMenu && (
              <div 
                ref={mobileMenuRef}
                className="md:hidden mt-4 pt-4 border-t border-[#2a2a2a] space-y-2"
              >
                {user ? (
                  <>
                    {/* Mobile Nav Links */}
                    <Link
                      to="/main"
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isActivePath('/main') 
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create
                    </Link>

                    <Link
                      to="/3d-generate"
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isActivePath('/3d-generate') 
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      3D Assets
                    </Link>

                    <Link
                      to="/explore"
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isExploreActive() 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Explore
                    </Link>

                    <Link
                      to="/history"
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isActivePath('/history') 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      History
                    </Link>

                    {/* Mobile User Info */}
                    <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                      <div className="px-4 py-3 bg-[#1a1a1a] rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
                            {profile?.firstName?.[0] || user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{profile?.firstName || user.email.split('@')[0]}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getPlanBadgeStyles()}`}>
                            {getCurrentPlan()?.name || 'Free'} Plan
                          </span>
                          <span className="text-xs text-gray-400">
                            {getCurrentUsage()}/{getCurrentLimit() === Infinity ? '∞' : getCurrentLimit()} used
                          </span>
                        </div>

                        {getCurrentLimit() !== Infinity && (
                          <div className="h-1.5 rounded-full bg-[#252525] overflow-hidden">
                            <div
                              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-emerald-500 to-sky-400"
                              style={{ width: `${getUsagePercentage()}%` }}
                            />
                          </div>
                        )}

                        {subscription?.planId === 'free' && (
                          <button
                            onClick={handleUpgradeClick}
                            className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold uppercase tracking-wider rounded-xl"
                          >
                            Upgrade Plan
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile Logout */}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/careers"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/[0.05] transition-all"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Careers
                    </Link>
                    <Link
                      to="/blog"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/[0.05] transition-all"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Blog
                    </Link>
                    <Link
                      to="/login"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-sm font-semibold rounded-xl mt-2"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* Modals */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        currentSubscription={subscription}
        onUpgrade={handleUpgradeClick}
      />

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative h-full flex items-center justify-center p-4">
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
