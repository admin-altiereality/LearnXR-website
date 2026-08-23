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
  partner_id?: string; // Channel partner who onboarded this school
  source?: 'partner_demo' | 'self_serve' | 'admin';
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

/** Default / curriculum path uses Firestore topics; 360 video tours use sentinel IDs + lesson_type;
 * `user_generated` reads from `user_generated_lessons/{chapter_id}` (chapter_id === topic_id === lessonId). */
export type LaunchedLessonType = 'curriculum' | 'vr360_video' | 'user_generated' | 'licensed_3d' | 'licensed_embed' | 'licensed_link';

/** Payload when teacher launches a curriculum lesson to the class */
export interface LaunchedLesson {
  chapter_id: string;
  topic_id: string;
  curriculum?: string;
  class_name?: string;
  subject?: string;
  /** Language for the launched lesson (e.g. 'en' | 'hi'); used for bundle and TTS */
  lang?: string;
  /**
   * When `vr360_video`, clients open /vr360-videotour and skip getLessonBundle.
   * `chapter_id` is typically `__vr360__`, `topic_id` like `tour-1`.
   */
  lesson_type?: LaunchedLessonType;
  /** Tour id from config (e.g. "1".."5") when `lesson_type === 'vr360_video'` */
  vr360_tour_id?: string;
  /** Entitlement-checked content ID for licensed native or hosted launches. */
  licensed_content_id?: string;
  /** Display title for licensed or generated launches. */
  title?: string;
  /** Unique dispatch ID so relaunching the same licensed item is not de-duplicated. */
  launch_id?: string;
}

export interface TeacherContentState {
  licensed_content_id: string;
  revision?: string;
  selected_part_id?: string | null;
  visible_layer_ids?: string[];
  exploded?: boolean;
  animation_clip?: string | null;
  animation_time?: number;
  animation_playing?: boolean;
  model_transform?: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  };
  locked?: boolean;
  sync_id: number;
}

/** Payload when teacher sends current Create-page scene to the class */
export interface LaunchedScene {
  type: 'create_scene';
  skybox_id?: string | null;
  skybox_glb_url?: string;
  /** Equirectangular image URL for 360 viewer (optional; used by class-scene viewer) */
  skybox_image_url?: string;
  /** Meshy-generated GLB URL for KRPano topic.asset_urls (optional). */
  meshy_glb_url?: string | null;
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
  /**
   * Teacher/host-controlled view for student sync (Krpano / 360 video).
   * `sync_id` bumps on explicit “Direct class to my view” so students re-apply
   * even when hlookat/vlookat/fov are unchanged (they may have looked away).
   */
  teacher_view?: TeacherSessionView | null;
  /** Student UIDs removed by teacher from this session (kicked out) */
  removed_student_uids?: string[];
  /** Student UIDs that requested to rejoin after being removed */
  join_requests?: string[];
  /** Teacher-controlled lesson phase – students lock to this when control_students_enabled is true. */
  teacher_controlled_phase?: string | null;
  /** Whether the teacher has "Control Students" mode active (students follow teacher phase). */
  control_students_enabled?: boolean;
  /** Synchronized state for licensed 3D content while teacher control is enabled. */
  teacher_content_state?: TeacherContentState | null;
  /**
   * Teacher-driven playback gate. Absent or `state: 'idle'` means the lesson is
   * held – students load the scene but nothing plays until the teacher presses
   * Play. A late joiner reads this to land on the class's current point.
   */
  teacher_playback?: TeacherPlayback | null;
  /** Names-only lobby roster published by the host so students can see who joined. */
  lobby_roster?: SessionLobbyMember[] | null;
  /** Teacher marker strokes, anchored in panorama sphere coordinates. */
  teacher_annotations?: TeacherAnnotations | null;
  /** Teacher asking the class to move into immersive mode. */
  teacher_immersive_request?: TeacherImmersiveRequest | null;
  /** Partner tenancy metadata for quota-governed demo sessions. */
  partner_id?: string;
  hosted_by_partner?: boolean;
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

/** Teacher-driven playback state broadcast to every student in the session. */
export interface TeacherPlayback {
  /** 'idle' = held, nothing has started yet. */
  state: 'idle' | 'playing' | 'paused';
  phase: SessionLessonPhase | null;
  /** Bumped on every Play/Replay so re-playing the same phase still re-fires. */
  play_token: number;
  /** Date.now() when this state was set. */
  at_ms: number;
}

/**
 * A single teacher marker stroke.
 *
 * Points are stored in PANORAMA sphere coordinates (degrees), not screen pixels,
 * so a circle drawn round an object stays on that object regardless of where each
 * student is looking or what their field of view is.
 */
export interface AnnotationPoint {
  /** ath — horizontal angle, -180..180 */
  a: number;
  /** atv — vertical angle, -90..90 */
  v: number;
}

export interface AnnotationStroke {
  id: string;
  /** 'laser' fades after ttl_ms; 'ink' persists until the teacher clears. */
  mode: 'laser' | 'ink';
  color: string;
  /** Stroke width in px at a reference fov of 90; scaled by 90/fov at render. */
  width: number;
  points: AnnotationPoint[];
  created_ms: number;
  /** Laser only. */
  ttl_ms?: number;
}

/**
 * A mark pinned to a 3D model, stored in the MODEL'S OWN local space so it rotates,
 * drags and re-lays-out with the model. Texture painting was rejected: models are
 * runtime GLBs with no guaranteed UVs, and materials are re-authored on load.
 */
export interface AnnotationModelMark {
  id: string;
  /** krpano hotspot name, e.g. "asset_0". */
  asset_id: string;
  /** Position in the model's local space. */
  x: number;
  y: number;
  z: number;
  color: string;
  created_ms: number;
  ttl_ms?: number;
}

/** Teacher marker state broadcast to the class. */
export interface TeacherAnnotations {
  /** Persistent ink, oldest dropped first once capped. */
  strokes: AnnotationStroke[];
  /** Most recent laser stroke; clients expire it locally from created_ms + ttl_ms. */
  laser: AnnotationStroke | null;
  /** Marks pinned to 3D models. */
  model_marks?: AnnotationModelMark[];
  /** Bumped so clients re-apply even when the stroke list looks unchanged. */
  sync_id: number;
  cleared_at: number;
}

/**
 * Teacher's request that the class move into immersive mode.
 *
 * A browser will not start a WebXR session without a user gesture, and students
 * auto-enter the lesson with zero taps — so this cannot silently force real VR
 * everywhere. It forces the *presentation* (2D chrome hidden) immediately, and
 * drives a one-tap prompt for actual headset entry.
 */
export interface TeacherImmersiveRequest {
  requested: boolean;
  /** Bumped so a student who reloads mid-class re-applies the request. */
  token: number;
  at_ms: number;
}

/** One entry in the waiting-room roster – names only, never scores. */
export interface SessionLobbyMember {
  uid: string;
  name: string;
  /** True once the student's scene and audio have finished loading. */
  ready: boolean;
}

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

/** Host view broadcast to students (orientation + optional force token / playback). */
export interface TeacherSessionView {
  hlookat: number;
  vlookat: number;
  fov?: number;
  /** Monotonic id — changes force students to re-apply even if look-at is identical. */
  sync_id?: number;
  /** Optional 360-video playhead (seconds) when directing a VR360 tour. */
  video_time?: number;
  /** Optional 360-video play/pause when directing a VR360 tour. */
  playing?: boolean;
}

/**
 * Student progress within a class session (subcollection progress/{student_uid}).
 * Teacher sees live phase per student.
 */
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

  // --- Attendance (write-once joined_at; the rest update as the student works) ---
  /** First time this student joined the session. Never overwritten. */
  joined_at?: Timestamp | string | null;
  last_active_at?: Timestamp | string | null;
  left_at?: Timestamp | string | null;
  duration_seconds?: number | null;
  /** True once the student's scene/audio finished loading (drives the lobby). */
  lesson_ready?: boolean;
  /** Set instead of deleting the doc when a teacher removes a student mid-session. */
  removed?: boolean;

  // --- Student signals ---
  hand_raised?: boolean;
  hand_raised_at?: Timestamp | string | null;
  /** How many times this student raised a hand across the session. */
  hand_raise_count?: number;
  signal?: 'help' | 'too_fast' | 'ok' | null;
  signal_at?: Timestamp | string | null;
}
