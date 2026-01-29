/**
 * Data Migration Script for Multi-School LMS
 * 
 * This script migrates existing data to the new LMS structure:
 * 1. Creates schools collection from existing user school field
 * 2. Assigns school_id to all users
 * 3. Creates initial classes collection
 * 4. Migrates user_quiz_results to student_scores with school_id
 * 5. Migrates user_lesson_progress to lesson_launches with school_id
 * 6. Updates user profiles with class_ids, managed_class_ids, etc.
 * 
 * Run with: npx ts-node scripts/migrate-to-lms.ts
 */

// Use server's firebase-admin installation
const serverNodeModules = path.resolve(__dirname, '../server/node_modules');
if (fs.existsSync(serverNodeModules)) {
  // Add server node_modules to module resolution
  const Module = require('module');
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function(request: string, parent: any, isMain: boolean) {
    if (request === 'firebase-admin') {
      const serverPath = path.join(serverNodeModules, 'firebase-admin');
      if (fs.existsSync(serverPath)) {
        return originalResolveFilename(serverPath, parent, isMain);
      }
    }
    return originalResolveFilename(request, parent, isMain);
  };
}

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin
// Try multiple possible service account file patterns
const rootDir = path.resolve(__dirname, '..');
const jsonFiles = fs.readdirSync(rootDir).filter(file => 
  (file.includes('firebase-adminsdk') || file.includes('serviceAccount')) && file.endsWith('.json')
);

if (jsonFiles.length === 0) {
  console.error('❌ Firebase service account file not found');
  console.error('   Looking for files matching: *firebase-adminsdk*.json or *serviceAccount*.json');
  process.exit(1);
}

const serviceAccountPath = path.resolve(__dirname, '..', jsonFiles[0]);
console.log(`📄 Using service account file: ${jsonFiles[0]}`);
const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

interface SchoolMap {
  [schoolName: string]: string; // school name -> school_id
}

async function migrateToLMS() {
  console.log('🚀 Starting LMS migration...\n');

  try {
    // Step 1: Create schools collection from existing user school field
    console.log('📚 Step 1: Creating schools collection...');
    const schoolsMap: SchoolMap = {};
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const schoolName = userData.school || userData.schoolName;
      
      if (schoolName && !schoolsMap[schoolName]) {
        // Create school document
        const schoolRef = db.collection('schools').doc();
        await schoolRef.set({
          name: schoolName,
          address: userData.address,
          city: userData.city,
          state: userData.state,
          pincode: userData.pincode,
          contactPerson: userData.contactPerson,
          contactPhone: userData.contactPhone || userData.phoneNumber,
          website: userData.website,
          boardAffiliation: userData.boardAffiliation,
          establishedYear: userData.establishedYear,
          schoolType: userData.schoolType,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userData.role === 'principal' ? userDoc.id : null,
        });
        
        schoolsMap[schoolName] = schoolRef.id;
        console.log(`  ✅ Created school: ${schoolName} (${schoolRef.id})`);
      }
    }
    
    console.log(`\n✅ Created ${Object.keys(schoolsMap).length} schools\n`);

    // Step 2: Assign school_id to all users
    console.log('👥 Step 2: Assigning school_id to users...');
    let updatedUsers = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const schoolName = userData.school || userData.schoolName;
      const schoolId = schoolName ? schoolsMap[schoolName] : null;
      
      if (schoolId) {
        await userDoc.ref.update({
          school_id: schoolId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updatedUsers++;
      }
      
      // For principals, set managed_school_id
      if (userData.role === 'principal' && schoolId) {
        await userDoc.ref.update({
          managed_school_id: schoolId,
        });
      }
    }
    
    console.log(`✅ Updated ${updatedUsers} users with school_id\n`);

    // Step 3: Create initial classes collection (placeholder - will be managed by admins)
    console.log('📖 Step 3: Classes collection will be created manually by admins\n');

    // Step 4: Migrate user_quiz_results to student_scores
    console.log('📊 Step 4: Migrating quiz results to student_scores...');
    const quizResultsSnapshot = await db.collection('user_quiz_results').get();
    let migratedScores = 0;
    
    for (const resultDoc of quizResultsSnapshot.docs) {
      const resultData = resultDoc.data();
      const userId = resultData.userId;
      
      // Get user to find school_id
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) continue;
      
      const userData = userDoc.data();
      const schoolId = userData.school_id;
      if (!schoolId) continue;
      
      // Create student_score document
      const scoreId = `${userId}_${resultData.chapterId || 'unknown'}_${resultData.topicId || 'unknown'}_${resultData.attempt_number || 1}`;
      const scoreRef = db.collection('student_scores').doc(scoreId);
      
      await scoreRef.set({
        student_id: userId,
        school_id: schoolId,
        class_id: null, // Will be set when classes are created
        chapter_id: resultData.chapterId || 'unknown',
        topic_id: resultData.topicId || 'unknown',
        curriculum: resultData.curriculum || 'CBSE',
        class_name: resultData.className || userData.class || 'unknown',
        subject: resultData.subject || 'unknown',
        attempt_number: resultData.attempt_number || 1,
        score: {
          correct: resultData.score?.correct || 0,
          total: resultData.score?.total || 0,
          percentage: resultData.score?.percentage || 0,
        },
        answers: resultData.answers || {},
        completed_at: resultData.completedAt || admin.firestore.FieldValue.serverTimestamp(),
        time_taken_seconds: resultData.time_taken_seconds,
      });
      
      migratedScores++;
    }
    
    console.log(`✅ Migrated ${migratedScores} quiz results to student_scores\n`);

    // Step 5: Migrate user_lesson_progress to lesson_launches
    console.log('📚 Step 5: Migrating lesson progress to lesson_launches...');
    const progressSnapshot = await db.collection('user_lesson_progress').get();
    let migratedLaunches = 0;
    
    for (const progressDoc of progressSnapshot.docs) {
      const progressData = progressDoc.data();
      const userId = progressData.userId;
      
      // Get user to find school_id
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) continue;
      
      const userData = userDoc.data();
      const schoolId = userData.school_id;
      if (!schoolId) continue;
      
      // Create lesson_launch document
      const launchId = `${userId}_${progressData.chapterId || 'unknown'}_${progressData.topicId || 'unknown'}_${Date.now()}`;
      const launchRef = db.collection('lesson_launches').doc(launchId);
      
      await launchRef.set({
        student_id: userId,
        school_id: schoolId,
        class_id: null, // Will be set when classes are created
        chapter_id: progressData.chapterId || 'unknown',
        topic_id: progressData.topicId || 'unknown',
        curriculum: progressData.curriculum || 'CBSE',
        class_name: progressData.className || userData.class || 'unknown',
        subject: progressData.subject || 'unknown',
        launched_at: progressData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        completed_at: progressData.completedAt || null,
        completion_status: progressData.completed ? 'completed' : 'in_progress',
        duration_seconds: progressData.duration_seconds,
      });
      
      migratedLaunches++;
    }
    
    console.log(`✅ Migrated ${migratedLaunches} lesson progress records to lesson_launches\n`);

    console.log('✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Create classes in the classes collection');
    console.log('  2. Assign students to classes (update user.class_ids)');
    console.log('  3. Assign teachers to classes (update user.managed_class_ids)');
    console.log('  4. Update class_id in student_scores and lesson_launches');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToLMS()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
