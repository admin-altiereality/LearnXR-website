/**
 * Student Approvals Page
 * 
 * Allows teachers to approve students in their classes
 * Allows principals to approve students in their school
 * 
 * Filtering:
 * - Teachers: Filter by school_id matching, then by class_ids intersection
 * - Principals: Filter by school_id matching (managed_school_id)
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  onSnapshot,
  getDoc
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
  FaBook,
  FaHashtag
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { 
  canApproveUser,
  UserProfile,
} from '../../utils/rbac';
import { toast } from 'react-toastify';
import type { School, Class } from '../../types/lms';
import { getSchoolById } from '../../services/schoolManagementService';
import { assignStudentToClass } from '../../services/classManagementService';

interface PendingStudent extends UserProfile {
  id: string;
  schoolCode?: string; // School code for display
  className?: string; // Class name for display
}

const TeacherApprovals = () => {
  const { profile } = useAuth();
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [schoolsCache, setSchoolsCache] = useState<Map<string, School>>(new Map());
  const [classesCache, setClassesCache] = useState<Map<string, Class>>(new Map());

  // Check if user is a teacher or principal
  useEffect(() => {
    if (profile && profile.role !== 'teacher' && profile.role !== 'principal') {
      toast.error('Only teachers and principals can access this page');
      return;
    }
  }, [profile]);

  // Fetch school and class data for display
  useEffect(() => {
    if (!profile || (profile.role !== 'teacher' && profile.role !== 'principal')) {
      return;
    }

    const fetchSchoolAndClassData = async () => {
      const schoolsMap = new Map<string, School>();
      const classesMap = new Map<string, Class>();

      // Get teacher's/principal's school_id
      const schoolId = profile.role === 'teacher' 
        ? profile.school_id 
        : profile.managed_school_id;

      if (schoolId) {
        // Fetch school to get school code
        const school = await getSchoolById(schoolId);
        if (school) {
          schoolsMap.set(schoolId, school);
        }
      }

      // For teachers, fetch their classes
      if (profile.role === 'teacher' && profile.managed_class_ids) {
        let firstClassSchoolId: string | null = null;
        
        for (const classId of profile.managed_class_ids) {
          try {
            const classDoc = await getDoc(doc(db, 'classes', classId));
            if (classDoc.exists()) {
              const classData = { id: classDoc.id, ...classDoc.data() } as Class;
              classesMap.set(classId, classData);
              
              // Store first class's school_id for auto-assignment if needed
              if (!firstClassSchoolId && classData.school_id) {
                firstClassSchoolId = classData.school_id;
              }
            }
          } catch (error) {
            console.error(`Error fetching class ${classId}:`, error);
          }
        }
        
        // Auto-assign school_id if teacher is missing it but has classes
        if (!profile.school_id && firstClassSchoolId && profile.uid) {
          try {
            console.log('🔧 TeacherApprovals: Auto-assigning school_id from class', {
              teacherId: profile.uid,
              schoolId: firstClassSchoolId,
            });
            await updateDoc(doc(db, 'users', profile.uid), {
              school_id: firstClassSchoolId,
              updatedAt: new Date().toISOString(),
            });
            console.log('✅ TeacherApprovals: Successfully assigned school_id to teacher');
            // Note: The profile will update via AuthContext listener
          } catch (error: any) {
            console.error('❌ TeacherApprovals: Error auto-assigning school_id', {
              error,
              errorCode: error.code,
              errorMessage: error.message,
            });
          }
        }
      }

      setSchoolsCache(schoolsMap);
      setClassesCache(classesMap);
    };

    fetchSchoolAndClassData();
  }, [profile]);

  // Helper function to filter and enrich students with display data
  // NOTE: For pending students, we don't filter by class_ids (they don't have classes yet)
  // For approved students, we can optionally filter by class_ids if needed
  const filterStudents = (students: UserProfile[], isPending: boolean = false): PendingStudent[] => {
    if (!profile) return [];

    const filtered: PendingStudent[] = [];

    for (const student of students) {
      // School ID check (already filtered at DB level, but verify for safety)
      if (profile.role === 'teacher') {
        const teacherSchoolId = profile.school_id;
        const studentSchoolId = student.school_id;
        if (!teacherSchoolId || !studentSchoolId || teacherSchoolId !== studentSchoolId) {
          continue; // Skip if not in same school
        }
        
        // For PENDING students: Don't filter by class_ids (they don't have classes yet)
        // Teachers can approve any pending student in their school
        // For APPROVED students: Show students where this teacher is in teacher_ids or class_teacher_id
        // Also show students without classes yet (class assignment might be pending)
        if (!isPending) {
          const studentClassIds = student.class_ids || [];
          
          // If student has no classes, still show them (class assignment might be pending or failed)
          if (studentClassIds.length === 0) {
            // Allow showing students without classes - they might be newly approved
            // The teacher can manually assign them to a class if needed
          } else {
            // Check if teacher is in teacher_ids or is the class_teacher_id for any of student's classes
            let isTeacherForStudent = false;
            for (const classId of studentClassIds) {
              const classData = classesCache.get(classId);
              if (classData) {
                // Check if teacher is the class teacher
                if (classData.class_teacher_id === profile.uid) {
                  isTeacherForStudent = true;
                  break;
                }
                // Also check if teacher is in teacher_ids (they might teach the class)
                if (classData.teacher_ids && classData.teacher_ids.includes(profile.uid)) {
                  isTeacherForStudent = true;
                  break;
                }
              }
            }
            
            // If student has classes but teacher is not assigned to any of them, skip
            if (!isTeacherForStudent) {
              continue;
            }
          }
        }
      }

      // For principals: check school_id match (already filtered at DB level)
      if (profile.role === 'principal') {
        const principalSchoolId = profile.managed_school_id;
        const studentSchoolId = student.school_id;
        if (!principalSchoolId || !studentSchoolId || principalSchoolId !== studentSchoolId) {
          continue; // Skip if not in same school
        }
      }

      // Get school code and class name for display
      const studentSchoolId = student.school_id;
      const school = studentSchoolId ? schoolsCache.get(studentSchoolId) : null;
      const schoolCode = school?.schoolCode || 'N/A';

      // Get class name
      let className = student.class || 'Not Assigned';
      if (student.class_ids && student.class_ids.length > 0) {
        const firstClassId = student.class_ids[0];
        const classData = classesCache.get(firstClassId);
        if (classData) {
          className = classData.class_name;
        }
      }

      filtered.push({
        ...student,
        id: (student as any).id || student.uid,
        schoolCode,
        className,
      } as PendingStudent);
    }

    return filtered;
  };

  // Helper function to set up the pending students query
  const setupPendingStudentsQuery = (schoolId: string) => {
    if (!profile) return null;

    console.log('🔍 TeacherApprovals: Fetching students for', {
      role: profile.role,
      schoolId,
      teacherClassIds: profile.role === 'teacher' ? profile.managed_class_ids : undefined,
      profileSchoolId: profile.school_id,
      profileManagedSchoolId: profile.managed_school_id,
    });

    const usersRef = collection(db, 'users');
    
    // Query pending students filtered by school_id at database level
    const pendingQuery = query(
      usersRef,
      where('role', '==', 'student'),
      where('school_id', '==', schoolId),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingQuery, async (snapshot) => {
      const allStudents: UserProfile[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        allStudents.push({
          ...data,
          uid: docSnapshot.id,
          id: docSnapshot.id,
        } as any);
      });

      console.log('🔍 TeacherApprovals: Raw query results', {
        totalFromDB: allStudents.length,
        schoolId,
        students: allStudents.map(s => ({
          uid: s.uid,
          name: s.name || s.email,
          school_id: s.school_id,
          approvalStatus: s.approvalStatus,
          class_ids: s.class_ids,
        })),
      });

      // For pending students: Don't filter by class_ids (they don't have classes yet)
      // School_id already filtered at DB level
      const filtered = filterStudents(allStudents, true); // true = isPending

      console.log('🔍 TeacherApprovals: Filtered pending students', {
        totalFromDB: allStudents.length,
        filtered: filtered.length,
        schoolId,
        role: profile.role,
        teacherClassIds: profile.role === 'teacher' ? profile.managed_class_ids : undefined,
        filteredStudents: filtered.map(s => ({
          id: s.id || s.uid,
          name: s.name || s.email,
          school_id: s.school_id,
        })),
      });

      if (allStudents.length > 0 && filtered.length === 0) {
        console.warn('⚠️ TeacherApprovals: Students found but filtered out', {
          totalFromDB: allStudents.length,
          schoolId,
          role: profile.role,
        });
      }

      setPendingStudents(filtered);
      setLoading(false);
    }, (error) => {
      console.error('❌ TeacherApprovals: Error fetching pending students', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        schoolId,
        role: profile.role,
      });
      toast.error(`Failed to load pending students: ${error.message || 'Unknown error'}`);
      setLoading(false);
    });

    return unsubscribe;
  };

  // Fetch pending students
  useEffect(() => {
    if (!profile || (profile.role !== 'teacher' && profile.role !== 'principal')) {
      setLoading(false);
      return;
    }

    // Get the school_id to filter by - use the most reliable source
    let schoolId = profile.role === 'teacher' 
      ? (profile.school_id || profile.managed_school_id)
      : profile.managed_school_id;

    // For teachers: if school_id is missing but they have classes, fetch it directly from a class
    if (!schoolId && profile.role === 'teacher' && profile.managed_class_ids && profile.managed_class_ids.length > 0) {
      // First check cache
      const firstClass = Array.from(classesCache.values())[0];
      if (firstClass?.school_id) {
        schoolId = firstClass.school_id;
        console.log('🔧 TeacherApprovals: Using school_id from class cache', {
          schoolId,
          classId: firstClass.id,
        });
      } else {
        // If not in cache, fetch directly from Firestore
        const fetchSchoolIdFromClass = async () => {
          try {
            const firstClassId = profile.managed_class_ids[0];
            const classDoc = await getDoc(doc(db, 'classes', firstClassId));
            if (classDoc.exists()) {
              const classData = classDoc.data();
              if (classData.school_id) {
                const fetchedSchoolId = classData.school_id;
                console.log('🔧 TeacherApprovals: Fetched school_id directly from class', {
                  schoolId: fetchedSchoolId,
                  classId: firstClassId,
                });
                
                // Auto-assign to profile if missing
                if (!profile.school_id && profile.uid) {
                  await updateDoc(doc(db, 'users', profile.uid), {
                    school_id: fetchedSchoolId,
                    updatedAt: new Date().toISOString(),
                  });
                  console.log('✅ TeacherApprovals: Auto-assigned school_id to teacher profile');
                }
                
                // Set up the query immediately with the fetched school_id
                const unsubscribe = setupPendingStudentsQuery(fetchedSchoolId);
                if (unsubscribe) {
                  return () => unsubscribe();
                }
              } else {
                console.warn('⚠️ TeacherApprovals: Class found but no school_id', {
                  classId: firstClassId,
                });
                setLoading(false);
              }
            } else {
              console.warn('⚠️ TeacherApprovals: Class not found', {
                classId: firstClassId,
              });
              setLoading(false);
            }
          } catch (error: any) {
            console.error('❌ TeacherApprovals: Error fetching school_id from class', {
              error,
              errorCode: error.code,
              errorMessage: error.message,
            });
            setLoading(false);
          }
          return undefined;
        };
        
        // Note: We can't return from an async function in useEffect, so we'll set up the query here
        // The async function will handle the query setup
        fetchSchoolIdFromClass();
        return; // Exit early, will continue in fetchSchoolIdFromClass
      }
    }

    if (!schoolId) {
      console.warn('⚠️ TeacherApprovals: No school_id found for', profile.role, {
        role: profile.role,
        hasSchoolId: !!profile.school_id,
        hasManagedSchoolId: !!profile.managed_school_id,
        hasClasses: profile.role === 'teacher' ? !!profile.managed_class_ids?.length : undefined,
        profileUid: profile.uid,
      });
      setLoading(false);
      return;
    }

    // Set up the student query
    const unsubscribe = setupPendingStudentsQuery(schoolId);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile, schoolsCache, classesCache]);

  // Fetch approved students
  useEffect(() => {
    if (!profile || (profile.role !== 'teacher' && profile.role !== 'principal')) {
      return;
    }

    const schoolId = profile.role === 'teacher' 
      ? profile.school_id 
      : profile.managed_school_id;

    if (!schoolId) {
      return;
    }

    const usersRef = collection(db, 'users');
    const approvedQuery = query(
      usersRef,
      where('role', '==', 'student'),
      where('school_id', '==', schoolId),
      where('approvalStatus', '==', 'approved')
    );

    const unsubscribe = onSnapshot(approvedQuery, async (snapshot) => {
      const allStudents: UserProfile[] = [];
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        allStudents.push({
          ...data,
          uid: docSnapshot.id,
          id: docSnapshot.id,
        } as any);
      });

      // For approved students: School_id already filtered at DB level
      // Optionally filter by class_ids if needed (currently showing all approved students in school)
      const filtered = filterStudents(allStudents, false); // false = not pending
      
      console.log('🔍 TeacherApprovals: Approved students', {
        total: allStudents.length,
        filtered: filtered.length,
        schoolId,
      });
      
      setApprovedStudents(filtered);
    }, (error) => {
      console.error('Error fetching approved students:', error);
    });

    return () => unsubscribe();
  }, [profile, schoolsCache, classesCache]);

  const handleApprove = async (studentId: string) => {
    if (!profile) {
      toast.error('Authentication required');
      return;
    }

    // Verify we can approve this student
    const student = pendingStudents.find(s => s.id === studentId || s.uid === studentId);
    if (!student) {
      console.error('❌ TeacherApprovals: Student not found', {
        studentId,
        pendingStudentsIds: pendingStudents.map(s => s.id || s.uid),
      });
      toast.error('Student not found in pending list');
      return;
    }

    // Check permission with detailed logging
    const canApprove = canApproveUser(profile, student);
    
    // Additional check: For approved students (with classes), verify teacher is class teacher
    if (profile.role === 'teacher' && student.approvalStatus !== 'pending' && student.class_ids && student.class_ids.length > 0) {
      let isClassTeacher = false;
      for (const classId of student.class_ids) {
        const classData = classesCache.get(classId);
        if (classData && classData.class_teacher_id === profile.uid) {
          isClassTeacher = true;
          break;
        }
      }
      
      if (!isClassTeacher) {
        toast.error('Only the class teacher can approve students in this class');
        return;
      }
    }
    
    console.log('🔍 TeacherApprovals: Checking approval permission', {
      studentId,
      studentName: student.name || student.email,
      studentSchoolId: student.school_id,
      approverRole: profile.role,
      approverSchoolId: profile.role === 'teacher' ? profile.school_id : profile.managed_school_id,
      canApprove,
      studentApprovalStatus: student.approvalStatus,
    });

    if (!canApprove) {
      console.warn('⚠️ TeacherApprovals: Permission denied', {
        studentId,
        approverRole: profile.role,
        studentSchoolId: student.school_id,
        approverSchoolId: profile.role === 'teacher' ? profile.school_id : profile.managed_school_id,
      });
      toast.error('You do not have permission to approve this student. Check that the student is in your school.');
      return;
    }

    setProcessingId(studentId);
    try {
      const now = new Date().toISOString();
      const userRef = doc(db, 'users', studentId);
      
      // Get the approver's school_id to ensure student has correct school_id
      const approverSchoolId = profile.role === 'teacher' 
        ? profile.school_id 
        : profile.managed_school_id;
      
      // Prepare update data - ensure school_id is preserved or set correctly
      const updateData: Record<string, unknown> = {
        approvalStatus: 'approved',
        approvedBy: profile.uid,
        approvedAt: now,
        updatedAt: now,
      };
      
      // If student doesn't have school_id, set it from approver's school
      // If student has school_id but it doesn't match approver, update it
      if (!student.school_id || (approverSchoolId && student.school_id !== approverSchoolId)) {
        if (approverSchoolId) {
          updateData.school_id = approverSchoolId;
          console.log('🔧 TeacherApprovals: Setting/updating student school_id', {
            studentId,
            oldSchoolId: student.school_id,
            newSchoolId: approverSchoolId,
          });
        } else {
          console.warn('⚠️ TeacherApprovals: Approver missing school_id, preserving student school_id', {
            studentId,
            studentSchoolId: student.school_id,
            approverRole: profile.role,
          });
        }
      }
      
      console.log('🔍 TeacherApprovals: Approving student', {
        studentId,
        studentName: student.name || student.email,
        approverUid: profile.uid,
        approverRole: profile.role,
        schoolId: updateData.school_id || student.school_id,
      });

      await updateDoc(userRef, updateData);

      console.log('✅ TeacherApprovals: Student approved successfully', { studentId });

      // If approver is a teacher, assign student to teacher's class
      if (profile.role === 'teacher') {
        try {
          let targetClassId: string | null = null;
          
          // First, try to find a class where teacher is the class_teacher_id
          if (profile.managed_class_ids && profile.managed_class_ids.length > 0) {
            for (const classId of profile.managed_class_ids) {
              const classData = classesCache.get(classId);
              if (classData && classData.class_teacher_id === profile.uid) {
                targetClassId = classId;
                break;
              }
            }
            
            // If no class found where teacher is class_teacher_id, use the first class
            if (!targetClassId) {
              targetClassId = profile.managed_class_ids[0];
            }
          } else {
            // Teacher has no managed_class_ids - try to find classes where teacher is in teacher_ids
            console.log('⚠️ TeacherApprovals: Teacher has no managed_class_ids, searching for classes', {
              teacherId: profile.uid,
              schoolId: profile.school_id,
            });
            
            if (profile.school_id) {
              // First, try to find classes where teacher is in teacher_ids
              const classesQuery = query(
                collection(db, 'classes'),
                where('school_id', '==', profile.school_id),
                where('teacher_ids', 'array-contains', profile.uid)
              );
              const classesSnapshot = await getDocs(classesQuery);
              
              if (!classesSnapshot.empty) {
                const firstClass = classesSnapshot.docs[0];
                targetClassId = firstClass.id;
                // Update cache
                const classData = { id: firstClass.id, ...firstClass.data() } as Class;
                classesCache.set(targetClassId, classData);
                console.log('🔧 TeacherApprovals: Found class for teacher', {
                  classId: targetClassId,
                  className: classData.class_name,
                });
              } else {
                // If no classes found with teacher in teacher_ids, check if there are any classes in the school
                // This handles the case where classes exist but teacher isn't assigned yet
                const allClassesQuery = query(
                  collection(db, 'classes'),
                  where('school_id', '==', profile.school_id)
                );
                const allClassesSnapshot = await getDocs(allClassesQuery);
                
                if (!allClassesSnapshot.empty) {
                  // Found classes in school but teacher isn't assigned - use the first one
                  // The assignStudentToClass function will add the teacher to teacher_ids
                  const firstClass = allClassesSnapshot.docs[0];
                  targetClassId = firstClass.id;
                  const classData = { id: firstClass.id, ...firstClass.data() } as Class;
                  classesCache.set(targetClassId, classData);
                  console.log('🔧 TeacherApprovals: Found class in school (teacher not assigned yet), will assign teacher', {
                    classId: targetClassId,
                    className: classData.class_name,
                  });
                } else {
                  console.warn('⚠️ TeacherApprovals: No classes found in school', {
                    schoolId: profile.school_id,
                    teacherId: profile.uid,
                  });
                }
              }
            }
          }
          
          if (targetClassId) {
            console.log('🔧 TeacherApprovals: Assigning student to teacher\'s class', {
              studentId,
              classId: targetClassId,
              teacherUid: profile.uid,
              teacherManagedClasses: profile.managed_class_ids,
            });
            
            // Assign student to class (this updates both class.student_ids and user.class_ids)
            const assigned = await assignStudentToClass(profile, studentId, targetClassId);
            
            if (assigned) {
              console.log('✅ TeacherApprovals: Student assigned to class successfully', {
                studentId,
                classId: targetClassId,
              });
              toast.success('Student approved and assigned to your class successfully');
            } else {
              console.warn('⚠️ TeacherApprovals: Failed to assign student to class', {
                studentId,
                classId: targetClassId,
              });
              toast.warn('Student approved, but class assignment failed. Please assign manually.');
            }
          } else {
            console.warn('⚠️ TeacherApprovals: No class found to assign student', {
              studentId,
              teacherManagedClasses: profile.managed_class_ids,
              teacherSchoolId: profile.school_id,
            });
            toast.warn(
              'Student approved, but no class found. ' +
              'Please ask your school administrator to create a class and assign you as the class teacher, ' +
              'or manually assign this student to a class from the Class Management page.',
              { duration: 6000 }
            );
          }
        } catch (classAssignError: any) {
          console.error('❌ TeacherApprovals: Error assigning student to class', {
            error: classAssignError,
            studentId,
            errorCode: classAssignError.code,
            errorMessage: classAssignError.message,
            stack: classAssignError.stack,
          });
          // Don't fail the approval if class assignment fails - student is already approved
          toast.warn('Student approved, but class assignment failed. Please assign manually.');
        }
      } else {
        // For principals or teachers without classes, just show success
        toast.success('Student approved successfully');
      }
    } catch (error: any) {
      console.error('❌ TeacherApprovals: Error approving student', {
        error,
        studentId,
        errorCode: error.code,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      toast.error(`Failed to approve student: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (studentId: string) => {
    if (!profile) {
      toast.error('Authentication required');
      return;
    }

    // Verify we can approve this student - check both id and uid
    const student = pendingStudents.find(s => (s.id === studentId) || (s.uid === studentId));
    if (!student) {
      console.error('❌ TeacherApprovals: Student not found for rejection', {
        studentId,
        pendingStudentsIds: pendingStudents.map(s => ({ id: s.id, uid: s.uid })),
      });
      toast.error('Student not found in pending list');
      return;
    }

    const canReject = canApproveUser(profile, student);
    if (!canReject) {
      console.warn('⚠️ TeacherApprovals: Permission denied for rejection', {
        studentId,
        approverRole: profile.role,
      });
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

  const filteredPending = useMemo(() => {
    return pendingStudents.filter(student =>
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.schoolCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.className?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pendingStudents, searchQuery]);

  const filteredApproved = useMemo(() => {
    return approvedStudents.filter(student =>
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.schoolCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.className?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [approvedStudents, searchQuery]);

  if (profile?.role !== 'teacher' && profile?.role !== 'principal') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center">
          <p className="text-white text-lg mb-2">Access Denied</p>
          <p className="text-slate-400">Only teachers and principals can access this page.</p>
          <p className="text-slate-500 text-sm mt-2">Your role: {profile?.role || 'Unknown'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Student Approvals</h1>
              <p className="text-slate-400">
                {profile?.role === 'teacher' 
                  ? 'Approve students in your school' 
                  : 'Approve students in your school'}
              </p>
            </div>
            {pendingStudents.length > 0 && (
              <div className="px-4 py-2 bg-amber-500/20 border border-amber-500/50 rounded-lg">
                <p className="text-amber-300 font-semibold">
                  {pendingStudents.length} Pending Approval{pendingStudents.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {profile?.role === 'teacher' && (
                <>
                  <div>
                    <span className="text-slate-400">School ID: </span>
                    <span className="text-white font-mono">{profile.school_id || '❌ Not Set'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Classes Assigned: </span>
                    <span className="text-white">{profile.managed_class_ids?.length || 0}</span>
                  </div>
                </>
              )}
              {profile?.role === 'principal' && (
                <div>
                  <span className="text-slate-400">School ID: </span>
                  <span className="text-white font-mono">{profile.managed_school_id || '❌ Not Set'}</span>
                </div>
              )}
            </div>
            {!profile?.school_id && profile?.role === 'teacher' && (
              <p className="text-amber-400 text-xs mt-2">
                ⚠️ Warning: You don't have a school_id set. Contact your administrator.
              </p>
            )}
            {!profile?.managed_school_id && profile?.role === 'principal' && (
              <p className="text-amber-400 text-xs mt-2">
                ⚠️ Warning: You don't have a managed_school_id set. Contact your administrator.
              </p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, school code, or class..."
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
              <p className="text-slate-400 text-lg mb-2">
                {profile?.role === 'teacher' 
                  ? 'No pending students found' 
                  : 'No pending students in your school'}
              </p>
              <p className="text-slate-500 text-sm mb-4">
                {profile?.role === 'teacher' 
                  ? 'Students who join your school will appear here for approval.' 
                  : 'Students who join your school will appear here for approval.'}
              </p>
              <div className="bg-slate-800/50 rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-slate-300 text-sm font-semibold mb-2">Troubleshooting:</p>
                <ul className="text-slate-400 text-xs space-y-1 list-disc list-inside">
                  {profile?.role === 'teacher' && (
                    <>
                      <li>Check that you have a school_id: {profile.school_id || '❌ Missing'}</li>
                      <li>Check browser console (F12) for debug logs</li>
                      <li>Verify students have completed onboarding</li>
                      <li>Verify students have approvalStatus: 'pending'</li>
                      <li>Verify students have the same school_id as you</li>
                    </>
                  )}
                  {profile?.role === 'principal' && (
                    <>
                      <li>Check that you have a managed_school_id: {profile.managed_school_id || '❌ Missing'}</li>
                      <li>Check browser console (F12) for debug logs</li>
                      <li>Verify students have completed onboarding</li>
                      <li>Verify students have approvalStatus: 'pending'</li>
                      <li>Verify students have the same school_id as your managed school</li>
                    </>
                  )}
                </ul>
              </div>
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
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <FaUserGraduate className="text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">{student.name || student.email}</h3>
                        <p className="text-slate-400 text-sm">{student.email}</p>
                        <div className="flex items-center gap-4 mt-2">
                          {student.schoolCode && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <FaHashtag className="text-slate-600" />
                              <span>Code: {student.schoolCode}</span>
                            </div>
                          )}
                          {student.className && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <FaBook className="text-slate-600" />
                              <span>{student.className}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const studentId = student.id || student.uid;
                          console.log('🔍 TeacherApprovals: Approve button clicked', {
                            studentId,
                            studentUid: student.uid,
                            studentName: student.name || student.email,
                            studentSchoolId: student.school_id,
                          });
                          handleApprove(studentId);
                        }}
                        disabled={processingId === (student.id || student.uid)}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-emerald-500/50"
                      >
                        {processingId === (student.id || student.uid) ? (
                          <>
                            <FaSpinner className="animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <FaCheck />
                            Approve Student
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const studentId = student.id || student.uid;
                          console.log('🔍 TeacherApprovals: Reject button clicked', {
                            studentId,
                            studentUid: student.uid,
                          });
                          handleReject(studentId);
                        }}
                        disabled={processingId === (student.id || student.uid)}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-red-500/50"
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
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{student.name || student.email}</h3>
                      <p className="text-slate-400 text-sm">{student.email}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {student.schoolCode && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <FaHashtag className="text-slate-600" />
                            <span>Code: {student.schoolCode}</span>
                          </div>
                        )}
                        {student.className && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <FaBook className="text-slate-600" />
                            <span>{student.className}</span>
                          </div>
                        )}
                      </div>
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
