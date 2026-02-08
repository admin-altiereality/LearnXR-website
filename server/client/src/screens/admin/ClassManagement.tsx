/**
 * Class Management Component
 * 
 * Allows teachers, school administrators, principals and admins to:
 * - Create classes
 * - Assign students to classes
 * - Assign teachers to classes
 * - View and manage class rosters
 * 
 * Access: Teacher (their school), School Administrator (their school), Principal (their school), Admin/Superadmin (all)
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  createClass,
  assignStudentToClass,
  removeStudentFromClass,
  assignTeacherToClass,
  removeTeacherFromClass,
  getSchoolClasses,
  setClassTeacher,
} from '../../services/classManagementService';
import type { Class } from '../../types/lms';
import { FaPlus, FaUsers, FaChalkboardTeacher, FaTrash, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';

const ClassManagement = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [newClassData, setNewClassData] = useState({
    class_name: '',
    curriculum: 'CBSE',
    subject: '',
    academic_year: new Date().getFullYear().toString(),
    class_teacher_id: '', // Primary class teacher
  });

  useEffect(() => {
    if (!profile) return;

    // Get school_id based on role
    // Principals use managed_school_id, others use school_id
    let schoolId = profile.role === 'principal' 
      ? profile.managed_school_id 
      : (profile.school_id || profile.managed_school_id);

    // For school administrators: if they have managed_school_id but no school_id, auto-assign it
    if (!schoolId && profile.role === 'school' && profile.managed_school_id && profile.uid) {
      schoolId = profile.managed_school_id;
      // Auto-assign school_id from managed_school_id for consistency
      updateDoc(doc(db, 'users', profile.uid), {
        school_id: profile.managed_school_id,
        updatedAt: new Date().toISOString(),
      }).catch((error) => {
        console.warn('⚠️ ClassManagement: Could not auto-assign school_id', error);
      });
    }

    if (!schoolId) {
      console.warn('⚠️ ClassManagement: Missing school_id', {
        role: profile.role,
        school_id: profile.school_id,
        managed_school_id: profile.managed_school_id,
        uid: profile.uid,
      });
      setLoading(false);
      return;
    }

    // Load classes
    const loadClasses = async () => {
      const classesData = await getSchoolClasses(profile, schoolId);
      setClasses(classesData);
    };

    loadClasses();

    // Load students in school
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', schoolId)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setStudents(studentsData);
    });

    // Load teachers in school - query all teachers, we'll filter by approvalStatus in UI
    // Note: We don't filter by approvalStatus in the query because:
    // 1. Some teachers might not have approvalStatus set (backward compatibility)
    // 2. We want to show all teachers but indicate their status
    const teachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('school_id', '==', schoolId)
    );

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      
      // Log detailed information about loaded teachers
      const approvedTeachers = teachersData.filter(t => t.approvalStatus === 'approved');
      const pendingTeachers = teachersData.filter(t => t.approvalStatus === 'pending');
      const noStatusTeachers = teachersData.filter(t => !t.approvalStatus);
      
      console.log('🔍 ClassManagement: Loaded teachers', {
        total: teachersData.length,
        schoolId,
        approved: approvedTeachers.length,
        pending: pendingTeachers.length,
        noStatus: noStatusTeachers.length,
        teachers: teachersData.map(t => ({
          uid: t.uid,
          name: t.name || t.displayName || t.email,
          approvalStatus: t.approvalStatus || 'not set',
          school_id: t.school_id,
        })),
      });
      
      // Show warning if no approved teachers found
      if (teachersData.length > 0 && approvedTeachers.length === 0) {
        console.warn('⚠️ ClassManagement: No approved teachers found', {
          total: teachersData.length,
          pending: pendingTeachers.length,
          noStatus: noStatusTeachers.length,
          schoolId,
        });
      }
      
      setTeachers(teachersData);
      setLoading(false);
    }, (error) => {
      console.error('❌ ClassManagement: Error loading teachers', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        schoolId,
        role: profile.role,
      });
      toast.error(`Failed to load teachers: ${error.message || 'Unknown error'}`);
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeTeachers();
    };
  }, [profile]);

  const handleCreateClass = async () => {
    if (!profile) return;

    // Get school_id based on role
    // Principals use managed_school_id, others use school_id
    const schoolId = profile.role === 'principal' 
      ? profile.managed_school_id 
      : (profile.school_id || profile.managed_school_id);

    if (!schoolId) {
      toast.error('Unable to determine your school. Please ensure you have a school assigned. Contact your administrator if this issue persists.');
      console.warn('⚠️ ClassManagement: Missing school_id when creating class', {
        role: profile.role,
        school_id: profile.school_id,
        managed_school_id: profile.managed_school_id,
        uid: profile.uid,
      });
      return;
    }
    
    if (!newClassData.class_name.trim()) {
      toast.error('Please enter a class name.');
      return;
    }

    const classId = await createClass(profile, {
      school_id: schoolId,
      class_name: newClassData.class_name.trim(),
      curriculum: newClassData.curriculum,
      subject: newClassData.subject || undefined,
      academic_year: newClassData.academic_year || undefined,
      class_teacher_id: newClassData.class_teacher_id || undefined,
    });

    if (classId) {
      setShowCreateModal(false);
      setNewClassData({
        class_name: '',
        curriculum: 'CBSE',
        subject: '',
        academic_year: new Date().getFullYear().toString(),
        class_teacher_id: '',
      });
    }
  };

  const handleAssignStudent = async (studentId: string, classId: string) => {
    if (!profile) return;
    await assignStudentToClass(profile, studentId, classId);
  };

  const handleAssignTeacher = async (teacherId: string, classId: string) => {
    if (!profile) return;
    await assignTeacherToClass(profile, teacherId, classId);
  };

  const handleSetClassTeacher = async (classId: string, teacherId: string | null) => {
    if (!profile) return;
    await setClassTeacher(profile, classId, teacherId);
  };

  // Get school_id for display/checking
  const schoolId = profile?.role === 'principal' 
    ? profile.managed_school_id 
    : (profile?.school_id || profile?.managed_school_id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white/60">Loading class management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <FaUsers className="text-white" />
              </div>
              Class Management
            </h1>
            <p className="text-white/50">Create and manage classes, assign students and teachers</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all flex items-center gap-2"
          >
            <FaPlus />
            Create Class
          </button>
        </div>

        {/* Classes List */}
        <div className="space-y-4">
          {classes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaUsers className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No classes created yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all"
              >
                Create Your First Class
              </button>
            </div>
          ) : (
            classes.map((classItem) => {
              const classStudents = students.filter(s => 
                s.class_ids?.includes(classItem.id)
              );
              const classTeachers = teachers.filter(t => 
                t.managed_class_ids?.includes(classItem.id)
              );

              return (
                <div
                  key={classItem.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">
                        {classItem.class_name}
                      </h3>
                      <p className="text-white/50 text-sm">
                        {classItem.curriculum} • {classItem.subject || 'All Subjects'}
                        {classItem.academic_year && ` • ${classItem.academic_year}`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedClass(classItem);
                        setShowAssignModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all text-sm"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FaChalkboardTeacher className="text-purple-400" />
                        <span className="text-white/70 text-sm font-medium">Teachers ({classTeachers.length})</span>
                      </div>
                      <div className="space-y-1">
                        {classTeachers.length === 0 ? (
                          <p className="text-white/30 text-sm">No teachers assigned</p>
                        ) : (
                          classTeachers.map(teacher => {
                            const isClassTeacher = classItem.class_teacher_id === teacher.uid;
                            return (
                              <div key={teacher.uid} className="flex items-center gap-2">
                                <span className={`text-sm ${isClassTeacher ? 'text-purple-400 font-medium' : 'text-white/50'}`}>
                                  {teacher.name || teacher.displayName || teacher.email}
                                </span>
                                {isClassTeacher && (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Class Teacher
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FaUsers className="text-blue-400" />
                        <span className="text-white/70 text-sm font-medium">Students ({classStudents.length})</span>
                      </div>
                      <div className="space-y-1">
                        {classStudents.length === 0 ? (
                          <p className="text-white/30 text-sm">No students enrolled</p>
                        ) : (
                          classStudents.slice(0, 5).map(student => (
                            <div key={student.uid} className="text-white/50 text-sm">
                              {student.name || student.displayName || student.email}
                            </div>
                          ))
                        )}
                        {classStudents.length > 5 && (
                          <p className="text-white/30 text-sm">+{classStudents.length - 5} more</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create Class Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold text-white mb-4">Create New Class</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-white/70 text-sm mb-1 block">Class Name *</label>
                  <input
                    type="text"
                    value={newClassData.class_name}
                    onChange={(e) => setNewClassData({ ...newClassData, class_name: e.target.value })}
                    placeholder="e.g., Class 8A, Section B"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Curriculum *</label>
                  <select
                    value={newClassData.curriculum}
                    onChange={(e) => setNewClassData({ ...newClassData, curriculum: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-400/50"
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="RBSE">RBSE</option>
                    <option value="ICSE">ICSE</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Subject (Optional)</label>
                  <input
                    type="text"
                    value={newClassData.subject}
                    onChange={(e) => setNewClassData({ ...newClassData, subject: e.target.value })}
                    placeholder="e.g., Science, Mathematics"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Academic Year</label>
                  <input
                    type="text"
                    value={newClassData.academic_year}
                    onChange={(e) => setNewClassData({ ...newClassData, academic_year: e.target.value })}
                    placeholder="e.g., 2024-2025"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm mb-1 block">Class Teacher (Optional)</label>
                  <p className="text-white/40 text-xs mb-2">The class teacher can approve students in this class</p>
                  <select
                    value={newClassData.class_teacher_id}
                    onChange={(e) => setNewClassData({ ...newClassData, class_teacher_id: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-400/50"
                  >
                    <option value="">Select a teacher (optional)</option>
                    {teachers.length === 0 ? (
                      <option value="" disabled>No teachers available</option>
                    ) : (
                      (() => {
                        // Show ALL teachers from the school - approved, pending, or no status
                        // This ensures approved teachers are always visible
                        const availableTeachers = teachers
                          .filter(t => {
                            // Include all teachers - we'll mark their status
                            return true;
                          })
                          .sort((a, b) => {
                            // Sort approved first, then by name
                            if (a.approvalStatus === 'approved' && b.approvalStatus !== 'approved') return -1;
                            if (a.approvalStatus !== 'approved' && b.approvalStatus === 'approved') return 1;
                            const nameA = (a.name || a.displayName || a.email || '').toLowerCase();
                            const nameB = (b.name || b.displayName || b.email || '').toLowerCase();
                            return nameA.localeCompare(nameB);
                          });
                        
                        return availableTeachers.map(teacher => (
                          <option key={teacher.uid} value={teacher.uid}>
                            {teacher.name || teacher.displayName || teacher.email}
                            {teacher.approvalStatus === 'pending' && ' (Pending Approval)'}
                            {teacher.approvalStatus === 'rejected' && ' (Rejected)'}
                            {!teacher.approvalStatus && ' (No Status)'}
                          </option>
                        ));
                      })()
                    )}
                  </select>
                  {teachers.length > 0 && (
                    <p className="text-white/40 text-xs mt-1">
                      {teachers.length} teacher(s) in your school
                      {teachers.filter(t => t.approvalStatus === 'approved').length > 0 && (
                        <span className="text-emerald-400"> ({teachers.filter(t => t.approvalStatus === 'approved').length} approved)</span>
                      )}
                      {teachers.filter(t => t.approvalStatus === 'pending').length > 0 && (
                        <span className="text-amber-400"> ({teachers.filter(t => t.approvalStatus === 'pending').length} pending)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClass}
                  className="flex-1 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Students/Teachers Modal */}
        {showAssignModal && selectedClass && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-white mb-4">
                Manage: {selectedClass.class_name}
              </h2>

              <div className="space-y-6">
                {/* Assign Teachers */}
                <div>
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <FaChalkboardTeacher className="text-purple-400" />
                    Assign Teachers
                  </h3>
                  <div className="mb-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-purple-300 text-xs mb-2">Class Teacher:</p>
                    <select
                      value={selectedClass.class_teacher_id || ''}
                      onChange={(e) => handleSetClassTeacher(selectedClass.id, e.target.value || null)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400/50"
                    >
                      <option value="">No class teacher assigned</option>
                      {(() => {
                        // Show ALL teachers from the school - approved, pending, or no status
                        const availableTeachers = teachers
                          .filter(t => {
                            // Include all teachers - we'll mark their status
                            return true;
                          })
                          .sort((a, b) => {
                            // Sort approved first, then by name
                            if (a.approvalStatus === 'approved' && b.approvalStatus !== 'approved') return -1;
                            if (a.approvalStatus !== 'approved' && b.approvalStatus === 'approved') return 1;
                            const nameA = (a.name || a.displayName || a.email || '').toLowerCase();
                            const nameB = (b.name || b.displayName || b.email || '').toLowerCase();
                            return nameA.localeCompare(nameB);
                          });
                        
                        return availableTeachers.map(teacher => (
                          <option key={teacher.uid} value={teacher.uid}>
                            {teacher.name || teacher.displayName || teacher.email}
                            {teacher.approvalStatus === 'pending' && ' (Pending)'}
                            {teacher.approvalStatus === 'rejected' && ' (Rejected)'}
                            {!teacher.approvalStatus && ' (No Status)'}
                            {teacher.managed_class_ids?.includes(selectedClass.id) && ' (Assigned)'}
                          </option>
                        ));
                      })()}
                    </select>
                    <p className="text-white/40 text-xs mt-2">The class teacher can approve students in this class. Select any approved teacher from your school.</p>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {teachers.length === 0 ? (
                      <p className="text-white/50 text-sm p-2">No teachers available in your school</p>
                    ) : (
                      teachers
                        .filter(t => {
                          // Show all approved teachers from the school
                          return t.approvalStatus === 'approved' || !t.approvalStatus;
                        })
                        .sort((a, b) => {
                          // Sort by name for better UX
                          const nameA = (a.name || a.displayName || a.email || '').toLowerCase();
                          const nameB = (b.name || b.displayName || b.email || '').toLowerCase();
                          return nameA.localeCompare(nameB);
                        })
                        .map(teacher => {
                          const isAssigned = teacher.managed_class_ids?.includes(selectedClass.id);
                          const isClassTeacher = selectedClass.class_teacher_id === teacher.uid;
                          return (
                            <div
                              key={teacher.uid}
                              className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-white/70 text-sm">
                                  {teacher.name || teacher.displayName || teacher.email}
                                </span>
                                {isClassTeacher && (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Class Teacher
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  if (isAssigned) {
                                    removeTeacherFromClass(profile, teacher.uid, selectedClass.id);
                                  } else {
                                    handleAssignTeacher(teacher.uid, selectedClass.id);
                                  }
                                }}
                                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                                  isAssigned
                                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                                    : 'bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30'
                                }`}
                              >
                                {isAssigned ? (
                                  <>
                                    <FaTrash className="inline mr-1" />
                                    Remove
                                  </>
                                ) : (
                                  <>
                                    <FaCheck className="inline mr-1" />
                                    Assign
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Assign Students */}
                <div>
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <FaUsers className="text-blue-400" />
                    Assign Students
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {students.map(student => {
                      const isEnrolled = student.class_ids?.includes(selectedClass.id);
                      return (
                        <div
                          key={student.uid}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                        >
                          <span className="text-white/70 text-sm">
                            {student.name || student.displayName || student.email}
                          </span>
                          <button
                            onClick={() => {
                              if (isEnrolled) {
                                removeStudentFromClass(profile, student.uid, selectedClass.id);
                              } else {
                                handleAssignStudent(student.uid, selectedClass.id);
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-sm transition-all ${
                              isEnrolled
                                ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                                : 'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                            }`}
                          >
                            {isEnrolled ? (
                              <>
                                <FaTrash className="inline mr-1" />
                                Remove
                              </>
                            ) : (
                              <>
                                <FaCheck className="inline mr-1" />
                                Enroll
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedClass(null);
                }}
                className="w-full mt-6 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassManagement;
