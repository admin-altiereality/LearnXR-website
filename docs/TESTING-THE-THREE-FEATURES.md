# How to Verify the 3 Features Are Working

This guide tells you exactly how to check **Personalized Learning**, **Automated Assessments**, and **AI Teacher Support** in the app.

---

## Before You Start

1. **App is running**
   - Frontend: http://localhost:3000 (or your deployed URL)
   - Backend: http://localhost:5002/api (or your API URL)

2. **You need two test accounts** (in Firebase / your auth):
   - One user with role **student**
   - One user with role **teacher** (and assigned to at least one class)

3. **Optional for AI features:** Backend has `OPENAI_API_KEY` set in `server/.env` for richer AI responses (otherwise you get fallback content).

---

## 1. Personalized Learning (AI) – Student Only

**Purpose:** Student sees AI recommendations (strengths, areas to improve, study tips, next action).

### How to test

1. Log in as a **student**.
2. In the sidebar, click **Personalized Learning** (or go to `/personalized-learning`).
3. The page should load (spinner first, then content).

### What “working” looks like

- **Loading:** You see “Getting your personalized recommendations…” then the page content.
- **Content:** You see at least:
  - A **next best action** line (e.g. “Continue with the next lesson…”).
  - One of: **Strengths**, **Areas to improve**, or **Study tips** (lists or message).
- **No errors:** No red error message; no “Failed to load recommendations”.

### If it fails

- **403 / “Only students”:** You’re not logged in as a student. Check user role in Firebase (e.g. `users/<uid>.role === 'student'`).
- **503 / “Database not available”:** Backend can’t reach Firestore (check Firebase config and that Firestore is enabled).
- **Empty or generic text:** Normal if the student has no scores/lesson data yet; you still get fallback recommendations. Add some lesson/quiz activity for that student and reload to see more specific AI suggestions (if `OPENAI_API_KEY` is set).

### Quick API check (backend only)

If the frontend fails, check that the backend responds (you need a valid Firebase ID token for a **student** user):

```bash
# Replace YOUR_STUDENT_FIREBASE_ID_TOKEN with a real token (e.g. from browser DevTools → Application → Local Storage or from your app after login)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer YOUR_STUDENT_FIREBASE_ID_TOKEN" "http://localhost:5002/api/ai-education/personalized-learning/recommendations"
```

- **200** = OK (feature is working from API side).
- **403** = Not a student or invalid token.
- **401** = Missing or invalid token.

---

## 2. Automated Assessments – Teacher + Student

**Purpose:** Teachers create quizzes (MCQ, true/false, short answer); students take them and get auto-graded; teachers see attempts and scores.

### 2a. Teacher: Create and view assessments

1. Log in as a **teacher** who has at least one **class** assigned.
2. Sidebar → **Assessments** (or go to `/assessments`).
3. Select a **class** in the dropdown (you should see at least one class).
4. Click **Create assessment**.
5. Fill in:
   - **Title** (e.g. “Math Quiz 1”)
   - **Description** (optional)
   - At least one **question**: question text, options for MCQ, and select the correct answer (radio).
6. Click **Create**.

**Working:** You see “Assessment created” (or similar success), and the new assessment appears in the list for that class.

**View attempts (after a student has taken it):** Click **View attempts** on an assessment. You should see a table of attempts (student id, score, completed date) or an empty state (“No attempts yet”).

### 2b. Student: Take an assessment and see result

1. Log in as a **student** who is in the **same class** as the assessment you created.
2. Sidebar → **Assessments** (or `/assessments`).
3. Under “Available” you should see the assessment you created (e.g. “Math Quiz 1”).
4. Click **Take** (or go to `/assessments/take/<assessment-id>`).
5. Answer the questions (select options for MCQ / true-false, or type for short answer).
6. Click **Submit**.

**Working:** You see a result screen with:
- “You passed!” or “Keep practicing”
- Score like “2/3 (67%)” or “3/3 (100%)”
- Button “Back to assessments”

**My attempts:** Back on `/assessments`, under “My attempts” you should see this attempt with score and date.

### If it fails

- **Teacher sees “No assessments” / no class:** Teacher must have `managed_class_ids` (or classes where they are in `teacher_ids`). Check Firestore `users/<teacher_uid>` and `classes` collection.
- **Student doesn’t see the assessment:** Student’s `class_ids` must include the class the assessment is assigned to. Check `users/<student_uid>.class_ids` and `assessments/<id>.classId`.
- **Submit fails (4xx/5xx):** Check browser Network tab for the `POST .../assessment/<id>/submit` request. 403 = not a student or wrong class; 400 = invalid payload (e.g. missing `answers`).
- **Score always 0 or wrong:** Backend auto-grades by matching correct option index (MCQ) or exact string (short answer). Check that the correct answer in the created assessment matches what you’re submitting (e.g. option index 0/1/2).

---

## 3. AI Teacher Support – Teachers Only

**Purpose:** Teachers get AI-generated lesson plans, content ideas (examples, activities, etc.), and grading rubrics.

### How to test

1. Log in as a **teacher** (or principal/admin).
2. Sidebar → **AI Teacher Support** (or `/teacher-support`).
3. You should see three tabs: **Lesson plan**, **Content ideas**, **Rubric**.

### 3a. Lesson plan

1. Open the **Lesson plan** tab.
2. Fill in **Subject** (e.g. Mathematics), **Class** (e.g. 8), **Topic** (e.g. Linear equations).
3. Click **Generate lesson plan**.

**Working:** A card appears with:
- Title
- Objectives (list)
- Materials (list)
- Steps (numbered, with optional duration)
- Assessment ideas
- Differentiation tips

If `OPENAI_API_KEY` is missing, you still get a **fallback** lesson plan (generic steps). So the feature “works” even without OpenAI; with OpenAI you get a richer plan.

### 3b. Content ideas

1. Open the **Content ideas** tab.
2. Fill **Subject**, **Class**, **Topic**.
3. Choose **Type**: Examples, Activities, Discussion questions, or Real-world connections.
4. Click **Get suggestions**.

**Working:** A list of 4–6 short suggestions appears. Without OpenAI you get a short fallback list.

### 3c. Rubric

1. Open the **Rubric** tab.
2. Fill **Subject**, **Class**, and **Assignment type** (e.g. “Essay”, “Lab report”).
3. Click **Generate rubric**.

**Working:** A rubric appears with:
- Criteria (e.g. Understanding, Accuracy)
- For each criterion: levels (e.g. Excellent, Good, Needs Improvement) with descriptions
- Max score (e.g. 100)

Again, without OpenAI you get a simple fallback rubric.

### If it fails

- **403 / “Only teachers and above”:** User role is not teacher/school/principal/admin/superadmin. Check `users/<uid>.role`.
- **No content / long loading then error:** Backend might be missing `OPENAI_API_KEY` or OpenAI might be failing; you should still get fallback content. Check server logs for errors.

---

## Summary checklist

| Feature                 | Who      | Where to go              | What to do                                      | Success = |
|-------------------------|----------|---------------------------|--------------------------------------------------|-----------|
| Personalized Learning   | Student  | Sidebar → Personalized Learning | Open page, wait for load                        | Recommendations + next action / strengths / tips |
| Assessments (teacher)   | Teacher  | Sidebar → Assessments     | Select class → Create assessment → Add questions | Assessment in list; “View attempts” works |
| Assessments (student)    | Student  | Sidebar → Assessments     | Take assessment → Submit                        | Result screen with score; attempt in “My attempts” |
| AI Teacher Support      | Teacher  | Sidebar → AI Teacher Support | Generate lesson plan, content ideas, rubric     | Plan / suggestions / rubric appear (or fallback) |

---

## Quick “smoke” order

1. **Teacher:** Create one assessment with 2–3 MCQ questions.
2. **Student:** Take that assessment and submit; confirm score and “My attempts”.
3. **Student:** Open Personalized Learning; confirm no error and some recommendations.
4. **Teacher:** Open AI Teacher Support; generate lesson plan and rubric once each.

If all four steps succeed, the three features are working end-to-end.
