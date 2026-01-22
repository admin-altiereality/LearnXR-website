/**
 * Role-Based Access Control (RBAC) Utilities
 * 
 * This module provides centralized permission management for the application.
 * All role checks and access control should use these utilities.
 */

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'student' | 'teacher' | 'school' | 'admin' | 'superadmin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | null;

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  name?: string;
  role: UserRole;
  approvalStatus?: ApprovalStatus;
  createdAt: string;
  updatedAt?: string;
  
  // Student-specific fields (required after onboarding)
  age?: number;
  class?: string;
  curriculum?: string;
  school?: string;
  
  // Onboarding status
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;
  
  // Legacy fields for backward compatibility
  userType?: string;
  teamSize?: string;
  usageType?: string[];
  newsletterSubscription?: boolean;
}

// Route categories for permission checking
export type RouteCategory = 
  | 'public'           // No auth required
  | 'auth'             // Auth required, no role check
  | 'lessons'          // Lesson viewing
  | 'create'           // Content creation (Create/Studio pages)
  | 'admin'            // Admin pages
  | 'superadmin';      // Superadmin-only pages

// ============================================================================
// Constants
// ============================================================================

/**
 * Role hierarchy (higher index = higher permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  student: 1,
  teacher: 2,
  school: 2,
  admin: 3,
  superadmin: 4,
};

/**
 * Roles that require approval before accessing protected features
 */
export const APPROVAL_REQUIRED_ROLES: UserRole[] = ['teacher', 'school'];

/**
 * Roles that can approve other users (admin and superadmin)
 */
export const CAN_APPROVE_ROLES: UserRole[] = ['admin', 'superadmin'];

/**
 * Roles that can approve chapters/content (admin and superadmin)
 */
export const CAN_APPROVE_CHAPTERS_ROLES: UserRole[] = ['admin', 'superadmin'];

/**
 * Roles that require student onboarding
 */
export const STUDENT_ONBOARDING_ROLES: UserRole[] = ['student'];

/**
 * Route permission matrix
 * Defines which roles can access which route categories
 */
export const ROUTE_PERMISSIONS: Record<RouteCategory, UserRole[]> = {
  public: ['student', 'teacher', 'school', 'admin', 'superadmin'],
  auth: ['student', 'teacher', 'school', 'admin', 'superadmin'],
  lessons: ['student', 'teacher', 'school', 'admin', 'superadmin'],
  create: ['teacher', 'school', 'admin', 'superadmin'],
  admin: ['admin', 'superadmin'],
  superadmin: ['admin', 'superadmin'], // Admin can also access approval pages
};

/**
 * Route to category mapping
 */
export const ROUTE_CATEGORIES: Record<string, RouteCategory> = {
  // Public routes
  '/': 'public',
  '/login': 'public',
  '/signup': 'public',
  '/forgot-password': 'public',
  '/careers': 'public',
  '/blog': 'public',
  '/privacy-policy': 'public',
  '/terms-conditions': 'public',
  '/refund-policy': 'public',
  '/help': 'public',
  
  // Auth required routes (any authenticated user)
  '/onboarding': 'auth',
  '/profile': 'auth',
  '/approval-pending': 'auth',
  
  // Lesson routes (student can access)
  '/lessons': 'lessons',
  '/vrlessonplayer': 'lessons',
  '/xrlessonplayer': 'lessons',
  
  // Create/Studio routes (teacher, school, admin, superadmin)
  '/main': 'create',
  '/explore': 'create',
  '/history': 'create',
  '/3d-generate': 'create',
  '/asset-generator': 'create',
  '/unified-prompt': 'create',
  '/preview': 'create',
  '/studio': 'create',
  '/developer': 'create',
  '/docs': 'create',
  '/teacher-avatar-demo': 'create',
  '/learnxr': 'create',
  
  // Admin routes
  '/admin': 'admin',
  '/system-status': 'admin',
  
  // Superadmin routes (admin can also access)
  '/admin/approvals': 'superadmin',
  '/admin/chapter-approvals': 'superadmin', // NEW: Chapter/content approval
};

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if a role requires approval before accessing protected features
 */
export function requiresApproval(role: UserRole): boolean {
  return APPROVAL_REQUIRED_ROLES.includes(role);
}

/**
 * Check if a user is approved (or doesn't need approval)
 */
export function isApproved(profile: UserProfile | null): boolean {
  if (!profile) return false;
  
  // Roles that don't require approval
  if (!requiresApproval(profile.role)) {
    return true;
  }
  
  return profile.approvalStatus === 'approved';
}

/**
 * Check if a role requires student onboarding
 */
export function requiresStudentOnboarding(role: UserRole): boolean {
  return STUDENT_ONBOARDING_ROLES.includes(role);
}

/**
 * Check if a student has completed required onboarding fields
 */
export function hasCompletedStudentOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  
  // Non-students don't need student onboarding
  if (!requiresStudentOnboarding(profile.role)) {
    return true;
  }
  
  // Check required student fields
  const hasRequiredFields = !!(
    profile.age &&
    profile.class &&
    profile.curriculum &&
    profile.school
  );
  
  return hasRequiredFields && profile.onboardingCompleted === true;
}

/**
 * Check if a teacher has completed required onboarding fields
 * Note: The actual field validation happens in the Onboarding form.
 * This function just checks if onboardingCompleted flag is set.
 */
export function hasCompletedTeacherOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role !== 'teacher') return true;
  
  // Simply check if onboarding is marked complete
  // The onboarding form validates required fields before setting this flag
  return profile.onboardingCompleted === true;
}

/**
 * Check if a school has completed required onboarding fields
 * Note: The actual field validation happens in the Onboarding form.
 * This function just checks if onboardingCompleted flag is set.
 */
export function hasCompletedSchoolOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role !== 'school') return true;
  
  // Simply check if onboarding is marked complete
  // The onboarding form validates required fields before setting this flag
  return profile.onboardingCompleted === true;
}

/**
 * Check if user has completed general onboarding
 * 
 * Flow:
 * - Students: Must complete student-specific onboarding (age, class, curriculum, school)
 * - Teachers: Must complete teacher onboarding (school, subjects, etc.) then wait for approval
 * - Schools: Must complete school onboarding (address, contact, etc.) then wait for approval
 * - Admin/Superadmin: No onboarding required
 */
export function hasCompletedOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  
  // Admin and superadmin don't need onboarding
  if (profile.role === 'admin' || profile.role === 'superadmin') {
    return true;
  }
  
  // For students, check student-specific onboarding
  if (requiresStudentOnboarding(profile.role)) {
    return hasCompletedStudentOnboarding(profile);
  }
  
  // For teachers and schools, just check the onboardingCompleted flag
  // The onboarding form validates all required fields before setting this
  return profile.onboardingCompleted === true;
}

/**
 * Get route category for a given path
 */
export function getRouteCategory(path: string): RouteCategory {
  // Check exact match first
  if (ROUTE_CATEGORIES[path]) {
    return ROUTE_CATEGORIES[path];
  }
  
  // Check prefix matches
  for (const [route, category] of Object.entries(ROUTE_CATEGORIES)) {
    if (path.startsWith(route + '/') || path === route) {
      return category;
    }
  }
  
  // Default to requiring auth
  return 'auth';
}

/**
 * Check if a role can access a specific route category
 */
export function canRoleAccessCategory(role: UserRole, category: RouteCategory): boolean {
  return ROUTE_PERMISSIONS[category].includes(role);
}

/**
 * Main access control function
 * Returns an object with access status and redirect path if needed
 */
export interface AccessCheckResult {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
}

export function checkAccess(
  profile: UserProfile | null,
  path: string,
  isAuthenticated: boolean
): AccessCheckResult {
  const category = getRouteCategory(path);
  
  // Public routes - always allowed
  if (category === 'public') {
    return { allowed: true };
  }
  
  // All other routes require authentication
  if (!isAuthenticated || !profile) {
    return { 
      allowed: false, 
      redirectTo: '/login',
      reason: 'Authentication required'
    };
  }
  
  const role = profile.role;
  
  // Special case: approval-pending page - always accessible for pending users
  if (path === '/approval-pending') {
    if (requiresApproval(role) && profile.approvalStatus !== 'approved') {
      return { allowed: true };
    }
    // If approved, redirect to main content
    return { 
      allowed: false, 
      redirectTo: '/lessons',
      reason: 'Already approved'
    };
  }
  
  // Special case: onboarding page - always accessible for incomplete onboarding
  if (path === '/onboarding') {
    if (!hasCompletedOnboarding(profile)) {
      return { allowed: true };
    }
    // If completed, redirect based on role
    return { 
      allowed: false, 
      redirectTo: role === 'student' ? '/lessons' : '/main',
      reason: 'Onboarding already completed'
    };
  }
  
  // Check onboarding completion BEFORE approval check
  // This ensures teachers/schools complete onboarding first, then wait for approval
  if (!hasCompletedOnboarding(profile)) {
    return { 
      allowed: false, 
      redirectTo: '/onboarding',
      reason: 'Onboarding not completed'
    };
  }
  
  // Check approval status for roles that require it (after onboarding is done)
  if (requiresApproval(role) && !isApproved(profile)) {
    return { 
      allowed: false, 
      redirectTo: '/approval-pending',
      reason: 'Pending approval'
    };
  }
  
  // Check role permissions for the route
  if (!canRoleAccessCategory(role, category)) {
    // Redirect based on role
    const defaultPage = role === 'student' ? '/lessons' : '/main';
    return { 
      allowed: false, 
      redirectTo: defaultPage,
      reason: `Role '${role}' cannot access '${category}' routes`
    };
  }
  
  return { allowed: true };
}

/**
 * Simplified access check that just returns boolean
 */
export function canAccess(
  profile: UserProfile | null,
  path: string,
  isAuthenticated: boolean
): boolean {
  return checkAccess(profile, path, isAuthenticated).allowed;
}

/**
 * Check if user can approve other users
 */
export function canApproveUsers(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return CAN_APPROVE_ROLES.includes(profile.role);
}

/**
 * Check if user can approve chapters/content
 */
export function canApproveChapters(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return CAN_APPROVE_CHAPTERS_ROLES.includes(profile.role);
}

/**
 * Check if a user's role is at least the specified role level
 */
export function hasMinimumRole(profile: UserProfile | null, minimumRole: UserRole): boolean {
  if (!profile) return false;
  return ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get the default landing page for a role
 */
export function getDefaultPage(role: UserRole): string {
  switch (role) {
    case 'student':
      return '/lessons';
    case 'teacher':
    case 'school':
      return '/lessons'; // Students, teachers, schools go to lessons
    case 'admin':
    case 'superadmin':
      return '/studio/content'; // Admin/Superadmin go to Dashboard (Studio)
    default:
      return '/lessons';
  }
}

/**
 * Get pages accessible to a role
 */
export function getAccessiblePages(role: UserRole): string[] {
  const pages: string[] = [];
  
  for (const [route, category] of Object.entries(ROUTE_CATEGORIES)) {
    if (canRoleAccessCategory(role, category)) {
      pages.push(route);
    }
  }
  
  return pages;
}

// ============================================================================
// Role Display Utilities
// ============================================================================

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  school: 'School Administrator',
  admin: 'Administrator',
  superadmin: 'Super Administrator',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  student: 'Access lessons and complete quizzes',
  teacher: 'Create and manage educational content',
  school: 'Manage school-wide content and teachers',
  admin: 'Full platform administration access',
  superadmin: 'Complete system control and user approvals',
};

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  student: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  teacher: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  school: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  admin: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  superadmin: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

export const APPROVAL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Approval', color: 'text-yellow-400' },
  approved: { label: 'Approved', color: 'text-green-400' },
  rejected: { label: 'Rejected', color: 'text-red-400' },
};
