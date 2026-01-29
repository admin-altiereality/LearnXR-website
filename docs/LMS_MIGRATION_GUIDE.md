# LMS Migration Guide

## Overview
This guide explains how to migrate existing data to the new multi-school LMS structure.

## Prerequisites
1. Firebase Admin SDK credentials file (service account JSON)
2. Access to Firebase Console
3. Admin or Superadmin role

## Migration Steps

### Step 1: Create Schools Collection

The migration script will:
1. Scan all users in the `users` collection
2. Extract unique school names from `school` or `schoolName` fields
3. Create documents in the `schools` collection
4. Map school names to school IDs

**Manual Alternative:**
If you prefer to create schools manually:
1. Go to Firebase Console → Firestore
2. Create a new collection: `schools`
3. For each unique school, create a document with:
   - `name`: School name
   - `address`, `city`, `state`, etc. (from user data)
   - `createdBy`: Principal UID (if applicable)
   - `createdAt`: Current timestamp
   - `updatedAt`: Current timestamp

### Step 2: Assign school_id to Users

The migration script will:
1. For each user, find their school name
2. Look up the corresponding school_id from the schools collection
3. Update the user document with `school_id` field

**Manual Alternative:**
1. Query users by school name
2. For each user, update their document:
   ```javascript
   // In Firebase Console or via script
   await updateDoc(doc(db, 'users', userId), {
     school_id: schoolId,
     updatedAt: serverTimestamp()
   });
   ```

### Step 3: Create Classes

Classes should be created manually by principals/admins using the Class Management UI:
1. Navigate to `/admin/classes` (as principal or admin)
2. Click "Create Class"
3. Fill in class details (name, curriculum, subject, academic year)
4. The class will be automatically linked to your school

### Step 4: Assign Students to Classes

1. Go to Class Management (`/admin/classes`)
2. Click "Manage" on a class
3. Assign students by clicking "Enroll" next to each student
4. This updates both `class.student_ids` and `user.class_ids`

### Step 5: Assign Teachers to Classes

1. Go to Class Management (`/admin/classes`)
2. Click "Manage" on a class
3. Assign teachers by clicking "Assign" next to each teacher
4. This updates both `class.teacher_ids` and `user.managed_class_ids`

### Step 6: Migrate Quiz Results (Optional - Automatic Going Forward)

**Existing Data:**
The migration script will copy data from `user_quiz_results` to `student_scores` with school_id.

**New Data:**
All new quiz completions automatically save to `student_scores` collection with proper school_id and class_id.

### Step 7: Migrate Lesson Progress (Optional - Automatic Going Forward)

**Existing Data:**
The migration script will copy data from `user_lesson_progress` to `lesson_launches` with school_id.

**New Data:**
All new lesson launches automatically track in `lesson_launches` collection with proper school_id and class_id.

## Running the Migration Script

### Option 1: Using tsx (Recommended)
```bash
cd server
NODE_PATH=./node_modules:$NODE_PATH npx tsx ../scripts/migrate-to-lms.ts
```

### Option 2: Using Node.js directly
```bash
cd server
node -r ts-node/register ../scripts/migrate-to-lms.ts
```

### Option 3: Manual Migration via Firebase Console
Follow the manual alternatives listed above for each step.

## Post-Migration Tasks

1. **Verify Data:**
   - Check that all users have `school_id`
   - Verify principals have `managed_school_id`
   - Confirm classes have correct `school_id`

2. **Assign Classes:**
   - Use Class Management UI to create classes
   - Assign students to appropriate classes
   - Assign teachers to their classes

3. **Test Permissions:**
   - Verify students can only see their own data
   - Verify teachers can only see their class students
   - Verify principals can only see their school data

## Troubleshooting

### Service Account Authentication Error
- Ensure the service account JSON file is for the correct Firebase project
- Verify the file has proper permissions
- Check that the project ID matches your Firebase project

### Missing school_id
- Run migration script again (it's idempotent)
- Or manually update users via Firebase Console

### Classes Not Showing
- Ensure classes have `school_id` set
- Verify user has `school_id` matching the class
- Check Firestore rules allow read access

## Notes

- The migration script is **idempotent** - safe to run multiple times
- Legacy collections (`user_quiz_results`, `user_lesson_progress`) are maintained for backward compatibility
- New data automatically goes to LMS collections (`student_scores`, `lesson_launches`)
- Both old and new collections are updated simultaneously for smooth transition
