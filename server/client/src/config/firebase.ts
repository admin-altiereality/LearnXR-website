import { getAnalytics } from "firebase/analytics";
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

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
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app); 