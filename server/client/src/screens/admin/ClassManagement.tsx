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
import { getSchoolById, getAllSchools } from '../../services/schoolManagementService';
import { getAvailableSubjects, getAvailableCurriculums } from '../../lib/firebase/queries/curriculumChapters';
import { createCurriculumChangeRequest } from '../../services/curriculumChangeRequestService';
import type { Class, School } from '../../types/lms';
import { FaPlus, FaUsers, FaChalkboardTeacher, FaTrash, FaCheck, FaSchool } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../../Components/ui/button';
import { Card, CardContent } from '../../Components/ui/card';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../Components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../Components/ui/select';
import { Badge } from '../../Components/ui/badge';

const ClassManagement = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [school, setSchool] = useState<{ boardAffiliation?: string } | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [showCurriculumRequestModal, setShowCurriculumRequestModal] = useState(false);
  const [curriculumRequestData, setCurriculumRequestData] = useState({ requestedCurriculum: '', reason: '' });
  const [availableCurriculums, setAvailableCurriculums] = useState<string[]>([]);
  const [submittingCurriculumRequest, setSubmittingCurriculumRequest] = useState(false);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [newClassData, setNewClassData] = useState({
    class_name: '',
    class_number: 0 as number | 0, // 1-12 for dropdown
    curriculum: 'CBSE',
    subject: '',
    academic_year: new Date().getFullYear().toString(),
    class_teacher_id: '', // Primary class teacher
  });

  // Get school_id for display/checking and effects - must be declared before any useEffect that uses it
  // For admin/superadmin without a profile school, use selected school from dropdown
  const profileSchoolId = profile?.role === 'principal'
    ? profile.managed_school_id
    : (profile?.school_id || profile?.managed_school_id);
  const isAdminOrSuperadmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const schoolId = profileSchoolId ?? (isAdminOrSuperadmin ? selectedSchoolId : null);

  useEffect(() => {
    if (!profile) return;

    // Use effective schoolId (from profile or admin/superadmin selection); for school role, allow auto-assign from managed_school_id
    let effectiveSchoolId = schoolId;
    if (!effectiveSchoolId && profile.role === 'school' && profile.managed_school_id && profile.uid) {
      effectiveSchoolId = profile.managed_school_id;
      updateDoc(doc(db, 'users', profile.uid), {
        school_id: profile.managed_school_id,
        updatedAt: new Date().toISOString(),
      }).catch((error) => {
        console.warn('⚠️ ClassManagement: Could not auto-assign school_id', error);
      });
    }

    if (!effectiveSchoolId) {
      // Only warn for roles that are expected to have a school; admin/superadmin select a school via UI
      const roleExpectsSchool = ['teacher', 'school', 'principal'].includes(profile.role);
      if (roleExpectsSchool) {
        console.warn('⚠️ ClassManagement: Missing school_id', {
          role: profile.role,
          school_id: profile.school_id,
          managed_school_id: profile.managed_school_id,
          uid: profile.uid,
        });
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    // Load classes
    const loadClasses = async () => {
      const classesData = await getSchoolClasses(profile, effectiveSchoolId);
      setClasses(classesData);
    };

    loadClasses();

    // Load students in school
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', effectiveSchoolId)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setStudents(studentsData);
    });

    // Load teachers in school - query all teachers, we'll filter by approvalStatus in UI
    const teachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('school_id', '==', effectiveSchoolId)
    );

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      const approvedTeachers = teachersData.filter(t => t.approvalStatus === 'approved');
      const pendingTeachers = teachersData.filter(t => t.approvalStatus === 'pending');
      const noStatusTeachers = teachersData.filter(t => !t.approvalStatus);
      console.log('🔍 ClassManagement: Loaded teachers', {
        total: teachersData.length,
        schoolId: effectiveSchoolId,
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
      if (teachersData.length > 0 && approvedTeachers.length === 0) {
        console.warn('⚠️ ClassManagement: No approved teachers found', {
          total: teachersData.length,
          pending: pendingTeachers.length,
          noStatus: noStatusTeachers.length,
          schoolId: effectiveSchoolId,
        });
      }
      setTeachers(teachersData);
      setLoading(false);
    }, (error) => {
      console.error('❌ ClassManagement: Error loading teachers', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        schoolId: effectiveSchoolId,
        role: profile.role,
      });
      toast.error(`Failed to load teachers: ${error.message || 'Unknown error'}`);
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeTeachers();
    };
  }, [profile, schoolId]);

  // Load all schools for admin/superadmin school selector
  useEffect(() => {
    if (!profile || !isAdminOrSuperadmin) return;
    getAllSchools(profile).then(setAllSchools);
  }, [profile, isAdminOrSuperadmin]);

  // Load school for boardAffiliation (curriculum)
  useEffect(() => {
    if (!schoolId) return;
    getSchoolById(schoolId).then(setSchool);
  }, [schoolId]);

  // Load subjects when curriculum and class_number change
  useEffect(() => {
    if (!newClassData.class_number || !newClassData.curriculum) {
      setAvailableSubjects([]);
      return;
    }
    setLoadingSubjects(true);
    getAvailableSubjects(newClassData.curriculum, newClassData.class_number)
      .then(setAvailableSubjects)
      .catch(() => setAvailableSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [newClassData.curriculum, newClassData.class_number]);

  // Load available curriculums when curriculum request modal opens
  useEffect(() => {
    if (showCurriculumRequestModal) {
      getAvailableCurriculums().then(setAvailableCurriculums);
    }
  }, [showCurriculumRequestModal]);

  const handleCreateClass = async () => {
    if (!profile) return;

    // Get school_id based on role
    const schoolId = profile.role === 'principal' 
      ? profile.managed_school_id 
      : (profile.school_id || profile.managed_school_id);

    if (!schoolId) {
      toast.error('Unable to determine your school. Please ensure you have a school assigned. Contact your administrator if this issue persists.');
      return;
    }
    
    if (!newClassData.class_number || newClassData.class_number < 1 || newClassData.class_number > 12) {
      toast.error('Please select a class (Class 1 to Class 12).');
      return;
    }

    const class_name = `Class ${newClassData.class_number}`;
    const curriculum = school?.boardAffiliation || newClassData.curriculum || 'CBSE';

    const classId = await createClass(profile, {
      school_id: schoolId,
      class_name,
      curriculum,
      subject: newClassData.subject || undefined,
      academic_year: newClassData.academic_year || undefined,
      class_teacher_id: newClassData.class_teacher_id || undefined,
    });

    if (classId) {
      setShowCreateModal(false);
      setNewClassData({
        class_name: '',
        class_number: 0,
        curriculum: school?.boardAffiliation || 'CBSE',
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

  const handleSubmitCurriculumRequest = async () => {
    if (!profile || !schoolId) return;
    if (!curriculumRequestData.requestedCurriculum.trim()) {
      toast.error('Please select a curriculum');
      return;
    }
    setSubmittingCurriculumRequest(true);
    try {
      const id = await createCurriculumChangeRequest(
        profile,
        schoolId,
        curriculumRequestData.requestedCurriculum,
        curriculumRequestData.reason
      );
      if (id) {
        setShowCurriculumRequestModal(false);
        setCurriculumRequestData({ requestedCurriculum: '', reason: '' });
        const updated = await getSchoolById(schoolId);
        if (updated) setSchool(updated);
      }
    } finally {
      setSubmittingCurriculumRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading class management...</p>
        </div>
      </div>
    );
  }

  // Admin/superadmin without a profile school must select a school first
  if (!schoolId && isAdminOrSuperadmin) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="border-border rounded-2xl">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <FaSchool className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Select a school</h2>
                  <p className="text-muted-foreground text-sm">Choose a school to manage classes, students, and teachers.</p>
                </div>
              </div>
              <Select
                value={selectedSchoolId ?? ''}
                onValueChange={(v) => setSelectedSchoolId(v || null)}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Select school..." />
                </SelectTrigger>
                <SelectContent>
                  {allSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` — ${s.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allSchools.length === 0 && (
                <p className="text-muted-foreground text-sm mt-2">No schools found. Create schools from School Management first.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <FaUsers className="text-primary" />
              </div>
              Class Management
            </h1>
            <p className="text-muted-foreground">Create and manage classes, assign students and teachers</p>
          </div>
          <div className="flex gap-2">
            {(profile?.role === 'school' || profile?.role === 'principal') && (
              <Button variant="outline" onClick={() => setShowCurriculumRequestModal(true)}>
                Request Curriculum Change
              </Button>
            )}
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <FaPlus className="w-4 h-4" />
              Create Class
            </Button>
          </div>
        </div>

        {/* Classes List */}
        <div className="space-y-4">
          {classes.length === 0 ? (
            <Card className="border-border rounded-2xl">
              <CardContent className="p-8 text-center">
                <FaUsers className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No classes created yet</p>
                <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                  Create Your First Class
                </Button>
              </CardContent>
            </Card>
          ) : (
            classes.map((classItem) => {
              const classStudents = students.filter(s => 
                s.class_ids?.includes(classItem.id)
              );
              const classTeachers = teachers.filter(t => 
                t.managed_class_ids?.includes(classItem.id)
              );

              return (
                <Card key={classItem.id} className="rounded-xl border-border bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-foreground mb-1">
                          {classItem.class_name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {classItem.curriculum} • {classItem.subject || 'All Subjects'}
                          {classItem.academic_year && ` • ${classItem.academic_year}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClass(classItem);
                          setShowAssignModal(true);
                        }}
                      >
                        Manage
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FaChalkboardTeacher className="text-primary" />
                          <span className="text-foreground text-sm font-medium">Teachers ({classTeachers.length})</span>
                        </div>
                        <div className="space-y-1">
                          {classTeachers.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No teachers assigned</p>
                          ) : (
                            classTeachers.map(teacher => {
                              const isClassTeacher = classItem.class_teacher_id === teacher.uid;
                              return (
                                <div key={teacher.uid} className="flex items-center gap-2">
                                  <span className={`text-sm ${isClassTeacher ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                    {teacher.name || teacher.displayName || teacher.email}
                                  </span>
                                  {isClassTeacher && (
                                    <Badge variant="secondary" className="text-xs">Class Teacher</Badge>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FaUsers className="text-primary" />
                          <span className="text-foreground text-sm font-medium">Students ({classStudents.length})</span>
                        </div>
                        <div className="space-y-1">
                          {classStudents.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No students enrolled</p>
                          ) : (
                            classStudents.slice(0, 5).map(student => (
                              <div key={student.uid} className="text-muted-foreground text-sm">
                                {student.name || student.displayName || student.email}
                              </div>
                            ))
                          )}
                          {classStudents.length > 5 && (
                            <p className="text-muted-foreground text-sm">+{classStudents.length - 5} more</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Create Class Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => {
          setShowCreateModal(open);
          if (open) {
            setNewClassData(prev => ({
              ...prev,
              curriculum: school?.boardAffiliation || prev.curriculum || 'CBSE',
              class_number: prev.class_number || 0,
            }));
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create New Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Class *</Label>
                <Select
                  value={newClassData.class_number ? String(newClassData.class_number) : ''}
                  onValueChange={(v) => setNewClassData({ ...newClassData, class_number: parseInt(v, 10) || 0 })}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select class (1-12)" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Class {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Curriculum</Label>
                <Input
                  value={school?.boardAffiliation || newClassData.curriculum || 'CBSE'}
                  readOnly
                  className="bg-muted/50 border-border text-foreground cursor-not-allowed"
                />
                <p className="text-muted-foreground text-xs flex items-center gap-2">
                  Curriculum is fixed per school.
                  {(profile?.role === 'school' || profile?.role === 'principal') && (
                    <button
                      type="button"
                      onClick={() => setShowCurriculumRequestModal(true)}
                      className="text-primary hover:underline"
                    >
                      Request curriculum change
                    </button>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Subject (Optional)</Label>
                <Select
                  value={newClassData.subject || 'none'}
                  onValueChange={(v) => setNewClassData({ ...newClassData, subject: v === 'none' ? '' : v })}
                  disabled={!newClassData.class_number || loadingSubjects}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder={loadingSubjects ? 'Loading subjects...' : 'Select subject'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / All subjects</SelectItem>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Subjects from available curriculum content
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Academic Year</Label>
                <Input
                  value={newClassData.academic_year}
                  onChange={(e) => setNewClassData({ ...newClassData, academic_year: e.target.value })}
                  placeholder="e.g., 2024-2025"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Class Teacher (Optional)</Label>
                <p className="text-muted-foreground text-xs">The class teacher can approve students in this class</p>
                <Select
                  value={newClassData.class_teacher_id || 'none'}
                  onValueChange={(v) => setNewClassData({ ...newClassData, class_teacher_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select a teacher (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a teacher (optional)</SelectItem>
                    {teachers.length === 0 ? null : (() => {
                      const availableTeachers = [...teachers].sort((a, b) => {
                        if (a.approvalStatus === 'approved' && b.approvalStatus !== 'approved') return -1;
                        if (a.approvalStatus !== 'approved' && b.approvalStatus === 'approved') return 1;
                        const nameA = (a.name || a.displayName || a.email || '').toLowerCase();
                        const nameB = (b.name || b.displayName || b.email || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                      });
                      return availableTeachers.map(teacher => (
                        <SelectItem key={teacher.uid} value={teacher.uid}>
                          {teacher.name || teacher.displayName || teacher.email}
                          {teacher.approvalStatus === 'pending' && ' (Pending Approval)'}
                          {teacher.approvalStatus === 'rejected' && ' (Rejected)'}
                          {!teacher.approvalStatus && ' (No Status)'}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                {teachers.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {teachers.length} teacher(s) in your school
                    {teachers.filter(t => t.approvalStatus === 'approved').length > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400"> ({teachers.filter(t => t.approvalStatus === 'approved').length} approved)</span>
                    )}
                    {teachers.filter(t => t.approvalStatus === 'pending').length > 0 && (
                      <span className="text-amber-600 dark:text-amber-400"> ({teachers.filter(t => t.approvalStatus === 'pending').length} pending)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreateClass}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Students/Teachers Modal */}
        <Dialog open={showAssignModal && !!selectedClass} onOpenChange={(open) => { if (!open) { setShowAssignModal(false); setSelectedClass(null); } }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Manage: {selectedClass?.class_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Assign Teachers */}
              <div>
                <h3 className="text-foreground font-medium mb-3 flex items-center gap-2">
                  <FaChalkboardTeacher className="text-primary" />
                  Assign Teachers
                </h3>
                <Card className="mb-3 border-border bg-muted/30">
                  <CardContent className="p-3">
                    <Label className="text-muted-foreground text-xs mb-2 block">Class Teacher:</Label>
                    <Select
                      value={selectedClass?.class_teacher_id || 'none'}
                      onValueChange={(v) => selectedClass && handleSetClassTeacher(selectedClass.id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="w-full bg-background border-border text-foreground text-sm">
                        <SelectValue placeholder="No class teacher assigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No class teacher assigned</SelectItem>
                        {teachers
                          .filter(t => true)
                          .sort((a, b) => {
                            if (a.approvalStatus === 'approved' && b.approvalStatus !== 'approved') return -1;
                            if (a.approvalStatus !== 'approved' && b.approvalStatus === 'approved') return 1;
                            const nameA = (a.name || a.displayName || a.email || '').toLowerCase();
                            const nameB = (b.name || b.displayName || b.email || '').toLowerCase();
                            return nameA.localeCompare(nameB);
                          })
                          .map(teacher => (
                            <SelectItem key={teacher.uid} value={teacher.uid}>
                              {teacher.name || teacher.displayName || teacher.email}
                              {teacher.approvalStatus === 'pending' && ' (Pending)'}
                              {teacher.approvalStatus === 'rejected' && ' (Rejected)'}
                              {!teacher.approvalStatus && ' (No Status)'}
                              {teacher.managed_class_ids?.includes(selectedClass?.id) && ' (Assigned)'}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs mt-2">The class teacher can approve students in this class.</p>
                  </CardContent>
                </Card>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {teachers.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-2">No teachers available in your school</p>
                  ) : (
                    teachers
                      .filter(t => t.approvalStatus === 'approved' || !t.approvalStatus)
                      .sort((a, b) => {
                        const nameA = (a.name || a.displayName || a.email || '').toLowerCase();
                        const nameB = (b.name || b.displayName || b.email || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map(teacher => {
                        const isAssigned = teacher.managed_class_ids?.includes(selectedClass?.id);
                        const isClassTeacher = selectedClass?.class_teacher_id === teacher.uid;
                        return (
                          <div
                            key={teacher.uid}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-foreground text-sm">
                                {teacher.name || teacher.displayName || teacher.email}
                              </span>
                              {isClassTeacher && (
                                <Badge variant="secondary" className="text-xs">Class Teacher</Badge>
                              )}
                            </div>
                            <Button
                              variant={isAssigned ? 'destructive' : 'default'}
                              size="sm"
                              onClick={() => {
                                if (!selectedClass) return;
                                if (isAssigned) {
                                  removeTeacherFromClass(profile, teacher.uid, selectedClass.id);
                                } else {
                                  handleAssignTeacher(teacher.uid, selectedClass.id);
                                }
                              }}
                            >
                              {isAssigned ? <><FaTrash className="mr-1" /> Remove</> : <><FaCheck className="mr-1" /> Assign</>}
                            </Button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Assign Students */}
              <div>
                <h3 className="text-foreground font-medium mb-3 flex items-center gap-2">
                  <FaUsers className="text-primary" />
                  Assign Students
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {students.map(student => {
                    const isEnrolled = student.class_ids?.includes(selectedClass?.id);
                    return (
                      <div
                        key={student.uid}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border"
                      >
                        <span className="text-foreground text-sm">
                          {student.name || student.displayName || student.email}
                        </span>
                        <Button
                          variant={isEnrolled ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => {
                            if (!selectedClass) return;
                            if (isEnrolled) {
                              removeStudentFromClass(profile, student.uid, selectedClass.id);
                            } else {
                              handleAssignStudent(student.uid, selectedClass.id);
                            }
                          }}
                        >
                          {isEnrolled ? <><FaTrash className="mr-1" /> Remove</> : <><FaCheck className="mr-1" /> Enroll</>}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => { setShowAssignModal(false); setSelectedClass(null); }}
            >
              Close
            </Button>
          </DialogContent>
        </Dialog>

        {/* Curriculum Change Request Modal */}
        <Dialog open={showCurriculumRequestModal} onOpenChange={setShowCurriculumRequestModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Request Curriculum Change</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm mb-4">
              Submit a request to change your school&apos;s curriculum. Super Admin will review and approve.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Requested Curriculum</Label>
                <Select
                  value={curriculumRequestData.requestedCurriculum}
                  onValueChange={(v) => setCurriculumRequestData(prev => ({ ...prev, requestedCurriculum: v }))}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select curriculum" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurriculums
                      .filter(c => c.toUpperCase() !== (school?.boardAffiliation || 'CBSE').toUpperCase())
                      .map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Reason (Optional)</Label>
                <Input
                  value={curriculumRequestData.reason}
                  onChange={(e) => setCurriculumRequestData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Why do you need this change?"
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowCurriculumRequestModal(false)} disabled={submittingCurriculumRequest}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSubmitCurriculumRequest} disabled={submittingCurriculumRequest}>
                {submittingCurriculumRequest ? <Loader2 className="animate-spin h-4 w-4" /> : 'Submit Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ClassManagement;
