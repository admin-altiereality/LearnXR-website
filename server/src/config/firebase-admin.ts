import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { ServiceAccount } from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from server directory
const envPath = path.resolve(__dirname, '../../.env');
console.log('Attempting to load .env from:', envPath);
console.log('Does .env file exist?', fs.existsSync(envPath));

dotenv.config({ path: envPath });

let firebaseInitialized = false;
let adminApp: ReturnType<typeof initializeApp> | null = null;

// Try to load service account from JSON file first, then fall back to environment variables
function getServiceAccount(): ServiceAccount | null {
  const projectId = 'learnxr-evoneuralai';
  
  // First, try to find service account JSON file
  const possibleJsonFiles = [
    path.resolve(__dirname, `../../../${projectId}-firebase-adminsdk-*.json`),
    path.resolve(__dirname, `../../${projectId}-firebase-adminsdk-*.json`),
    path.resolve(process.cwd(), `${projectId}-firebase-adminsdk-*.json`)
  ];
  
  // Try to find any JSON file matching the pattern
  const rootDir = path.resolve(__dirname, '../../..');
  const jsonFiles = fs.readdirSync(rootDir).filter(file => 
    file.startsWith(`${projectId}-firebase-adminsdk-`) && file.endsWith('.json')
  );
  
  if (jsonFiles.length > 0) {
    const jsonPath = path.resolve(rootDir, jsonFiles[0]);
    try {
      console.log(`📄 Found service account file: ${jsonFiles[0]}`);
      const serviceAccountData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return {
        projectId: serviceAccountData.project_id,
        clientEmail: serviceAccountData.client_email,
        privateKey: serviceAccountData.private_key
      };
    } catch (error) {
      console.warn(`⚠️  Failed to read service account file: ${error}`);
    }
  }
  
  // Fall back to environment variables
  const envProjectId = process.env.FIREBASE_PROJECT_ID || projectId;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  // Validate that the private key is not a placeholder
  if (envClientEmail && envPrivateKey && 
      !envPrivateKey.includes('YOUR_PRIVATE_KEY') && 
      !envPrivateKey.includes('your_private_key') &&
      envPrivateKey.includes('BEGIN PRIVATE KEY')) {
    console.log('📝 Using service account from environment variables');
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, '\n')
    };
  } else if (envClientEmail && envPrivateKey) {
    console.warn('⚠️  FIREBASE_PRIVATE_KEY appears to be a placeholder. Skipping environment variable authentication.');
  }
  
  return null;
}

try {
  const serviceAccount = getServiceAccount();
  
  if (!serviceAccount) {
    console.warn('⚠️  Firebase credentials not found. Firebase features will be disabled.');
    console.warn('   To enable Firebase features:');
    console.warn('   1. Download service account JSON from Firebase Console');
    console.warn('   2. Place it in project root as: learnxr-evoneuralai-firebase-adminsdk-*.json');
    console.warn('   OR set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
  } else {
    // Check if Firebase is already initialized
    if (!adminApp) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
        storageBucket: `${serviceAccount.projectId}.appspot.com`
      });
    }
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
    console.log('📦 Project ID:', serviceAccount.projectId);
    console.log('📧 Service Account:', serviceAccount.clientEmail);
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error);
  console.warn('⚠️  Firebase features will be disabled.');
}

// Export Firestore instance
export const db = firebaseInitialized && adminApp ? getFirestore(adminApp) : null;

// Export Storage instance
export const storage = firebaseInitialized && adminApp ? getStorage(adminApp) : null;

// Export admin app for direct access if needed
export const getAdminApp = () => adminApp;

export const isFirebaseInitialized = () => firebaseInitialized; 