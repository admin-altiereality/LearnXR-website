import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { 
  User,
  Mail,
  Building2,
  Briefcase,
  Phone,
  Edit3,
  Check,
  X,
  GraduationCap,
  BookOpen,
  Trophy,
  Target,
  Calendar,
  Shield,
  Star,
  Award,
  TrendingUp,
  Clock,
  ChevronRight,
  School,
  Users,
  Settings,
  MapPin,
  Globe
} from 'lucide-react';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

// Role badge component
const RoleBadge = ({ role }: { role: string }) => {
  const roleConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
    student: { 
      color: 'text-cyan-300', 
      bg: 'bg-cyan-500/10', 
      border: 'border-cyan-500/30',
      icon: <GraduationCap className="w-3.5 h-3.5" />
    },
    teacher: { 
      color: 'text-purple-300', 
      bg: 'bg-purple-500/10', 
      border: 'border-purple-500/30',
      icon: <BookOpen className="w-3.5 h-3.5" />
    },
    school: { 
      color: 'text-amber-300', 
      bg: 'bg-amber-500/10', 
      border: 'border-amber-500/30',
      icon: <School className="w-3.5 h-3.5" />
    },
    admin: { 
      color: 'text-emerald-300', 
      bg: 'bg-emerald-500/10', 
      border: 'border-emerald-500/30',
      icon: <Shield className="w-3.5 h-3.5" />
    },
    superadmin: { 
      color: 'text-rose-300', 
      bg: 'bg-rose-500/10', 
      border: 'border-rose-500/30',
      icon: <Star className="w-3.5 h-3.5" />
    },
  };

  const config = roleConfig[role] || roleConfig.student;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.color} border ${config.border}`}>
      {config.icon}
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
};

// Stats card component
const StatCard = ({ icon: Icon, label, value, color = 'cyan' }: { icon: any; label: string; value: string | number; color?: string }) => {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400',
    emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  };

  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color].replace('from-', 'from-').replace('/20', '/30')} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [stats, setStats] = useState({
    lessonsCompleted: 0,
    quizzesCompleted: 0,
    averageScore: 0,
    totalTime: 0,
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    function: '',
    phoneNumber: '',
    email: user?.email || '',
    bio: '',
    location: '',
    website: '',
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
            firstName: profileData.firstName || profileData.name?.split(' ')[0] || '',
            lastName: profileData.lastName || profileData.name?.split(' ').slice(1).join(' ') || '',
            company: profileData.company || profileData.schoolName || '',
            function: profileData.function || profileData.designation || '',
            phoneNumber: profileData.phoneNumber || profileData.phone || '',
            email: profileData.email || user.email || '',
            bio: profileData.bio || '',
            location: profileData.location || profileData.city || '',
            website: profileData.website || '',
          });
        }

        // Fetch user stats if student
        if (authProfile?.role === 'student' || !authProfile?.role) {
          try {
            const progressRef = collection(db, 'user_lesson_progress');
            const q = query(progressRef, where('userId', '==', user.uid));
            const progressSnap = await getDocs(q);
            
            let completed = 0;
            let quizzes = 0;
            let totalScore = 0;
            let scoreCount = 0;
            
            progressSnap.forEach(doc => {
              const data = doc.data();
              if (data.completed) completed++;
              if (data.quizCompleted) {
                quizzes++;
                if (data.quizScore?.percentage) {
                  totalScore += data.quizScore.percentage;
                  scoreCount++;
                }
              }
            });
            
            setStats({
              lessonsCompleted: completed,
              quizzesCompleted: quizzes,
              averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
              totalTime: completed * 15, // Estimate 15 mins per lesson
            });
          } catch (e) {
            console.warn('Could not fetch stats:', e);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load profile data');
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    
    try {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        updatedAt: new Date()
      });
      
      setProfile((prev: any) => ({
        ...prev,
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
      }));
      
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    }
  };

  const getInitials = () => {
    if (formData.firstName && formData.lastName) {
      return `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase();
    }
    if (formData.firstName) {
      return formData.firstName[0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (formData.firstName || formData.lastName) {
      return `${formData.firstName} ${formData.lastName}`.trim();
    }
    return profile?.name || user?.email?.split('@')[0] || 'User';
  };

  const userRole = profile?.role || authProfile?.role || 'student';
  const memberSince = profile?.createdAt ? new Date(profile.createdAt.seconds * 1000 || profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently joined';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-red-500/20 hover:bg-red-600/30 text-red-300 rounded-xl transition-all border border-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Profile Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl shadow-2xl"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
          
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg shadow-cyan-500/25 ring-4 ring-slate-900/50">
                    {getInitials()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
                
                {/* User Info */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                      {getDisplayName()}
                    </h1>
                    <RoleBadge role={userRole} />
                  </div>
                  <p className="text-slate-400 flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4" />
                    {user?.email}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {memberSince}
                    </span>
                    {formData.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {formData.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                  isEditing 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {isEditing ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    Edit Profile
                  </>
                )}
              </button>
            </div>

            {/* Bio */}
            {formData.bio && !isEditing && (
              <p className="mt-4 text-slate-300 text-sm leading-relaxed max-w-2xl">
                {formData.bio}
              </p>
            )}
          </div>
        </motion.div>

        {/* Stats Section - For Students */}
        {(userRole === 'student' || !userRole) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <StatCard 
              icon={BookOpen} 
              label="Lessons Completed" 
              value={stats.lessonsCompleted} 
              color="cyan" 
            />
            <StatCard 
              icon={Trophy} 
              label="Quizzes Passed" 
              value={stats.quizzesCompleted} 
              color="amber" 
            />
            <StatCard 
              icon={Target} 
              label="Average Score" 
              value={`${stats.averageScore}%`} 
              color="emerald" 
            />
            <StatCard 
              icon={Clock} 
              label="Learning Time" 
              value={`${stats.totalTime}m`} 
              color="purple" 
            />
          </motion.div>
        )}

        {/* Profile Details / Edit Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl overflow-hidden"
        >
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Profile Information
            </h2>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder="Enter first name"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder="Enter last name"
                    />
                  </div>

                  {/* Company/School */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {userRole === 'school' ? 'School Name' : userRole === 'student' ? 'School/Institution' : 'Company'}
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder={userRole === 'student' ? 'Enter school name' : 'Enter company name'}
                    />
                  </div>

                  {/* Function/Role */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {userRole === 'student' ? 'Class/Grade' : 'Designation'}
                    </label>
                    <input
                      type="text"
                      value={formData.function}
                      onChange={(e) => setFormData(prev => ({ ...prev, function: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder={userRole === 'student' ? 'e.g., Class 10' : 'Enter designation'}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder="Enter phone number"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder="City, Country"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/30 border border-slate-700/30 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: User, label: 'First Name', value: formData.firstName || 'Not set' },
                  { icon: User, label: 'Last Name', value: formData.lastName || 'Not set' },
                  { icon: userRole === 'school' ? School : Building2, label: userRole === 'school' ? 'School Name' : userRole === 'student' ? 'School' : 'Company', value: formData.company || 'Not set' },
                  { icon: Briefcase, label: userRole === 'student' ? 'Class' : 'Designation', value: formData.function || 'Not set' },
                  { icon: Phone, label: 'Phone', value: formData.phoneNumber || 'Not set' },
                  { icon: Mail, label: 'Email', value: user?.email || 'Not set' },
                  { icon: MapPin, label: 'Location', value: formData.location || 'Not set' },
                  { icon: Globe, label: 'Website', value: formData.website || 'Not set' },
                ].map((field, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center group-hover:bg-cyan-500/10 transition-colors">
                        <field.icon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{field.label}</span>
                    </div>
                    <p className="text-sm text-white font-medium truncate" title={field.value}>
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {userRole === 'student' && (
            <button
              onClick={() => navigate('/lessons')}
              className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 hover:border-cyan-400/50 transition-all group text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-cyan-400" />
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
              <h3 className="text-white font-semibold mb-1">Continue Learning</h3>
              <p className="text-sm text-slate-400">Pick up where you left off</p>
            </button>
          )}

          {(userRole === 'teacher' || userRole === 'school' || userRole === 'admin' || userRole === 'superadmin') && (
            <button
              onClick={() => navigate('/studio/content')}
              className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 hover:border-purple-400/50 transition-all group text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-purple-400" />
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
              <h3 className="text-white font-semibold mb-1">Content Studio</h3>
              <p className="text-sm text-slate-400">Manage your lessons</p>
            </button>
          )}

          <button
            onClick={() => navigate('/lessons')}
            className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 hover:border-emerald-400/50 transition-all group text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-emerald-400" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <h3 className="text-white font-semibold mb-1">Browse Lessons</h3>
            <p className="text-sm text-slate-400">Explore available content</p>
          </button>

          <button
            onClick={() => toast.info('Coming soon!')}
            className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-400/50 transition-all group text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <h3 className="text-white font-semibold mb-1">Achievements</h3>
            <p className="text-sm text-slate-400">View your badges</p>
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
