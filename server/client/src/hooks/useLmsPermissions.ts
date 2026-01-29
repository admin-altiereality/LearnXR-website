/**
 * useLmsPermissions Hook
 * 
 * React hook that provides permission checking functions and accessible
 * resource lists based on the current user's role and school/class assignments.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  canViewStudent,
  canViewClass,
  canViewSchool,
  getAccessibleStudents,
  getAccessibleClasses,
  getAccessibleSchools,
} from '../services/lmsPermissionService';

export function useLmsPermissions() {
  const { profile } = useAuth();
  const [accessibleStudents, setAccessibleStudents] = useState<string[]>([]);
  const [accessibleClasses, setAccessibleClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch accessible resources
  useEffect(() => {
    if (!profile) {
      setAccessibleStudents([]);
      setAccessibleClasses([]);
      setLoading(false);
      return;
    }

    const fetchResources = async () => {
      setLoading(true);
      const [students, classes] = await Promise.all([
        getAccessibleStudents(profile),
        getAccessibleClasses(profile),
      ]);
      setAccessibleStudents(students);
      setAccessibleClasses(classes);
      setLoading(false);
    };

    fetchResources();
  }, [profile]);

  const accessibleSchools = useMemo(() => {
    return getAccessibleSchools(profile);
  }, [profile]);

  return {
    // Permission check functions
    canViewStudent: (studentId: string) => canViewStudent(profile, studentId),
    canViewClass: (classId: string) => canViewClass(profile, classId),
    canViewSchool: (schoolId: string) => canViewSchool(profile, schoolId),
    
    // Accessible resource lists
    accessibleStudents,
    accessibleClasses,
    accessibleSchools,
    
    // Loading state
    loading,
    
    // Helper to check if user has any accessible resources
    hasAccess: profile !== null,
    
    // Role helpers
    isStudent: profile?.role === 'student',
    isTeacher: profile?.role === 'teacher',
    isPrincipal: profile?.role === 'principal',
    isAdmin: profile?.role === 'admin' || profile?.role === 'superadmin',
  };
}
