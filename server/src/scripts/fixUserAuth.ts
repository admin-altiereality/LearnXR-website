import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { createSubscriptionIfNotExists } from '../services/subscriptionService';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY as string)?.replace(/\\n/g, '\n')
  })
});

const auth = getAuth(app);
const db = getFirestore(app);

async function fixUserAuth() {
  try {
    // Get the user from Firestore
    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('email', '==', 'dev@in3devo.com').get();

    if (querySnapshot.empty) {
      console.log('No user found in Firestore');
      return;
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // Check if user exists in Firebase Auth
    try {
      const userRecord = await auth.getUserByEmail('dev@in3devo.com');
      console.log('User exists in Firebase Auth:', userRecord.uid);
    } catch (error) {
      // User doesn't exist in Firebase Auth, create it
      console.log('Creating user in Firebase Auth...');
      const userRecord = await auth.createUser({
        email: 'dev@in3devo.com',
        password: 'dev123!@#',
        displayName: userData.name || 'evo',
        emailVerified: true
      });
      console.log('Successfully created user:', userRecord.uid);
      
      // Create subscription document for the user
      await createSubscriptionIfNotExists(userRecord.uid, 'free');
    }

    // Also check if existing user has a subscription
    const userRecord = await auth.getUserByEmail('dev@in3devo.com');
    await createSubscriptionIfNotExists(userRecord.uid, 'free');

    console.log('User authentication and subscription fixed successfully');
  } catch (error) {
    console.error('Error fixing user authentication:', error);
  } finally {
    process.exit(0);
  }
}

fixUserAuth(); 