# Class Launch to Multiple Headsets – Step-by-Step Implementation

This document describes the step-by-step implementation for launching lessons (or Create-page scenes) to multiple student headsets from the Teacher Dashboard, with live per-student progress.

---

## Overview

| Phase | Scope | Deliverables |
|-------|--------|---------------|
| **Phase 1** | Foundation | Sessions, launch lesson to class, students open lesson when launched |
| **Phase 2** | Live progress | Teacher sees each student's phase in real time; XR player reports phase |
| **Phase 3** | Create → class | "Send current scene to class" from Create page |
| **Phase 4** | Polish | End session, offline/retry, UX improvements |

---

## Phase 1 – Foundation

### Step 1.1 – Data model and types

- [x] **1.1.1** Add to `server/client/src/types/lms.ts`:
  - `ClassSession` interface: `id`, `teacher_uid`, `school_id`, `class_id`, `status` (`waiting` \| `active` \| `ended`), `session_code`, `launched_lesson` (nullable), `launched_scene` (nullable), `created_at`, `updated_at`.
  - `LaunchedLesson`: `chapter_id`, `topic_id`, optional `curriculum`, `class_name`, `subject`.
  - `LaunchedScene`: `type: 'create_scene'`, `skybox_id?`, `skybox_glb_url?`, etc.
  - `SessionStudentProgress`: `student_uid`, `display_name?`, `phase`, `launch_id?`, `last_updated`.

- [x] **1.1.2** Firestore structure:
  - Collection: `class_sessions` (doc per session).
  - Subcollection: `class_sessions/{sessionId}/progress` (doc id = `student_uid`).

### Step 1.2 – Firestore security rules

- [x] **1.2.1** `class_sessions/{sessionId}`:
  - **Create**: Authenticated user with `role == 'teacher'`; `request.resource.data.teacher_uid == request.auth.uid`; teacher must be in `classes/{class_id}.teacher_ids` or class shared with teacher; `school_id` matches teacher's school.
  - **Read**: Session owner (teacher_uid); or student in same school with `class_ids` containing `class_id`.
  - **Update**: Only `teacher_uid`; allowed fields: `status`, `launched_lesson`, `launched_scene`, `updated_at`.
  - **Delete**: Only `teacher_uid` (or admin/superadmin).

- [x] **1.2.2** `class_sessions/{sessionId}/progress/{studentUid}`:
  - **Read**: Session owner (teacher) or the student (studentUid == auth.uid).
  - **Create/Update**: Only the student for their own doc (`studentUid == request.auth.uid`); student must be in the session's class (same school, class_ids contains session.class_id).

### Step 1.3 – Class session service

- [x] **1.3.1** Create `server/client/src/services/classSessionService.ts`:
  - `createSession(teacherUid, schoolId, classId): Promise<string | null>` → creates session, generates short `session_code`, returns session id.
  - `launchLesson(sessionId, teacherUid, payload: LaunchedLesson): Promise<void>`.
  - `launchScene(sessionId, teacherUid, payload: LaunchedScene): Promise<void>` (for Phase 3).
  - `endSession(sessionId, teacherUid): Promise<void>`.
  - `joinSession(sessionCode, studentUid, schoolId, classIds): Promise<string | null>` → returns sessionId if student is in that class.
  - `subscribeSession(sessionId, onUpdate): () => void` → unsubscribe.
  - `subscribeSessionProgress(sessionId, onUpdate): () => void` → listen to progress subcollection.

### Step 1.4 – Session context (client)

- [x] **1.4.1** Create `server/client/src/contexts/ClassSessionContext.tsx`:
  - For **teacher**: hold `activeSessionId`, `activeSession`, `startSession()`, `launchLesson()`, `endSession()`, and subscribe to session + progress when active.
  - For **student**: hold `joinedSessionId`, `joinedSession`, `joinSession(code)`, `leaveSession()`, and subscribe to session so when `launched_lesson` is set, consumer can open lesson (and later report progress).

### Step 1.5 – Teacher Dashboard UI

- [x] **1.5.1** In `TeacherDashboard.tsx`:
  - Add a **Class Session** section (e.g. above or below "Teaching & Creation Tools").
  - **Start session**: Dropdown to select class (from managed/shared classes), button "Start class session" → call `createSession`, show success and **session code** (large, copyable) and optional join URL.
  - When session is active: show "Session active" with session code again; **Launch lesson** control: open a lesson picker (reuse from Lessons or curriculum), on select call `launchLesson(sessionId, payload)`.
  - **End session** button → `endSession(sessionId)`.
  - (Phase 2: show live list of students and their phase from `progress` subcollection.)

### Step 1.6 – Student join and receive launch

- [x] **1.6.1** **Join entry point**: On Lessons page (or dedicated "Join class" in sidebar/dashboard), add "Join with session code" input + "Join" button. On submit call `joinSession(sessionCode, studentUid, schoolId, classIds)`; on success store `joinedSessionId` in context and show "Joined. Waiting for teacher to launch a lesson."

- [x] **1.6.2** **React to launched lesson**: In a component that has access to `ClassSessionContext` and is mounted when student is on Lessons (or app root): when `joinedSession` has `launched_lesson` set, build the same `fullLessonData` shape used by the app (from lesson bundle or topic/chapter fetch), set `sessionStorage.setItem('activeLesson', ...)` and navigate to `/xrlessonplayer` (or set LessonContext and navigate). Use existing lesson-loading path (e.g. getLessonBundle by chapter_id/topic_id) so assets load from CDN/Firestore (data-efficient).

- [x] **1.6.3** **Session code in URL (optional)**: Support `?session=CODE` on Lessons or a join page so students can open link and auto-join.

### Step 1.7 – Lesson data for launched lesson

- [x] **1.7.1** When teacher launches, store only `chapter_id` and `topic_id` (and optionally curriculum/class_name/subject) in `launched_lesson`. Student app, when it sees `launched_lesson`, fetches full lesson bundle (e.g. existing `getLessonBundle` or curriculum service) by chapter_id/topic_id, then builds `fullLessonData` and either sets sessionStorage and navigates to XR player or passes via context. No duplication of large payloads.

### Step 1.8 – Wire ClassSessionProvider

- [x] **1.8.1** Wrap app (or dashboard/lessons subtree) with `ClassSessionProvider` in `App.jsx` so Teacher Dashboard and Lessons (and XR player later) can use `useClassSession()`.

---

## Phase 2 – Live progress

### Step 2.1 – XR player reports phase

- [x] **2.1.1** In `XRLessonPlayerV3.tsx`: when `learnxr_class_session_id` is in sessionStorage (set when opening a class-launched lesson), on `lessonPhase` change call `reportSessionProgress(sessionId, studentUid, displayName, phase)` which writes to `class_sessions/{sessionId}/progress/{studentUid}`. Phase is mapped from player phases (waiting→idle, intro→intro, content→explanation, outro→outro, mcq→quiz, complete→completed).

### Step 2.2 – Teacher sees live progress

- [x] **2.2.1** In Teacher Dashboard, when a session is active, the Class Launch card subscribes to progress via `useClassSession().progressList` and shows a row of badges: student display_name (or uid slice) and current phase. Updates in real time via `subscribeSessionProgress` in ClassSessionContext.

---

## Phase 3 – Send scene from Create page

### Step 3.1 – Create page: capture and send scene

- [x] **3.1.1** In Create page (`/main`), add "Send to class" (or "Send current scene to class"): read current skybox/scene (skybox_id, skybox_glb_url, skybox_image_url, name). If no active session, show "Start a class session from Dashboard first" or open a modal to select active session. Then call `launchScene(sessionId, teacherUid, { type: 'create_scene', skybox_id, skybox_glb_url, skybox_image_url, ... })`.

### Step 3.2 – Student receives scene

- [x] **3.2.1** When `joinedSession.launched_scene` is set, student app opens `/class-scene` (ClassSceneViewer) that reads scene from sessionStorage and displays the skybox via SkyboxFullScreen. "Back to Lessons" button returns to Lessons.

---

## Phase 4 – Polish

- [ ] **4.1** **End session**: Already in Phase 1; ensure students see "Session ended" when status becomes `ended` and leave session.
- [ ] **4.2** **Offline/retry**: On student app focus/reconnect, re-read `class_sessions/{sessionId}` and if `launched_lesson`/`launched_scene` is set, open it (idempotent).
- [ ] **4.3** **Same WiFi hint**: Optional; show "Same network as teacher" when on same LAN (e.g. via simple backend or client heuristic); join still via session code + Firestore.

---

## File checklist

| File | Purpose |
|------|--------|
| `server/client/src/types/lms.ts` | Add ClassSession, LaunchedLesson, LaunchedScene, SessionStudentProgress |
| `firestore.rules` | Rules for `class_sessions` and `class_sessions/{id}/progress` |
| `server/client/src/services/classSessionService.ts` | createSession, launchLesson, launchScene, endSession, joinSession, subscribeSession, subscribeSessionProgress, reportSessionProgress |
| `server/client/src/contexts/ClassSessionContext.tsx` | ClassSessionProvider, useClassSession (teacher + student state) |
| `server/client/src/screens/dashboard/TeacherDashboard.tsx` | Class Session section: start, code, launch lesson, end; (Phase 2: live progress list) |
| `server/client/src/screens/Lessons.jsx` (or JoinSession component) | Join with session code; when launched_lesson set → fetch bundle, set sessionStorage, navigate to XR |
| `server/client/src/App.jsx` | Wrap with ClassSessionProvider |
| `server/client/src/screens/XRLessonPlayerV3.tsx` | (Phase 2) Report phase to progress when in session |
| Create page (e.g. MainSection or /main) | (Phase 3) "Send to class" button, launchScene |

---

## Session code format

- Short, readable, unique per session. Example: 6-character alphanumeric (e.g. from `nanoid` or random). Stored in `class_sessions.session_code` and used for `joinSession(sessionCode)`.

---

## Indexes (Firestore)

- `class_sessions`: Query by `session_code` (unique) for join; by `teacher_uid` for "my active session"; by `class_id`, `status` if needed.
- `class_sessions/{id}/progress`: Collection group query not required for Phase 1 (we query by session id). For Phase 2, teacher listens to subcollection under one sessionId.
