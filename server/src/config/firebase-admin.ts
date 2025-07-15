import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ServiceAccount } from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from server directory
const envPath = path.resolve(__dirname, '../../.env');
console.log('Attempting to load .env from:', envPath);
console.log('Does .env file exist?', fs.existsSync(envPath));

dotenv.config({ path: envPath });

// Debug environment variables
console.log('Environment variables after loading:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('FIREBASE_PRIVATE_KEY exists:', !!process.env.FIREBASE_PRIVATE_KEY);

let firebaseInitialized = false;

try {
  // Initialize Firebase Admin with individual credentials
  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID as string,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY as string)?.replace(/\\n/g, '\n')
  };
  
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.warn('⚠️  Firebase credentials not found. Firebase features will be disabled.');
    console.warn('   To enable Firebase features, set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
  } else {
    initializeApp({
      credential: cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error);
  console.warn('⚠️  Firebase features will be disabled.');
}

export const db = firebaseInitialized ? getFirestore() : null;
export const isFirebaseInitialized = () => firebaseInitialized; 