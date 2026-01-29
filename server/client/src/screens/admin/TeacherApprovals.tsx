/**
 * Teacher Approvals Page
 * 
 * Allows teachers to approve students in their classes
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
  FaUserGraduate,
  FaCheck,
  FaTimes,
  FaSpinner,
  FaClock,
  FaSchool,
  FaBook
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

interface PendingStudent extends UserProfile {
  id: string;
}

const TeacherApprovals = () => {
  const { profile } = useAuth();
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // Check if user is a teacher
  useEffect(() => {
    if (profile && profile.role !== 'teacher') {
      toast.error('Only teachers can access this page');
      return;
    }
  }, [profile]);

  // Fetch pending students in teacher's classes
  useEffect(() => {
    if (!profile || profile.role !== 'teacher' || !profile.managed_class_ids) {
      setLoading(false);
      return;
    }

    const teacherClassIds = profile.managed_class_ids;
    
    const usersRef = collection(db, 'users');
    const pendingQuery = query(
      usersRef,
      where('role', '==', 'student'),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const students: PendingStudent[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        const studentClassIds = data.class_ids || [];
        
        // Check if student is in any of teacher's classes
        const isInTeacherClass = teacherClassIds.some(classId => 
          studentClassIds.includes(classId)
        );
        
        if (isInTeacherClass && canApproveUser(profile, data)) {
          students.push({
            id: docSnapshot.id,
            ...data,
          } as PendingStudent);
        }
      });

      setPendingStudents(students);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending students:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Fetch approved students
  useEffect(() => {
    if (!profile || profile.role !== 'teacher' || !profile.managed_class_ids) {
      return;
    }

    const teacherClassIds = profile.managed_class_ids;
    
    const usersRef = collection(db, 'users');
    const approvedQuery = query(
      usersRef,
      where('role', '==', 'student'),
      where('approvalStatus', '==', 'approved')
    );

    const unsubscribe = onSnapshot(approvedQuery, (snapshot) => {
      const students: PendingStudent[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        const studentClassIds = data.class_ids || [];
        
        const isInTeacherClass = teacherClassIds.some(classId => 
          studentClassIds.includes(classId)
        );
        
        if (isInTeacherClass && canApproveUser(profile, data)) {
          students.push({
            id: docSnapshot.id,
            ...data,
          } as PendingStudent);
        }
      });

      setApprovedStudents(students);
    }, (error) => {
      console.error('Error fetching approved students:', error);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleApprove = async (studentId: string) => {
    if (!profile || !canApproveUser(profile, { role: 'student' } as UserProfile)) {
      toast.error('You do not have permission to approve this student');
      return;
    }

    setProcessingId(studentId);
    try {
      const now = new Date().toISOString();
      const userRef = doc(db, 'users', studentId);
      await updateDoc(userRef, {
        approvalStatus: 'approved',
        approvedBy: profile.uid,
        approvedAt: now,
        updatedAt: now,
      });

      toast.success('Student approved successfully');
    } catch (error: any) {
      console.error('Error approving student:', error);
      toast.error('Failed to approve student: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (studentId: string) => {
    if (!profile || !canApproveUser(profile, { role: 'student' } as UserProfile)) {
      toast.error('You do not have permission to reject this student');
      return;
    }

    setProcessingId(studentId);
    try {
      const now = new Date().toISOString();
      const userRef = doc(db, 'users', studentId);
      await updateDoc(userRef, {
        approvalStatus: 'rejected',
        rejectedBy: profile.uid,
        rejectedAt: now,
        updatedAt: now,
      });

      toast.success('Student rejected');
    } catch (error: any) {
      console.error('Error rejecting student:', error);
      toast.error('Failed to reject student: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPending = pendingStudents.filter(student =>
    student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredApproved = approvedStudents.filter(student =>
    student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (profile?.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center">
          <p className="text-white">Only teachers can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Student Approvals</h1>
          <p className="text-slate-400">Approve students in your classes</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search students..."
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

        {/* Students List */}
        {loading ? (
          <div className="text-center py-12">
            <FaSpinner className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading students...</p>
          </div>
        ) : activeTab === 'pending' ? (
          filteredPending.length === 0 ? (
            <div className="text-center py-12">
              <FaUserGraduate className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No pending students in your classes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPending.map((student) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-lg border border-slate-700 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <FaUserGraduate className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{student.name || student.email}</h3>
                        <p className="text-slate-400 text-sm">{student.email}</p>
                        {student.class && (
                          <p className="text-slate-500 text-xs mt-1">Class: {student.class}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(student.id)}
                        disabled={processingId === student.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processingId === student.id ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <>
                            <FaCheck />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(student.id)}
                        disabled={processingId === student.id}
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
              <p className="text-slate-400">No approved students</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApproved.map((student) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-lg border border-emerald-500/20 p-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <FaUserGraduate className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{student.name || student.email}</h3>
                      <p className="text-slate-400 text-sm">{student.email}</p>
                      {student.class && (
                        <p className="text-slate-500 text-xs mt-1">Class: {student.class}</p>
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

export default TeacherApprovals;
