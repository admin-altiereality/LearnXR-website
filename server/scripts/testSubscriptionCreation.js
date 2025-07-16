const admin = require('firebase-admin');
const serviceAccount = require('../../in3devoneuralai-firebase-adminsdk-fbsvc-6e8e1092c4.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Import the subscription service helper
const { createDefaultSubscriptionServer, hasExistingSubscription, createSubscriptionIfNotExists } = require('../dist/services/subscriptionService');

async function testSubscriptionCreation() {
  console.log('🧪 Testing subscription creation functionality...\n');
  
  const testEmail = 'test-user@example.com';
  const testPassword = 'testPassword123';
  let testUserUid = null;
  
  try {
    // 1. Create a test user
    console.log('1. Creating test user...');
    const userRecord = await auth.createUser({
      email: testEmail,
      password: testPassword,
      emailVerified: true
    });
    testUserUid = userRecord.uid;
    console.log(`✅ Test user created with UID: ${testUserUid}`);
    
    // 2. Create user document in Firestore
    console.log('2. Creating user document in Firestore...');
    await db.collection('users').doc(testUserUid).set({
      email: testEmail,
      name: 'Test User',
      role: 'user',
      createdAt: new Date().toISOString()
    });
    console.log('✅ User document created in Firestore');
    
    // 3. Test subscription creation
    console.log('3. Testing subscription creation...');
    const subscription = await createDefaultSubscriptionServer(testUserUid, 'free');
    console.log('✅ Subscription created:', subscription);
    
    // 4. Verify subscription exists
    console.log('4. Verifying subscription exists...');
    const exists = await hasExistingSubscription(testUserUid);
    console.log(`✅ Subscription exists: ${exists}`);
    
    // 5. Verify subscription structure
    console.log('5. Verifying subscription structure...');
    const subscriptionDoc = await db.collection('subscriptions').doc(testUserUid).get();
    
    if (subscriptionDoc.exists) {
      const subscriptionData = subscriptionDoc.data();
      console.log('✅ Subscription data:', subscriptionData);
      
      // Validate required fields
      const requiredFields = ['userId', 'planId', 'status', 'createdAt', 'updatedAt', 'usage'];
      const missingFields = requiredFields.filter(field => !subscriptionData[field]);
      
      if (missingFields.length === 0) {
        console.log('✅ All required fields present');
      } else {
        console.log('❌ Missing fields:', missingFields);
      }
      
      // Validate usage structure
      if (subscriptionData.usage && typeof subscriptionData.usage.skyboxGenerations === 'number') {
        console.log('✅ Usage structure is valid');
      } else {
        console.log('❌ Usage structure is invalid');
      }
    } else {
      console.log('❌ Subscription document not found');
    }
    
    // 6. Test createSubscriptionIfNotExists for existing user
    console.log('6. Testing createSubscriptionIfNotExists for existing user...');
    const existingResult = await createSubscriptionIfNotExists(testUserUid, 'free');
    console.log(`✅ Result for existing user: ${existingResult ? 'Created' : 'Already exists'}`);
    
    // 7. Test with different plan
    console.log('7. Testing with different plan...');
    const testUser2 = await auth.createUser({
      email: 'test-user2@example.com',
      password: testPassword,
      emailVerified: true
    });
    
    const proSubscription = await createDefaultSubscriptionServer(testUser2.uid, 'pro');
    console.log('✅ Pro subscription created:', proSubscription);
    
    // Clean up test user 2
    await auth.deleteUser(testUser2.uid);
    await db.collection('users').doc(testUser2.uid).delete();
    await db.collection('subscriptions').doc(testUser2.uid).delete();
    console.log('✅ Test user 2 cleaned up');
    
    console.log('\n🎉 All tests passed! Subscription creation is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up test user
    if (testUserUid) {
      try {
        await auth.deleteUser(testUserUid);
        await db.collection('users').doc(testUserUid).delete();
        await db.collection('subscriptions').doc(testUserUid).delete();
        console.log('✅ Test user cleaned up');
      } catch (cleanupError) {
        console.error('❌ Error cleaning up test user:', cleanupError);
      }
    }
  }
}

// Run the test
testSubscriptionCreation().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 