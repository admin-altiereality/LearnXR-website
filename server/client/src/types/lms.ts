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
  teacher_ids: string[]; // Array of teacher UIDs
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
