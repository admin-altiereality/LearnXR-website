/**
 * School Management Service
 * 
 * Provides functions for creating and managing schools.
 * Access: Admin/Superadmin only
 */

import { collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { School } from '../types/lms';
import type { UserProfile } from '../utils/rbac';
import { toast } from 'react-toastify';

/**
 * Create a new school
 * Access: Admin/Superadmin only
 */
export async function createSchool(
  profile: UserProfile | null,
  schoolData: {
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
    schoolType?: string;
  }
): Promise<string | null> {
  if (!profile) {
    toast.error('Authentication required');
    return null;
  }

  // Only admin and superadmin can create schools
  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Only admins can create schools');
    return null;
  }

  if (!schoolData.name.trim()) {
    toast.error('School name is required');
    return null;
  }

  try {
    // Check if school with same name already exists
    const existingQuery = query(
      collection(db, 'schools'),
      where('name', '==', schoolData.name.trim())
    );
    const existing = await getDocs(existingQuery);
    
    if (!existing.empty) {
      toast.error('A school with this name already exists');
      return null;
    }

    const schoolRef = doc(collection(db, 'schools'));
    const newSchool: Omit<School, 'id'> = {
      name: schoolData.name.trim(),
      address: schoolData.address || '',
      city: schoolData.city || '',
      state: schoolData.state || '',
      pincode: schoolData.pincode || '',
      contactPerson: schoolData.contactPerson || '',
      contactPhone: schoolData.contactPhone || '',
      website: schoolData.website || '',
      boardAffiliation: schoolData.boardAffiliation || '',
      establishedYear: schoolData.establishedYear || '',
      schoolType: schoolData.schoolType || '',
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      createdBy: profile.uid,
    };

    await setDoc(schoolRef, newSchool);
    toast.success(`School "${schoolData.name}" created successfully`);
    return schoolRef.id;
  } catch (error: any) {
    console.error('Error creating school:', error);
    toast.error(`Failed to create school: ${error.message}`);
    return null;
  }
}

/**
 * Update an existing school
 * Access: Admin/Superadmin only
 */
export async function updateSchool(
  profile: UserProfile | null,
  schoolId: string,
  schoolData: Partial<Omit<School, 'id' | 'createdAt' | 'createdBy'>>
): Promise<boolean> {
  if (!profile) {
    toast.error('Authentication required');
    return false;
  }

  // Only admin and superadmin can update schools
  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Only admins can update schools');
    return false;
  }

  try {
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (!schoolDoc.exists()) {
      toast.error('School not found');
      return false;
    }

    await updateDoc(schoolRef, {
      ...schoolData,
      updatedAt: serverTimestamp(),
    });

    toast.success('School updated successfully');
    return true;
  } catch (error: any) {
    console.error('Error updating school:', error);
    toast.error(`Failed to update school: ${error.message}`);
    return false;
  }
}

/**
 * Get all schools
 * Access: Admin/Superadmin only
 */
export async function getAllSchools(profile: UserProfile | null): Promise<School[]> {
  if (!profile) return [];

  // Only admin and superadmin can view all schools
  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    return [];
  }

  try {
    const schoolsQuery = query(collection(db, 'schools'));
    const snapshot = await getDocs(schoolsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as School[];
  } catch (error) {
    console.error('Error fetching schools:', error);
    return [];
  }
}

/**
 * Get school by ID
 */
export async function getSchoolById(schoolId: string): Promise<School | null> {
  try {
    const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
    if (!schoolDoc.exists()) {
      return null;
    }
    return {
      id: schoolDoc.id,
      ...schoolDoc.data(),
    } as School;
  } catch (error) {
    console.error('Error fetching school:', error);
    return null;
  }
}
