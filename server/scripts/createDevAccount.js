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

    // Set up pro subscription
    await db.collection('subscriptions').doc(userRecord.uid).set({
      userId: userRecord.uid,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      usage: {
        count: 0,
        limit: Infinity
      }
    });

    console.log('Developer account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (error) {
    console.error('Error creating developer account:', error);
  }
}

createDevAccount(); 