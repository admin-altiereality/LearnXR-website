import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  FaUserCheck, 
  FaUserTimes, 
  FaSearch, 
  FaFilter,
  FaChalkboardTeacher,
  FaSchool,
  FaEnvelope,
  FaCalendarAlt,
  FaClock,
  FaCheck,
  FaTimes,
  FaSpinner,
  FaUsers,
  FaExclamationCircle,
  FaArrowLeft,
  FaPhone,
  FaMapMarkerAlt,
  FaGraduationCap,
  FaBriefcase,
  FaBook,
  FaGlobe,
  FaEye,
  FaChevronDown,
  FaChevronUp,
  FaBuilding,
  FaUserGraduate,
  FaExclamationTriangle
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { 
  canApproveUsers, 
  UserProfile,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  APPROVAL_STATUS_DISPLAY
} from '../../utils/rbac';
import { toast } from 'react-toastify';

// All onboarding data is now stored directly in users collection
interface PendingUser extends UserProfile {
  id: string;
  // Teacher-specific fields (stored in users collection)
  schoolName?: string;
  subjectsTaught?: string[];
  experienceYears?: string;
  qualifications?: string;
  phoneNumber?: string;
  city?: string;
  state?: string;
  boardAffiliation?: string;
  classesHandled?: string[];
  // School-specific fields (stored in users collection)
  address?: string;
  pincode?: string;
  contactPerson?: string;
  contactPhone?: string;
  website?: string;
  studentCount?: string;
  establishedYear?: string;
  schoolType?: string;
}

const Approvals = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'teacher' | 'school'>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    teachers: 0,
    schools: 0
  });

  // Check if user can approve
  useEffect(() => {
    if (profile && !canApproveUsers(profile)) {
      toast.error('You do not have permission to access this page');
      navigate('/lessons');
    }
  }, [profile, navigate]);

  // Fetch pending users
  useEffect(() => {
    if (!profile || !canApproveUsers(profile)) return;

    console.log('🔍 Approvals: Setting up listener for pending users...');
    
    const usersRef = collection(db, 'users');
    
    // Simple query - just get users with approvalStatus = 'pending'
    // We'll filter for teacher/school roles client-side
    const pendingQuery = query(
      usersRef,
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      console.log('🔍 Approvals: Received snapshot with', snapshot.docs.length, 'documents');
      
      const users: PendingUser[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const role = (data.role || '').toLowerCase();
        
        console.log('🔍 Approvals: User doc:', docSnapshot.id, {
          role: data.role,
          approvalStatus: data.approvalStatus,
          onboardingCompleted: data.onboardingCompleted,
          email: data.email
        });
        
        // Include teachers and schools
        if (role === 'teacher' || role === 'school') {
          users.push({
            id: docSnapshot.id,
            uid: docSnapshot.id,
            ...data,
            role: role as any // Normalize role to lowercase
          } as PendingUser);
        }
      });
      
      // Sort by createdAt descending (newest first)
      users.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      console.log('🔍 Approvals: Found', users.length, 'pending teacher/school users');
      setPendingUsers(users);
      setLoading(false);
    }, (error: any) => {
      console.error('❌ Approvals Error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Check if it's an index error
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.error('🔴 FIREBASE INDEX REQUIRED!');
        console.error('Create index at: Firebase Console > Firestore > Indexes');
        console.error('Collection: users, Field: approvalStatus');
        toast.error('Database index required. Check console for instructions.');
      } else {
        toast.error('Failed to load pending users: ' + error.message);
      }
      setLoading(false);
    });

    return () => {
      console.log('🔍 Approvals: Cleaning up listener');
      unsubscribe();
    };
  }, [profile]);

  // Toggle expanded user details (data is already in users collection)
  const toggleExpandUser = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!profile || !canApproveUsers(profile)) return;

      try {
        const usersRef = collection(db, 'users');
        
        // Get all teachers and schools
        const rolesQuery = query(
          usersRef,
          where('role', 'in', ['teacher', 'school'])
        );
        
        const snapshot = await getDocs(rolesQuery);
        
        let pending = 0, approved = 0, rejected = 0, teachers = 0, schools = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.approvalStatus === 'pending') pending++;
          else if (data.approvalStatus === 'approved') approved++;
          else if (data.approvalStatus === 'rejected') rejected++;
          
          if (data.role === 'teacher') teachers++;
          else if (data.role === 'school') schools++;
        });
        
        setStats({ pending, approved, rejected, teachers, schools });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [profile, pendingUsers]);

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      const user = pendingUsers.find(u => u.id === userId);
      const now = new Date().toISOString();
      
      // Update users collection (single source of truth)
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        approvalStatus: 'approved',
        approvedAt: now,
        approvedBy: profile?.uid,
        updatedAt: now,
      });
      console.log(`✅ Approved user:`, userId);
      
      // Send approval email notification
      // Note: In production, this would be handled by a Firebase Cloud Function
      console.log(`📧 Approval email would be sent to: ${user?.email}`);
      console.log(`Subject: Your ${user?.role} account has been approved!`);
      console.log(`From: admin@altiereality.com`);
      
      toast.success(`User approved! An approval email will be sent to ${user?.email}`);
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setProcessingId(userId);
    try {
      const now = new Date().toISOString();
      
      // Update users collection (single source of truth)
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        approvalStatus: 'rejected',
        rejectedAt: now,
        rejectedBy: profile?.uid,
        updatedAt: now,
      });
      console.log(`❌ Rejected user:`, userId);
      
      toast.success('User rejected');
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Failed to reject user');
    } finally {
      setProcessingId(null);
    }
  };

  // Filter users
  const filteredUsers = pendingUsers.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: i * 0.05,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white/60">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          custom={0}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="mb-8"
        >
          <button
            onClick={() => navigate('/lessons')}
            className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-4"
          >
            <FaArrowLeft className="text-sm" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <FaUserCheck className="text-white" />
                </div>
                User Approvals
              </h1>
              <p className="text-white/50 mt-1">
                Review and approve teacher and school registrations
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-yellow-400 font-bold text-lg">{stats.pending}</span>
                <span className="text-yellow-400/70 text-sm ml-2">Pending</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 font-bold text-lg">{stats.approved}</span>
                <span className="text-emerald-400/70 text-sm ml-2">Approved</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          custom={1}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row gap-4 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 
                       text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
            />
          </div>
          
          {/* Role Filter */}
          <div className="flex gap-2">
            {['all', 'teacher', 'school'].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role as typeof filterRole)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  filterRole === role
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 border'
                    : 'bg-white/[0.03] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1) + 's'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Users List */}
        <motion.div
          custom={2}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.05] flex items-center justify-center">
                <FaUsers className="text-2xl text-white/30" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Pending Approvals</h3>
              <p className="text-white/50">
                {searchQuery || filterRole !== 'all' 
                  ? 'No users match your search criteria'
                  : 'All user registrations have been reviewed'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user, index) => {
                  const roleColors = ROLE_COLORS[user.role];
                  const RoleIcon = user.role === 'teacher' ? FaChalkboardTeacher : FaSchool;
                  const isProcessing = processingId === user.id;

                  return (
                    <motion.div
                      key={user.id}
                      custom={index}
                      variants={fadeUpVariants}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                      layout
                      className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
                    >
                      {/* Main Content */}
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* User Info */}
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-14 h-14 rounded-xl ${roleColors.bg} ${roleColors.border} border flex items-center justify-center flex-shrink-0`}>
                              <RoleIcon className={`text-xl ${roleColors.text}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold text-white truncate">
                                  {user.name || user.displayName || 'Unknown User'}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${roleColors.bg} ${roleColors.text} ${roleColors.border} border`}>
                                  {ROLE_DISPLAY_NAMES[user.role]}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
                                <span className="flex items-center gap-1.5">
                                  <FaEnvelope className="text-xs" />
                                  {user.email}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <FaCalendarAlt className="text-xs" />
                                  {user.createdAt 
                                    ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })
                                    : 'Unknown date'}
                                </span>
                                {/* Onboarding Status Badge */}
                                {user.onboardingCompleted ? (
                                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                                    <FaCheck className="text-[10px]" />
                                    Onboarded
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                                    <FaExclamationTriangle className="text-[10px]" />
                                    Pending Onboarding
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-3 sm:flex-shrink-0">
                            {/* View Details Button */}
                            <motion.button
                              onClick={() => toggleExpandUser(user.id)}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 
                                       text-white/60 hover:text-white hover:bg-white/10 transition-all"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <FaEye />
                              <span className="font-medium text-sm">Details</span>
                              {expandedUserId === user.id ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
                            </motion.button>
                            
                            <motion.button
                              onClick={() => handleReject(user.id)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 
                                       text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {isProcessing ? (
                                <FaSpinner className="animate-spin" />
                              ) : (
                                <FaTimes />
                              )}
                              <span className="font-medium">Reject</span>
                            </motion.button>
                            
                            <motion.button
                              onClick={() => handleApprove(user.id)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 
                                       text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {isProcessing ? (
                                <FaSpinner className="animate-spin" />
                              ) : (
                                <FaCheck />
                              )}
                              <span className="font-medium">Approve</span>
                            </motion.button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details Section */}
                      <AnimatePresence>
                        {expandedUserId === user.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="border-t border-white/10 bg-white/[0.02]"
                          >
                            <div className="p-6">
                              <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FaUserGraduate />
                                Onboarding Information
                              </h4>
                              
                              {user.role === 'teacher' ? (
                                /* Teacher Details - data directly from user object */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaBuilding />
                                      School/Institution
                                    </div>
                                    <p className="text-white font-medium">{user.schoolName || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaMapMarkerAlt />
                                      Location
                                    </div>
                                    <p className="text-white font-medium">
                                      {[user.city, user.state].filter(Boolean).join(', ') || 'Not provided'}
                                    </p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaPhone />
                                      Phone Number
                                    </div>
                                    <p className="text-white font-medium">{user.phoneNumber || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaBriefcase />
                                      Experience
                                    </div>
                                    <p className="text-white font-medium">{user.experienceYears || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaGraduationCap />
                                      Qualifications
                                    </div>
                                    <p className="text-white font-medium">{user.qualifications || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaBook />
                                      Board Affiliation
                                    </div>
                                    <p className="text-white font-medium uppercase">{user.boardAffiliation || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                                      <FaBook />
                                      Subjects Taught
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {user.subjectsTaught?.length ? (
                                        user.subjectsTaught.map((subject, i) => (
                                          <span key={i} className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-300 text-sm border border-blue-500/20">
                                            {subject}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-white/50">Not provided</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                                      <FaUsers />
                                      Classes Handled
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {user.classesHandled?.length ? (
                                        user.classesHandled.map((cls, i) => (
                                          <span key={i} className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 text-sm border border-emerald-500/20">
                                            Class {cls}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-white/50">Not provided</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Onboarding Status */}
                                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FaCheck className="text-emerald-400" />
                                        <span className="text-emerald-400 font-medium">
                                          Onboarding {user.onboardingCompleted ? 'Completed' : 'Incomplete'}
                                        </span>
                                      </div>
                                      {user.onboardingCompletedAt && (
                                        <span className="text-white/50 text-sm">
                                          Completed on {new Date(user.onboardingCompletedAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : user.role === 'school' ? (
                                /* School Details - data directly from user object */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaSchool />
                                      School Name
                                    </div>
                                    <p className="text-white font-medium">{user.schoolName || user.name || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaBuilding />
                                      School Type
                                    </div>
                                    <p className="text-white font-medium capitalize">{user.schoolType || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaCalendarAlt />
                                      Established Year
                                    </div>
                                    <p className="text-white font-medium">{user.establishedYear || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaMapMarkerAlt />
                                      Full Address
                                    </div>
                                    <p className="text-white font-medium">
                                      {user.address || 'No address'}
                                      {user.city && `, ${user.city}`}
                                      {user.state && `, ${user.state}`}
                                      {user.pincode && ` - ${user.pincode}`}
                                    </p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaUserCheck />
                                      Contact Person
                                    </div>
                                    <p className="text-white font-medium">{user.contactPerson || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaPhone />
                                      Contact Phone
                                    </div>
                                    <p className="text-white font-medium">{user.contactPhone || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaGlobe />
                                      Website
                                    </div>
                                    {user.website ? (
                                      <a href={user.website} target="_blank" rel="noopener noreferrer" 
                                         className="text-cyan-400 hover:underline font-medium truncate block">
                                        {user.website}
                                      </a>
                                    ) : (
                                      <p className="text-white/50">Not provided</p>
                                    )}
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaBook />
                                      Board Affiliation
                                    </div>
                                    <p className="text-white font-medium uppercase">{user.boardAffiliation || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                                      <FaUsers />
                                      Student Count
                                    </div>
                                    <p className="text-white font-medium">{user.studentCount || 'Not provided'}</p>
                                  </div>
                                  
                                  {/* Onboarding Status */}
                                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FaCheck className="text-purple-400" />
                                        <span className="text-purple-400 font-medium">
                                          Onboarding {user.onboardingCompleted ? 'Completed' : 'Incomplete'}
                                        </span>
                                      </div>
                                      {user.onboardingCompletedAt && (
                                        <span className="text-white/50 text-sm">
                                          Completed on {new Date(user.onboardingCompletedAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                                    <FaExclamationCircle className="text-2xl text-amber-400" />
                                  </div>
                                  <h3 className="text-lg font-semibold text-white mb-2">Onboarding Not Completed</h3>
                                  <p className="text-white/50 mb-4">This user has not completed their onboarding yet.</p>
                                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <FaClock className="text-amber-400" />
                                    <span className="text-amber-300 text-sm">Waiting for user to complete profile setup</span>
                                  </div>
                                  <p className="text-white/40 text-sm mt-4">
                                    Consider reaching out to remind them to complete their profile before approval.
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Role Stats Cards */}
        <motion.div
          custom={3}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8"
        >
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FaChalkboardTeacher className="text-blue-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Total Teachers</p>
                <p className="text-2xl font-bold text-white">{stats.teachers}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FaSchool className="text-purple-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Total Schools</p>
                <p className="text-2xl font-bold text-white">{stats.schools}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Approvals;
