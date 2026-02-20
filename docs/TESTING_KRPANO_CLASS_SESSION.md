# Testing Krpano Class Session (LMS-manav)

How to verify **teacher view control (hlookat/vlookat)**, **dashboard sync (phase + quiz)**, and **3D/quiz in scene** when using the Krpano VR lesson player with a class session.

---

## Prerequisites

- **Two accounts:** one **teacher** (with a school and class), one **student** (in that class).
- **Two browsers or one normal + one incognito** so you can be logged in as both.
- **Same lesson** that has:
  - A **skybox** (360° image) so Krpano loads.
  - Optional: 3D asset, MCQs (for quiz and completion reporting).

---

## Option A: Test with class launch (students open Krpano)

By default, when the teacher launches a lesson, students are sent to **XR player** (`/xrlessonplayer`). To test **Krpano** with the same flow, point the launch redirect to the Krpano player.

### 1. Point “launch to class” to Krpano (one-time change)

In both files, change the redirect from XR player to Krpano when `launched_lesson` is set:

**`server/client/src/screens/Lessons.jsx`** (around line 1411):

```js
// Before:
setTimeout(() => navigate('/xrlessonplayer'), 200);

// After (for testing Krpano):
setTimeout(() => navigate('/vrlessonplayer-krpano'), 200);
```

**`server/client/src/screens/dashboard/StudentDashboard.tsx`** (around line 204):

```tsx
// Before:
setTimeout(() => navigate('/xrlessonplayer'), 200);

// After (for testing Krpano):
setTimeout(() => navigate('/vrlessonplayer-krpano'), 200);
```

Revert these when you are done testing Krpano if you want the default to stay XR.

### 2. Run the flow

1. **Teacher (browser 1)**  
   - Go to **Dashboard** (teacher).  
   - Under “Class launch”, click **Start session** and pick a class.  
   - Copy the **session code**.

2. **Student (browser 2)**  
   - Go to **Dashboard** (student) or **Lessons**.  
   - **Join session** with the code.  
   - Wait on Lessons or dashboard.

3. **Teacher**  
   - In the launch modal, choose **chapter** and **topic** (lesson with skybox).  
   - Click **Launch to class**.

4. **Student**  
   - Should auto-navigate to **Krpano** (`/vrlessonplayer-krpano`) with that lesson.

5. **Teacher**  
   - Open the **same lesson** in Krpano: go to **Lessons**, open the same chapter/topic, and click **Launch lesson** (or use a direct link to `/vrlessonplayer-krpano` with the same lesson data in context/sessionStorage).  
   - If your app has a “Launch in Krpano” button, use that; otherwise ensure the teacher has the same lesson loaded in Krpano (e.g. by launching from Lessons to `/vrlessonplayer` then changing the URL to `/vrlessonplayer-krpano` after the lesson is in context, or by the temporary redirect above and launching again).

---

## Option B: Test without changing redirect (use “Open in Krpano” button)

Use this if you don’t want to change the launch redirect. The Lessons modal has an **“Open in Krpano”** button next to **“Launch lesson”**.

1. **Teacher**  
   - Start a class session from Teacher Dashboard; copy the **session code**.

2. **Student**  
   - Join the session (Dashboard or Lessons).

3. **Both**  
   - Go to **Lessons**.  
   - Open the **same lesson** (same chapter/topic) so the launch modal appears.  
   - **Teacher:** Click **“Open in Krpano”** → you go to `/vrlessonplayer-krpano` with the lesson loaded.  
   - **Student:** Click **“Open in Krpano”** as well (with the session already joined, so `learnxr_class_session_id` is set).  
   - Both are now in Krpano with the same lesson; teacher view sync and dashboard sync will work.

---

## What to check

### 1. Dashboard sync (phase + quiz)

- **Teacher:** Stay on **Teacher Dashboard** (or the tab where you see the class session and live progress).
- **Student:** In Krpano, click **Start Lesson**, then go through intro → explanation → outro.
- **Teacher:** You should see the student’s **phase** update (e.g. intro → explanation → outro) in (near) real time.
- **Student:** Complete the **quiz** (answer all MCQs and finish).
- **Teacher:** Student should show as **completed** with **quiz score** (e.g. “2/3”).

**Console (student):** No errors; optional `[VRPlayer]` logs.

### 2. Teacher view control (hlookat / vlookat)

- **Teacher:** In Krpano, after starting the lesson, **drag** the 360° view (change direction).
- **Student:** In Krpano (same session, same lesson), the view should **smoothly follow** the teacher’s view (with a short delay and ~1s tween).
- **Teacher:** Move again; student’s view should update again.

**Notes:**

- Teacher view is broadcast about every **500 ms** from the teacher’s Krpano view.
- If the student view never moves, check:
  - Teacher is the **session owner** (started the session).
  - Student has **joined** the session (`joinedSessionId` / `learnxr_class_session_id` set).
  - Krpano viewer object has a **`get`** API (e.g. `view.hlookat` / `view.vlookat`). If your build doesn’t expose `get`, teacher broadcast won’t run; student follow still works if `teacher_view` is written by another client or a fallback.

### 3. 3D assets and quiz in scene

- **With skybox + GLB:** You should see the **360° background** and the **3D model** in the same scene (integrated Three.js mode).
- **Krpano-only (no GLB):** You see the **360° pano** and the **quiz** in the bottom overlay when you reach the quiz phase.
- **Quiz completion:** After the last MCQ, the student sees the **“Lesson Complete!”** screen and the teacher dashboard shows **completed** and **quiz score**.

---

## Quick console checks (student, in Krpano)

- `sessionStorage.getItem('learnxr_class_session_id')` → should be the session ID (not null) when joined.
- In the Network tab, Firestore (or your backend) should show **writes** to the session’s `progress` subcollection when phase changes and when quiz is completed.

---

## Reverting the redirect (after testing)

If you used **Option A**, change the two lines back to:

```js
setTimeout(() => navigate('/xrlessonplayer'), 200);
```

so that “launch to class” again opens the XR player by default.
