/**
 * LMS (Learning Management System) Type Definitions
 * 
 * This file contains all TypeScript interfaces for the multi-school LMS architecture,
 * including schools, classes, lesson launches, and student scores.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * School entity
 * Represents a school/organization in the LMS
 */
export interface School {
  id: string; // Auto-generated document ID
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactPerson?: string;
  contactPhone?: string;
  website?: string;
  boardAffiliation?: string;
  establishedYear?: string;
  schoolType?: string; // e.g., "public", "private", "international"
  principal_id?: string; // Principal UID assigned to this school
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // School approval status
  schoolCode?: string; // Unique 6-character school code for teacher/student onboarding
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  createdBy: string; // Principal/Admin UID who created the school
}

/**
 * Class entity
 * Represents a class/section within a school
 */
export interface Class {
  id: string; // Auto-generated document ID
  school_id: string; // Reference to schools collection
  class_name: string; // e.g., "Class 8A", "Section B"
  curriculum: string; // e.g., "CBSE", "RBSE"
  subject?: string; // Optional: subject-specific class
  teacher_ids: string[]; // Array of teacher UIDs (all teachers in the class)
  class_teacher_id?: string; // Primary class teacher who can approve students (one per class)
  shared_with_teachers?: string[]; // Array of teacher UIDs who have been granted access to view this class data
  student_ids: string[]; // Array of student UIDs
  academic_year?: string; // e.g., "2024-2025"
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  createdBy: string; // Principal/Teacher UID
}

/**
 * Lesson Launch entity
 * Tracks when a student launches/completes a lesson
 */
export interface LessonLaunch {
  id: string; // Auto-generated: `${student_id}_${chapter_id}_${topic_id}_${timestamp}`
  student_id: string;
  school_id: string;
  class_id?: string;
  chapter_id: string;
  topic_id: string;
  curriculum: string;
  class_name: string; // Student's class name (e.g., "8")
  subject: string;
  launched_at: Timestamp | string;
  completed_at?: Timestamp | string;
  completion_status: 'in_progress' | 'completed' | 'abandoned';
  duration_seconds?: number;
}

/**
 * Student Score entity
 * Tracks quiz scores and attempts for students
 */
export interface StudentScore {
  id: string; // `${student_id}_${chapter_id}_${topic_id}_${attempt_number}`
  student_id: string;
  school_id: string;
  class_id?: string;
  chapter_id: string;
  topic_id: string;
  curriculum: string;
  class_name: string; // Student's class name (e.g., "8")
  subject: string;
  attempt_number: number;
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  answers: Record<string, number>;
  completed_at: Timestamp | string;
  time_taken_seconds?: number;
  /** Learning objective text for this topic (optional, for evaluation) */
  topic_objective?: string;
}

/**
 * Student entity (extended user profile for students)
 */
export interface Student {
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  school_id?: string;
  class_ids?: string[];
  teacher_id?: string;
  role: 'student';
}

/**
 * Teacher entity (extended user profile for teachers)
 */
export interface Teacher {
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  school_id?: string;
  managed_class_ids?: string[];
  role: 'teacher';
}

/**
 * Principal entity (extended user profile for principals)
 */
export interface Principal {
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  managed_school_id?: string;
  role: 'principal';
}

// =============================================================================
// Class Launch – Sessions and live progress
// =============================================================================

/** Payload when teacher launches a curriculum lesson to the class */
export interface LaunchedLesson {
  chapter_id: string;
  topic_id: string;
  curriculum?: string;
  class_name?: string;
  subject?: string;
}

/** Payload when teacher sends current Create-page scene to the class */
export interface LaunchedScene {
  type: 'create_scene';
  skybox_id?: string | null;
  skybox_glb_url?: string;
  /** Equirectangular image URL for 360 viewer (optional; used by class-scene viewer) */
  skybox_image_url?: string;
  name?: string;
}

/** Status of a class session */
export type ClassSessionStatus = 'waiting' | 'active' | 'ended';

/**
 * Class session – teacher starts one per class; students join by code.
 * When teacher launches a lesson or scene, all joined students receive it.
 */
export interface ClassSession {
  id: string;
  teacher_uid: string;
  school_id: string;
  class_id: string;
  status: ClassSessionStatus;
  /** Short code for students to join (e.g. 6-char alphanumeric) */
  session_code: string;
  /** Set when teacher launches a curriculum lesson */
  launched_lesson: LaunchedLesson | null;
  /** Set when teacher sends scene from Create page */
  launched_scene: LaunchedScene | null;
  /** Teacher-controlled view (hlookat, vlookat) for student sync in Krpano lessons */
  teacher_view?: { hlookat: number; vlookat: number; fov?: number } | null;
  /** Student UIDs removed by teacher from this session (kicked out) */
  removed_student_uids?: string[];
  created_at: Timestamp | string;
  updated_at: Timestamp | string;
}

/**
 * Student progress within a class session (subcollection progress/{student_uid}).
 * Teacher sees live phase per student.
 */
export type SessionLessonPhase =
  | 'idle'
  | 'loading'
  | 'intro'
  | 'explanation'
  | 'exploration'
  | 'outro'
  | 'quiz'
  | 'completed';

/** Per-question result for teacher quiz analytics */
export interface SessionQuizAnswer {
  question_index: number;
  correct: boolean;
  selected_option_index: number;
}

/** Student’s current 360° view (for teacher “see what they see” preview) */
export interface SessionStudentView {
  hlookat: number;
  vlookat: number;
  fov?: number;
}

export interface SessionStudentProgress {
  student_uid: string;
  display_name?: string;
  /** Student email (for teacher display when name is not set) */
  email?: string;
  phase: SessionLessonPhase;
  /** Optional link to lesson_launches doc for LMS */
  launch_id?: string | null;
  last_updated: Timestamp | string;
  /** Set when student completes the lesson quiz (phase === 'completed') */
  quiz_score?: number | null;
  quiz_total?: number | null;
  quiz_answers?: SessionQuizAnswer[] | null;
  /** Student’s current view in 360° lesson (hlookat, vlookat, fov) for teacher preview */
  student_view?: SessionStudentView | null;
}
