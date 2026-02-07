import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  User,
  Mail,
  Building2,
  Briefcase,
  Phone,
  Edit3,
  Check,
  X,
  GraduationCap,
  BookOpen,
  Trophy,
  Target,
  Calendar,
  Shield,
  Star,
  Award,
  Clock,
  ChevronRight,
  School,
  MapPin,
  Globe,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Components/ui/button';
import { Card, CardContent } from '../Components/ui/card';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Badge } from '../Components/ui/badge';
import { PrismFluxLoader } from '../Components/ui/prism-flux-loader';

const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  student: { label: 'Student', variant: 'secondary', icon: GraduationCap },
  teacher: { label: 'Teacher', variant: 'secondary', icon: BookOpen },
  school: { label: 'School', variant: 'outline', icon: School },
  admin: { label: 'Admin', variant: 'default', icon: Shield },
  superadmin: { label: 'Superadmin', variant: 'destructive', icon: Star },
};

const RoleBadge = ({ role }: { role: string }) => {
  const config = roleConfig[role] ?? roleConfig.student;
  const Icon = config.icon;
  const displayLabel = config.label || (role.charAt(0).toUpperCase() + role.slice(1));
  return (
    <Badge variant={config.variant} className="gap-1.5 font-semibold">
      <Icon className="w-3.5 h-3.5" />
      {displayLabel}
    </Badge>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) => (
  <Card className="rounded-xl border-border bg-card">
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const Profile = () => {
  const { user, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [stats, setStats] = useState({
    lessonsCompleted: 0,
    quizzesCompleted: 0,
    averageScore: 0,
    totalTime: 0,
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    function: '',
    phoneNumber: '',
    email: user?.email ?? '',
    bio: '',
    location: '',
    website: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setProfile(profileData);
          setFormData({
            firstName: (profileData.firstName as string) || (profileData.name as string)?.split(' ')[0] || '',
            lastName: (profileData.lastName as string) || (profileData.name as string)?.split(' ').slice(1).join(' ') || '',
            company: (profileData.company as string) || (profileData.schoolName as string) || '',
            function: (profileData.function as string) || (profileData.designation as string) || '',
            phoneNumber: (profileData.phoneNumber as string) || (profileData.phone as string) || '',
            email: (profileData.email as string) || user.email || '',
            bio: (profileData.bio as string) || '',
            location: (profileData.location as string) || (profileData.city as string) || '',
            website: (profileData.website as string) || '',
          });
        }
        if (authProfile?.role === 'student' || !authProfile?.role) {
          try {
            const progressRef = collection(db, 'user_lesson_progress');
            const q = query(progressRef, where('userId', '==', user.uid));
            const progressSnap = await getDocs(q);
            let completed = 0;
            let quizzes = 0;
            let totalScore = 0;
            let scoreCount = 0;
            progressSnap.forEach((d) => {
              const data = d.data();
              if (data.completed) completed++;
              if (data.quizCompleted) {
                quizzes++;
                if (data.quizScore?.percentage) {
                  totalScore += data.quizScore.percentage;
                  scoreCount++;
                }
              }
            });
            setStats({
              lessonsCompleted: completed,
              quizzesCompleted: quizzes,
              averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
              totalTime: completed * 15,
            });
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, authProfile?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    try {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        updatedAt: new Date(),
      });
      setProfile((prev) => (prev ? { ...prev, ...formData, name: `${formData.firstName} ${formData.lastName}`.trim() } : prev));
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    }
  };

  const getInitials = () => {
    if (formData.firstName && formData.lastName) return `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase();
    if (formData.firstName) return formData.firstName[0].toUpperCase();
    return user?.email?.[0].toUpperCase() ?? 'U';
  };

  const getDisplayName = () => {
    if (formData.firstName || formData.lastName) return `${formData.firstName} ${formData.lastName}`.trim();
    return (profile?.name as string) || user?.email?.split('@')[0] || 'User';
  };

  const userRole = (profile?.role as string) || authProfile?.role || 'student';
  const memberSince = profile?.createdAt
    ? new Date((profile.createdAt as { seconds?: number }).seconds ? (profile.createdAt as { seconds: number }).seconds * 1000 : (profile.createdAt as number)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-24">
        <Card className="rounded-xl border-border max-w-md w-full">
          <CardContent className="py-16">
            <PrismFluxLoader statuses={['Loading profile…', 'Fetching your data…']} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-24">
        <Card className="rounded-xl border-border border-destructive/50 bg-destructive/5 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <X className="w-7 h-7 text-destructive" />
            </div>
            <p className="text-foreground font-medium mb-1">Error</p>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" className="border-border" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const infoFields = [
    { icon: User, label: 'First Name', value: formData.firstName || 'Not set' },
    { icon: User, label: 'Last Name', value: formData.lastName || 'Not set' },
    { icon: userRole === 'school' ? School : Building2, label: userRole === 'school' ? 'School Name' : userRole === 'student' ? 'School' : 'Company', value: formData.company || 'Not set' },
    { icon: Briefcase, label: userRole === 'student' ? 'Class' : 'Designation', value: formData.function || 'Not set' },
    { icon: Phone, label: 'Phone', value: formData.phoneNumber || 'Not set' },
    { icon: Mail, label: 'Email', value: user?.email || 'Not set' },
    { icon: MapPin, label: 'Location', value: formData.location || 'Not set' },
    { icon: Globe, label: 'Website', value: formData.website || 'Not set' },
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Profile Header Card */}
        <Card className="rounded-2xl border-border overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/20 border border-border flex items-center justify-center text-foreground text-2xl sm:text-3xl font-bold">
                    {getInitials()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary border-2 border-card flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{getDisplayName()}</h1>
                    <RoleBadge role={userRole} />
                  </div>
                  <p className="text-muted-foreground flex items-center gap-2 mb-2 text-sm">
                    <Mail className="w-4 h-4" />
                    {user?.email}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {memberSince}
                    </span>
                    {formData.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {formData.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-muted shrink-0"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </>
                )}
              </Button>
            </div>
            {formData.bio && !isEditing && (
              <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-2xl">{formData.bio}</p>
            )}
          </CardContent>
        </Card>

        {/* Stats - Students */}
        {(userRole === 'student' || !userRole) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={BookOpen} label="Lessons Completed" value={stats.lessonsCompleted} />
            <StatCard icon={Trophy} label="Quizzes Passed" value={stats.quizzesCompleted} />
            <StatCard icon={Target} label="Average Score" value={`${stats.averageScore}%`} />
            <StatCard icon={Clock} label="Learning Time" value={`${stats.totalTime}m`} />
          </div>
        )}

        {/* Profile Information */}
        <Card className="rounded-2xl border-border overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile Information
            </h2>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">First Name</Label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter first name"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Last Name</Label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter last name"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">
                      {userRole === 'school' ? 'School Name' : userRole === 'student' ? 'School/Institution' : 'Company'}
                    </Label>
                    <Input
                      value={formData.company}
                      onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                      placeholder={userRole === 'student' ? 'Enter school name' : 'Enter company name'}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{userRole === 'student' ? 'Class/Grade' : 'Designation'}</Label>
                    <Input
                      value={formData.function}
                      onChange={(e) => setFormData((prev) => ({ ...prev, function: e.target.value }))}
                      placeholder={userRole === 'student' ? 'e.g., Class 10' : 'Enter designation'}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Phone Number</Label>
                    <Input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="Enter phone number"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Location</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="City, Country"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <Input type="email" value={formData.email} disabled className="bg-muted border-border text-muted-foreground cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Website</Label>
                    <Input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                      placeholder="https://..."
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Bio</Label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
                    placeholder="Tell us about yourself..."
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" className="border-border" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {infoFields.map((field, index) => {
                  const Icon = field.icon;
                  return (
                    <Card key={index} className="rounded-xl border-border bg-card hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{field.label}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate" title={String(field.value)}>
                          {field.value}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userRole === 'student' && (
            <Card
              className="rounded-2xl border-border bg-card hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => navigate('/lessons')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mb-1">Continue Learning</h3>
                <p className="text-sm text-muted-foreground">Pick up where you left off</p>
              </CardContent>
            </Card>
          )}
          {(userRole === 'school' || userRole === 'admin' || userRole === 'superadmin') && (
            <Card
              className="rounded-2xl border-border bg-card hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => navigate('/studio/content')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Settings className="w-6 h-6 text-primary" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mb-1">Content Studio</h3>
                <p className="text-sm text-muted-foreground">Manage your lessons</p>
              </CardContent>
            </Card>
          )}

          <Card
            className="rounded-2xl border-border bg-card hover:border-primary/40 transition-all cursor-pointer group"
            onClick={() => navigate('/lessons')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-foreground font-semibold mb-1">Browse Lessons</h3>
              <p className="text-sm text-muted-foreground">Explore available content</p>
            </CardContent>
          </Card>

          <Card
            className="rounded-2xl border-border bg-card hover:border-primary/40 transition-all cursor-pointer group"
            onClick={() => toast.info('Coming soon!')}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-foreground font-semibold mb-1">Achievements</h3>
              <p className="text-sm text-muted-foreground">View your badges</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
