import {
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { auth, db } from '../config/firebase';
import { createDefaultSubscription } from '../services/subscriptionService';
import { 
  UserRole, 
  ApprovalStatus, 
  UserProfile,
  requiresApproval,
  APPROVAL_REQUIRED_ROLES,
  isGuestUser
} from '../utils/rbac';

export type ModalType = 'subscription' | 'upgrade' | null;

export interface ModalContextType {
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
}

// Re-export types from rbac for convenience
export type { UserRole, ApprovalStatus, UserProfile };

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  selectedRole: UserRole | null;
  setSelectedRole: (role: UserRole | null) => void;
  signup: (email: string, password: string, name: string, role?: UserRole) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  loginWithGoogle: (role?: UserRole, options?: { isDemo?: boolean }) => Promise<any>;
  loginAsGuestStudent: () => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);
const ModalContext = createContext<ModalContextType>({
  activeModal: null,
  openModal: () => {},
  closeModal: () => {}
});

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Fetch user profile from Firestore
  const fetchProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid,
          email: data.email || '',
          displayName: data.displayName || data.name || '',
          name: data.name || data.displayName || '',
          role: data.role || 'student',
          approvalStatus: data.approvalStatus || null,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt,
          age: data.age,
          class: data.class,
          curriculum: data.curriculum,
          school: data.school,
          onboardingCompleted: data.onboardingCompleted || false,
          onboardingCompletedAt: data.onboardingCompletedAt,
          userType: data.userType,
          teamSize: data.teamSize,
          usageType: data.usageType,
          newsletterSubscription: data.newsletterSubscription,
          // LMS-specific fields
          school_id: data.school_id,
          class_ids: data.class_ids,
          teacher_id: data.teacher_id,
          managed_class_ids: data.managed_class_ids,
          managed_school_id: data.managed_school_id,
          isGuest: data.isGuest || false,
          isDemo: data.isDemo || false,
          demoLocation: data.demoLocation,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  // Refresh profile manually
  const refreshProfile = useCallback(async () => {
    if (!user?.uid) return;
    setProfileLoading(true);
    const profileData = await fetchProfile(user.uid);
    setProfile(profileData);
    setProfileLoading(false);
  }, [user, fetchProfile]);

  // Update user profile (guests may only complete onboarding once; no other writes)
  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!user?.uid) {
      throw new Error('No user logged in');
    }
    // Allow guest to complete onboarding (one-time write with onboardingCompleted + isGuest)
    if (isGuestUser(profile) && !(data.onboardingCompleted === true && (data.isGuest === true || profile?.isGuest === true))) {
      throw new Error('Guest users cannot update profile. You are in read-only mode.');
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      await updateDoc(userDocRef, updateData);
      
      // Refresh local profile so redirect sees updated state
      await refreshProfile();
      
      return;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  }, [user, profile, refreshProfile]);

  useEffect(() => {
    if (typeof window === 'undefined' || !auth) {
      console.warn('Auth: Not in browser environment or auth not available');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          setProfileLoading(true);
          
          try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const data = userDoc.data();
              const profileData: UserProfile = {
                uid: firebaseUser.uid,
                email: data.email || firebaseUser.email || '',
                displayName: data.displayName || data.name || firebaseUser.displayName || '',
                name: data.name || data.displayName || firebaseUser.displayName || '',
                role: data.role || 'student',
                approvalStatus: data.approvalStatus || null,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt,
                age: data.age,
                class: data.class,
                curriculum: data.curriculum,
                school: data.school,
                onboardingCompleted: data.onboardingCompleted || false,
                onboardingCompletedAt: data.onboardingCompletedAt,
                userType: data.userType,
                teamSize: data.teamSize,
                usageType: data.usageType,
                newsletterSubscription: data.newsletterSubscription,
                // LMS-specific fields
                school_id: data.school_id,
                class_ids: data.class_ids,
                teacher_id: data.teacher_id,
                managed_class_ids: data.managed_class_ids,
                managed_school_id: data.managed_school_id,
                isGuest: data.isGuest || false,
                isDemo: data.isDemo || false,
                demoLocation: data.demoLocation,
              };
              setProfile(profileData);
            } else {
              // New user - profile will be created during signup
              setProfile(null);
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            setProfile(null);
          }
          
          setProfileLoading(false);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Auth state change error:', error);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Subscribe to profile changes in real-time
  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const profileData: UserProfile = {
          uid: user.uid,
          email: data.email || user.email || '',
          displayName: data.displayName || data.name || user.displayName || '',
          name: data.name || data.displayName || user.displayName || '',
          role: data.role || 'student',
          approvalStatus: data.approvalStatus || null,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt,
          age: data.age,
          class: data.class,
          curriculum: data.curriculum,
          school: data.school,
          onboardingCompleted: data.onboardingCompleted || false,
          onboardingCompletedAt: data.onboardingCompletedAt,
          userType: data.userType,
          teamSize: data.teamSize,
          usageType: data.usageType,
          newsletterSubscription: data.newsletterSubscription,
          // LMS-specific fields
          school_id: data.school_id,
          class_ids: data.class_ids,
          teacher_id: data.teacher_id,
          managed_class_ids: data.managed_class_ids,
        managed_school_id: data.managed_school_id,
        isGuest: data.isGuest || false,
        isDemo: data.isDemo || false,
        demoLocation: data.demoLocation,
      };
      setProfile(profileData);
    }
    }, (error) => {
      console.error('Profile snapshot error:', error);
    });

    return unsubscribe;
  }, [user]);

  const signup = async (email: string, password: string, name: string, role: UserRole = 'student') => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Approval status set only after onboarding; until then null so they don't appear in approval queue
      const approvalStatus: ApprovalStatus = null;
      const now = new Date().toISOString();
      
      // Create user document with role in main users collection
      const userData = {
        name,
        displayName: name,
        email,
        role,
        approvalStatus,
        createdAt: now,
        updatedAt: now,
        onboardingCompleted: false,
        newsletterSubscription: true,
        userType: role,
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userData);
      console.log('✅ Created user entry:', newUser.uid);
      
      // Create default subscription document
      await createDefaultSubscription(newUser.uid);
      
      // Set profile locally
      setProfile({
        uid: newUser.uid,
        ...userData,
      });
      
      toast.success('Account created successfully!');
      return newUser;
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message);
      throw error;
    }
  };

  const getLocationForDemo = (): Promise<{ latitude: number; longitude: number; timestamp: string } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: new Date().toISOString(),
        }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    });
  };

  const loginWithGoogle = async (role?: UserRole, options?: { isDemo?: boolean }) => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      const provider = new GoogleAuthProvider();
      
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        console.warn('Popup failed, trying redirect:', popupError);
        
        if (popupError.code === 'auth/popup-closed-by-user' || 
            popupError.code === 'auth/popup-blocked' ||
            popupError.code === 'auth/cancelled-popup-request') {
          throw new Error('Please allow popups for this site and try again');
        }
        throw popupError;
      }
      
      const { user: googleUser } = result;
      const isDemo = options?.isDemo === true;
      
      const userDocRef = doc(db, 'users', googleUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // New user - use selected role or default to student for demo
        const userRole = role || selectedRole || 'student';
        const approvalStatus: ApprovalStatus = null;
        const now = new Date().toISOString();
        
        const userData: Record<string, unknown> = {
          name: googleUser.displayName,
          displayName: googleUser.displayName,
          email: googleUser.email,
          role: userRole,
          approvalStatus,
          createdAt: now,
          updatedAt: now,
          onboardingCompleted: false,
          newsletterSubscription: true,
          userType: userRole,
          isDemo: isDemo || false,
        };
        
        await setDoc(userDocRef, userData);
        console.log('✅ Created user entry for Google user:', googleUser.uid);
        
        await createDefaultSubscription(googleUser.uid);
        
        setProfile({
          uid: googleUser.uid,
          ...userData,
        } as UserProfile);
      }
      
      if (isDemo) {
        // For both new and existing users: capture location and set isDemo
        try {
          const location = await getLocationForDemo();
          if (location) {
            await updateDoc(userDocRef, {
              isDemo: true,
              demoLocation: location,
              updatedAt: new Date().toISOString(),
            });
            const profileData = await fetchProfile(googleUser.uid);
            if (profileData) setProfile(profileData);
          } else {
            await updateDoc(userDocRef, {
              isDemo: true,
              updatedAt: new Date().toISOString(),
            });
            const profileData = await fetchProfile(googleUser.uid);
            if (profileData) setProfile(profileData);
          }
        } catch (locErr) {
          console.warn('Demo location capture failed:', locErr);
          await updateDoc(userDocRef, {
            isDemo: true,
            updatedAt: new Date().toISOString(),
          });
          const profileData = await fetchProfile(googleUser.uid);
          if (profileData) setProfile(profileData);
        }
      }
      
      setSelectedRole(null);
      
      toast.success(isDemo ? 'Demo started! Explore with Google sign-in.' : 'Logged in successfully with Google!');
      return googleUser;
    } catch (error: any) {
      console.error("Google login error:", error);
      
      let errorMessage = 'Login failed. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Login was cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Please allow popups for this site and try again.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Login was cancelled. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      throw error;
    }
  };

  const loginAsGuestStudent = async () => {
    if (!auth || !db) {
      throw new Error('Authentication service is not available');
    }
    try {
      const { user: guestUser } = await signInAnonymously(auth);
      const userDocRef = doc(db, 'users', guestUser.uid);
      const userDoc = await getDoc(userDocRef);
      const now = new Date().toISOString();
      if (!userDoc.exists()) {
        const userData = {
          email: guestUser.email || '',
          displayName: 'Guest Explorer',
          name: 'Guest Explorer',
          role: 'student' as UserRole,
          approvalStatus: null as ApprovalStatus,
          onboardingCompleted: false,
          isGuest: true,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userDocRef, userData);
        const profileData: UserProfile = {
          uid: guestUser.uid,
          ...userData,
          createdAt: userData.createdAt,
        };
        setProfile(profileData);
      } else {
        const profileData = await fetchProfile(guestUser.uid);
        setProfile(profileData);
      }
      setSelectedRole(null);
      toast.success('Exploring as guest! Complete the quick setup to continue.');
      return guestUser;
    } catch (error: any) {
      console.error('Guest login error:', error);
      toast.error(error?.message || 'Could not start guest session');
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully!');
      return result;
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message);
      throw error;
    }
  };

  const logout = async () => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      await signOut(auth);
      setProfile(null);
      setSelectedRole(null);
      toast.success('Logged out successfully!');
      return Promise.resolve();
    } catch (error: any) {
      console.error("Logout error:", error);
      toast.error(error.message);
      return Promise.reject(error);
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message);
      throw error;
    }
  };

  const modalContextValue: ModalContextType = {
    activeModal,
    openModal: (modalType) => setActiveModal(modalType),
    closeModal: () => setActiveModal(null)
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      selectedRole,
      setSelectedRole,
      signup,
      login,
      loginWithGoogle,
      loginAsGuestStudent,
      logout,
      resetPassword,
      updateProfile,
      refreshProfile,
      loading,
      profileLoading
    }}>
      <ModalContext.Provider value={modalContextValue}>
        {!loading && children}
      </ModalContext.Provider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
