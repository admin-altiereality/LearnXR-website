import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  checkAccess, 
  AccessCheckResult,
  hasCompletedOnboarding,
  requiresApproval,
  isApproved,
  getDefaultPage,
  UserRole
} from '../../utils/rbac';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Minimum role required to access this route */
  minRole?: UserRole;
  /** Specific roles allowed (overrides minRole) */
  allowedRoles?: UserRole[];
  /** If true, bypasses approval check */
  bypassApproval?: boolean;
  /** If true, bypasses onboarding check */
  bypassOnboarding?: boolean;
  /** Custom redirect path on access denied */
  redirectTo?: string;
}

/**
 * RoleGuard - Comprehensive route protection component
 * 
 * This component handles:
 * 1. Authentication check
 * 2. Profile loading
 * 3. Role-based access control
 * 4. Onboarding completion check
 * 5. Approval status check (for teacher/school)
 * 
 * Usage:
 * <RoleGuard allowedRoles={['admin', 'superadmin']}>
 *   <AdminPage />
 * </RoleGuard>
 */
export const RoleGuard = ({ 
  children, 
  minRole,
  allowedRoles,
  bypassApproval = false,
  bypassOnboarding = false,
  redirectTo
}: RoleGuardProps) => {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();
  const [accessResult, setAccessResult] = useState<AccessCheckResult | null>(null);

  useEffect(() => {
    // Wait for auth and profile to load
    if (loading || profileLoading) return;

    // Check access
    const result = checkAccess(profile, location.pathname, !!user);
    
    // Additional role checks if specified
    if (result.allowed && profile) {
      // Check minRole
      if (minRole) {
        const roleHierarchy: Record<UserRole, number> = {
          student: 1,
          teacher: 2,
          principal: 2,
          school: 2,
          admin: 3,
          superadmin: 4,
        };
        
        if (roleHierarchy[profile.role] < roleHierarchy[minRole]) {
          setAccessResult({
            allowed: false,
            redirectTo: redirectTo || getDefaultPage(profile.role),
            reason: `Minimum role '${minRole}' required`
          });
          return;
        }
      }
      
      // Check allowedRoles
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        setAccessResult({
          allowed: false,
          redirectTo: redirectTo || getDefaultPage(profile.role),
          reason: `Role '${profile.role}' not in allowed roles`
        });
        return;
      }
    }
    
    // Override approval check if bypassed
    if (bypassApproval && result.redirectTo === '/approval-pending') {
      setAccessResult({ allowed: true });
      return;
    }
    
    // Override onboarding check if bypassed
    if (bypassOnboarding && result.redirectTo === '/onboarding') {
      setAccessResult({ allowed: true });
      return;
    }
    
    setAccessResult(result);
  }, [user, profile, loading, profileLoading, location.pathname, minRole, allowedRoles, bypassApproval, bypassOnboarding, redirectTo]);

  // Show loading state
  if (loading || profileLoading || accessResult === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white/60">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Redirect if not allowed
  if (!accessResult.allowed && accessResult.redirectTo) {
    console.log(`[RoleGuard] Access denied to ${location.pathname}. Reason: ${accessResult.reason}. Redirecting to ${accessResult.redirectTo}`);
    return <Navigate to={accessResult.redirectTo} replace />;
  }

  // Access granted
  return <>{children}</>;
};

/**
 * StudentGuard - Only allows students and higher roles
 */
export const StudentGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowedRoles={['student', 'teacher', 'school', 'admin', 'superadmin']}>
    {children}
  </RoleGuard>
);

/**
 * TeacherGuard - Only allows teachers and higher roles (excludes school administrators)
 * School administrators should NOT have access to Create, Explore, History
 */
export const TeacherGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowedRoles={['teacher', 'admin', 'superadmin']}>
    {children}
  </RoleGuard>
);

/**
 * AdminOrSchoolGuard - Only allows school, admin, superadmin (no student, teacher, principal).
 * Use for Chapter Editor / Studio / Content Library.
 */
export const AdminOrSchoolGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowedRoles={['school', 'admin', 'superadmin']}>
    {children}
  </RoleGuard>
);

/**
 * AdminGuard - Only allows admin and superadmin (no API Keys for school/teacher/principal)
 */
export const AdminGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowedRoles={['admin', 'superadmin']}>
    {children}
  </RoleGuard>
);

/**
 * SuperAdminGuard - Only allows superadmin
 */
export const SuperAdminGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowedRoles={['superadmin']}>
    {children}
  </RoleGuard>
);

export default RoleGuard;
