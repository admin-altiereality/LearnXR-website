/**
 * School Approvals Page
 * 
 * Allows schools to approve teachers in their school
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { 
  FaUserCheck, 
  FaUserTimes, 
  FaSearch, 
  FaChalkboardTeacher,
  FaCheck,
  FaTimes,
  FaSpinner,
  FaSchool
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { 
  canApproveUser,
  UserProfile,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS
} from '../../utils/rbac';
import { toast } from 'react-toastify';

interface PendingTeacher extends UserProfile {
  id: string;
}

const SchoolApprovals = () => {
  const { profile } = useAuth();
  const [pendingTeachers, setPendingTeachers] = useState<PendingTeacher[]>([]);
  const [approvedTeachers, setApprovedTeachers] = useState<PendingTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // Check if user is a school
  useEffect(() => {
    if (profile && profile.role !== 'school') {
      toast.error('Only schools can access this page');
      return;
    }
  }, [profile]);

  // Fetch pending teachers in school
  useEffect(() => {
    if (!profile || profile.role !== 'school' || !profile.school_id) {
      setLoading(false);
      return;
    }

    const schoolId = profile.school_id || profile.managed_school_id;
    
    const usersRef = collection(db, 'users');
    const pendingQuery = query(
      usersRef,
      where('role', '==', 'teacher'),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const teachers: PendingTeacher[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        
        // Check if teacher is in this school
        const isInSchool = data.school_id === schoolId;
        
        if (isInSchool && canApproveUser(profile, data)) {
          teachers.push({
            id: docSnapshot.id,
            ...data,
          } as PendingTeacher);
        }
      });

      setPendingTeachers(teachers);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending teachers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Fetch approved teachers
  useEffect(() => {
    if (!profile || profile.role !== 'school' || !profile.school_id) {
      return;
    }

    const schoolId = profile.school_id || profile.managed_school_id;
    
    const usersRef = collection(db, 'users');
    const approvedQuery = query(
      usersRef,
      where('role', '==', 'teacher'),
      where('approvalStatus', '==', 'approved')
    );

    const unsubscribe = onSnapshot(approvedQuery, (snapshot) => {
      const teachers: PendingTeacher[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        
        const isInSchool = data.school_id === schoolId;
        
        if (isInSchool && canApproveUser(profile, data)) {
          teachers.push({
            id: docSnapshot.id,
            ...data,
          } as PendingTeacher);
        }
      });

      setApprovedTeachers(teachers);
    }, (error) => {
      console.error('Error fetching approved teachers:', error);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleApprove = async (teacherId: string) => {
    if (!profile || !canApproveUser(profile, { role: 'teacher' } as UserProfile)) {
      toast.error('You do not have permission to approve this teacher');
      return;
    }

    setProcessingId(teacherId);
    try {
      const now = new Date().toISOString();
      const userRef = doc(db, 'users', teacherId);
      await updateDoc(userRef, {
        approvalStatus: 'approved',
        approvedBy: profile.uid,
        approvedAt: now,
        updatedAt: now,
      });

      toast.success('Teacher approved successfully');
    } catch (error: any) {
      console.error('Error approving teacher:', error);
      toast.error('Failed to approve teacher: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (teacherId: string) => {
    if (!profile || !canApproveUser(profile, { role: 'teacher' } as UserProfile)) {
      toast.error('You do not have permission to reject this teacher');
      return;
    }

    setProcessingId(teacherId);
    try {
      const now = new Date().toISOString();
      const userRef = doc(db, 'users', teacherId);
      await updateDoc(userRef, {
        approvalStatus: 'rejected',
        rejectedBy: profile.uid,
        rejectedAt: now,
        updatedAt: now,
      });

      toast.success('Teacher rejected');
    } catch (error: any) {
      console.error('Error rejecting teacher:', error);
      toast.error('Failed to reject teacher: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPending = pendingTeachers.filter(teacher =>
    teacher.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredApproved = approvedTeachers.filter(teacher =>
    teacher.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (profile?.role !== 'school') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center">
          <p className="text-white">Only schools can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Teacher Approvals</h1>
          <p className="text-slate-400">Approve teachers in your school</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Pending ({filteredPending.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'approved'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Approved ({filteredApproved.length})
          </button>
        </div>

        {/* Teachers List */}
        {loading ? (
          <div className="text-center py-12">
            <FaSpinner className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading teachers...</p>
          </div>
        ) : activeTab === 'pending' ? (
          filteredPending.length === 0 ? (
            <div className="text-center py-12">
              <FaChalkboardTeacher className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No pending teachers in your school</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPending.map((teacher) => (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-lg border border-slate-700 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <FaChalkboardTeacher className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{teacher.name || teacher.email}</h3>
                        <p className="text-slate-400 text-sm">{teacher.email}</p>
                        {teacher.subjectsTaught && teacher.subjectsTaught.length > 0 && (
                          <p className="text-slate-500 text-xs mt-1">
                            Subjects: {teacher.subjectsTaught.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(teacher.id)}
                        disabled={processingId === teacher.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processingId === teacher.id ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <>
                            <FaCheck />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(teacher.id)}
                        disabled={processingId === teacher.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <FaTimes />
                        Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          filteredApproved.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No approved teachers</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApproved.map((teacher) => (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-lg border border-emerald-500/20 p-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <FaChalkboardTeacher className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{teacher.name || teacher.email}</h3>
                      <p className="text-slate-400 text-sm">{teacher.email}</p>
                      {teacher.subjectsTaught && teacher.subjectsTaught.length > 0 && (
                        <p className="text-slate-500 text-xs mt-1">
                          Subjects: {teacher.subjectsTaught.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default SchoolApprovals;
