import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBo9VsJMft4Qqap5oUmQowwbjiMQErloqU",
  authDomain: "in3devoneuralai.firebaseapp.com",
  projectId: "in3devoneuralai",
  storageBucket: "in3devoneuralai.firebasestorage.app",
  messagingSenderId: "708037023303",
  appId: "1:708037023303:web:f0d5b319b05aa119288362",
  measurementId: "G-FNENMQ3BMF"
};

const app = initializeApp(firebaseConfig);

// Initialize analytics only if supported and in browser environment
let analytics = null;

// Function to safely initialize analytics
const initializeAnalytics = async () => {
  try {
    if (typeof window !== 'undefined' && await isSupported()) {
      analytics = getAnalytics(app);
    }
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
};

// Initialize analytics on client side
if (typeof window !== 'undefined') {
  initializeAnalytics();
}

// Initialize Functions with error handling
let functions: ReturnType<typeof getFunctions> | undefined = undefined;
if (typeof window !== 'undefined') {
  try {
    functions = getFunctions(app);
    // Connect to emulator in development
    if (process.env.NODE_ENV === 'development') {
      try {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      } catch (error) {
        console.warn('Functions emulator connection failed:', error);
      }
    }
  } catch (error) {
    console.warn('Functions initialization failed:', error);
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export { analytics, functions };
export default app; 