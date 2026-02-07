import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  FaClock, 
  FaEnvelope, 
  FaSignOutAlt, 
  FaCheck,
  FaChalkboardTeacher,
  FaSchool,
  FaUser,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaUserGraduate,
  FaExchangeAlt
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { 
  requiresApproval, 
  getDefaultPage,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  APPROVAL_STATUS_DISPLAY
} from '../utils/rbac';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../Components/ui/card';
import { Button } from '../Components/ui/button';
import { Badge } from '../Components/ui/badge';

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isRejected ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted border border-border'}`}>
              {isRejected ? (
                <FaExclamationTriangle className="text-destructive text-2xl" />
              ) : (
                <FaClock className="text-muted-foreground text-2xl" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            {isRejected ? 'Application Rejected' : 'Pending Approval'}
          </h1>
          <p className="text-muted-foreground text-sm">
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
        <Card className="shadow-lg">
          <CardContent className="pt-6 space-y-6">
            <div className="flex justify-center">
              <Badge variant={isRejected ? 'destructive' : 'secondary'}>
                {isRejected ? <FaExclamationTriangle className="mr-1.5 h-3 w-3" /> : <FaClock className="mr-1.5 h-3 w-3" />}
                {isRejected ? 'Application Rejected' : 'Awaiting Review'}
              </Badge>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 ${roleColors.bg} ${roleColors.border}`}>
                    <RoleIcon className={`text-lg ${roleColors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{profile?.name || profile?.displayName || 'User'}</h3>
                    <p className="text-muted-foreground text-sm truncate">{profile?.email}</p>
                    <Badge variant="secondary" className="mt-2">
                      {profile?.role ? ROLE_DISPLAY_NAMES[profile.role] : 'User'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <FaCalendarAlt className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Account Created</p>
                <p className="text-muted-foreground text-xs">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recently'}
                </p>
              </div>
            </div>

            {!isRejected && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FaEnvelope className="h-4 w-4 text-primary" />
                    What happens next?
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <FaCheck className="text-primary text-xs" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Application Submitted</p>
                      <p className="text-muted-foreground text-xs">Your registration is complete</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted border flex items-center justify-center shrink-0 mt-0.5">
                      <FaClock className="text-muted-foreground text-xs" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Under Review</p>
                      <p className="text-muted-foreground text-xs">
                        {profile?.role === 'student'
                          ? 'Your teacher is reviewing your profile'
                          : profile?.role === 'teacher'
                          ? 'Your school administrator is reviewing your profile'
                          : 'Our admin team is reviewing your profile'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted border flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-muted-foreground text-xs">3</span>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Approval & Access</p>
                      <p className="text-muted-foreground text-xs">Once approved, you'll have full access</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isRejected && (
              <Card className="border-destructive/20">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-2">Why was my application rejected?</h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    Your application may have been rejected for various reasons. Common reasons include:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                    <li>Incomplete or invalid information</li>
                    <li>Unable to verify credentials</li>
                    <li>Duplicate account detected</li>
                  </ul>
                  <p className="text-muted-foreground text-sm mt-4">
                    If you believe this was a mistake, contact support at{' '}
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
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FaUserGraduate className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold mb-1">Want to start learning now?</h3>
                        <p className="text-muted-foreground text-sm mb-3">
                          While waiting for approval, you can switch to a student account and start accessing lessons.
                        </p>
                        <Button variant="outline" size="sm" onClick={handleSwitchToStudent} disabled={switching}>
                          {switching ? (
                            <>Switching...</>
                          ) : (
                            <>
                              <FaExchangeAlt className="mr-2 h-3.5 w-3.5" />
                              Switch to Student
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            <p className="text-center text-muted-foreground text-xs">
              Questions? Contact{' '}
              <a href="mailto:admin@altiereality.com" className="text-primary hover:underline">
                admin@altiereality.com
              </a>
            </p>

            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <FaSignOutAlt className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-xs">
          This page will update when your status changes.
        </p>
      </div>
    </div>
  );
};

export default ApprovalPending;
