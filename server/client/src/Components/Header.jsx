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
import { useCreateGeneration } from '../contexts/CreateGenerationContext';
import Logo from "./Logo";
// Subscription removed

const Header = () => {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const { state: generationState } = useCreateGeneration();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  // Subscription removed
  const [profile, setProfile] = useState(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.uid) {
        try {
          const profileRef = doc(db, 'users', user.uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data());
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };

    fetchProfile();
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

  // Scroll detection for header show/hide with smooth transitions
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          // Show header at the top of the page
          if (currentScrollY < 10) {
            setIsHeaderVisible(true);
          } else {
            // Hide header when scrolling down, show when scrolling up
            // Add threshold to prevent flickering on small scrolls
            const scrollDifference = Math.abs(currentScrollY - lastScrollY.current);
            if (scrollDifference > 5) {
              if (currentScrollY > lastScrollY.current) {
                // Scrolling down
                setIsHeaderVisible(false);
              } else {
                // Scrolling up
                setIsHeaderVisible(true);
              }
            }
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const isExploreActive = () => {
    return location.pathname.startsWith('/explore');
  };

  // Subscription functions removed

  // Navigation Links Component
  const NavLink = ({ to, label, icon, isActive, activeColor = 'sky' }) => {
    const colorClasses = {
      sky: 'bg-sky-500/20 text-sky-300 border-sky-500/30 shadow-sky-500/10',
      orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30 shadow-orange-500/10',
      emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10',
      purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-purple-500/10',
      violet: 'bg-violet-500/20 text-violet-300 border-violet-500/30 shadow-violet-500/10',
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
      {/* Collapsed Header - Small Toggle Button */}
      {isHeaderCollapsed && (
        <button
          onClick={() => setIsHeaderCollapsed(false)}
          className="fixed top-4 left-4 z-50 p-2 rounded-full bg-[#141414]/90 border border-[#262626] 
                     backdrop-blur-xl shadow-lg hover:bg-[#1a1a1a] transition-all duration-300
                     hover:scale-105 group"
          aria-label="Show navigation"
        >
          <svg 
            className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isHeaderVisible && !isHeaderCollapsed
            ? 'translate-y-0 opacity-100' 
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{
          transitionProperty: 'transform, opacity',
          willChange: 'transform, opacity'
        }}
      >
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
                      to="/lessons"
                      label="Lessons"
                      isActive={isActivePath('/lessons')}
                      activeColor="emerald"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      }
                    />
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
                    {['school', 'admin', 'superadmin'].includes(profile?.role) && (
                    <NavLink
                      to="/studio/content"
                      label="Studio"
                      isActive={location.pathname.startsWith('/studio')}
                      activeColor="orange"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                        </svg>
                      }
                    />
                    )}
                    {/* Pricing removed */}
                  </div>
                )}
              </div>

              {/* Right Section - User Actions */}
              <div className="hidden md:flex items-center gap-3">
                {user ? (
                  <>
                    {/* Persistent Generation Indicator - Show while generating */}
                    {(generationState.isGenerating || generationState.isGenerating3DAsset) && (
                      <Link
                        to="/main"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 transition-all duration-300 group"
                      >
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-sky-300 font-medium">
                            {generationState.isGenerating3DAsset ? 'Generating 3D Asset' : 'Generating Skybox'}
                          </span>
                          {(generationState.assetGenerationProgress || generationState.skyboxProgress > 0) && (
                            <span className="text-[10px] text-sky-400">
                              {generationState.assetGenerationProgress 
                                ? `${Math.round(generationState.assetGenerationProgress.progress)}%`
                                : `${Math.round(generationState.skyboxProgress)}%`}
                            </span>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                    
                    {/* Subscription features removed */}

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
                          </div>

                          {/* Subscription features removed */}

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
                              to="/lessons"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>My Lessons</span>
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
                            <Link
                              to="/help"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Help & Support</span>
                            </Link>
                            {['school', 'admin', 'superadmin'].includes(profile?.role) && (
                            <Link
                              to="/studio/content"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                              onClick={() => setShowDropdown(false)}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>Content Studio</span>
                            </Link>
                            )}
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
                    {/* Pricing removed */}
                    <NavLink
                      to="/help"
                      label="Help"
                      isActive={isActivePath('/help')}
                      activeColor="cyan"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

              {/* Collapse Header Button - Desktop */}
              <button
                onClick={() => setIsHeaderCollapsed(true)}
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg 
                         bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a]
                         text-gray-500 hover:text-white transition-all duration-300"
                title="Hide navigation bar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>

            {/* Mobile Menu */}
            {showMobileMenu && (
              <div 
                ref={mobileMenuRef}
                className="md:hidden mt-4 pt-4 border-t border-[#2a2a2a] space-y-2"
              >
                {user ? (
                  <>
                    {/* Mobile Generation Indicator - Show while generating */}
                    {(generationState.isGenerating || generationState.isGenerating3DAsset) && (
                      <Link
                        to="/main"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sm font-medium text-sky-300 hover:bg-sky-500/20 transition-all"
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <div className="flex flex-col flex-1">
                          <span>
                            {generationState.isGenerating3DAsset ? 'Generating 3D Asset' : 'Generating Skybox'}
                          </span>
                          {(generationState.assetGenerationProgress || generationState.skyboxProgress > 0) && (
                            <span className="text-[10px] text-sky-400">
                              {generationState.assetGenerationProgress 
                                ? `${Math.round(generationState.assetGenerationProgress.progress)}%`
                                : `${Math.round(generationState.skyboxProgress)}%`}
                            </span>
                          )}
                        </div>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                    
                    {/* Mobile Nav Links */}
                    <Link
                      to="/lessons"
                      className={` 
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isActivePath('/lessons') 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Lessons
                    </Link>
                    
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

                    {['school', 'admin', 'superadmin'].includes(profile?.role) && (
                    <Link
                      to="/studio/content"
                      className={` 
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${location.pathname.startsWith('/studio') 
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                      </svg>
                      Content Studio
                    </Link>
                    )}

                    {/* Pricing removed */}

                    <Link
                      to="/help"
                      className={` 
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isActivePath('/help') 
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                          : 'text-gray-300 hover:bg-white/[0.05]'
                        }
                      `}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Help & Support
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
                        
                        {/* Subscription features removed */}
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
                    {/* Pricing removed */}
                    <Link
                      to="/help"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/[0.05] transition-all"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Help & Support
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
      <div className="" />

      {/* Subscription modals removed */}
    </>
  );
};

export default Header;
