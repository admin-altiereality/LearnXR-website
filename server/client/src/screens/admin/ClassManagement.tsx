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
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading class management...</p>
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
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <FaUsers className="text-primary" />
              </div>
              Class Management
            </h1>
            <p className="text-muted-foreground">Create and manage classes, assign students and teachers</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <FaPlus className="w-4 h-4" />
            Create Class
          </Button>
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
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create New Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Class Name *</Label>
                <Input
                  value={newClassData.class_name}
                  onChange={(e) => setNewClassData({ ...newClassData, class_name: e.target.value })}
                  placeholder="e.g., Class 8A, Section B"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Curriculum *</Label>
                <Select
                  value={newClassData.curriculum}
                  onValueChange={(v) => setNewClassData({ ...newClassData, curriculum: v })}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CBSE">CBSE</SelectItem>
                    <SelectItem value="RBSE">RBSE</SelectItem>
                    <SelectItem value="ICSE">ICSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Subject (Optional)</Label>
                <Input
                  value={newClassData.subject}
                  onChange={(e) => setNewClassData({ ...newClassData, subject: e.target.value })}
                  placeholder="e.g., Science, Mathematics"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
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
      </div>
    </div>
  );
};

export default ClassManagement;
