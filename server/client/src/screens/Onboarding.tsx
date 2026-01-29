import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, setDoc, serverTimestamp, query, where, getDocs, onSnapshot, arrayUnion } from 'firebase/firestore';
import { 
  FaRocket, 
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
  FaUserGraduate,
  FaBook,
  FaSchool,
  FaCalendarAlt,
  FaGraduationCap,
  FaChalkboardTeacher,
  FaBuilding,
  FaPhone,
  FaMapMarkerAlt,
  FaGlobe,
  FaUsers,
  FaBriefcase,
  FaCertificate,
  FaEnvelope,
  FaCity,
  FaClipboardList,
  FaShieldAlt,
  FaLock,
  FaUserShield,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChild,
  FaHeart,
  FaLanguage
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import { 
  requiresStudentOnboarding, 
  requiresApproval,
  getDefaultPage
} from '../utils/rbac';
import FuturisticBackground from '../Components/FuturisticBackground';

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
  parentEmail: string;
  parentConsent: boolean;
  gdprConsent: boolean;
  dataProcessingConsent: boolean;
  marketingConsent: boolean;
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
    parentEmail: '',
    parentConsent: false,
    gdprConsent: false,
    dataProcessingConsent: false,
    marketingConsent: false,
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
  
  // Total steps based on role - Students have 6 steps including GDPR consent
  const totalSteps = isStudentRole ? 6 : isTeacherRole ? 4 : isSchoolRole ? 4 : 1;

  // Check if user is a minor (under 16) for GDPR
  const isMinor = studentData.age && parseInt(studentData.age) < 16;

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.uid || !profile) {
        setLoading(false);
        return;
      }

      try {
        // Check if onboarding is already completed (using general check that works for all roles)
        if (profile.onboardingCompleted === true) {
          // If onboarding is complete, check where to redirect
          if (requiresApproval(profile.role) && profile.approvalStatus !== 'approved') {
            // Teacher/School completed onboarding but waiting for approval
            navigate('/approval-pending');
          } else {
            // Approved or doesn't need approval - go to main content
            navigate(getDefaultPage(profile.role));
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

  // Verify student's school code (code only; no dropdown, no class selection)
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
    } catch (err: unknown) {
      console.error('Error verifying school code:', err);
      setStudentSchoolCodeError('Could not verify school code. Please try again.');
    } finally {
      setStudentSchoolCodeVerifying(false);
    }
  };

  const canProceed = () => {
    if (isStudentRole) {
      switch (step) {
        case 1: return studentData.age !== '';
        case 2: return studentData.curriculum !== '';
        case 3: return studentData.schoolId !== '';
        case 4: return studentData.learningPreferences.length > 0;
        case 5: // GDPR consent step
          if (isMinor) {
            return studentData.parentEmail.trim() !== '' && 
                   studentData.parentConsent && 
                   studentData.gdprConsent && 
                   studentData.dataProcessingConsent;
          }
          return studentData.gdprConsent && studentData.dataProcessingConsent;
        case 6: return true; // Review step
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
        updateData = {
          ...updateData,
          // Student onboarding data (school by code only; class assigned later by school/teacher)
          age: parseInt(studentData.age) || null,
          dateOfBirth: studentData.dateOfBirth || null,
          class: '',
          curriculum: studentData.curriculum,
          school: studentData.schoolName.trim(),
          school_id: studentData.schoolId,
          class_ids: [], // To be assigned by school/teacher on approval or in Class Management
          city: studentData.city || null,
          state: studentData.state || null,
          languagePreference: studentData.languagePreference,
          learningPreferences: studentData.learningPreferences,
          // GDPR consent data
          parentEmail: studentData.parentEmail || null,
          parentConsent: studentData.parentConsent,
          parentConsentAt: studentData.parentConsent ? now : null,
          gdprConsent: studentData.gdprConsent,
          gdprConsentAt: studentData.gdprConsent ? now : null,
          dataProcessingConsent: studentData.dataProcessingConsent,
          marketingConsent: studentData.marketingConsent,
          // Set approval status to pending for students (they need teacher approval)
          approvalStatus: 'pending',
        };
        console.log('✅ Student onboarding data prepared');
      }

      if (isTeacherRole) {
        updateData = {
          ...updateData,
          // Teacher onboarding data
          schoolName: teacherData.schoolName,
          school_id: teacherData.schoolId, // Store school_id
          subjectsTaught: teacherData.subjectsTaught,
          experienceYears: teacherData.experienceYears,
          qualifications: teacherData.qualifications,
          phoneNumber: teacherData.phoneNumber,
          city: teacherData.city,
          state: teacherData.state,
          boardAffiliation: teacherData.boardAffiliation,
          classesHandled: teacherData.classesHandled,
          // Set approval status to pending for teachers (they need admin approval)
          approvalStatus: 'pending',
        };
        console.log('✅ Teacher onboarding data prepared');
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
      console.log('✅ Updated users collection with all onboarding data');

      toast.success("Welcome aboard! Your profile has been updated.");
      
      // All roles (student, teacher, school) need approval in hierarchical system
      // Redirect to approval pending screen
      const userRole = profile?.role || 'student';
      if (requiresApproval(userRole)) {
        // All roles need approval: students (teacher), teachers (school), schools (admin)
        navigate('/approval-pending');
      } else {
        // Only admin/superadmin don't need approval
        navigate(getDefaultPage(userRole));
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
      <FuturisticBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      </FuturisticBackground>
    );
  }

  // Student onboarding steps
  const renderStudentSteps = () => {
    switch (step) {
      case 1: // Age & Basic Info
        return (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <FaChild className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">How old are you?</h2>
              <p className="text-white/50 text-sm">We need this to personalize your experience and ensure age-appropriate content</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {ageOptions.map((age) => (
                <motion.button key={age.id} onClick={() => setStudentData(prev => ({ ...prev, age: age.id }))}
                  className={`relative p-4 rounded-xl border-2 transition-all ${studentData.age === age.id ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {studentData.age === age.id && <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><FaCheck className="text-white text-[8px]" /></div>}
                  <span className="text-white font-medium">{age.label}</span>
                </motion.button>
              ))}
            </div>
            
            {/* Date of Birth (optional) */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-white/70 mb-2">Date of Birth (Optional)</label>
              <input type="date" value={studentData.dateOfBirth} 
                onChange={(e) => setStudentData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-emerald-400/60" />
            </div>

            {/* Age notice for minors */}
            {studentData.age && parseInt(studentData.age) < 16 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <FaExclamationTriangle className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-amber-300 font-medium">Parental Consent Required</p>
                    <p className="text-amber-300/70 mt-1">As you're under 16, we'll need your parent or guardian's email and consent to comply with data protection regulations (GDPR/COPPA).</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        );

      case 2: // Curriculum (Class selection moved to step 3 with school)
        return (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <FaGraduationCap className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Education Details</h2>
              <p className="text-white/50 text-sm">Tell us about your current academic level</p>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-3">Which class level are you in? (For reference)</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {classOptions.map((cls) => (
                    <button key={cls.id} type="button" onClick={() => setStudentData(prev => ({ ...prev, class: cls.id }))}
                      className={`px-3 py-2.5 rounded-lg text-sm transition-all ${studentData.class === cls.id ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 border' : 'bg-white/[0.03] border-white/10 text-white/70 border hover:bg-white/[0.05]'}`}>
                      {cls.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/40 mt-1">You'll select your actual class in the next step</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-3">Which curriculum do you follow? *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {curriculumOptions.map((c) => (
                    <button key={c.id} type="button" onClick={() => setStudentData(prev => ({ ...prev, curriculum: c.id }))}
                      className={`p-3 rounded-xl text-left transition-all ${studentData.curriculum === c.id ? 'bg-indigo-500/20 border-indigo-500/50 border' : 'bg-white/[0.03] border-white/10 border hover:bg-white/[0.05]'}`}>
                      <span className={`font-medium block ${studentData.curriculum === c.id ? 'text-indigo-300' : 'text-white/80'}`}>{c.label}</span>
                      <span className="text-xs text-white/40">{c.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 3: // School & Location (school by code only; no class selection)
        return (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FaSchool className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">School Information</h2>
              <p className="text-white/50 text-sm">Enter your school code to connect with your school. Your class will be assigned by your school.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">School code *</label>
                <p className="text-xs text-white/50 mb-2">Get the code from your school to join</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={studentSchoolCodeInput}
                    onChange={(e) => {
                      setStudentSchoolCodeInput(e.target.value.toUpperCase().slice(0, 10));
                      setStudentSchoolCodeError('');
                    }}
                    placeholder="e.g. ABC123"
                    className="flex-1 rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 uppercase"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyStudentSchoolCode}
                    disabled={studentSchoolCodeVerifying || !studentSchoolCodeInput.trim()}
                    className="px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-400/50 text-violet-300 font-medium hover:bg-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {studentSchoolCodeVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {studentSchoolCodeError && (
                  <p className="text-xs text-red-400 mt-1">{studentSchoolCodeError}</p>
                )}
                {studentData.schoolId && (
                  <p className="text-xs text-white/50 mt-1">
                    Selected: {studentData.schoolName}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">City</label>
                  <input type="text" value={studentData.city} 
                    onChange={(e) => setStudentData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">State</label>
                  <select value={studentData.state} onChange={(e) => setStudentData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-violet-400/60">
                    <option value="">Select State</option>
                    {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Preferred Language</label>
                <select value={studentData.languagePreference} onChange={(e) => setStudentData(prev => ({ ...prev, languagePreference: e.target.value }))}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-violet-400/60">
                  {languageOptions.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        );

      case 4: // Learning Preferences
        return (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
                <FaHeart className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">How Do You Learn Best?</h2>
              <p className="text-white/50 text-sm">Select all that apply - this helps us personalize your lessons</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {learningPreferenceOptions.map((pref) => (
                <motion.button key={pref.id} type="button"
                  onClick={() => setStudentData(prev => ({
                    ...prev,
                    learningPreferences: prev.learningPreferences.includes(pref.id)
                      ? prev.learningPreferences.filter(p => p !== pref.id)
                      : [...prev.learningPreferences, pref.id]
                  }))}
                  className={`p-5 rounded-2xl text-left transition-all border-2 ${
                    studentData.learningPreferences.includes(pref.id) 
                      ? 'bg-pink-500/15 border-pink-500/50' 
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'
                  }`}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{pref.icon}</span>
                    <div className="flex-1">
                      <span className={`font-semibold block ${studentData.learningPreferences.includes(pref.id) ? 'text-pink-300' : 'text-white'}`}>
                        {pref.label}
                      </span>
                      <span className="text-sm text-white/50">{pref.description}</span>
                    </div>
                    {studentData.learningPreferences.includes(pref.id) && (
                      <FaCheckCircle className="text-pink-400 text-lg" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        );

      case 5: // GDPR Consent
        return (
          <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <FaShieldAlt className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Privacy & Data Protection</h2>
              <p className="text-white/50 text-sm">We take your privacy seriously. Please review and consent below.</p>
            </div>

            {/* GDPR Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <FaLock className="text-emerald-400" />
                <span className="text-emerald-300 text-sm font-medium">GDPR Compliant</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Parental Consent for Minors */}
              {isMinor && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3 mb-4">
                    <FaUserShield className="text-amber-400 text-xl mt-0.5" />
                    <div>
                      <h3 className="text-amber-300 font-semibold">Parental/Guardian Consent Required</h3>
                      <p className="text-amber-300/70 text-sm mt-1">
                        As you're under 16, we require your parent or guardian's email and consent as per GDPR Article 8 and COPPA regulations.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-amber-300/80 mb-2">Parent/Guardian Email *</label>
                    <input type="email" value={studentData.parentEmail} 
                      onChange={(e) => setStudentData(prev => ({ ...prev, parentEmail: e.target.value }))}
                      placeholder="parent@email.com"
                      className="w-full rounded-xl bg-amber-900/20 px-4 py-3 border border-amber-500/30 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/60" />
                    <p className="text-xs text-amber-400/60 mt-2">We'll send a verification email to confirm consent</p>
                  </div>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={studentData.parentConsent}
                      onChange={(e) => setStudentData(prev => ({ ...prev, parentConsent: e.target.checked }))}
                      className="mt-1 w-5 h-5 rounded border-amber-500/50 bg-transparent text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-amber-300/80">
                      I confirm that I have my parent/guardian's permission to use this platform and they have reviewed this privacy notice. *
                    </span>
                  </label>
                </div>
              )}

              {/* Data Processing Consent */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={studentData.dataProcessingConsent}
                    onChange={(e) => setStudentData(prev => ({ ...prev, dataProcessingConsent: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded border-white/30 bg-transparent text-cyan-500 focus:ring-cyan-500" />
                  <div>
                    <span className="text-white font-medium block">Data Processing Consent *</span>
                    <span className="text-sm text-white/50">
                      I consent to LearnXR processing my personal data (name, email, age, educational information) to provide personalized learning experiences.
                    </span>
                  </div>
                </label>
              </div>

              {/* GDPR Consent */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={studentData.gdprConsent}
                    onChange={(e) => setStudentData(prev => ({ ...prev, gdprConsent: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded border-white/30 bg-transparent text-cyan-500 focus:ring-cyan-500" />
                  <div>
                    <span className="text-white font-medium block">Privacy Policy & Terms *</span>
                    <span className="text-sm text-white/50">
                      I have read and agree to the{' '}
                      <a href="/privacy-policy" target="_blank" className="text-cyan-400 hover:underline">Privacy Policy</a>
                      {' '}and{' '}
                      <a href="/terms-conditions" target="_blank" className="text-cyan-400 hover:underline">Terms of Service</a>.
                      I understand my rights under GDPR including the right to access, rectify, and delete my data.
                    </span>
                  </div>
                </label>
              </div>

              {/* Marketing Consent (Optional) */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={studentData.marketingConsent}
                    onChange={(e) => setStudentData(prev => ({ ...prev, marketingConsent: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded border-white/30 bg-transparent text-cyan-500 focus:ring-cyan-500" />
                  <div>
                    <span className="text-white font-medium block">Educational Updates (Optional)</span>
                    <span className="text-sm text-white/50">
                      I'd like to receive educational tips, new lesson notifications, and platform updates via email. You can unsubscribe anytime.
                    </span>
                  </div>
                </label>
              </div>

              {/* Data Protection Notice */}
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <div className="flex items-start gap-3">
                  <FaLock className="text-cyan-400 mt-0.5" />
                  <div className="text-sm text-cyan-300/80">
                    <p className="font-medium mb-1">Your Data Rights</p>
                    <ul className="space-y-1 text-cyan-300/60">
                      <li>• Right to access your personal data</li>
                      <li>• Right to correct inaccurate data</li>
                      <li>• Right to delete your data ("right to be forgotten")</li>
                      <li>• Right to data portability</li>
                      <li>• Contact: <a href="mailto:admin@altiereality.com" className="text-cyan-400">admin@altiereality.com</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 6: // Review & Confirm
        return (
          <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <FaCheckCircle className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Review Your Profile</h2>
              <p className="text-white/50 text-sm">Make sure everything looks correct before we continue</p>
            </div>
            
            <div className="space-y-4">
              {/* Personal Info */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FaUserGraduate /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-white/50">Age</div><div className="text-white">{studentData.age} years</div>
                  <div className="text-white/50">Class</div><div className="text-white">To be assigned by school</div>
                  <div className="text-white/50">Curriculum</div><div className="text-white uppercase">{studentData.curriculum || 'Not selected'}</div>
                  <div className="text-white/50">School</div><div className="text-white">{studentData.schoolName || 'Not selected'}</div>
                </div>
              </div>

              {/* School Info */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FaSchool /> School Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-white/50">School</div><div className="text-white truncate">{studentData.schoolName || 'Not provided'}</div>
                  <div className="text-white/50">Location</div><div className="text-white">{[studentData.city, studentData.state].filter(Boolean).join(', ') || 'Not provided'}</div>
                  <div className="text-white/50">Language</div><div className="text-white capitalize">{studentData.languagePreference}</div>
                </div>
              </div>

              {/* Learning Preferences */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-semibold text-pink-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FaHeart /> Learning Style
                </h3>
                <div className="flex flex-wrap gap-2">
                  {studentData.learningPreferences.map(pref => {
                    const option = learningPreferenceOptions.find(o => o.id === pref);
                    return option ? (
                      <span key={pref} className="px-3 py-1.5 rounded-lg bg-pink-500/20 text-pink-300 text-sm">
                        {option.icon} {option.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Consent Summary */}
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FaShieldAlt /> Consent Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FaCheckCircle className={studentData.gdprConsent ? 'text-emerald-400' : 'text-white/30'} />
                    <span className={studentData.gdprConsent ? 'text-emerald-300' : 'text-white/50'}>Privacy Policy & Terms Accepted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaCheckCircle className={studentData.dataProcessingConsent ? 'text-emerald-400' : 'text-white/30'} />
                    <span className={studentData.dataProcessingConsent ? 'text-emerald-300' : 'text-white/50'}>Data Processing Consent</span>
                  </div>
                  {isMinor && (
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className={studentData.parentConsent ? 'text-emerald-400' : 'text-white/30'} />
                      <span className={studentData.parentConsent ? 'text-emerald-300' : 'text-white/50'}>Parental Consent</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {studentData.marketingConsent ? <FaCheckCircle className="text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-white/30" />}
                    <span className={studentData.marketingConsent ? 'text-emerald-300' : 'text-white/50'}>Marketing Communications {!studentData.marketingConsent && '(opted out)'}</span>
                  </div>
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
          <motion.div key="t1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <FaBuilding className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">School Information</h2>
              <p className="text-white/50 text-sm">Tell us about your school</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">School unique code *</label>
                <p className="text-xs text-white/50 mb-2">Enter the unique code provided by your school to get associated</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={schoolCodeInput}
                    onChange={(e) => {
                      setSchoolCodeInput(e.target.value.toUpperCase().slice(0, 10));
                      setSchoolCodeError('');
                    }}
                    placeholder="e.g. ABC123"
                    className="flex-1 rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60 uppercase"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={handleVerifySchoolCode}
                    disabled={schoolCodeVerifying || !schoolCodeInput.trim()}
                    className="px-4 py-3 rounded-xl bg-blue-500/20 border border-blue-400/50 text-blue-300 font-medium hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {schoolCodeVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {schoolCodeError && (
                  <p className="text-xs text-red-400 mt-1">{schoolCodeError}</p>
                )}
                {teacherData.schoolId && (
                  <p className="text-xs text-white/50 mt-1">
                    Selected: {teacherData.schoolName}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">City *</label>
                  <input type="text" value={teacherData.city} onChange={(e) => setTeacherData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city" className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">State</label>
                  <select value={teacherData.state} onChange={(e) => setTeacherData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-blue-400/60">
                    <option value="">Select State</option>
                    {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Board/Affiliation</label>
                <select value={teacherData.boardAffiliation} onChange={(e) => setTeacherData(prev => ({ ...prev, boardAffiliation: e.target.value }))}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-blue-400/60">
                  <option value="">Select Board</option>
                  {curriculumOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="t2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <FaBook className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Teaching Details</h2>
              <p className="text-white/50 text-sm">What subjects and classes do you teach?</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Subjects Taught * (select all that apply)</label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-white/[0.02] rounded-xl border border-white/10">
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
          <motion.div key="t3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FaBriefcase className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Experience & Qualifications</h2>
              <p className="text-white/50 text-sm">Tell us about your teaching background</p>
            </div>
            <div className="space-y-4">
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
                <select value={teacherData.qualifications} onChange={(e) => setTeacherData(prev => ({ ...prev, qualifications: e.target.value }))}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-violet-400/60">
                  <option value="">Select Qualification</option>
                  {qualificationOptions.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="t4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <FaPhone className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Contact Information</h2>
              <p className="text-white/50 text-sm">How can we reach you?</p>
            </div>
            <div className="space-y-4">
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
          <motion.div key="sc1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                <FaSchool className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">School Details</h2>
              <p className="text-white/50 text-sm">Basic information about your school</p>
            </div>
            <div className="space-y-4">
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
          <motion.div key="sc2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <FaMapMarkerAlt className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Location</h2>
              <p className="text-white/50 text-sm">Where is your school located?</p>
            </div>
            <div className="space-y-4">
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
                <select value={schoolData.state} onChange={(e) => setSchoolData(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 border border-white/10 text-white focus:outline-none focus:border-blue-400/60">
                  <option value="">Select State</option>
                  {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="sc3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <FaPhone className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Contact Details</h2>
              <p className="text-white/50 text-sm">Primary contact for your school</p>
            </div>
            <div className="space-y-4">
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
          <motion.div key="sc4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <FaUsers className="text-2xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">School Stats</h2>
              <p className="text-white/50 text-sm">Additional information about your school</p>
            </div>
            <div className="space-y-4">
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

  return (
    <FuturisticBackground>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          {/* Header */}
          <motion.div custom={0} variants={fadeUpVariants} initial="hidden" animate="visible" className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                <RoleIcon className="text-white text-xl" />
              </div>
              <span className="text-2xl font-bold text-white capitalize">{profile?.role} Onboarding</span>
            </div>
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]">
              <FaRocket className="text-cyan-400 mr-2" />
              <span className="text-white/60 text-sm">Welcome, {profile?.name || user?.email?.split('@')[0]}!</span>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible" className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/50">Step {step} of {totalSteps}</span>
              <span className="text-sm text-white/40">{step === totalSteps ? 'Almost done!' : 'Keep going!'}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500"
                initial={{ width: 0 }} animate={{ width: `${(step / totalSteps) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>
          </motion.div>

          {/* Form Card */}
          <motion.div custom={2} variants={fadeUpVariants} initial="hidden" animate="visible"
            className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)] p-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5 pointer-events-none" />
            
            <div className="relative z-10">
              <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>

              {/* Navigation Buttons */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
                <button onClick={handleBack} disabled={step === 1}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white/[0.03] hover:bg-white/[0.08] text-white/70 border border-white/10'}`}>
                  <FaArrowLeft /> Back
                </button>

                {step < totalSteps ? (
                  <motion.button onClick={handleNext} disabled={!canProceed()}
                    className={`group relative flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all duration-300 overflow-hidden ${canProceed() ? 'text-white' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                    whileHover={canProceed() ? { scale: 1.02 } : {}} whileTap={canProceed() ? { scale: 0.98 } : {}}>
                    {canProceed() && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </>
                    )}
                    <span className="relative">Continue</span>
                    <FaArrowRight className="relative group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                ) : (
                  <motion.button onClick={handleSubmit} disabled={submitting || !canProceed()}
                    className="group relative flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={!submitting ? { scale: 1.02 } : {}} whileTap={!submitting ? { scale: 0.98 } : {}}>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {submitting ? (
                      <>
                        <div className="relative animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="relative">Saving...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative">
                          {isSchoolRole ? "Let's Onboard" : isTeacherRole ? "Complete Onboarding" : "Start Learning"}
                        </span>
                        {isSchoolRole || isTeacherRole ? (
                          <FaCheckCircle className="relative" />
                        ) : (
                          <FaRocket className="relative" />
                        )}
                      </>
                    )}
                  </motion.button>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* GDPR Badge Footer */}
          <motion.div custom={3} variants={fadeUpVariants} initial="hidden" animate="visible" 
            className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-white/40">
              <FaShieldAlt className="text-emerald-400" />
              <span>Your data is protected under GDPR regulations</span>
            </div>
          </motion.div>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default Onboarding;
