import {
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInAnonymously,
    signInWithCustomToken,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { auth, db } from '../config/firebase';
import { getApiBaseUrl } from '../utils/apiConfig';
import { createDefaultSubscription } from '../services/subscriptionService';
import {
    ApprovalStatus,
    isGuestUser,
    normalizeUserRole,
    UserProfile,
    UserRole
} from '../utils/rbac';

export type ModalType = 'subscription' | 'upgrade' | null;

export interface ModalContextType {
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
}

// Re-export types from rbac for convenience
export type { ApprovalStatus, UserProfile, UserRole };

async function syncRoleClaimsForCurrentUser(): Promise<void> {
  if (!auth?.currentUser) return;
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${getApiBaseUrl()}/user/sync-claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      await auth.currentUser.getIdToken(true);
    }
  } catch {
    // Non-blocking; storage RBAC falls back until claims sync succeeds.
  }
}

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

/**
 * Map a `users/{uid}` document onto UserProfile.
 *
 * This used to be written out three times — in fetchProfile, in the
 * onAuthStateChanged handler, and in the realtime listener — and the copies had
 * drifted: the listener's version omitted `partner_id`, so a partner's id was
 * present right after sign-in and then silently dropped the moment the snapshot
 * re-emitted. One mapping means that cannot happen again.
 *
 * `authFallback` supplies the Firebase Auth values used when the document has no
 * email/displayName of its own.
 */
function mapUserProfile(
  uid: string,
  data: Record<string, any>,
  authFallback: { email?: string | null; displayName?: string | null } = {}
): UserProfile {
  return {
    uid,
    email: data.email || authFallback.email || '',
    displayName: data.displayName || data.name || authFallback.displayName || '',
    name: data.name || data.displayName || authFallback.displayName || '',
    firstName: data.firstName,
    role: normalizeUserRole(data.role),
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
    partner_id: data.partner_id,
    isGuest: data.isGuest || false,
    isDemo: data.isDemo || false,
    demoLocation: data.demoLocation,
  };
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // When opened from mobile app WebView with idToken in hash or query, sign in so Firestore/skybox/meshy work.
  // Skip on /studio-standalone and /vrplayer-standalone -- those pages handle auth themselves.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase();
    if (path.includes('studio-standalone') || path.includes('vrplayer-standalone') || path.includes('main-standalone')) return;
    const hashMatch = window.location.hash.match(/[#&]idToken=([^&]+)/);
    const queryMatch = window.location.search.match(/[?&]idToken=([^&]+)/);
    const raw = hashMatch?.[1] || queryMatch?.[1];
    const idToken = raw ? decodeURIComponent(raw) : null;
    if (!idToken) return;
    (async () => {
      try {
        const base = getApiBaseUrl().replace(/\/$/, '');
        const res = await fetch(`${base}/auth/custom-token`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const { customToken } = await res.json();
          if (customToken) {
            await signInWithCustomToken(auth, customToken);
            const search = window.location.search.replace(/[?&]idToken=[^&]+/g, '').replace(/^&/, '?').replace(/^\?$/, '');
            const hash = window.location.hash.replace(/[#&]idToken=[^&]+/g, '').replace(/^&/, '#').replace(/^#$/, '');
            window.history.replaceState(null, '', window.location.pathname + search + hash);
          }
        }
      } catch (e) {
        console.warn('WebView idToken sign-in failed:', e);
      }
    })();
  }, []);

  // Fetch user profile from Firestore
  const fetchProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        return mapUserProfile(uid, userDoc.data());
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
          // The profile itself is delivered by the realtime listener below, which
          // fires with the document immediately. Fetching it here as well meant two
          // network reads of users/{uid} on every single page load for the same data.
          // profileLoading stays true until that first snapshot lands, so RoleGuard
          // and the login screens still wait for a profile exactly as before.
          setProfileLoading(true);
        } else {
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
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

  // Sole source of profile state: one realtime listener on users/{uid}.
  // Keyed on user?.uid rather than the user object so a new FirebaseUser identity
  // for the same account does not tear the listener down and re-read the document.
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const authFallback = { email: user?.email, displayName: user?.displayName };
    let settled = false;

    // Clearing profileLoading is what releases the route guards, so it has to happen
    // on the first emission whatever that emission is — document, no document, or error.
    const settle = () => {
      if (settled) return;
      settled = true;
      setProfileLoading(false);
    };

    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile(mapUserProfile(uid, snapshot.data(), authFallback));
          if (!settled) void syncRoleClaimsForCurrentUser();
        } else {
          // New user — the profile is created during signup.
          setProfile(null);
        }
        settle();
      },
      (error) => {
        console.error('Profile snapshot error:', error);
        setProfile(null);
        settle();
      }
    );

    // Deliberately does NOT settle: on an account switch this cleanup runs after
    // onAuthStateChanged has already set profileLoading back to true for the new
    // uid, so settling here would release the guards against a stale profile.
    // Sign-out is settled by the auth handler instead.
    return unsubscribe;
  }, [user?.uid, user?.email, user?.displayName]);

  const signup = async (email: string, password: string, name: string, _role: UserRole = 'student') => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Approval status set only after onboarding; until then null so they don't appear in approval queue
      const approvalStatus: ApprovalStatus = null;
      const now = new Date().toISOString();
      
      // Create user document with role in main users collection
      const role: UserRole = 'student';
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
      // Release the generation-job listeners before the credential goes away.
      // The service is a module-level singleton, so without this the next user in
      // the same tab would inherit listeners on the previous user's jobs.
      try {
        const { backgroundGenerationService } = await import('../services/backgroundGenerationService');
        backgroundGenerationService.cleanup();
      } catch (cleanupError) {
        console.warn('Background generation cleanup failed during logout:', cleanupError);
      }

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
