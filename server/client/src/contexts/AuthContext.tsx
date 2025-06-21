import {
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { auth, db } from '../config/firebase';

export type ModalType = 'subscription' | 'upgrade' | null;

export interface ModalContextType {
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signup: (email: string, password: string, name: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !auth) {
      console.warn('Auth: Not in browser environment or auth not available');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              setUser({
                ...user,
                ...userDoc.data()
              });
            } else {
              const userData = {
                name: user.displayName || '',
                email: user.email,
                role: 'user',
                subscriptionStatus: 'free',
                createdAt: new Date().toISOString()
              };
              await setDoc(userDocRef, userData);
              setUser({
                ...user,
                ...userData
              });
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            setUser(user);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Auth state change error:', error);
        setUser(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const signup = async (email: string, password: string, name: string) => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        role: 'user',
        createdAt: new Date().toISOString()
      });
      toast.success('Account created successfully!');
      return user;
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    if (!auth) {
      throw new Error('Authentication service is not available');
    }
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          name: user.displayName,
          email: user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
      }
      toast.success('Logged in successfully with Google!');
      return user;
    } catch (error: any) {
      console.error("Google login error:", error);
      toast.error(error.message);
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
      signup,
      login,
      loginWithGoogle,
      logout,
      resetPassword,
      loading
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