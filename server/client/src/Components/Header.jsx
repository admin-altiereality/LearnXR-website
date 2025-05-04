import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/AuthContext';
import SubscriptionModal from './SubscriptionModal';
import { subscriptionService } from '../services/subscriptionService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Logo from "./Logo";

const Header = () => {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfileAndSubscription = async () => {
      if (user?.uid) {
        // Fetch profile data
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        }

        // Fetch subscription data
        const userSubscription = await subscriptionService.getUserSubscription(user.uid);
        setSubscription(userSubscription);
      }
    };

    fetchProfileAndSubscription();
  }, [user?.uid]);

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
      // Error toast is already handled in AuthContext
      console.error('Logout failed:', error);
    }
  };

  const handleUpgradeClick = async () => {
    openModal('subscription');
    setShowDropdown(false);
  };

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <header className="bg-gray-900/40 backdrop-blur-sm border-b border-gray-800/50 sticky top-0 z-40">
        <nav className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
            
            {user && (
              <div className="hidden md:flex items-center space-x-2">
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
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActivePath('/explore')
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Explore</span>
                  </span>
                </Link>
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
    </>
  );
};

export default Header;
