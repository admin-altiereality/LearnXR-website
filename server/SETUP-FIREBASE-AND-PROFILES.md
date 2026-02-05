# Firebase Admin & User Profiles (AI features, Assessments, Teacher Support)

## 1. Firebase Admin (required for auth; otherwise API returns 503)

**Option A – Service account JSON (recommended for local dev)**  
- In Firebase Console: Project Settings → Service Accounts → Generate new private key.  
- Save the JSON in the **project root** (e.g. `d:\LearnXR-website\`) as:  
  `learnxr-evoneuralai-firebase-adminsdk-xxxxx.json`  
- Do not commit this file. Add it to `.gitignore` if needed.

**Option B – Environment variables**  
In `server/.env` set (from the same service account):

- `FIREBASE_PROJECT_ID=learnxr-evoneuralai`
- `FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@learnxr-evoneuralai.iam.gserviceaccount.com`
- `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`  
  (use real newlines or `\n` in the string; no placeholder text)

## 2. User profiles in Firestore (required for Teacher Support & Assessments)

Each user must have a document in **Firestore `users`** with at least a **`role`** field.  
Without it, API returns 401 “User profile not found”.

**Ensure a single user has a profile:**

From `server/`:

```bash
npx tsx src/scripts/ensure-user-profile.ts <firebase-uid> [role]
```

Examples:

- `npx tsx src/scripts/ensure-user-profile.ts abc123xyz superadmin`
- `npx tsx src/scripts/ensure-user-profile.ts abc123xyz student`
- `npm run ensure-user-profile -- abc123xyz teacher`

Roles: `student` | `teacher` | `principal` | `admin` | `superadmin` | `school` | `associate`

**Get a user’s Firebase UID:**  
Firebase Console → Authentication → Users, or from your app after login (e.g. `auth.currentUser.uid`).

**Bulk / manual:**  
Create or update documents in Firestore `users/{uid}` with at least:

- `role`: one of the roles above (string).

You can add `school_id`, `class_ids`, `managed_class_ids`, etc. as needed for your app.

## 3. Restart the backend

After changing `.env` or adding the service account file:

```bash
cd server
npm run dev
```

API base: `http://localhost:5002` (or `SERVER_PORT` from `.env`).
