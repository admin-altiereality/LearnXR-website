import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    FaCalendarAlt,
    FaChalkboardTeacher,
    FaCheck,
    FaClock,
    FaEnvelope,
    FaExchangeAlt,
    FaExclamationTriangle,
    FaSchool,
    FaSignOutAlt,
    FaUserGraduate
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Badge } from '../Components/ui/badge';
import { Button } from '../Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../Components/ui/card';
import FuturisticBackground from '../Components/FuturisticBackground';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
    getDefaultPage,
    requiresApproval,
    ROLE_COLORS,
    ROLE_DISPLAY_NAMES
} from '../utils/rbac';

const ApprovalPending = () => {
  const navigate = useNavigate();
  const { user, profile, logout, refreshProfile } = useAuth();
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      navigate('/login');
      return;
    }

    // Redirect if profile doesn't require approval
    if (profile && !requiresApproval(profile.role)) {
      navigate(getDefaultPage(profile.role));
      return;
    }

    // Redirect if already approved
    if (profile?.approvalStatus === 'approved') {
      navigate(getDefaultPage(profile.role));
      return;
    }
  }, [user, profile, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Switch to student role (only allowed when approval is pending)
  const handleSwitchToStudent = async () => {
    if (!user?.uid || profile?.approvalStatus !== 'pending') return;
    
    setSwitching(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: 'student',
        approvalStatus: null, // Students don't need approval
        previousRole: profile?.role, // Keep track of previous role
        roleSwitchedAt: new Date().toISOString(),
        onboardingCompleted: false, // Require student onboarding
      });
      
      toast.success('Switched to student account! Please complete your profile.');
      
      // Refresh profile and redirect to onboarding
      await refreshProfile();
      navigate('/onboarding');
    } catch (error) {
      console.error('Error switching role:', error);
      toast.error('Failed to switch role. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  const isRejected = profile?.approvalStatus === 'rejected';
  const RoleIcon = profile?.role === 'teacher' ? FaChalkboardTeacher : FaSchool;
  const roleColors = profile?.role ? ROLE_COLORS[profile.role] : ROLE_COLORS.teacher;

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  return (
    <FuturisticBackground className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col">
      <div className="relative z-10 flex flex-1 min-h-0 w-full flex-col px-3 py-2">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 min-h-0 gap-1.5 justify-center">
        {/* Header */}
        <div className="text-center shrink-0">
          <div className="flex justify-center mb-2">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isRejected ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted border border-border'}`}>
              {isRejected ? (
                <FaExclamationTriangle className="text-destructive text-xl" />
              ) : (
                <FaClock className="text-muted-foreground text-xl" />
              )}
            </div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight mb-1">
            {isRejected ? 'Application Rejected' : 'Pending Approval'}
          </h1>
          <p className="text-muted-foreground text-xs">
            {isRejected
              ? 'Unfortunately, your application was not approved'
              : profile?.role === 'student'
              ? 'Your account is being reviewed by your teacher'
              : profile?.role === 'teacher'
              ? 'Your account is being reviewed by your school administrator'
              : 'Your account is being reviewed by our admin team'}
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardContent className="pt-3 pb-3 space-y-2.5 flex-1 min-h-0 flex flex-col">
            <div className="flex justify-center shrink-0">
              <Badge variant={isRejected ? 'destructive' : 'secondary'} className="text-xs">
                {isRejected ? <FaExclamationTriangle className="mr-1 h-2.5 w-2.5" /> : <FaClock className="mr-1 h-2.5 w-2.5" />}
                {isRejected ? 'Application Rejected' : 'Awaiting Review'}
              </Badge>
            </div>

            <Card className="shrink-0">
              <CardContent className="py-3 px-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${roleColors.bg} ${roleColors.border}`}>
                    <RoleIcon className={`text-base ${roleColors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{profile?.name || profile?.displayName || 'User'}</h3>
                    <p className="text-muted-foreground text-xs truncate">{profile?.email}</p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'User'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 rounded-lg border bg-card p-2.5 shrink-0">
              <FaCalendarAlt className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium">Account Created</p>
                <p className="text-muted-foreground text-[11px]">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recently'}
                </p>
              </div>
            </div>

            {!isRejected && (
              <Card className="shrink-0">
                <CardHeader className="py-2 px-3 pb-0">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <FaEnvelope className="h-3.5 w-3.5 text-primary" />
                    What happens next?
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1.5 px-3 pb-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <FaCheck className="text-primary text-[10px]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Application Submitted</p>
                      <p className="text-muted-foreground text-[11px]">Your registration is complete</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-muted border flex items-center justify-center shrink-0 mt-0.5">
                      <FaClock className="text-muted-foreground text-[10px]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Under Review</p>
                      <p className="text-muted-foreground text-[11px]">
                        {profile?.role === 'student'
                          ? 'Your teacher is reviewing your profile'
                          : profile?.role === 'teacher'
                          ? 'Your school administrator is reviewing your profile'
                          : 'Our admin team is reviewing your profile'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-muted border flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-muted-foreground text-[10px]">3</span>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Approval & Access</p>
                      <p className="text-muted-foreground text-[11px]">Once approved, you'll have full access</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isRejected && (
              <Card className="border-destructive/20 shrink-0">
                <CardContent className="py-3 px-3">
                  <h3 className="text-xs font-semibold mb-1.5">Why was my application rejected?</h3>
                  <p className="text-muted-foreground text-[11px] mb-2">
                    Your application may have been rejected for various reasons. Common reasons include:
                  </p>
                  <ul className="space-y-0.5 text-[11px] text-muted-foreground list-disc list-inside">
                    <li>Incomplete or invalid information</li>
                    <li>Unable to verify credentials</li>
                    <li>Duplicate account detected</li>
                  </ul>
                  <p className="text-muted-foreground text-[11px] mt-2">
                    If you believe this was a mistake, contact{' '}
                    <a href="mailto:admin@altiereality.com" className="text-primary hover:underline">
                      admin@altiereality.com
                    </a>
                  </p>
                </CardContent>
              </Card>
            )}

            {profile?.approvalStatus === 'pending' &&
              profile?.role !== 'student' &&
              (profile?.role === 'teacher' || profile?.role === 'school') && (
                <Card className="shrink-0">
                  <CardContent className="py-3 px-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FaUserGraduate className="text-primary text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold mb-0.5">Want to start learning now?</h3>
                        <p className="text-muted-foreground text-[11px] mb-2">
                          While waiting for approval, you can switch to a student account and start accessing lessons.
                        </p>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSwitchToStudent} disabled={switching}>
                          {switching ? (
                            <>Switching...</>
                          ) : (
                            <>
                              <FaExchangeAlt className="mr-1.5 h-3 w-3" />
                              Switch to Student
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            <p className="text-center text-muted-foreground text-[11px] shrink-0">
              Questions? Contact{' '}
              <a href="mailto:admin@altiereality.com" className="text-primary hover:underline">
                admin@altiereality.com
              </a>
            </p>

            <Button variant="outline" size="sm" className="w-full shrink-0 h-9 text-xs" onClick={handleLogout}>
              <FaSignOutAlt className="mr-1.5 h-3.5 w-3.5" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-[11px] shrink-0">
          This page will update when your status changes.
        </p>
      </div>
      </div>
    </FuturisticBackground>
  );
};

export default ApprovalPending;
