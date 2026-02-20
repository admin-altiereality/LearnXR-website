import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
    FaArrowLeft,
    FaArrowRight,
    FaBook,
    FaBriefcase,
    FaBuilding,
    FaCalendarAlt,
    FaChalkboardTeacher,
    FaCheck,
    FaCheckCircle,
    FaChild,
    FaClipboardList,
    FaGraduationCap,
    FaHeart,
    FaMapMarkerAlt,
    FaPhone,
    FaRocket,
    FaSchool,
    FaUserGraduate,
    FaUsers
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../Components/ui/button';
import { Card, CardContent } from '../Components/ui/card';
import FuturisticBackground from '../Components/FuturisticBackground';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Progress } from '../Components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../Components/ui/select';
import { db } from '../config/firebase';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { isMetaQuestBrowser } from '../utils/vrDetection';
import type { Class } from '../types/lms';
import {
    getDefaultPage,
    requiresApproval,
    isGuestUser
} from '../utils/rbac';

// Student onboarding data
interface StudentOnboardingData {
  age: string;
  dateOfBirth: string;
  class: string;
  classId: string; // Selected class ID
  curriculum: string;
  schoolName: string;
  schoolId: string; // Selected school ID
  city: string;
  state: string;
  learningPreferences: string[];
  languagePreference: string;
}

// Teacher onboarding data
interface TeacherOnboardingData {
  schoolName: string;
  schoolId: string; // Selected school ID
  subjectsTaught: string[];
  experienceYears: string;
  qualifications: string;
  phoneNumber: string;
  city: string;
  state: string;
  boardAffiliation: string;
  classesHandled: string[];
}

// School onboarding data
interface SchoolOnboardingData {
  schoolName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
  contactPhone: string;
  website: string;
  studentCount: string;
  boardAffiliation: string;
  establishedYear: string;
  schoolType: string;
}

// Options
const curriculumOptions = [
  { id: 'cbse', label: 'CBSE', description: 'Central Board of Secondary Education' },
  { id: 'icse', label: 'ICSE', description: 'Indian Certificate of Secondary Education' },
  { id: 'state', label: 'State Board', description: 'State Education Board' },
  { id: 'ib', label: 'IB', description: 'International Baccalaureate' },
  { id: 'cambridge', label: 'Cambridge', description: 'Cambridge International' },
  { id: 'other', label: 'Other', description: 'Other curriculum' },
];

const classOptions = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  label: `Class ${i + 1}`,
}));

const ageOptions = Array.from({ length: 15 }, (_, i) => ({
  id: String(i + 6),
  label: `${i + 6} years`,
}));

const subjectOptions = [
  'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology',
  'English', 'Hindi', 'Social Studies', 'History', 'Geography',
  'Computer Science', 'Economics', 'Business Studies', 'Accountancy',
  'Physical Education', 'Art', 'Music', 'Other'
];

/** Generate a unique 6-character uppercase alphanumeric school code */
function generateSchoolCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const experienceOptions = [
  { id: '0-2', label: '0-2 years' },
  { id: '3-5', label: '3-5 years' },
  { id: '6-10', label: '6-10 years' },
  { id: '11-15', label: '11-15 years' },
  { id: '15+', label: '15+ years' },
];

const qualificationOptions = [
  'B.Ed', 'M.Ed', 'B.A.', 'M.A.', 'B.Sc.', 'M.Sc.', 
  'B.Tech', 'M.Tech', 'Ph.D.', 'D.Ed', 'Other'
];

const stateOptions = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Other'
];

const schoolTypeOptions = [
  { id: 'private', label: 'Private' },
  { id: 'government', label: 'Government' },
  { id: 'aided', label: 'Government Aided' },
  { id: 'international', label: 'International' },
  { id: 'other', label: 'Other' },
];

const studentCountOptions = [
  { id: '1-100', label: 'Less than 100' },
  { id: '100-500', label: '100 - 500' },
  { id: '500-1000', label: '500 - 1000' },
  { id: '1000-2000', label: '1000 - 2000' },
  { id: '2000+', label: 'More than 2000' },
];

const learningPreferenceOptions = [
  { id: 'visual', label: 'Visual Learning', icon: '👁️', description: 'I learn best by seeing' },
  { id: 'auditory', label: 'Audio Learning', icon: '👂', description: 'I learn best by listening' },
  { id: 'kinesthetic', label: 'Hands-on Learning', icon: '🤲', description: 'I learn best by doing' },
  { id: 'reading', label: 'Reading/Writing', icon: '📚', description: 'I learn best by reading' },
];

const languageOptions = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'kannada', label: 'Kannada' },
  { id: 'malayalam', label: 'Malayalam' },
  { id: 'marathi', label: 'Marathi' },
  { id: 'bengali', label: 'Bengali' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'other', label: 'Other' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  
  // Teacher form data
  const [teacherData, setTeacherData] = useState<TeacherOnboardingData>({
    schoolName: '',
    schoolId: '', // Store selected school ID
    subjectsTaught: [],
    experienceYears: '',
    qualifications: '',
    phoneNumber: '',
    city: '',
    state: '',
    boardAffiliation: '',
    classesHandled: [],
  });

  // Student form data - with class and school selection
  const [studentData, setStudentData] = useState<StudentOnboardingData>({
    age: '',
    dateOfBirth: '',
    class: '',
    classId: '', // Store selected class ID
    curriculum: '',
    schoolName: '',
    schoolId: '', // Store selected school ID
    city: '',
    state: '',
    learningPreferences: [],
    languagePreference: 'english',
  });

  // Approved schools and classes
  const [approvedSchools, setApprovedSchools] = useState<any[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [schoolsLoadError, setSchoolsLoadError] = useState<string | null>(null);
  const [retrySchoolsKey, setRetrySchoolsKey] = useState(0);
  // Teacher: unique school code input and verify state
  const [schoolCodeInput, setSchoolCodeInput] = useState('');
  const [schoolCodeError, setSchoolCodeError] = useState('');
  const [schoolCodeVerifying, setSchoolCodeVerifying] = useState(false);
  // Student: school code only (no dropdown, no class selection)
  const [studentSchoolCodeInput, setStudentSchoolCodeInput] = useState('');
  const [studentSchoolCodeError, setStudentSchoolCodeError] = useState('');
  const [studentSchoolCodeVerifying, setStudentSchoolCodeVerifying] = useState(false);
  // Student: available classes for selected school
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  
  // School form data
  const [schoolData, setSchoolData] = useState<SchoolOnboardingData>({
    schoolName: profile?.name || '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactPerson: '',
    contactPhone: '',
    website: '',
    studentCount: '',
    boardAffiliation: '',
    establishedYear: '',
    schoolType: '',
  });

  const isStudentRole = profile?.role === 'student';
  const isTeacherRole = profile?.role === 'teacher';
  const isSchoolRole = profile?.role === 'school';
  const hasRedirectedRef = useRef(false);

  // Total steps based on role - Students have 5 steps; guest students have 4 (no school step)
  const totalSteps = isStudentRole ? (isGuestUser(profile) ? 4 : 5) : isTeacherRole ? 4 : isSchoolRole ? 4 : 1;

  // Theme and body overflow - must run before any conditional return (Rules of Hooks)
  const { setTheme } = useTheme();
  const [isVRDevice, setIsVRDevice] = useState(false);
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);
  useEffect(() => {
    setIsVRDevice(isMetaQuestBrowser());
  }, []);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Wait for user and profile (critical for guest: profile loads after anonymous auth)
      if (!user?.uid || !profile) {
        return; // Keep loading true until we have both
      }

      try {
        // Check if onboarding is already completed (using general check that works for all roles)
        if (profile.onboardingCompleted === true) {
          if (hasRedirectedRef.current) return;
          hasRedirectedRef.current = true;
          // If onboarding is complete, check where to redirect
          if (!isGuestUser(profile) && requiresApproval(profile.role) && profile.approvalStatus !== 'approved') {
            navigate('/approval-pending');
          } else {
            navigate(getDefaultPage(profile.role, profile));
          }
          return;
        }
        
        // Pre-fill school name if available
        if (isSchoolRole && profile.name) {
          setSchoolData(prev => ({ ...prev, schoolName: profile.name || '' }));
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, profile, navigate, isSchoolRole]);

  // Fetch approved schools for teacher onboarding only (student uses code-only lookup)
  useEffect(() => {
    if (!isTeacherRole) return;

    setSchoolsLoadError(null);
    const schoolsRef = collection(db, 'schools');
    const approvedSchoolsQuery = query(
      schoolsRef,
      where('approvalStatus', '==', 'approved')
    );

    const unsubscribe = onSnapshot(approvedSchoolsQuery, (snapshot) => {
      const schools: any[] = [];
      snapshot.forEach((docSnapshot) => {
        schools.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });
      });
      setApprovedSchools(schools);
      setLoadingSchools(false);
      setSchoolsLoadError(null);
    }, (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Permission or network error';
      console.error('Error fetching approved schools:', error);
      setSchoolsLoadError(msg);
      setLoadingSchools(false);
    });

    return () => unsubscribe();
  }, [isTeacherRole, retrySchoolsKey]);

  // Verify teacher's school code and associate with school
  // Prefer client-side match from loaded list; fallback to direct query if list empty (e.g. load failed)
  const handleVerifySchoolCode = async () => {
    const code = schoolCodeInput.trim().toUpperCase().replace(/\s/g, '');
    if (!code) {
      setSchoolCodeError('Please enter your school code.');
      return;
    }
    setSchoolCodeError('');
    setSchoolCodeVerifying(true);
    try {
      const normalizeCode = (c: unknown) => String(c ?? '').trim().toUpperCase().replace(/\s/g, '');
      let found = approvedSchools.find(
        (s: { schoolCode?: unknown }) => normalizeCode(s.schoolCode) === code
      );
      if (!found) {
        const schoolsRef = collection(db, 'schools');
        const q = query(
          schoolsRef,
          where('approvalStatus', '==', 'approved'),
          where('schoolCode', '==', code)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          found = { id: doc.id, ...doc.data() } as { id: string; name?: string; city?: string; state?: string; boardAffiliation?: string; schoolCode?: string };
        }
      }
      if (!found) {
        setSchoolCodeError(
          'Invalid or unapproved school code. Get the code from your school admin.'
        );
        return;
      }
      const school = found as { id: string; name?: string; city?: string; state?: string; boardAffiliation?: string };
      setTeacherData(prev => ({
        ...prev,
        schoolId: school.id,
        schoolName: school.name || prev.schoolName,
        city: school.city || prev.city,
        state: school.state || prev.state,
        boardAffiliation: school.boardAffiliation || prev.boardAffiliation,
      }));
      setSchoolCodeError('');
      toast.success(`Associated with ${school.name || 'school'}`);
    } catch (err: unknown) {
      console.error('Error verifying school code:', err);
      setSchoolCodeError('Could not verify school code. Please try again.');
    } finally {
      setSchoolCodeVerifying(false);
    }
  };

  // Verify student's school code and fetch available classes
  const handleVerifyStudentSchoolCode = async () => {
    const code = studentSchoolCodeInput.trim().toUpperCase().replace(/\s/g, '');
    if (!code) {
      setStudentSchoolCodeError('Please enter your school code.');
      return;
    }
    setStudentSchoolCodeError('');
    setStudentSchoolCodeVerifying(true);
    try {
      const schoolsRef = collection(db, 'schools');
      const q = query(
        schoolsRef,
        where('approvalStatus', '==', 'approved'),
        where('schoolCode', '==', code)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setStudentSchoolCodeError('Invalid or unapproved school code. Get the code from your school.');
        return;
      }
      const docSnap = snapshot.docs[0];
      const school = { id: docSnap.id, ...docSnap.data() } as { id: string; name?: string; city?: string; state?: string };
      setStudentData(prev => ({
        ...prev,
        schoolId: school.id,
        schoolName: school.name || prev.schoolName,
        city: school.city || prev.city,
        state: school.state || prev.state,
        classId: '',
        class: '',
      }));
      setStudentSchoolCodeError('');
      toast.success(`School: ${school.name || 'Verified'}`);
      
      // Fetch available classes for this school
      await fetchSchoolClasses(school.id);
    } catch (err: unknown) {
      console.error('Error verifying school code:', err);
      setStudentSchoolCodeError('Could not verify school code. Please try again.');
    } finally {
      setStudentSchoolCodeVerifying(false);
    }
  };

  // Fetch classes for the selected school
  const fetchSchoolClasses = async (schoolId: string) => {
    if (!schoolId) return;
    
    setLoadingClasses(true);
    try {
      const classesRef = collection(db, 'classes');
      const q = query(
        classesRef,
        where('school_id', '==', schoolId)
      );
      const snapshot = await getDocs(q);
      const classes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Class[];
      
      setAvailableClasses(classes);
      console.log('✅ Fetched classes for school', { schoolId, classCount: classes.length });
    } catch (err: unknown) {
      console.error('Error fetching classes:', err);
      toast.error('Could not load classes. Please try again.');
      setAvailableClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const canProceed = () => {
    if (isStudentRole) {
      if (isGuestUser(profile)) {
        switch (step) {
          case 1: return studentData.age !== '';
          case 2: return studentData.curriculum !== '';
          case 3: return studentData.learningPreferences.length > 0;
          case 4: return true; // Review step
          default: return false;
        }
      }
      switch (step) {
        case 1: return studentData.age !== '';
        case 2: return studentData.curriculum !== '';
        case 3: return studentData.schoolId !== '' && (studentData.classId !== '' || availableClasses.length === 0);
        case 4: return studentData.learningPreferences.length > 0;
        case 5: return true; // Review step
        default: return false;
      }
    }
    
    if (isTeacherRole) {
      switch (step) {
        case 1: return teacherData.schoolId !== '' && teacherData.city.trim() !== '';
        case 2: return teacherData.subjectsTaught.length > 0 && teacherData.classesHandled.length > 0;
        case 3: return teacherData.experienceYears !== '' && teacherData.qualifications !== '';
        case 4: return teacherData.phoneNumber.trim().length >= 10;
        default: return false;
      }
    }
    
    if (isSchoolRole) {
      switch (step) {
        case 1: return schoolData.schoolName.trim() !== '' && schoolData.schoolType !== '';
        case 2: return schoolData.address.trim() !== '' && schoolData.city.trim() !== '' && schoolData.state !== '';
        case 3: return schoolData.contactPerson.trim() !== '' && schoolData.contactPhone.trim().length >= 10;
        case 4: return schoolData.boardAffiliation !== '' && schoolData.studentCount !== '';
        default: return false;
      }
    }
    
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user?.uid) return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      
      // Base update data
      let updateData: any = {
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        updatedAt: now,
      };

      // Add role-specific data to the SAME users collection
      if (isStudentRole) {
        const isGuestStudent = isGuestUser(profile);
        if (!isGuestStudent && !studentData.schoolId) {
          toast.error('Please verify your school code before submitting.');
          setSubmitting(false);
          return;
        }
        updateData = {
          ...updateData,
          // Student onboarding data (school by code; class selected during onboarding; guest has no school)
          age: parseInt(studentData.age) || null,
          dateOfBirth: studentData.dateOfBirth || null,
          class: studentData.class || '',
          curriculum: studentData.curriculum,
          school: isGuestStudent ? '' : studentData.schoolName.trim(),
          school_id: isGuestStudent ? null : studentData.schoolId,
          class_ids: isGuestStudent ? [] : (studentData.classId ? [studentData.classId] : []),
          city: studentData.city || null,
          state: studentData.state || null,
          languagePreference: studentData.languagePreference,
          learningPreferences: studentData.learningPreferences,
          approvalStatus: isGuestStudent ? 'approved' : 'pending',
          ...(isGuestStudent ? { isGuest: true } : {}),
        };
        console.log('✅ Student onboarding data prepared', {
          schoolId: isGuestStudent ? null : studentData.schoolId,
          schoolName: isGuestStudent ? '(guest)' : studentData.schoolName,
        });
      }

      if (isTeacherRole) {
        // Validate school_id is set
        if (!teacherData.schoolId) {
          toast.error('Please verify your school code before submitting.');
          setSubmitting(false);
          return;
        }
        
        updateData = {
          ...updateData,
          // Teacher onboarding data
          schoolName: teacherData.schoolName,
          school_id: teacherData.schoolId, // CRITICAL: Must be set
          subjectsTaught: teacherData.subjectsTaught,
          experienceYears: teacherData.experienceYears,
          qualifications: teacherData.qualifications,
          phoneNumber: teacherData.phoneNumber,
          city: teacherData.city,
          state: teacherData.state,
          boardAffiliation: teacherData.boardAffiliation,
          classesHandled: teacherData.classesHandled,
          managed_class_ids: [], // To be assigned by school admin
          // Set approval status to pending for teachers (they need admin approval)
          approvalStatus: 'pending',
        };
        console.log('✅ Teacher onboarding data prepared', {
          schoolId: teacherData.schoolId,
          schoolName: teacherData.schoolName,
        });
      }
      
      if (isSchoolRole) {
        updateData = {
          ...updateData,
          // School onboarding data
          schoolName: schoolData.schoolName,
          address: schoolData.address,
          city: schoolData.city,
          state: schoolData.state,
          pincode: schoolData.pincode,
          contactPerson: schoolData.contactPerson,
          contactPhone: schoolData.contactPhone,
          website: schoolData.website,
          studentCount: schoolData.studentCount,
          boardAffiliation: schoolData.boardAffiliation,
          establishedYear: schoolData.establishedYear,
          schoolType: schoolData.schoolType,
          // Set approval status to pending for schools (they need admin approval)
          approvalStatus: 'pending',
        };
        console.log('✅ School onboarding data prepared');

        // Create school document in schools collection with unique school code
        const schoolRef = doc(collection(db, 'schools'));
        const schoolCode = generateSchoolCode();
        await setDoc(schoolRef, {
          name: schoolData.schoolName.trim(),
          address: schoolData.address || '',
          city: schoolData.city || '',
          state: schoolData.state || '',
          pincode: schoolData.pincode || '',
          contactPerson: schoolData.contactPerson || '',
          contactPhone: schoolData.contactPhone || '',
          website: schoolData.website || '',
          boardAffiliation: schoolData.boardAffiliation || '',
          establishedYear: schoolData.establishedYear || '',
          schoolType: schoolData.schoolType || '',
          approvalStatus: 'pending',
          schoolCode, // Unique code for teachers to associate (share with teachers after approval)
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        });

        // Store school_id in user profile
        updateData.school_id = schoolRef.id;
        updateData.managed_school_id = schoolRef.id; // School user manages their own school
        console.log('✅ School document created in schools collection:', schoolRef.id);
      }

      // Update users collection with ALL data
      await updateProfile(updateData);
      console.log('✅ Updated users collection with all onboarding data', {
        role: profile?.role,
        schoolId: updateData.school_id,
      });

      toast.success("Welcome aboard! Your profile has been updated.");
      
      // Guest students skip approval; other roles (student, teacher, school) go to approval-pending
      const userRole = profile?.role || 'student';
      const isGuestStudent = isGuestUser(profile);
      if (isGuestStudent || !requiresApproval(userRole)) {
        navigate(getDefaultPage(userRole, profile));
      } else {
        navigate('/approval-pending');
      }
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.25, 0.4, 0.25, 1] },
    }),
  };

  if (loading) {
    return (
      <FuturisticBackground className="h-[100dvh] w-screen overflow-hidden">
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-border border-t-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </FuturisticBackground>
    );
  }

  // Student onboarding steps (guest: 4 steps with step 3 = learning prefs, step 4 = review; no school step)
  const renderStudentSteps = () => {
    const effectiveStep = isGuestUser(profile) ? (step === 3 ? 4 : step === 4 ? 5 : step) : step;
    switch (effectiveStep) {
      case 1: // Age & Basic Info
        return (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-2">
              <div className="w-10 h-10 mx-auto mb-1 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FaChild className="text-lg text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-0.5">How old are you?</h2>
              <p className="text-muted-foreground text-xs">We use this to personalize your experience</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {ageOptions.map((age) => (
                <Button
                  key={age.id}
                  type="button"
                  variant={studentData.age === age.id ? 'default' : 'outline'}
                  size="sm"
                  className="relative h-auto py-2 text-xs"
                  onClick={() => setStudentData(prev => ({ ...prev, age: age.id }))}
                >
                  {studentData.age === age.id && <FaCheck className="absolute top-1 right-1 h-3 w-3" />}
                  {age.label}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-dob" className="text-sm text-foreground">Date of Birth (Optional)</Label>
              <div className="relative">
                <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  id="onboarding-dob"
                  type="date"
                  value={studentData.dateOfBirth}
                  onChange={(e) => setStudentData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="pl-10 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20 w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">Format: mm/dd/yyyy</p>
            </div>
          </motion.div>
        );

      case 2: // Curriculum (Class selection moved to step 3 with school)
        return (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-2">
              <div className="w-10 h-10 mx-auto mb-1 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FaGraduationCap className="text-lg text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-0.5">Education Details</h2>
              <p className="text-muted-foreground text-xs">Your current academic level</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-foreground text-sm mb-1 block">Which class level are you in? (For reference)</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {classOptions.map((cls) => (
                    <Button
                      key={cls.id}
                      type="button"
                      variant={studentData.class === cls.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStudentData(prev => ({ ...prev, class: cls.id }))}
                    >
                      {cls.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">You'll select your actual class in the next step</p>
              </div>
              <div>
                <Label className="text-foreground text-sm mb-1 block">Which curriculum do you follow? *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {curriculumOptions.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={studentData.curriculum === c.id ? 'default' : 'outline'}
                      className="min-h-[3.5rem] min-w-0 h-auto py-2 px-2 text-left justify-start flex flex-col items-start w-full text-xs"
                      onClick={() => setStudentData(prev => ({ ...prev, curriculum: c.id }))}
                    >
                      <span className="font-medium shrink-0">{c.label}</span>
                      <span className="text-xs text-muted-foreground font-normal break-words whitespace-normal text-left w-full">{c.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 3: // School & Location (school by code only; no class selection)
        return (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-2">
              <div className="w-10 h-10 mx-auto mb-1 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FaSchool className="text-lg text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-0.5">School Information</h2>
              <p className="text-muted-foreground text-xs">Enter your school code, then choose your class and location.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-foreground">School code *</Label>
                <p className="text-xs text-muted-foreground">Get the code from your school to join</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="text"
                    value={studentSchoolCodeInput}
                    onChange={(e) => {
                      setStudentSchoolCodeInput(e.target.value.toUpperCase().slice(0, 10));
                      setStudentSchoolCodeError('');
                    }}
                    placeholder="e.g. ABC123"
                    className="flex-1 uppercase border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20 max-w-full"
                    maxLength={10}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleVerifyStudentSchoolCode}
                    disabled={studentSchoolCodeVerifying || !studentSchoolCodeInput.trim()}
                    className="shrink-0"
                  >
                    {studentSchoolCodeVerifying ? 'Verifying...' : 'Verify'}
                  </Button>
                </div>
                {studentSchoolCodeError && (
                  <p className="text-xs text-destructive mt-1">{studentSchoolCodeError}</p>
                )}
                {studentData.schoolId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {studentData.schoolName}
                  </p>
                )}
              </div>

              {/* Class Selection */}
              {studentData.schoolId && (
                <div className="space-y-2">
                  <Label className="text-foreground">Select Your Class *</Label>
                  {loadingClasses ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-border border-t-primary" />
                      <span className="text-sm">Loading classes...</span>
                    </div>
                  ) : availableClasses.length === 0 ? (
                    <p className="text-xs text-destructive mt-1">
                      No classes available for this school. Please contact your school administrator.
                    </p>
                  ) : (
                    <Select
                      value={studentData.classId}
                      onValueChange={(value) => {
                        const selectedClass = availableClasses.find(c => c.id === value);
                        setStudentData(prev => ({
                          ...prev,
                          classId: value,
                          class: selectedClass?.class_name || prev.class,
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full h-10 border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[16rem]">
                        {availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.class_name} {cls.subject ? `- ${cls.subject}` : ''} {cls.curriculum ? `(${cls.curriculum})` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {studentData.classId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {availableClasses.find(c => c.id === studentData.classId)?.class_name || 'Class'}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">City</Label>
                  <Input
                    type="text"
                    value={studentData.city}
                    onChange={(e) => setStudentData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">State</Label>
                  <Select value={studentData.state} onValueChange={(value) => setStudentData(prev => ({ ...prev, state: value }))}>
                    <SelectTrigger className="w-full h-10 border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[16rem]">
                      {stateOptions.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Preferred Language</Label>
                <Select value={studentData.languagePreference} onValueChange={(value) => setStudentData(prev => ({ ...prev, languagePreference: value }))}>
                  <SelectTrigger className="w-full h-10 border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[16rem]">
                    {languageOptions.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        );

      case 4: // Learning Preferences
        return (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-2">
              <div className="w-10 h-10 mx-auto mb-1 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FaHeart className="text-lg text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-0.5">How Do You Learn Best?</h2>
              <p className="text-muted-foreground text-xs">Select all that apply to personalize your lessons</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {learningPreferenceOptions.map((pref) => (
                <Button
                  key={pref.id}
                  type="button"
                  variant={studentData.learningPreferences.includes(pref.id) ? 'default' : 'outline'}
                  className={`h-auto p-3 rounded-lg text-left justify-start border-2 transition-colors text-sm ${
                    studentData.learningPreferences.includes(pref.id) ? 'border-primary' : 'border-border'
                  }`}
                  onClick={() => setStudentData(prev => ({
                    ...prev,
                    learningPreferences: prev.learningPreferences.includes(pref.id)
                      ? prev.learningPreferences.filter(p => p !== pref.id)
                      : [...prev.learningPreferences, pref.id]
                  }))}
                >
                  <span className="text-lg mr-3">{pref.icon}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="font-semibold block text-foreground">{pref.label}</span>
                    <span className="text-xs sm:text-sm text-muted-foreground">{pref.description}</span>
                  </div>
                  {studentData.learningPreferences.includes(pref.id) && (
                    <FaCheckCircle className="text-primary text-lg shrink-0 ml-2" />
                  )}
                </Button>
              ))}
            </div>
          </motion.div>
        );

      case 5: // Review & Confirm
        return (
          <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-2">
              <div className="w-10 h-10 mx-auto mb-1 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FaCheckCircle className="text-lg text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-0.5">Review Your Profile</h2>
              <p className="text-muted-foreground text-xs">Confirm your details before we continue</p>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FaUserGraduate className="h-3.5 w-3.5" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-1.5 gap-y-1 text-xs">
                  <div className="text-muted-foreground">Age</div><div className="text-foreground truncate">{studentData.age} years</div>
                  <div className="text-muted-foreground">Class</div><div className="text-foreground">{isGuestUser(profile) ? '—' : 'From school'}</div>
                  <div className="text-muted-foreground">Curriculum</div><div className="text-foreground uppercase truncate">{studentData.curriculum || '—'}</div>
                  <div className="text-muted-foreground">School</div><div className="text-foreground truncate">{isGuestUser(profile) ? 'Exploring as guest — no school linked' : (studentData.schoolName || '—')}</div>
                  {isGuestUser(profile) && (
                    <>
                      <div className="text-muted-foreground">Language</div><div className="text-foreground capitalize">{studentData.languagePreference}</div>
                    </>
                  )}
                </div>
              </div>

              {!isGuestUser(profile) && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FaSchool className="h-3.5 w-3.5" /> School Information
                </h3>
                <div className="grid grid-cols-2 gap-1.5 gap-y-1 text-xs">
                  <div className="text-muted-foreground">School</div><div className="text-foreground truncate">{studentData.schoolName || '—'}</div>
                  <div className="text-muted-foreground">Location</div><div className="text-foreground truncate">{[studentData.city, studentData.state].filter(Boolean).join(', ') || '—'}</div>
                  <div className="text-muted-foreground">Language</div><div className="text-foreground capitalize">{studentData.languagePreference}</div>
                </div>
              </div>
              )}

              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FaHeart className="h-3.5 w-3.5" /> Learning Style
                </h3>
                <div className="flex flex-wrap gap-2">
                  {studentData.learningPreferences.map(pref => {
                    const option = learningPreferenceOptions.find(o => o.id === pref);
                    return option ? (
                      <span key={pref} className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm">
                        {option.icon} {option.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        );

      default: return null;
    }
  };

  // Teacher onboarding steps (unchanged from before)
  const renderTeacherSteps = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="t1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 max-h-[15vh]">
                <FaBuilding className="text-xl text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-1">School Information</h2>
              <p className="text-muted-foreground text-sm">Associate with your school using the code provided</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-foreground">School code *</Label>
                <p className="text-xs text-muted-foreground">Enter the code from your school admin</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="text"
                    value={schoolCodeInput}
                    onChange={(e) => {
                      setSchoolCodeInput(e.target.value.toUpperCase().slice(0, 10));
                      setSchoolCodeError('');
                    }}
                    placeholder="e.g. ABC123"
                    className="flex-1 uppercase border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20 max-w-full"
                    maxLength={10}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleVerifySchoolCode}
                    disabled={schoolCodeVerifying || !schoolCodeInput.trim()}
                    className="shrink-0"
                  >
                    {schoolCodeVerifying ? 'Verifying...' : 'Verify'}
                  </Button>
                </div>
                {schoolCodeError && <p className="text-xs text-destructive mt-1">{schoolCodeError}</p>}
                {teacherData.schoolId && (
                  <p className="text-xs text-muted-foreground mt-1">Selected: {teacherData.schoolName}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">City *</Label>
                  <Input
                    type="text"
                    value={teacherData.city}
                    onChange={(e) => setTeacherData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">State</Label>
                  <Select value={teacherData.state} onValueChange={(value) => setTeacherData(prev => ({ ...prev, state: value }))}>
                    <SelectTrigger className="w-full h-10 border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[16rem]">
                      {stateOptions.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Board / Affiliation</Label>
                <Select value={teacherData.boardAffiliation} onValueChange={(value) => setTeacherData(prev => ({ ...prev, boardAffiliation: value }))}>
                  <SelectTrigger className="w-full h-10 border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <SelectValue placeholder="Select Board" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[16rem]">
                    {curriculumOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="t2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaBook className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Teaching Details</h2>
              <p className="text-white/50 text-sm">What subjects and classes do you teach?</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Subjects Taught * (select all that apply)</label>
                <div className="grid grid-cols-3 gap-2 max-h-[min(12rem,22dvh)] overflow-hidden p-2 bg-white/[0.02] rounded-xl border border-white/10">
                  {subjectOptions.map(subject => (
                    <button key={subject} type="button"
                      onClick={() => setTeacherData(prev => ({
                        ...prev,
                        subjectsTaught: prev.subjectsTaught.includes(subject)
                          ? prev.subjectsTaught.filter(s => s !== subject)
                          : [...prev.subjectsTaught, subject]
                      }))}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${teacherData.subjectsTaught.includes(subject) ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {subject}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Classes Handled * (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {classOptions.map(cls => (
                    <button key={cls.id} type="button"
                      onClick={() => setTeacherData(prev => ({
                        ...prev,
                        classesHandled: prev.classesHandled.includes(cls.id)
                          ? prev.classesHandled.filter(c => c !== cls.id)
                          : [...prev.classesHandled, cls.id]
                      }))}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${teacherData.classesHandled.includes(cls.id) ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {cls.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="t3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaBriefcase className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Experience & Qualifications</h2>
              <p className="text-white/50 text-sm">Tell us about your teaching background</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Teaching Experience *</label>
                <div className="grid grid-cols-3 gap-3">
                  {experienceOptions.map(exp => (
                    <button key={exp.id} type="button" onClick={() => setTeacherData(prev => ({ ...prev, experienceYears: exp.id }))}
                      className={`px-4 py-3 rounded-xl text-sm transition-all ${teacherData.experienceYears === exp.id ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {exp.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Highest Qualification *</label>
                <Select value={teacherData.qualifications} onValueChange={(value) => setTeacherData(prev => ({ ...prev, qualifications: value }))}>
                  <SelectTrigger className="w-full rounded-xl bg-white/[0.03] px-4 py-3 h-auto min-h-[2.75rem] border border-white/10 text-white focus:ring-primary/50 focus:border-primary/50">
                    <SelectValue placeholder="Select Qualification" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[16rem]">
                    {qualificationOptions.map(q => (
                      <SelectItem key={q} value={q} className="text-foreground focus:bg-primary/20">{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="t4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaPhone className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Contact Information</h2>
              <p className="text-white/50 text-sm">How can we reach you?</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Phone Number *</label>
                <input type="tel" value={teacherData.phoneNumber} onChange={(e) => setTeacherData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+91 XXXXX XXXXX" maxLength={15}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/60" />
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><FaClipboardList className="text-cyan-400" /> Profile Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-white/50">School:</div><div className="text-white">{teacherData.schoolName || '-'}</div>
                  <div className="text-white/50">Subjects:</div><div className="text-white">{teacherData.subjectsTaught.join(', ') || '-'}</div>
                  <div className="text-white/50">Experience:</div><div className="text-white">{teacherData.experienceYears || '-'}</div>
                  <div className="text-white/50">Qualification:</div><div className="text-white">{teacherData.qualifications || '-'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  // School onboarding steps (unchanged from before)
  const renderSchoolSteps = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="sc1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaSchool className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">School Details</h2>
              <p className="text-white/50 text-sm">Basic information about your school</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">School Name *</label>
                <input type="text" value={schoolData.schoolName} onChange={(e) => setSchoolData(prev => ({ ...prev, schoolName: e.target.value }))}
                  placeholder="Enter school name" className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">School Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {schoolTypeOptions.map(type => (
                    <button key={type.id} type="button" onClick={() => setSchoolData(prev => ({ ...prev, schoolType: type.id }))}
                      className={`px-4 py-3 rounded-xl text-sm transition-all ${schoolData.schoolType === type.id ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Established Year</label>
                  <input type="number" value={schoolData.establishedYear} onChange={(e) => setSchoolData(prev => ({ ...prev, establishedYear: e.target.value }))}
                    placeholder="e.g., 1990" min="1800" max="2025"
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Website</label>
                  <input type="url" value={schoolData.website} onChange={(e) => setSchoolData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://..." className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/60" />
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="sc2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaMapMarkerAlt className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Location</h2>
              <p className="text-white/50 text-sm">Where is your school located?</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Address *</label>
                <textarea value={schoolData.address} onChange={(e) => setSchoolData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full school address" rows={3}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">City *</label>
                  <input type="text" value={schoolData.city} onChange={(e) => setSchoolData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City" className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Pincode</label>
                  <input type="text" value={schoolData.pincode} onChange={(e) => setSchoolData(prev => ({ ...prev, pincode: e.target.value }))}
                    placeholder="XXXXXX" maxLength={6}
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">State *</label>
                <Select value={schoolData.state} onValueChange={(value) => setSchoolData(prev => ({ ...prev, state: value }))}>
                  <SelectTrigger className="w-full rounded-xl bg-white/[0.03] px-4 py-3 h-auto min-h-[2.75rem] border border-white/10 text-white focus:ring-primary/50 focus:border-primary/50">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[16rem]">
                    {stateOptions.map(s => (
                      <SelectItem key={s} value={s} className="text-foreground focus:bg-primary/20">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="sc3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaPhone className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Contact Details</h2>
              <p className="text-white/50 text-sm">Primary contact for your school</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Contact Person Name *</label>
                <input type="text" value={schoolData.contactPerson} onChange={(e) => setSchoolData(prev => ({ ...prev, contactPerson: e.target.value }))}
                  placeholder="Full name of contact person" className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Contact Phone Number *</label>
                <input type="tel" value={schoolData.contactPhone} onChange={(e) => setSchoolData(prev => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder="+91 XXXXX XXXXX" maxLength={15}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/60" />
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="sc4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="text-center mb-3">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0 max-h-[15vh]">
                <FaUsers className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">School Stats</h2>
              <p className="text-white/50 text-sm">Additional information about your school</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Board/Affiliation *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {curriculumOptions.map(c => (
                    <button key={c.id} type="button" onClick={() => setSchoolData(prev => ({ ...prev, boardAffiliation: c.id }))}
                      className={`px-4 py-3 rounded-xl text-sm transition-all ${schoolData.boardAffiliation === c.id ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Number of Students *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {studentCountOptions.map(count => (
                    <button key={count.id} type="button" onClick={() => setSchoolData(prev => ({ ...prev, studentCount: count.id }))}
                      className={`px-4 py-3 rounded-xl text-sm transition-all ${schoolData.studentCount === count.id ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {count.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><FaClipboardList className="text-cyan-400" /> School Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-white/50">Name:</div><div className="text-white truncate">{schoolData.schoolName || '-'}</div>
                  <div className="text-white/50">Type:</div><div className="text-white capitalize">{schoolData.schoolType || '-'}</div>
                  <div className="text-white/50">City:</div><div className="text-white">{schoolData.city || '-'}</div>
                  <div className="text-white/50">Contact:</div><div className="text-white">{schoolData.contactPerson || '-'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  const renderStepContent = () => {
    if (isStudentRole) return renderStudentSteps();
    if (isTeacherRole) return renderTeacherSteps();
    if (isSchoolRole) return renderSchoolSteps();
    return null;
  };

  const getRoleIcon = () => {
    if (isStudentRole) return FaUserGraduate;
    if (isTeacherRole) return FaChalkboardTeacher;
    if (isSchoolRole) return FaBuilding;
    return FaUserGraduate;
  };

  const RoleIcon = getRoleIcon();

  // Onboarding: dark mode only, no toggle
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  const compact = isVRDevice;
  return (
    <FuturisticBackground className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col">
      <div className={`relative z-10 flex flex-1 min-h-0 flex-col items-center overflow-hidden ${compact ? 'px-2 py-1' : 'px-3 py-2 sm:px-6 sm:py-2'}`}>
        <div className={`w-full mx-auto h-full flex flex-col min-h-0 ${compact ? 'max-w-lg gap-1' : 'max-w-2xl gap-1.5 sm:gap-2'}`}>
          {/* Header - glass pill */}
          <div className="text-center shrink-0">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <RoleIcon className="text-primary h-3.5 w-3.5" />
              </div>
              <span className="text-sm sm:text-base font-semibold tracking-tight capitalize text-foreground">{profile?.role} Onboarding</span>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-card/80 backdrop-blur-md border border-border text-[11px] text-muted-foreground">
              <FaRocket className="text-primary mr-1 h-2.5 w-2.5 shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-none">Welcome, {profile?.name || user?.email?.split('@')[0]}</span>
            </div>
          </div>

          {/* Progress - glass bar container */}
          <div className="w-full min-w-0 rounded-lg bg-card/80 backdrop-blur-xl border border-border p-1.5 sm:p-2 shrink-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] sm:text-xs text-muted-foreground">Step {step} of {totalSteps}</span>
            </div>
            <Progress value={(step / totalSteps) * 100} className="h-1" />
          </div>

          {/* Form Card - glass panel */}
          <Card className="w-full flex-1 min-h-0 flex flex-col bg-card/80 backdrop-blur-2xl border border-border shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
          <CardContent className="pt-2 pb-2 px-3 sm:px-4 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-1.5 mt-2 pt-2 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className={`bg-card/50 border-border hover:bg-accent/50 hover:border-primary/40 ${step === 1 ? 'invisible' : ''}`}
              >
                <FaArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              {step < totalSteps ? (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  Continue <FaArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || !canProceed()}>
                  {submitting ? (
                    <>Saving...</>
                  ) : (
                    <>
                      {isSchoolRole ? "Let's Onboard" : isTeacherRole ? "Complete Onboarding" : "Start Learning"}
                      {isSchoolRole || isTeacherRole ? (
                        <FaCheckCircle className="ml-2 h-4 w-4" />
                      ) : (
                        <FaRocket className="ml-2 h-4 w-4" />
                      )}
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default Onboarding;
