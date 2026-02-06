# Automated Assessment & Evaluation – Implementation Plan

This document plans how to implement **automated assessment** and **evaluation** in the LearnXR platform, with a focus on the VR lesson flow and LMS.

---

## 1. Current State Summary

### What Already Exists

| Area | What exists | Where |
|------|-------------|--------|
| **In-lesson (VR) quiz** | Post-lesson MCQs from `chapter_mcqs` or embedded in topic; auto-graded by correct option index | `VRLessonPlayer.tsx`, `getChapterMCQs()` |
| **Score persistence** | Quiz results saved to `student_scores` (LMS), plus legacy `user_quiz_results` and `user_lesson_progress` | `lessonTrackingService.saveQuizScore()`, VRLessonPlayer |
| **Lesson tracking** | `lesson_launches` (in_progress / completed / abandoned), optional `duration_seconds` | `trackLessonLaunch`, `updateLessonLaunch` |
| **Standalone assessments** | Teacher-created assessments (MCQ / short_answer / true_false), auto-grading, `assessment_attempts`, per-question results | `assessmentService.ts`, `/assessment` routes, TakeAssessment UI |
| **Personalized learning** | Uses `student_scores` + `assessment_attempts` to infer low/high scores by subject and topic; AI recommendations | `personalizedLearningService`, `aiEducation` routes |
| **Rubrics** | AI-generated grading rubrics (criteria + levels); used in Teacher Support UI, not yet tied to scoring | `teacherSupportService.generateRubric()`, TeacherSupport.tsx |
| **LMS APIs** | Student scores, lesson progress (launches), class/student access control | `lms.ts` routes |

### Gaps (What “automated assessment” and “evaluation” should add)

- **Unified model**: In-lesson (VR) scores and standalone assessment attempts are stored separately; evaluation and reporting should treat them in one coherent way where needed.
- **Learning objectives**: Curriculum has `learning_objective` (topic/chapter); no explicit link from scores to “did the student meet this objective?”
- **Evaluation layer**: No single place that aggregates “how is this student/class doing?” (e.g. by topic, by objective, pass/fail, trends).
- **Rubric-based evaluation**: Rubrics exist for teachers but are not used to score or evaluate student work in the app.
- **Automation**: MCQs are pre-authored (chapter_mcqs or topic.mcqs); no automated generation from lesson content or from objectives.

---

## 2. Definitions (for this codebase)

- **Assessment** = Any graded activity that produces a score or outcome:
  - **In-lesson (VR) quiz**: MCQs after a chapter/topic in the VR player; stored in `student_scores`.
  - **Standalone assessment**: Teacher-created quiz/assessment; stored in `assessment_attempts`.
  - (Future: rubric-based, open-ended, or AI-graded tasks.)

- **Automated assessment** = Either or both of:
  - **Auto-grading**: Already done for MCQs and short_answer/true_false in both flows.
  - **Auto-generation**: Generating assessment items (e.g. MCQs) from lesson content or learning objectives (not yet implemented).

- **Evaluation** = Using assessment data (and optionally other signals) to answer:
  - Did the student meet the learning objective(s) for this topic/chapter?
  - How is the student/class performing over time (by topic, subject, objective)?
  - Pass/fail, mastery levels, and reporting for teachers/principals.

---

## 3. Proposed Architecture

### 3.1 Keep Two Assessment Flows, One Evaluation Layer

- **Flow A – In-lesson (VR)**  
  - Stays as-is: VR lesson → MCQs → `saveQuizScore()` → `student_scores` (+ legacy collections).  
  - Optionally: tag each score with `learning_objective_id` or topic-level objective text for evaluation.

- **Flow B – Standalone assessments**  
  - Stays as-is: Teacher creates assessment → student takes it → `assessment_attempts` with auto-grading.  
  - Optionally: link assessments to `chapter_id` / `topic_id` / `curriculum` so evaluation can aggregate with in-lesson data.

- **Evaluation layer (new)**  
  - Reads from both `student_scores` and `assessment_attempts` (and optionally lesson_launches).  
  - Exposes:
    - Per-student: scores by topic/chapter/subject, completion, and (later) “objective met” flags.
    - Per-class: aggregates, trends, and simple reports.  
  - Implemented as a **service** (e.g. `evaluationService`) and **API routes** (e.g. under `/api/lms` or `/api/evaluation`) so dashboards and personalized learning can use one place.

### 3.2 Data Model Additions (minimal, backward-compatible)

- **student_scores** (existing):  
  - Optional: `learning_objective_id` or `topic_objective` (string) so evaluation can map “score” → “objective”.
- **assessments** (existing):  
  - Optional: `chapterId`, `topicId`, `curriculum`, `subject` so standalone assessments can be grouped with in-lesson data for evaluation.
- **evaluation** (new, optional later):  
  - Cached aggregates per student/class (e.g. “mastery” by topic, last 30 days) to avoid recomputing on every request. Can be added in a later phase.

### 3.3 Where “Automation” Fits

- **Phase 1 (current plan):**  
  - No new auto-generation. Focus on: clear evaluation layer, consistent use of existing scores, and (optional) linking scores/assessments to objectives/chapter/topic.

- **Phase 2 (later):**  
  - **Auto-generated MCQs**: Service that, given chapter/topic (and script or learning objective), calls an LLM to generate MCQ set; store in `chapter_mcqs` or return for one-off quiz.  
  - **Rubric-based grading**: If we add “submit open-ended answer” or “submit project,” use existing rubric + LLM to produce a score/level and store in a new collection (e.g. `rubric_scores`) and feed into the same evaluation layer.

---

## 4. Phased Implementation Plan

### Phase 1 – Evaluation layer and consistency (foundation)

**Goal:** One place that “evaluates” a student/class using existing data; no new assessment types yet.

1. **Define evaluation service (backend)**  
   - **File:** e.g. `server/src/services/evaluationService.ts`  
   - **Functions (examples):**
     - `getStudentEvaluation(studentId, options?)`: scores from `student_scores` + `assessment_attempts`, grouped by subject/topic/chapter; completion from `lesson_launches`; optional date range.
     - `getClassEvaluation(classId, options?)`: aggregate scores and completion for the class; optional by topic/subject.
   - Reuse existing RBAC: only allow if caller has access to that student/class (reuse `requireStudentAccess`, `requireClassAccess` from LMS).

2. **Expose evaluation APIs**  
   - Under existing LMS or new router, e.g.:
     - `GET /api/lms/students/:studentId/evaluation` → `getStudentEvaluation`
     - `GET /api/lms/classes/:classId/evaluation` → `getClassEvaluation`
   - Return structured JSON: by subject, by topic/chapter, last N scores, completion rate, optional “objectives” when we have that data.

3. **Optional: Enrich score records for evaluation**  
   - When saving in-lesson quiz in `saveQuizScore`, if we have topic/chapter info, add `topic_objective` (from curriculum) to `student_scores` so evaluation can later show “objective met” without schema break.  
   - When creating/editing standalone assessments, allow optional `chapterId` / `topicId` / `curriculum` / `subject` in the API and store them so `getStudentEvaluation` / `getClassEvaluation` can group them with in-lesson data.

4. **Wire dashboards to evaluation API**  
   - Student dashboard: use `GET .../students/:id/evaluation` for “your progress by topic/subject” instead of (or in addition to) raw scores.  
   - Teacher/principal dashboards: use `GET .../classes/:classId/evaluation` for class-level view.  
   - Personalized learning can keep using current analytics or switch to evaluation API for consistency.

**Deliverables:**  
- `evaluationService.ts` with at least student + class evaluation.  
- Two new (or extended) LMS routes.  
- Dashboards (and optionally personalized learning) using the new APIs.  
- Optional: `student_scores` and `assessments` schema extensions; no breaking changes.

---

### Phase 2 – Learning objectives and “objective met”

**Goal:** Tie assessments to learning objectives and surface “objective met” in evaluation.

1. **Curriculum:** Ensure we have a stable way to get “learning objective” per topic (and optionally per chapter). Already in types (`learning_objective`); ensure it’s present in the data we use in VR and in evaluation.

2. **When saving in-lesson score:**  
   - In `saveQuizScore` (or caller), pass and store `learning_objective_id` or `topic_objective` (string) in `student_scores` when available.

3. **Evaluation service:**  
   - In `getStudentEvaluation`, for each topic/chapter, derive “objective met” (e.g. “last/best score ≥ 70%” or “passed at least one quiz for this topic”).  
   - Return a list of objectives with `met: boolean` (and optionally score used).

4. **UI:**  
   - Student/teacher views: show “Learning objectives” and which are met (e.g. in student dashboard or in a dedicated “Progress by objective” section).

**Deliverables:**  
- `student_scores` (and possibly assessment_attempts if linked to topic) carrying objective info.  
- Evaluation response including “objectives” and “met” flags.  
- UI showing objective-level progress.

---

### Phase 3 – Automated assessment generation (optional)

**Goal:** Generate MCQs (and optionally other item types) from lesson content or objectives.

1. **MCQ generation service**  
   - Input: chapter/topic id (or script text / learning objective).  
   - Call LLM to generate N MCQs (question, options, correct index, explanation).  
   - Output: same shape as `ChapterMCQ`; store in `chapter_mcqs` or return for one-off use.

2. **Trigger points**  
   - Curriculum editor: “Generate MCQs for this topic” button.  
   - Or: before VR lesson, if no MCQs exist, call generator and then load as now (optional, can be Phase 4).

3. **Quality and safety**  
   - Validate format (question, 4 options, one correct); optional human review or “regenerate” in editor.

**Deliverables:**  
- `mcqGenerationService.ts` (or under `aiEducation`).  
- API route (e.g. POST) and optional UI in curriculum/editor to generate and save MCQs.

---

### Phase 4 – Rubric-based evaluation (optional, later)

**Goal:** Use existing rubric generator to score open-ended or project work and feed into evaluation.

1. **New submission type**  
   - e.g. “Rubric assignment”: teacher attaches a rubric (from existing generator), student submits text or file.

2. **LLM scoring**  
   - For each criterion, LLM chooses level (e.g. Exceeds/Meets/Approaching/Beginning) and optional feedback.  
   - Store result in a new collection (e.g. `rubric_scores` or extend `assessment_attempts` with a new type).

3. **Evaluation layer**  
   - Include rubric scores in `getStudentEvaluation` / `getClassEvaluation` so one report shows both quiz and rubric outcomes.

---

## 5. Recommended Order of Work

- **Start with Phase 1** (evaluation service + APIs + dashboard wiring). This gives immediate value: one place for “how is this student/class doing?” and sets the pattern for all future assessment types.
- **Then Phase 2** (objectives and “objective met”) so progress is interpretable in terms of curriculum goals.
- **Phase 3 and 4** can follow based on product priority (auto-MCQs for content scaling, rubric for open-ended work).

---

## 6. File and Route Checklist (Phase 1)

| Item | Action |
|------|--------|
| `server/src/services/evaluationService.ts` | **Create**: getStudentEvaluation, getClassEvaluation |
| `server/src/routes/lms.ts` (or new `evaluation.ts`) | **Add**: GET students/:id/evaluation, GET classes/:id/evaluation |
| RBAC | Reuse requireStudentAccess, requireClassAccess |
| `server/client` dashboards | **Update**: StudentDashboard, TeacherDashboard, etc. to call new APIs where appropriate |
| `lessonTrackingService.saveQuizScore` | **Optional**: accept and store topic_objective / learning_objective_id |
| Assessment create/update API | **Optional**: accept chapterId, topicId, curriculum, subject for standalone assessments |

---

## 7. Summary

- **Automated assessment** today = auto-grading (already in place). Next step = optional **auto-generation** of MCQs (Phase 3).  
- **Evaluation** = new **evaluation layer** that reads all score and progress data and answers “how is the student/class doing?” by topic, subject, and (later) by learning objective.  
- Implementing **Phase 1** (evaluation service + APIs + dashboard integration) first gives a clear, scalable foundation; **Phase 2** adds learning objectives; **Phase 3/4** add automation and rubric-based evaluation when needed.

If you want to proceed, the next concrete step is implementing **Phase 1**: add `evaluationService.ts` and the two evaluation endpoints, then wire one dashboard (e.g. Student Dashboard) to the new API.
