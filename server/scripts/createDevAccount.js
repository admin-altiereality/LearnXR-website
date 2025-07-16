const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Import the subscription service helper
const { createDefaultSubscriptionServer } = require('../dist/services/subscriptionService');

async function createDevAccount() {
  const email = 'dev@in3devo.com';
  const password = 'dev123!@#'; // You should change this password

  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: true
    });

    // Set user data in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      role: 'developer',
      name: 'Developer',
      createdAt: new Date().toISOString()
    });

    // Set up pro subscription using the helper function
    await createDefaultSubscriptionServer(userRecord.uid, 'pro');

    console.log('Developer account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (error) {
    console.error('Error creating developer account:', error);
  }
}

createDevAccount(); 