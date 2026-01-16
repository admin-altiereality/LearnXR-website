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
// Subscription removed
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user } = useAuth();
  // Subscription removed
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Removed subscription tab
  const [isEditing, setIsEditing] = useState(false);

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

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    if (profile?.firstName) {
      return profile.firstName[0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  if (loading) {
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
                {/* Plan badge removed */}
              </div>
            </div>

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
          </div>
        </motion.div>

        {/* Profile Content */}
        <div className="relative backdrop-blur-xl bg-[#141414]/90 border border-[#262626] rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="p-4 sm:p-6 md:p-8">
            <AnimatePresence mode="wait">
              {
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
              }
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
