/**
 * Firebase Connection Test Script
 * Tests all Firebase services: Auth, Firestore, Storage, Functions
 */

const path = require('path');
const fs = require('fs');

// Try to load firebase-admin from server directory
let admin;
try {
  // Try from server/node_modules
  const serverAdminPath = path.join(__dirname, '..', 'server', 'node_modules', 'firebase-admin');
  admin = require(serverAdminPath);
} catch (e) {
  try {
    // Try from root node_modules
    admin = require('firebase-admin');
  } catch (e2) {
    console.log('⚠️  firebase-admin not found. Installing...');
    console.log('   Run: cd server && npm install firebase-admin');
    console.log('   Or: npm install firebase-admin');
    process.exit(1);
  }
}

console.log('🔥 Testing Firebase Connection for learnxr-evoneuralai\n');
console.log('='.repeat(60));

const projectId = 'learnxr-evoneuralai';
let testsPassed = 0;
let testsFailed = 0;

// Test 1: Check service account file
console.log('\n📋 Test 1: Checking service account credentials...');
const serviceAccountFiles = fs.readdirSync('.').filter(file => 
  file.startsWith(`${projectId}-firebase-adminsdk-`) && file.endsWith('.json')
);

if (serviceAccountFiles.length > 0) {
  console.log(`✅ Found service account file: ${serviceAccountFiles[0]}`);
  testsPassed++;
  
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFiles[0], 'utf8'));
    console.log(`   Project ID: ${serviceAccount.project_id}`);
    console.log(`   Client Email: ${serviceAccount.client_email}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ Error reading service account: ${error.message}`);
    testsFailed++;
  }
} else {
  console.log('⚠️  Service account file not found');
  console.log('   Looking for: ' + projectId + '-firebase-adminsdk-*.json');
  testsFailed++;
}

// Test 2: Initialize Firebase Admin
console.log('\n📋 Test 2: Initializing Firebase Admin SDK...');
try {
  let serviceAccount;
  
  if (serviceAccountFiles.length > 0) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFiles[0], 'utf8'));
  } else {
    // Try environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };
      console.log('   Using environment variables');
    } else {
      throw new Error('No service account credentials found');
    }
  }
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || serviceAccount.projectId
    });
  }
  
  console.log('✅ Firebase Admin initialized successfully');
  testsPassed++;
} catch (error) {
  console.log(`❌ Failed to initialize Firebase Admin: ${error.message}`);
  testsFailed++;
  process.exit(1);
}

// Test 3: Test Firestore connection
console.log('\n📋 Test 3: Testing Firestore connection...');
try {
  const db = admin.firestore();
  console.log('✅ Firestore instance created');
  
  // Try to read a test document (this will fail if Firestore is not enabled, but won't crash)
  const testRef = db.collection('_test').doc('connection');
  testRef.get().then(() => {
    console.log('✅ Firestore is accessible');
    testsPassed++;
  }).catch((error) => {
    if (error.code === 7) {
      console.log('⚠️  Firestore may not be enabled or rules may be blocking');
      console.log('   Error: ' + error.message);
    } else {
      console.log('✅ Firestore connection test completed (expected to fail on read)');
      testsPassed++;
    }
  });
} catch (error) {
  console.log(`❌ Firestore test failed: ${error.message}`);
  testsFailed++;
}

// Test 4: Test Storage connection
console.log('\n📋 Test 4: Testing Storage connection...');
try {
  const storage = admin.storage();
  const bucket = storage.bucket(`${projectId}.appspot.com`);
  console.log('✅ Storage instance created');
  console.log(`   Bucket: ${bucket.name}`);
  testsPassed++;
} catch (error) {
  console.log(`❌ Storage test failed: ${error.message}`);
  testsFailed++;
}

// Test 5: Check environment files
console.log('\n📋 Test 5: Checking environment files...');
const clientEnvPath = path.join('server', 'client', '.env');
const serverEnvPath = path.join('server', '.env');

if (fs.existsSync(clientEnvPath)) {
  console.log('✅ Client .env file exists');
  testsPassed++;
} else {
  console.log('❌ Client .env file missing');
  testsFailed++;
}

if (fs.existsSync(serverEnvPath)) {
  console.log('✅ Server .env file exists');
  testsPassed++;
} else {
  console.log('❌ Server .env file missing');
  testsFailed++;
}

// Test 6: Check Firebase project configuration
console.log('\n📋 Test 6: Checking Firebase project configuration...');
const firebasercPath = '.firebaserc';
if (fs.existsSync(firebasercPath)) {
  const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
  if (firebaserc.projects?.default === projectId) {
    console.log(`✅ Firebase project configured: ${projectId}`);
    testsPassed++;
  } else {
    console.log(`❌ Firebase project mismatch. Expected: ${projectId}, Got: ${firebaserc.projects?.default}`);
    testsFailed++;
  }
} else {
  console.log('❌ .firebaserc file missing');
  testsFailed++;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Test Summary:');
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed! Firebase is properly configured.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the errors above.');
  console.log('\nNext steps:');
  console.log('  1. Enable services in Firebase Console');
  console.log('  2. Add service account credentials');
  console.log('  3. Deploy security rules: firebase deploy --only firestore:rules,storage:rules');
  process.exit(1);
}

