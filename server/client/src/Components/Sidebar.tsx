import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBookOpen,
  FaFlask,
  FaHistory,
  FaCubes,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaUserCheck,
  FaGraduationCap,
  FaChalkboardTeacher,
  FaSchool,
  FaShieldAlt,
  FaCrown,
  FaCode,
  FaTachometerAlt,
  FaUser,
  FaCog,
  FaBars,
  FaTimes,
  FaServer,
  FaUsers,
  FaFileAlt
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, ROLE_DISPLAY_NAMES } from '../utils/rbac';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Normalize role to lowercase for consistent comparison
const normalizeRole = (role: string | undefined): UserRole => {
  if (!role) return 'student';
  const normalized = role.toLowerCase().trim() as UserRole;
  // Handle common variations
  if (['student', 'teacher', 'school', 'admin', 'superadmin'].includes(normalized)) {
    return normalized;
  }
  // Handle case where someone might use "Super Admin" or "SuperAdmin"
  if (normalized === 'super admin' || normalized === 'super_admin') {
    return 'superadmin';
  }
  return 'student'; // Default fallback
};

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed for minimal design
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading, profileLoading, logout } = useAuth();

  // Get normalized role with debug logging
  const userRole = useMemo(() => {
    const rawRole = profile?.role;
    const normalized = normalizeRole(rawRole);
    
    // Debug logging - check browser console
    console.log('🔍 Sidebar Debug:', {
      hasUser: !!user,
      hasProfile: !!profile,
      rawRole: rawRole,
      normalizedRole: normalized,
      loading,
      profileLoading,
      onboardingCompleted: profile?.onboardingCompleted,
      approvalStatus: (profile as any)?.approvalStatus,
      profileData: profile ? {
        uid: profile.uid,
        email: profile.email,
        name: profile.name,
        displayName: profile.displayName,
        role: profile.role
      } : null
    });
    
    return normalized;
  }, [user, profile, loading, profileLoading]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save collapsed state
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Don't render sidebar on these pages
  const hiddenPages = ['/login', '/signup', '/forgot-password', '/onboarding', '/approval-pending', '/vrlessonplayer', '/xrlessonplayer', '/learnxr/lesson'];
  if (hiddenPages.some(page => location.pathname.startsWith(page)) || !user) {
    return null;
  }

  // Role checks
  const isStudent = userRole === 'student';
  const isTeacher = userRole === 'teacher';
  const isPrincipal = userRole === 'principal';
  const isSchool = userRole === 'school';
  const isAdmin = userRole === 'admin';
  const isSuperadmin = userRole === 'superadmin';
  const isTeacherOrSchool = isTeacher || isSchool;
  const isAdminOrSuperadmin = isAdmin || isSuperadmin;
  const canCreate = isTeacherOrSchool || isAdminOrSuperadmin;

  // Build navigation items based on role according to the spec:
  // Student: Dashboard, Lessons, Profile
  // Teacher: Dashboard, Lessons, Create, Explore, History, Studio, Profile, Settings
  // Principal: Dashboard, Lessons, Profile, Settings
  // Admin/Superadmin: Dashboard (Content), Lessons, Create, Explore, History, Approvals, System, Profile, Settings
  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    // LMS Dashboards - role-based
    if (isStudent) {
      items.push({ path: '/dashboard/student', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isTeacher) {
      items.push({ path: '/dashboard/teacher', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isPrincipal) {
      items.push({ path: '/dashboard/principal', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isAdminOrSuperadmin) {
      // Admin/Superadmin see content dashboard
      items.push({ path: '/studio/content', label: 'Dashboard', icon: FaTachometerAlt });
    }

    // Lessons - everyone can see
    items.push({ path: '/lessons', label: 'Lessons', icon: FaBookOpen });

    // Creator tools - teachers, schools, admin, superadmin (no Studio for teacher/principal/school)
    if (canCreate) {
      items.push({ path: '/main', label: 'Create', icon: FaFlask });
      items.push({ path: '/explore', label: 'Explore', icon: FaCubes });
      items.push({ path: '/history', label: 'History', icon: FaHistory });
      // Studio / Chapter Editor - admin and superadmin only (no school)
    }

    // Teacher tools - approve students
    if (isTeacher) {
      items.push({ path: '/teacher/approvals', label: 'Student Approvals', icon: FaUserCheck });
    }

    // School administrator tools - approve teachers, manage classes
    if (isSchool) {
      items.push({ path: '/school/approvals', label: 'Teacher Approvals', icon: FaUserCheck });
      items.push({ path: '/admin/classes', label: 'Class Management', icon: FaUsers });
    }

    // Admin tools - only for admin/superadmin
    if (isAdminOrSuperadmin) {
      items.push({ path: '/admin/approvals', label: 'Approvals', icon: FaUserCheck });
      items.push({ path: '/admin/schools', label: 'School Management', icon: FaSchool });
      items.push({ path: '/admin/classes', label: 'Class Management', icon: FaUsers });
      items.push({ path: '/system-status', label: 'System', icon: FaServer });
    }

    // Superadmin only tools
    if (isSuperadmin) {
      items.push({ path: '/admin/logs', label: 'Production Logs', icon: FaFileAlt });
    }

    // Principal can also access class management
    if (isPrincipal) {
      items.push({ path: '/admin/classes', label: 'Class Management', icon: FaUsers });
    }

    return items;
  };

  const navItems = getNavItems();

  // Role icon mapping
  const getRoleIcon = () => {
    switch (userRole) {
      case 'student': return FaGraduationCap;
      case 'teacher': return FaChalkboardTeacher;
      case 'principal': return FaSchool;
      case 'school': return FaSchool;
      case 'admin': return FaShieldAlt;
      case 'superadmin': return FaCrown;
      default: return FaUser;
    }
  };

  // Role color mapping
  const getRoleColor = () => {
    switch (userRole) {
      case 'student': return 'text-emerald-400';
      case 'teacher': return 'text-blue-400';
      case 'principal': return 'text-indigo-400';
      case 'school': return 'text-purple-400';
      case 'admin': return 'text-amber-400';
      case 'superadmin': return 'text-rose-400';
      default: return 'text-gray-400';
    }
  };

  const getRoleBgColor = () => {
    switch (userRole) {
      case 'student': return 'bg-emerald-500/20';
      case 'teacher': return 'bg-blue-500/20';
      case 'principal': return 'bg-indigo-500/20';
      case 'school': return 'bg-purple-500/20';
      case 'admin': return 'bg-amber-500/20';
      case 'superadmin': return 'bg-rose-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  const RoleIcon = getRoleIcon();
  const roleColor = getRoleColor();
  const roleBgColor = getRoleBgColor();

  // Sidebar width based on collapsed state
  const sidebarWidth = isCollapsed ? 64 : 220;

  return (
    <>
      {/* Mobile Menu Button - Hamburger icon */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white/70 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
        aria-label="Open menu"
      >
        <FaBars className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: sidebarWidth,
          x: isMobileOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? -sidebarWidth - 20 : 0)
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed left-0 top-0 h-full bg-slate-950/98 backdrop-blur-xl border-r border-white/5 z-50 flex flex-col shadow-xl"
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-center border-b border-white/5 px-3">
          <Link 
            to={isAdminOrSuperadmin ? '/studio/content' : '/lessons'} 
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-shadow">
              <FaGraduationCap className="text-white text-base" />
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-base font-bold text-white whitespace-nowrap overflow-hidden"
                >
                  LearnXR
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                              (item.path !== '/lessons' && location.pathname.startsWith(item.path + '/'));
              const Icon = item.icon;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 shadow-inner'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-white/50 group-hover:text-cyan-400'
                    }`} />
                    
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="text-sm font-medium whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-white/10">
                        {item.label}
                      </div>
                    )}
                    
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Divider */}
          <div className="my-4 h-px bg-white/5" />

          {/* Quick Links - Profile & Settings */}
          <ul className="space-y-1">
            <li>
              <Link
                to="/profile"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  location.pathname === '/profile'
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? 'Profile' : undefined}
              >
                <FaUser className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  location.pathname === '/profile' ? 'text-cyan-400' : 'text-white/50 group-hover:text-cyan-400'
                }`} />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      Profile
                    </motion.span>
                  )}
                </AnimatePresence>
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-white/10">
                    Profile
                  </div>
                )}
                {location.pathname === '/profile' && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full" />
                )}
              </Link>
            </li>
            
            {/* Settings (Developer / API Keys) - admin and superadmin only */}
            {isAdminOrSuperadmin && (
              <li>
                <Link
                  to="/developer"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                    location.pathname === '/developer'
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? 'Settings' : undefined}
                >
                  <FaCog className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    location.pathname === '/developer' ? 'text-cyan-400' : 'text-white/50 group-hover:text-cyan-400'
                  }`} />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        Settings
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-white/10">
                      Settings
                    </div>
                  )}
                  {location.pathname === '/developer' && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full" />
                  )}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* User Section at Bottom */}
        <div className="p-2 border-t border-white/5">
          {/* User Info Card */}
          <div className={`p-2 rounded-xl ${roleBgColor} mb-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className={`w-8 h-8 rounded-lg bg-slate-900/50 flex items-center justify-center flex-shrink-0 ${roleColor}`}>
                <RoleIcon className="text-sm" />
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 min-w-0 overflow-hidden"
                  >
                    <p className="text-xs font-medium text-white truncate">
                      {profile?.name || profile?.displayName || 'User'}
                    </p>
                    <p className={`text-[10px] ${roleColor} truncate`}>
                      {ROLE_DISPLAY_NAMES[userRole] || userRole}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all group relative ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <FaSignOutAlt className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm whitespace-nowrap overflow-hidden"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-white/10">
                Logout
              </div>
            )}
          </button>
        </div>

        {/* Collapse Toggle Button - positioned on right edge */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-white/10 text-white/40 hover:text-white hover:bg-slate-700 transition-all items-center justify-center hidden lg:flex shadow-lg hover:scale-110"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <FaChevronRight className="w-2.5 h-2.5" /> : <FaChevronLeft className="w-2.5 h-2.5" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Close menu"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      </motion.aside>

      {/* Spacer div to push content - matches sidebar width */}
      <div 
        className={`hidden lg:block flex-shrink-0 transition-all duration-200`}
        style={{ width: sidebarWidth }}
      />
    </>
  );
};

export default Sidebar;
