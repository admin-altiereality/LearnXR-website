import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Skybox } from '../types/firebase';

export const skyboxService = {
  async createSkybox(userId: string, skyboxData: Partial<Skybox>): Promise<string> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const skyboxRef = collection(db, 'skyboxes');
      const newSkybox = {
        userId,
        createdAt: new Date().toISOString(),
        status: 'pending',
        ...skyboxData
      };
      
      const docRef = await addDoc(skyboxRef, newSkybox);
      return docRef.id;
    } catch (error) {
      console.error('Error creating skybox:', error);
      throw error;
    }
  },

  async updateSkybox(skyboxId: string, updateData: Partial<Skybox>): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const skyboxRef = doc(db, 'skyboxes', skyboxId);
      await updateDoc(skyboxRef, updateData);
    } catch (error) {
      console.error('Error updating skybox:', error);
      throw error;
    }
  },

  async getUserSkyboxes(userId: string): Promise<Skybox[]> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const skyboxRef = collection(db, 'skyboxes');
      const q = query(
        skyboxRef,
        where('userId', '==', userId),
        where('status', '==', 'complete'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Skybox[];
    } catch (error) {
      console.error('Error getting user skyboxes:', error);
      throw error;
    }
  },

  async getSimilarSkyboxes(userId: string, metadata: Partial<Skybox['metadata']>): Promise<Skybox[]> {
    const skyboxRef = collection(db, 'skyboxes');
    const q = query(
      skyboxRef,
      where('userId', '==', userId),
      where('metadata.theme', '==', metadata.theme),
      where('status', '==', 'complete'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Skybox));
  },

  async updateSkyboxStatus(skyboxId: string, status: string, additionalData: Partial<Skybox> = {}): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const skyboxRef = doc(db, 'skyboxes', skyboxId);
      await updateDoc(skyboxRef, {
        status,
        updatedAt: serverTimestamp(),
        ...additionalData
      });
    } catch (error) {
      console.error('Error updating skybox status:', error);
      throw error;
    }
  },

  async getSkyboxById(skyboxId: string): Promise<Skybox | null> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const skyboxRef = doc(db, 'skyboxes', skyboxId);
      const snapshot = await getDoc(skyboxRef);
      
      if (!snapshot.exists()) return null;
      
      return {
        id: snapshot.id,
        ...snapshot.data()
      } as Skybox;
    } catch (error) {
      console.error('Error getting skybox by ID:', error);
      throw error;
    }
  }
}; 