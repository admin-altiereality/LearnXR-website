import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  FaTachometerAlt,
  FaUser,
  FaCog,
  FaBars,
  FaServer,
  FaUsers,
  FaEdit,
  FaFileAlt,
  FaLightbulb,
  FaClipboardList,
  FaSun,
  FaMoon
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { UserRole, ROLE_DISPLAY_NAMES } from '../utils/rbac';
import { learnXRFontStyle, TrademarkSymbol } from './LearnXRTypography';
import { Sheet, SheetContent } from './ui/sheet';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Normalize role to lowercase for consistent comparison
const normalizeRole = (role: string | undefined): UserRole => {
  if (!role) return 'student';
  const raw = role.toLowerCase().trim();
  // Handle case where someone might use "Super Admin" or "SuperAdmin"
  if (raw === 'super admin' || raw === 'super_admin') {
    return 'superadmin';
  }
  // Handle common variations
  if (['student', 'teacher', 'school', 'admin', 'superadmin', 'principal', 'associate'].includes(raw)) {
    return raw as UserRole;
  }
  return 'student'; // Default fallback
};

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed for minimal design
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const userRole = useMemo(() => normalizeRole(profile?.role), [profile?.role]);

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
  const hiddenPages = ['/login', '/signup', '/forgot-password', '/onboarding', '/approval-pending', '/secretbackend', '/vrlessonplayer', '/xrlessonplayer', '/learnxr/lesson'];
  if (hiddenPages.some(page => location.pathname.startsWith(page)) || !user) {
    return null;
  }

  // Role checks
  const isStudent = userRole === 'student';
  const isTeacher = userRole === 'teacher';
  const isPrincipal = userRole === 'principal';
  const isSchool = userRole === 'school';
  const isAssociate = userRole === 'associate';
  const isAdmin = userRole === 'admin';
  const isSuperadmin = userRole === 'superadmin';
  const isAdminOrSuperadmin = isAdmin || isSuperadmin;
  // School administrators should NOT have access to Create, Explore, History
  const canCreate = isTeacher || isAdminOrSuperadmin;

  // Build navigation items based on role according to the spec:
  // Associate: Dashboard, Lessons only (refine lessons, submit for approval)
  // Student: Dashboard, Lessons, Profile
  // Teacher: Dashboard, Lessons, Create, Explore, History, Studio, Profile, Settings
  // Principal: Dashboard, Lessons, Profile, Settings
  // Admin/Superadmin: Dashboard (Content), Lessons, Create, Explore, History, Approvals, System, Profile, Settings
  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [];

    // Associate: only Dashboard and Lessons
    if (isAssociate) {
      items.push({ path: '/dashboard/associate', label: 'Dashboard', icon: FaTachometerAlt });
      items.push({ path: '/lessons', label: 'Lessons', icon: FaBookOpen });
      return items;
    }

    // LMS Dashboards - role-based
    if (isStudent) {
      items.push({ path: '/dashboard/student', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isTeacher) {
      items.push({ path: '/dashboard/teacher', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isPrincipal) {
      items.push({ path: '/dashboard/principal', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isSchool) {
      items.push({ path: '/dashboard/school', label: 'Dashboard', icon: FaTachometerAlt });
    } else if (isAdminOrSuperadmin) {
      // Admin/Superadmin see content dashboard
      items.push({ path: '/studio/content', label: 'Dashboard', icon: FaTachometerAlt });
    }

    // Lessons - everyone can see
    items.push({ path: '/lessons', label: 'Lessons', icon: FaBookOpen });

    // Personalized Learning (AI) - students only
    if (isStudent) {
      items.push({ path: '/personalized-learning', label: 'Personalized Learning', icon: FaLightbulb });
    }

    // AI Teacher Support merged into Create page (top-right panel) - no separate nav item

    // Automated Assessments - students (take/list) and teachers+ (create/list/grade)
    if (isStudent || isTeacher || isSchool || isPrincipal || isAdminOrSuperadmin) {
      items.push({ path: '/assessments', label: 'Assessments', icon: FaClipboardList });
    }

    // Creator tools - teachers, schools, admin, superadmin (includes AI Teacher Support panel in top-right)
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
      items.push({ path: '/admin/lesson-edit-requests', label: 'Lesson Edit Requests', icon: FaEdit });
      items.push({ path: '/admin/schools', label: 'School Management', icon: FaSchool });
      items.push({ path: '/admin/classes', label: 'Class Management', icon: FaUsers });
      items.push({ path: '/admin/logs', label: 'Production Logs', icon: FaFileAlt });
      items.push({ path: '/system-status', label: 'System', icon: FaServer });
    }

    // Principal can also access class management, student approvals, and teacher approvals
    if (isPrincipal) {
      items.push({ path: '/teacher/approvals', label: 'Student Approvals', icon: FaUserCheck });
      items.push({ path: '/school/approvals', label: 'Teacher Approvals', icon: FaChalkboardTeacher });
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
      case 'associate': return FaUser;
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
      case 'school': return 'text-primary';
      case 'associate': return 'text-cyan-400';
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
      case 'school': return 'bg-primary/20';
      case 'associate': return 'bg-cyan-500/20';
      case 'admin': return 'bg-amber-500/20';
      case 'superadmin': return 'bg-rose-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  const RoleIcon = getRoleIcon();
  const roleColor = getRoleColor();
  const roleBgColor = getRoleBgColor();

  const sidebarWidth = isCollapsed ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)';

  const NavContent = ({ forceExpanded = false }: { forceExpanded?: boolean }) => {
    const expanded = forceExpanded || !isCollapsed;
    const navLinkClass = (active: boolean) =>
      `flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium transition-colors group relative ${
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      } ${!expanded ? 'justify-center px-0' : ''}`;

    const renderNavLink = (
      to: string,
      label: string,
      Icon: React.ComponentType<{ className?: string }>,
      active: boolean
    ) => (
      <Link to={to} className={navLinkClass(active)} title={!expanded ? label : undefined}>
        <Icon className="h-4 w-4 shrink-0" />
        {expanded && <span className="truncate">{label}</span>}
        {!expanded && (
          <span className="absolute left-full z-50 ml-2 rounded-md border border-sidebar-border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap">
            {label}
          </span>
        )}
      </Link>
    );

    return (
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-2">
          <Link
            to={isAdminOrSuperadmin ? '/studio/content' : isAssociate ? '/dashboard/associate' : '/lessons'}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <FaGraduationCap className="h-4 w-4" />
            </div>
            {expanded && (
              <span className="font-semibold leading-none" style={learnXRFontStyle}>
                <span className="text-sidebar-foreground">Learn</span>
                <span className="text-sidebar-primary">XR</span>
                <TrademarkSymbol className="ml-0.5 inline" />
              </span>
            )}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/lessons' && location.pathname.startsWith(item.path + '/'));
              return (
                <li key={item.path}>{renderNavLink(item.path, item.label, item.icon, isActive)}</li>
              );
            })}
          </ul>
          <div className="my-2 h-px bg-sidebar-border" />
          <ul className="space-y-0.5">
            {isAdminOrSuperadmin && (
              <li>
                {renderNavLink('/developer', 'Settings', FaCog, location.pathname === '/developer')}
              </li>
            )}
          </ul>
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`group mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${!expanded ? 'justify-center' : ''}`}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <FaSun className="h-4 w-4 shrink-0" /> : <FaMoon className="h-4 w-4 shrink-0" />}
            {expanded && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
            {!expanded && (
              <span className="absolute left-full z-50 ml-2 rounded-md border border-sidebar-border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${!expanded ? 'justify-center' : ''}`}
                title="Account"
                aria-label="Account menu"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${roleColor} ${roleBgColor}`}>
                  <RoleIcon className="h-4 w-4" />
                </div>
                {expanded && (
                  <div className="min-w-0 flex-1 truncate text-left">
                    <p className="text-xs font-medium truncate">
                      {ROLE_DISPLAY_NAMES[userRole] || userRole}
                      {profile?.isGuest && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal ml-1">
                          Guest
                        </Badge>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {profile?.name || profile?.displayName || 'User'}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={expanded ? 'start' : 'center'} side="right" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                  <FaUser className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                <FaSignOutAlt className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile: Sheet (left) */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label="Open menu"
        >
          <FaBars className="h-4 w-4" />
        </button>
        <SheetContent side="left" className="w-sidebar border-sidebar-border bg-sidebar p-0">
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <span className="font-semibold" style={learnXRFontStyle}>
              <span className="text-sidebar-foreground">Learn</span>
              <span className="text-sidebar-primary">XR</span>
              <TrademarkSymbol className="ml-0.5 inline" />
            </span>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden py-2">
            <NavContent forceExpanded />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: Icon sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-linear lg:flex"
        style={{ width: sidebarWidth }}
      >
        <NavContent />
        {/* Rail: collapse toggle (shadcn-style) */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar shadow-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <FaChevronRight className="h-3 w-3" />
          ) : (
            <FaChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>

      {/* Spacer */}
      <div className="hidden lg:block shrink-0 transition-[width] duration-200" style={{ width: sidebarWidth }} />
    </>
  );
};

export default Sidebar;
