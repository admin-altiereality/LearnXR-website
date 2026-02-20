import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  checkAccess, 
  AccessCheckResult,
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

const ROLE_HIERARCHY: Record<UserRole, number> = {
  student: 1,
  teacher: 2,
  principal: 2,
  school: 2,
  associate: 2,
  admin: 3,
  superadmin: 4,
};

/**
 * RoleGuard - Comprehensive route protection component
 * Computes access synchronously to avoid multiple Navigate renders and navigation throttling.
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

  const accessResult = useMemo((): AccessCheckResult | null => {
    if (loading || profileLoading) return null;

    let result = checkAccess(profile, location.pathname, !!user);

    if (result.allowed && profile) {
      if (minRole && ROLE_HIERARCHY[profile.role] < ROLE_HIERARCHY[minRole]) {
        return {
          allowed: false,
          redirectTo: redirectTo || getDefaultPage(profile.role, profile),
          reason: `Minimum role '${minRole}' required`
        };
      }
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        return {
          allowed: false,
          redirectTo: redirectTo || getDefaultPage(profile.role, profile),
          reason: `Role '${profile.role}' not in allowed roles`
        };
      }
    }

    if (bypassApproval && result.redirectTo === '/approval-pending') return { allowed: true };
    if (bypassOnboarding && result.redirectTo === '/onboarding') return { allowed: true };

    return result;
  }, [loading, profileLoading, profile, location.pathname, user, minRole, allowedRoles, bypassApproval, bypassOnboarding, redirectTo]);

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

  if (!accessResult.allowed && accessResult.redirectTo) {
    return <Navigate to={accessResult.redirectTo} replace />;
  }

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
 * StudioGuard - Allows admin, superadmin, and associate (Content Library / Chapter Editor).
 * Associate can refine lessons but cannot delete; changes require admin approval.
 */
export const StudioGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowedRoles={['admin', 'superadmin', 'associate']}>
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
