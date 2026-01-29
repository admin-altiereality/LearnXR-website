/**
 * Role-Based Access Control (RBAC) Utilities
 * 
 * This module provides centralized permission management for the application.
 * All role checks and access control should use these utilities.
 */

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'student' | 'teacher' | 'school' | 'admin' | 'superadmin' | 'principal' | 'associate';
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
  
  // ============================================
  // LMS-specific fields (Multi-School LMS)
  // ============================================
  school_id?: string; // Reference to schools collection
  class_ids?: string[]; // Array of class IDs (for students)
  teacher_id?: string; // For students: primary teacher UID
  managed_class_ids?: string[]; // For teachers: classes they teach
  managed_school_id?: string; // For principals: school they manage
}

// Route categories for permission checking
export type RouteCategory = 
  | 'public'           // No auth required
  | 'auth'             // Auth required, no role check
  | 'lessons'          // Lesson viewing
  | 'create'           // Content creation (Create/Explore/History - no Studio/Chapter Editor)
  | 'studio'           // Chapter Editor / Content Library - school, admin, superadmin only (no student, teacher, principal)
  | 'developer'        // API Keys / Developer - admin, superadmin only
  | 'class_management' // Class management - school, principal, admin, superadmin
  | 'admin'            // Admin pages (system, etc.)
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
  principal: 2,
  associate: 2,
  admin: 3,
  superadmin: 4,
};

/**
 * Roles that require approval before accessing protected features
 */
// All roles that require approval (hierarchical: student -> teacher -> school -> admin)
export const APPROVAL_REQUIRED_ROLES: UserRole[] = ['student', 'teacher', 'school'];

/**
 * Roles that can approve other users (hierarchical: teachers, schools, admins)
 */
export const CAN_APPROVE_ROLES: UserRole[] = ['teacher', 'school', 'admin', 'superadmin'];

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
  public: ['student', 'teacher', 'principal', 'school', 'admin', 'superadmin'],
  auth: ['student', 'teacher', 'principal', 'school', 'admin', 'superadmin'],
  lessons: ['student', 'teacher', 'principal', 'school', 'admin', 'superadmin'],
  create: ['teacher', 'school', 'admin', 'superadmin'],
  studio: ['admin', 'superadmin'],
  developer: ['admin', 'superadmin'],
  class_management: ['school', 'principal', 'admin', 'superadmin'],
  admin: ['admin', 'superadmin'],
  superadmin: ['superadmin'],
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
  
  // Create routes (teacher, school, admin, superadmin) - no Studio/Chapter Editor
  '/main': 'create',
  '/explore': 'create',
  '/history': 'create',
  '/3d-generate': 'create',
  '/asset-generator': 'create',
  '/unified-prompt': 'create',
  '/preview': 'create',
  '/teacher-avatar-demo': 'create',
  '/learnxr': 'create',
  
  // Studio / Chapter Editor - school, admin, superadmin only (no student, teacher, principal)
  '/studio/content': 'studio',
  '/studio': 'studio',
  
  // Developer / API Keys - admin, superadmin only
  '/developer': 'developer',
  '/docs/api': 'developer',
  '/docs/n8n': 'developer',
  '/docs': 'developer',
  
  // Class management - school, principal, admin, superadmin
  '/admin/classes': 'class_management',
  
  // Admin routes
  '/admin': 'admin',
  '/system-status': 'admin',
  
  // Superadmin routes
  '/admin/approvals': 'superadmin',
  '/admin/chapter-approvals': 'superadmin',
  '/admin/schools': 'admin',
  '/admin/logs': 'superadmin',
};

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if a role requires approval before accessing protected features
 * All roles except admin/superadmin require approval in hierarchical system:
 * - Students need teacher approval
 * - Teachers need school approval  
 * - Schools need admin/superadmin approval
 */
export function requiresApproval(role: UserRole): boolean {
  return APPROVAL_REQUIRED_ROLES.includes(role);
}

/**
 * Get the role that can approve a given role (hierarchical approval chain)
 */
export function getApproverRole(role: UserRole): UserRole | null {
  switch (role) {
    case 'student':
      return 'teacher'; // Teachers approve students
    case 'teacher':
      return 'school'; // Schools approve teachers
    case 'school':
      return 'admin'; // Admins/superadmins approve schools
    default:
      return null; // No approval needed
  }
}

/**
 * Check if a user can approve another user based on hierarchical approval system
 */
export function canApproveUser(approver: UserProfile | null, targetUser: UserProfile | null): boolean {
  if (!approver || !targetUser) return false;
  
  // Superadmins can approve anyone
  if (approver.role === 'superadmin') return true;
  
  // Admins can approve schools
  if (approver.role === 'admin' && targetUser.role === 'school') return true;
  
  // Schools can approve teachers in their school
  if (approver.role === 'school' && targetUser.role === 'teacher') {
    return approver.school_id === targetUser.school_id || 
           approver.managed_school_id === targetUser.school_id;
  }
  
  // Teachers can approve students in their classes
  if (approver.role === 'teacher' && targetUser.role === 'student') {
    // Check if student is in any of teacher's classes
    const teacherClassIds = approver.managed_class_ids || [];
    const studentClassIds = targetUser.class_ids || [];
    return teacherClassIds.some(classId => studentClassIds.includes(classId));
  }
  
  return false;
}

/**
 * Check if a user is approved (or doesn't need approval)
 * In hierarchical system, all roles except admin/superadmin need approval
 */
export function isApproved(profile: UserProfile | null): boolean {
  if (!profile) return false;
  
  // Admin and superadmin don't need approval
  if (profile.role === 'admin' || profile.role === 'superadmin') {
    return true;
  }
  
  // All other roles need approval
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
  
  // Special case: approval-pending page - only for users who completed onboarding and are pending approval
  if (path === '/approval-pending') {
    if (requiresApproval(role) && profile.approvalStatus === 'pending') {
      return { allowed: true };
    }
    // If approved or not yet in queue, redirect away
    return { 
      allowed: false, 
      redirectTo: '/lessons',
      reason: 'Already approved or complete onboarding first'
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
  // Only redirect to approval-pending when explicitly pending; null = not yet in queue
  if (requiresApproval(role) && profile.approvalStatus === 'pending') {
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
/**
 * Check if a user can approve other users (hierarchical approval system)
 * - Teachers can approve students in their classes
 * - Schools can approve teachers in their school
 * - Admins/superadmins can approve schools
 */
export function canApproveUsers(profile: UserProfile | null): boolean {
  if (!profile) return false;
  // All these roles can approve users in the hierarchical system
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
      return '/dashboard/student';
    case 'teacher':
      return '/dashboard/teacher';
    case 'principal':
      return '/dashboard/principal';
    case 'school':
      return '/lessons';
    case 'admin':
    case 'superadmin':
      return '/studio/content';
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
// Lesson Content Editing Permissions
// ============================================================================

/**
 * Check if user can edit lesson content
 * Both admin and superadmin can edit
 */
export function canEditLesson(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.role === 'admin' || profile.role === 'superadmin';
}

/**
 * Check if user can delete core assets
 * Only superadmin can delete core assets
 */
export function canDeleteCoreAsset(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.role === 'superadmin';
}

/**
 * Check if user can delete a specific asset
 * Admin can delete non-core assets, superadmin can delete all
 */
export function canDeleteAsset(profile: UserProfile | null, asset: { isCore?: boolean; assetTier?: string } | null): boolean {
  if (!profile) return false;
  if (!asset) return false;
  
  // Superadmin can delete anything
  if (profile.role === 'superadmin') return true;
  
  // Admin can only delete non-core assets
  if (profile.role === 'admin') {
    const isCore = asset.isCore === true || asset.assetTier === 'core';
    return !isCore;
  }
  
  return false;
}

/**
 * Check if user can delete entire lesson
 * Only superadmin can delete lessons
 */
export function canDeleteLesson(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.role === 'superadmin';
}

/**
 * Check if user is superadmin
 */
export function isSuperadmin(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.role === 'superadmin';
}

/**
 * Check if user is admin (but not superadmin)
 */
export function isAdminOnly(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.role === 'admin';
}

// ============================================================================
// Role Display Utilities
// ============================================================================

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  school: 'School Administrator',
  principal: 'Principal',
  associate: 'Associate',
  admin: 'Administrator',
  superadmin: 'Super Administrator',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  student: 'Access lessons and complete quizzes',
  teacher: 'Create and manage educational content',
  school: 'Manage school-wide content and teachers',
  principal: 'School principal with administrative access',
  associate: 'Associate user with limited access',
  admin: 'Full platform administration access',
  superadmin: 'Complete system control and user approvals',
};

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  student: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  teacher: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  school: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  principal: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  associate: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  admin: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  superadmin: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

export const APPROVAL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Approval', color: 'text-yellow-400' },
  approved: { label: 'Approved', color: 'text-green-400' },
  rejected: { label: 'Rejected', color: 'text-red-400' },
};
