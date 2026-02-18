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
  FaExclamationTriangle,
  FaCog,
  FaUserShield
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';

/** Generate a unique 6-character uppercase alphanumeric school code */
function generateSchoolCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
import { 
  canApproveUsers, 
  UserProfile,
  UserRole,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  APPROVAL_STATUS_DISPLAY
} from '../../utils/rbac';
import { toast } from 'react-toastify';
import { getSchoolClasses, assignTeacherToClass } from '../../services/classManagementService';
import {
  getPendingCurriculumChangeRequests,
  approveCurriculumChangeRequest,
  rejectCurriculumChangeRequest,
  type CurriculumChangeRequest,
} from '../../services/curriculumChangeRequestService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../Components/ui/dialog';
import { Button } from '../../Components/ui/button';
import { Label } from '../../Components/ui/label';
import type { Class } from '../../types/lms';

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
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [pendingSchools, setPendingSchools] = useState<any[]>([]);
  const [approvedSchools, setApprovedSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingApproved, setLoadingApproved] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [processingSchoolId, setProcessingSchoolId] = useState<string | null>(null);
  const [processingSchoolCodeId, setProcessingSchoolCodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'teacher' | 'school' | 'student' | 'principal' | 'associate' | 'admin' | 'superadmin'>('all');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [assignClassModal, setAssignClassModal] = useState<{
    open: boolean;
    teacher: PendingUser | null;
    schoolClasses: Class[];
    selectedClassId: string;
    assigning: boolean;
  }>({ open: false, teacher: null, schoolClasses: [], selectedClassId: '', assigning: false });
  const [curriculumRequests, setCurriculumRequests] = useState<CurriculumChangeRequest[]>([]);
  const [processingCurriculumRequestId, setProcessingCurriculumRequestId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    teachers: 0,
    schools: 0,
    pendingSchools: 0
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
        
        // Include teachers and schools; prefer those who completed onboarding (normal flow) but show any pending so none are hidden
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

  // Fetch approved users
  useEffect(() => {
    if (!profile || !canApproveUsers(profile)) return;

    console.log('🔍 Approvals: Setting up listener for approved users...');
    
    const usersRef = collection(db, 'users');
    
    // Query for approved users
    const approvedQuery = query(
      usersRef,
      where('approvalStatus', '==', 'approved')
    );

    const unsubscribe = onSnapshot(approvedQuery, (snapshot) => {
      console.log('🔍 Approvals: Received approved users snapshot with', snapshot.docs.length, 'documents');
      
      const users: PendingUser[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const role = (data.role || '').toLowerCase();
        // User Management dashboard is for teachers, schools, and staff only – exclude students
        if (role === 'student' || role === 'guest') return;
        users.push({
          id: docSnapshot.id,
          uid: docSnapshot.id,
          ...data,
          role: role as any
        } as PendingUser);
      });
      
      // Sort by approvedAt or createdAt descending (newest first)
      users.sort((a, b) => {
        const dateA = (a as any).approvedAt 
          ? new Date((a as any).approvedAt).getTime() 
          : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = (b as any).approvedAt 
          ? new Date((b as any).approvedAt).getTime() 
          : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      });
      
      console.log('🔍 Approvals: Found', users.length, 'approved users');
      setApprovedUsers(users);
      setLoadingApproved(false);
    }, (error: any) => {
      console.error('❌ Approvals Error (approved users):', error);
      toast.error('Failed to load approved users: ' + error.message);
      setLoadingApproved(false);
    });

    return () => {
      console.log('🔍 Approvals: Cleaning up approved users listener');
      unsubscribe();
    };
  }, [profile]);

  // Fetch pending schools from schools collection
  useEffect(() => {
    if (!profile || !canApproveUsers(profile)) return;

    console.log('🔍 Approvals: Setting up listener for pending schools...');
    
    const schoolsRef = collection(db, 'schools');
    const pendingSchoolsQuery = query(
      schoolsRef,
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingSchoolsQuery, (snapshot) => {
      const schools: any[] = [];
      snapshot.forEach((docSnapshot) => {
        schools.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });
      });

      schools.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      console.log('🔍 Approvals: Found', schools.length, 'pending schools');
      setPendingSchools(schools);
      setLoadingSchools(false);
    }, (error: any) => {
      console.error('❌ Approvals Error (schools):', error);
      setLoadingSchools(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Fetch approved schools
  useEffect(() => {
    if (!profile || !canApproveUsers(profile)) return;

    const schoolsRef = collection(db, 'schools');
    const approvedSchoolsQuery = query(
      schoolsRef,
      where('approvalStatus', '==', 'approved')
    );

    const unsubscribe = onSnapshot(approvedSchoolsQuery, (snapshot) => {
      const schools: any[] = [];
      snapshot.forEach((docSnapshot) => {
        schools.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });
      });

      schools.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });

      setApprovedSchools(schools);
    }, (error: any) => {
      console.error('❌ Error fetching approved schools:', error);
    });

    return () => unsubscribe();
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
        
        // Get all users (not just teachers/schools for stats)
        const snapshot = await getDocs(usersRef);
        
        let pending = 0, approved = 0, rejected = 0, teachers = 0, schools = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.approvalStatus === 'pending') pending++;
          else if (data.approvalStatus === 'approved') approved++;
          else if (data.approvalStatus === 'rejected') rejected++;
          
          if (data.role === 'teacher') teachers++;
          else if (data.role === 'school') schools++;
        });
        
        setStats({ pending, approved, rejected, teachers, schools, pendingSchools: pendingSchools.length });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [profile, pendingUsers, approvedUsers]);

  // Fetch curriculum change requests (Super Admin only)
  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return;
    getPendingCurriculumChangeRequests(profile).then(setCurriculumRequests);
    const interval = setInterval(() => {
      getPendingCurriculumChangeRequests(profile).then(setCurriculumRequests);
    }, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleApprove = async (userId: string) => {
    const user = pendingUsers.find(u => u.id === userId);
    if (!user) return;

    setProcessingId(userId);
    try {
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
      
      // For teachers: show optional class assignment modal
      if (user.role === 'teacher' && (user.school_id || user.managed_school_id)) {
        const schoolId = user.school_id || user.managed_school_id;
        const schoolClasses = await getSchoolClasses(profile, schoolId);
        setAssignClassModal({
          open: true,
          teacher: user,
          schoolClasses,
          selectedClassId: schoolClasses.length > 0 ? schoolClasses[0].id : '',
          assigning: false,
        });
      } else {
        toast.success(`User approved! An approval email will be sent to ${user?.email}`);
      }
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAssignClassConfirm = async () => {
    const { teacher, schoolClasses, selectedClassId } = assignClassModal;
    if (!teacher || !profile) return;

    if (selectedClassId) {
      setAssignClassModal(prev => ({ ...prev, assigning: true }));
      try {
        const success = await assignTeacherToClass(profile, teacher.id, selectedClassId);
        if (success) {
          toast.success(`Teacher assigned to ${schoolClasses.find(c => c.id === selectedClassId)?.class_name || 'class'}`);
        }
      } catch (err) {
        console.error('Error assigning teacher to class:', err);
      } finally {
        setAssignClassModal(prev => ({ ...prev, assigning: false }));
      }
    }
    setAssignClassModal({ open: false, teacher: null, schoolClasses: [], selectedClassId: '', assigning: false });
    toast.success(`User approved! An approval email will be sent to ${teacher?.email}`);
  };

  const handleAssignClassSkip = () => {
    const { teacher } = assignClassModal;
    setAssignClassModal({ open: false, teacher: null, schoolClasses: [], selectedClassId: '', assigning: false });
    if (teacher) {
      toast.success(`User approved! An approval email will be sent to ${teacher?.email}`);
    }
  };

  const handleApproveCurriculumRequest = async (requestId: string) => {
    setProcessingCurriculumRequestId(requestId);
    try {
      const ok = await approveCurriculumChangeRequest(profile, requestId);
      if (ok) setCurriculumRequests(prev => prev.filter(r => r.id !== requestId));
    } finally {
      setProcessingCurriculumRequestId(null);
    }
  };

  const handleRejectCurriculumRequest = async (requestId: string) => {
    setProcessingCurriculumRequestId(requestId);
    try {
      const ok = await rejectCurriculumChangeRequest(profile, requestId);
      if (ok) setCurriculumRequests(prev => prev.filter(r => r.id !== requestId));
    } finally {
      setProcessingCurriculumRequestId(null);
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

  // Resolve the school user ID (createdBy or fallback: user with role school linked to this school)
  const resolveSchoolUserId = async (schoolId: string, school?: { createdBy?: string }): Promise<string | null> => {
    if (school?.createdBy) return school.createdBy;
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'school'),
      where('school_id', '==', schoolId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    const q2 = query(
      usersRef,
      where('role', '==', 'school'),
      where('managed_school_id', '==', schoolId)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return snap2.docs[0].id;
    return null;
  };

  // Handle role change for approved users
  const handleApproveSchool = async (schoolId: string) => {
    setProcessingSchoolId(schoolId);
    try {
      const now = new Date().toISOString();
      const school = pendingSchools.find(s => s.id === schoolId);
      const schoolRef = doc(db, 'schools', schoolId);
      const updateData: Record<string, unknown> = {
        approvalStatus: 'approved',
        updatedAt: now,
      };
      if (!school?.schoolCode) {
        updateData.schoolCode = generateSchoolCode();
      }
      await updateDoc(schoolRef, updateData);

      const userId = await resolveSchoolUserId(schoolId, school);
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          approvalStatus: 'approved',
          approvedAt: now,
          approvedBy: profile?.uid,
          updatedAt: now,
        });
      }

      const code = (updateData.schoolCode as string) || school?.schoolCode;
      if (code) {
        toast.success(`School approved. Share this code with teachers: ${code}`);
      } else {
        toast.success('School approved successfully');
      }
    } catch (error: any) {
      console.error('Error approving school:', error);
      toast.error('Failed to approve school: ' + error.message);
    } finally {
      setProcessingSchoolId(null);
    }
  };

  const handleRejectSchool = async (schoolId: string) => {
    setProcessingSchoolId(schoolId);
    try {
      const now = new Date().toISOString();
      const schoolRef = doc(db, 'schools', schoolId);
      await updateDoc(schoolRef, {
        approvalStatus: 'rejected',
        updatedAt: now,
      });

      const school = pendingSchools.find(s => s.id === schoolId);
      const userId = await resolveSchoolUserId(schoolId, school);
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          approvalStatus: 'rejected',
          updatedAt: now,
        });
      }

      toast.success('School rejected');
    } catch (error: any) {
      console.error('Error rejecting school:', error);
      toast.error('Failed to reject school: ' + error.message);
    } finally {
      setProcessingSchoolId(null);
    }
  };

  const handleGenerateSchoolCode = async (schoolId: string) => {
    setProcessingSchoolCodeId(schoolId);
    try {
      const schoolRef = doc(db, 'schools', schoolId);
      const newCode = generateSchoolCode();
      await updateDoc(schoolRef, {
        schoolCode: newCode,
        updatedAt: new Date().toISOString(),
      });
      setApprovedSchools(prev =>
        prev.map(s => (s.id === schoolId ? { ...s, schoolCode: newCode } : s))
      );
      toast.success(`School code set: ${newCode}. Share this with teachers.`);
    } catch (error: any) {
      console.error('Error generating school code:', error);
      toast.error('Failed to set school code: ' + error.message);
    } finally {
      setProcessingSchoolCodeId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setChangingRoleId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      const now = new Date().toISOString();
      
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: now,
        roleChangedAt: now,
        roleChangedBy: profile?.uid,
      });
      
      const user = approvedUsers.find(u => u.id === userId);
      toast.success(`Role changed to ${ROLE_DISPLAY_NAMES[newRole]} for ${user?.name || user?.email}`);
      console.log(`✅ Changed role for user ${userId} to ${newRole}`);
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error(`Failed to change role: ${error.message || 'Unknown error'}`);
    } finally {
      setChangingRoleId(null);
    }
  };

  // Filter users based on active tab
  const filteredUsers = (activeTab === 'pending' ? pendingUsers : approvedUsers).filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  // Displayed pending count = what we actually show on the Pending tab (so count matches list)
  const displayedPendingCount =
    pendingUsers.length +
    pendingSchools.length +
    ((profile?.role === 'admin' || profile?.role === 'superadmin') ? curriculumRequests.length : 0);

  // Displayed approved count = approved users we show (excludes students), so tab count matches list
  const displayedApprovedCount = approvedUsers.length;

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
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="text-center text-foreground">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <FaArrowLeft className="text-sm" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <FaUserCheck className="text-primary" />
                </div>
                User Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Review approvals and manage user roles
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-amber-100 dark:bg-yellow-500/10 border border-amber-300 dark:border-yellow-500/20">
                <span className="text-amber-800 dark:text-yellow-400 font-bold text-lg">{displayedPendingCount}</span>
                <span className="text-amber-700 dark:text-yellow-400/70 text-sm ml-2">Pending</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20">
                <span className="text-emerald-800 dark:text-emerald-400 font-bold text-lg">{displayedApprovedCount}</span>
                <span className="text-emerald-700 dark:text-emerald-400/70 text-sm ml-2">Approved</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          custom={1}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex gap-2 mb-6 border-b border-border"
        >
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === 'pending'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Pending Approvals ({displayedPendingCount})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === 'approved'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Approved Users ({displayedApprovedCount})
          </button>
        </motion.div>

        {/* Assign Class Modal (after teacher approval) */}
        <Dialog open={assignClassModal.open} onOpenChange={(open) => !open && handleAssignClassSkip()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Assign Teacher to Class (Optional)</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm mb-4">
              Optionally assign {assignClassModal.teacher?.name || assignClassModal.teacher?.email} to a class. You can skip and assign later from Class Management.
            </p>
            {assignClassModal.schoolClasses.length === 0 ? (
              <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
                No classes exist for this school yet. Create classes in Class Management, then assign this teacher.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                <Label className="text-foreground">Select Class</Label>
                <select
                  value={assignClassModal.selectedClassId}
                  onChange={(e) => setAssignClassModal(prev => ({ ...prev, selectedClassId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
                >
                  {assignClassModal.schoolClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.class_name} {c.subject ? `(${c.subject})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleAssignClassSkip} disabled={assignClassModal.assigning}>
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleAssignClassConfirm}
                disabled={assignClassModal.assigning || assignClassModal.schoolClasses.length === 0}
              >
                {assignClassModal.assigning ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  'Assign & Done'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <motion.div
          custom={2}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row gap-4 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-border 
                       text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
            />
          </div>
          
          {/* Role Filter */}
          <div className="flex gap-2 flex-wrap">
            {activeTab === 'pending' 
              ? ['all', 'teacher', 'school'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role as typeof filterRole)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      filterRole === role
                        ? 'bg-primary/15 border border-primary/50 text-primary'
                        : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1) + 's'}
                  </button>
                ))
              : ['all', 'student', 'teacher', 'school', 'principal', 'associate', 'admin', 'superadmin'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role as typeof filterRole)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      filterRole === role
                        ? 'bg-primary/15 border border-primary/50 text-primary'
                        : 'bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {role === 'all' ? 'All Roles' : ROLE_DISPLAY_NAMES[role as UserRole] || role}
                  </button>
                ))
            }
          </div>
        </motion.div>

        {/* Pending Schools Section (only on pending tab) */}
        {activeTab === 'pending' && pendingSchools.length > 0 && (
          <motion.div
            custom={2.5}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-6"
          >
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaSchool className="text-primary" />
              Pending Schools ({pendingSchools.length})
            </h2>
            <div className="space-y-3">
              {pendingSchools.map((school, index) => (
                <motion.div
                  key={school.id}
                  custom={index}
                  variants={fadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-foreground font-medium mb-1">{school.name}</h3>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {school.city && <span>{school.city}, {school.state}</span>}
                        {school.contactPhone && <span>{school.contactPhone}</span>}
                        {school.boardAffiliation && <span>{school.boardAffiliation}</span>}
                        {school.schoolCode && <span className="text-primary font-mono">Code: {school.schoolCode}</span>}
                      </div>
                      {!school.schoolCode && <p className="text-xs text-muted-foreground mt-1">A unique code will be assigned when approved (teachers use it to join this school).</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectSchool(school.id)}
                        disabled={processingSchoolId === school.id}
                        className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {processingSchoolId === school.id ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaTimes />
                        )}
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveSchool(school.id)}
                        disabled={processingSchoolId === school.id}
                        className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {processingSchoolId === school.id ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaCheck />
                        )}
                        Approve
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Approved schools – codes for teacher onboarding */}
        {approvedSchools.length > 0 && (
          <motion.div
            custom={2.6}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-6"
          >
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaSchool className="text-primary" />
              Approved schools (share code with teachers)
            </h2>
            <div className="space-y-3">
              {approvedSchools.map((school) => (
                <motion.div
                  key={school.id}
                  className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between flex-wrap gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-foreground font-medium">{school.name}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                      {school.city && <span>{school.city}, {school.state}</span>}
                      {school.schoolCode ? (
                        <span className="text-primary font-mono font-medium">Code: {school.schoolCode}</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">No code – teachers cannot join by code</span>
                      )}
                    </div>
                  </div>
                  {!school.schoolCode && (
                    <button
                      type="button"
                      onClick={() => handleGenerateSchoolCode(school.id)}
                      disabled={processingSchoolCodeId === school.id}
                      className="px-4 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingSchoolCodeId === school.id ? (
                        <FaSpinner className="animate-spin" />
                      ) : null}
                      Generate code
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Curriculum Change Requests (Super Admin only) */}
        {(profile?.role === 'admin' || profile?.role === 'superadmin') && curriculumRequests.length > 0 && (
          <motion.div
            custom={2.7}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-6"
          >
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaBook className="text-primary" />
              Curriculum Change Requests ({curriculumRequests.length})
            </h2>
            <div className="space-y-3">
              {curriculumRequests.map((req) => (
                <motion.div
                  key={req.id}
                  className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between flex-wrap gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-foreground font-medium">{req.school_name || req.school_id}</h3>
                    <p className="text-muted-foreground text-sm">
                      Requested: <span className="text-primary font-medium">{req.requested_curriculum}</span>
                      {req.reason && ` • ${req.reason}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRejectCurriculumRequest(req.id)}
                      disabled={processingCurriculumRequestId === req.id}
                      className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingCurriculumRequestId === req.id ? <FaSpinner className="animate-spin" /> : <FaTimes />}
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveCurriculumRequest(req.id)}
                      disabled={processingCurriculumRequestId === req.id}
                      className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {processingCurriculumRequestId === req.id ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                      Approve
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Users List */}
        <motion.div
          custom={3}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
        >
          {(activeTab === 'pending' && loading) || (activeTab === 'approved' && loadingApproved) ? (
            <div className="text-center py-16 rounded-2xl border border-border bg-card/30">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading {activeTab === 'pending' ? 'pending' : 'approved'} users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border bg-muted/30">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <FaUsers className="text-2xl text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {activeTab === 'pending' ? 'No Pending Approvals' : 'No Approved Users'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || filterRole !== 'all' 
                  ? 'No users match your search criteria'
                  : activeTab === 'pending' 
                    ? 'All user registrations have been reviewed'
                    : 'No users have been approved yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user, index) => {
                  const roleColors = ROLE_COLORS[user.role] || ROLE_COLORS.teacher;
                  const RoleIcon = user.role === 'teacher' ? FaChalkboardTeacher 
                    : user.role === 'school' ? FaSchool 
                    : user.role === 'principal' ? FaUserShield
                    : user.role === 'admin' || user.role === 'superadmin' ? FaUserShield
                    : FaUserGraduate;
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
                      className="rounded-2xl border border-border bg-card/30 overflow-hidden"
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
                                <h3 className="text-lg font-semibold text-foreground truncate">
                                  {user.name || user.displayName || 'Unknown User'}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${roleColors.bg} ${roleColors.text} ${roleColors.border} border`}>
                                  {ROLE_DISPLAY_NAMES[user.role] || user.role}
                                </span>
                                {activeTab === 'approved' && (user as any).approvedAt && (
                                  <span className="text-xs text-emerald-400/70">
                                    Approved {new Date((user as any).approvedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
                                {activeTab === 'approved' && (user as any).approvedAt && (
                                  <span className="flex items-center gap-1.5 text-emerald-400/70">
                                    <FaCheck className="text-xs" />
                                    Approved {new Date((user as any).approvedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </span>
                                )}
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
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border 
                                       text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <FaEye />
                              <span className="font-medium text-sm">Details</span>
                              {expandedUserId === user.id ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
                            </motion.button>
                            
                            {activeTab === 'pending' ? (
                              <>
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
                              </>
                            ) : (
                              <div className="relative">
                                <select
                                  value={user.role}
                                  onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                  disabled={changingRoleId === user.id}
                                  className="appearance-none px-4 py-2.5 pr-10 rounded-xl bg-background border border-border 
                                           text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
                                           disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[160px]"
                                >
                                  <option value="student">Student</option>
                                  <option value="teacher">Teacher</option>
                                  <option value="school">School Administrator</option>
                                  <option value="principal">Principal</option>
                                  <option value="associate">Associate</option>
                                  <option value="admin">Administrator</option>
                                  <option value="superadmin">Super Administrator</option>
                                </select>
                                {changingRoleId === user.id ? (
                                  <FaSpinner className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin pointer-events-none" />
                                ) : (
                                  <FaCog className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                )}
                              </div>
                            )}
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
                            className="border-t border-border bg-muted/30"
                          >
                            <div className="p-6">
                              <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FaUserGraduate />
                                Onboarding Information
                              </h4>
                              
                              {user.role === 'teacher' ? (
                                /* Teacher Details - data directly from user object */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBuilding />
                                      School/Institution
                                    </div>
                                    <p className="text-foreground font-medium">{user.schoolName || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaMapMarkerAlt />
                                      Location
                                    </div>
                                    <p className="text-foreground font-medium">
                                      {[user.city, user.state].filter(Boolean).join(', ') || 'Not provided'}
                                    </p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaPhone />
                                      Phone Number
                                    </div>
                                    <p className="text-foreground font-medium">{user.phoneNumber || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBriefcase />
                                      Experience
                                    </div>
                                    <p className="text-foreground font-medium">{user.experienceYears || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaGraduationCap />
                                      Qualifications
                                    </div>
                                    <p className="text-foreground font-medium">{user.qualifications || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBook />
                                      Board Affiliation
                                    </div>
                                    <p className="text-foreground font-medium uppercase">{user.boardAffiliation || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
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
                                        <span className="text-muted-foreground">Not provided</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
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
                                        <span className="text-muted-foreground">Not provided</span>
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
                                        <span className="text-muted-foreground text-sm">
                                          Completed on {new Date(user.onboardingCompletedAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : user.role === 'student' ? (
                                /* Student Details - data directly from user object */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBuilding />
                                      School
                                    </div>
                                    <p className="text-foreground font-medium">{user.school || 'Not provided'}</p>
                                  </div>
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaUserGraduate />
                                      Class
                                    </div>
                                    <p className="text-foreground font-medium">{user.class || 'Not provided'}</p>
                                  </div>
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBook />
                                      Curriculum
                                    </div>
                                    <p className="text-foreground font-medium">{user.curriculum || 'Not provided'}</p>
                                  </div>
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaMapMarkerAlt />
                                      Location
                                    </div>
                                    <p className="text-foreground font-medium">
                                      {[user.city, user.state].filter(Boolean).join(', ') || 'Not provided'}
                                    </p>
                                  </div>
                                  {user.age != null && (
                                    <div className="p-4 rounded-xl bg-card/50 border border-border">
                                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                        <FaUserCheck />
                                        Age
                                      </div>
                                      <p className="text-foreground font-medium">{user.age}</p>
                                    </div>
                                  )}
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
                                        <span className="text-muted-foreground text-sm">
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
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaSchool />
                                      School Name
                                    </div>
                                    <p className="text-foreground font-medium">{user.schoolName || user.name || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBuilding />
                                      School Type
                                    </div>
                                    <p className="text-foreground font-medium capitalize">{user.schoolType || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaCalendarAlt />
                                      Established Year
                                    </div>
                                    <p className="text-foreground font-medium">{user.establishedYear || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaMapMarkerAlt />
                                      Full Address
                                    </div>
                                    <p className="text-foreground font-medium">
                                      {user.address || 'No address'}
                                      {user.city && `, ${user.city}`}
                                      {user.state && `, ${user.state}`}
                                      {user.pincode && ` - ${user.pincode}`}
                                    </p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaUserCheck />
                                      Contact Person
                                    </div>
                                    <p className="text-foreground font-medium">{user.contactPerson || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaPhone />
                                      Contact Phone
                                    </div>
                                    <p className="text-foreground font-medium">{user.contactPhone || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaGlobe />
                                      Website
                                    </div>
                                    {user.website ? (
                                      <a href={user.website} target="_blank" rel="noopener noreferrer" 
                                         className="text-primary hover:underline font-medium truncate block">
                                        {user.website}
                                      </a>
                                    ) : (
                                      <p className="text-muted-foreground">Not provided</p>
                                    )}
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaBook />
                                      Board Affiliation
                                    </div>
                                    <p className="text-foreground font-medium uppercase">{user.boardAffiliation || 'Not provided'}</p>
                                  </div>
                                  
                                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                      <FaUsers />
                                      Student Count
                                    </div>
                                    <p className="text-foreground font-medium">{user.studentCount || 'Not provided'}</p>
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
                                        <span className="text-muted-foreground text-sm">
                                          Completed on {new Date(user.onboardingCompletedAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* Other roles (principal, associate, admin, superadmin) – show status from flag */
                                <div className="grid grid-cols-1 gap-4">
                                  <div className={`p-4 rounded-xl border md:col-span-2 lg:col-span-3 ${user.onboardingCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {user.onboardingCompleted ? (
                                          <>
                                            <FaCheck className="text-emerald-400" />
                                            <span className="text-emerald-400 font-medium">Onboarding Completed</span>
                                          </>
                                        ) : (
                                          <>
                                            <FaExclamationCircle className="text-amber-400" />
                                            <span className="text-amber-400 font-medium">Onboarding Not Completed</span>
                                          </>
                                        )}
                                      </div>
                                      {user.onboardingCompletedAt && (
                                        <span className="text-muted-foreground text-sm">
                                          Completed on {new Date(user.onboardingCompletedAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    {!user.onboardingCompleted && (
                                      <p className="text-muted-foreground text-sm mt-2">
                                        Waiting for user to complete profile setup. Consider reaching out to remind them.
                                      </p>
                                    )}
                                  </div>
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
          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <FaChalkboardTeacher className="text-primary text-xl" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Teachers</p>
                <p className="text-2xl font-bold text-foreground">{stats.teachers}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <FaSchool className="text-primary text-xl" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Schools</p>
                <p className="text-2xl font-bold text-foreground">{stats.schools}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Approvals;
