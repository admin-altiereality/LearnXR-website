import { addDoc, collection, getDocs, orderBy, query, where, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Skybox } from '../types/firebase';

export const skyboxService = {
  async createSkybox(userId: string, skyboxData: Partial<Skybox>): Promise<string> {
    const skyboxRef = collection(db, 'skyboxes');
    const newSkybox = {
      userId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...skyboxData
    };
    
    const docRef = await addDoc(skyboxRef, newSkybox);
    return docRef.id;
  },

  async updateSkybox(skyboxId: string, updateData: Partial<Skybox>): Promise<void> {
    const skyboxRef = doc(db, 'skyboxes', skyboxId);
    await updateDoc(skyboxRef, updateData);
  },

  async getUserSkyboxes(userId: string): Promise<Skybox[]> {
    const skyboxRef = collection(db, 'skyboxes');
    const q = query(
      skyboxRef,
      where('userId', '==', userId),
      where('status', '==', 'complete'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Skybox));
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
    const skyboxRef = doc(db, 'skyboxes', skyboxId);
    await updateDoc(skyboxRef, {
      status,
      updatedAt: serverTimestamp(),
      ...additionalData
    });
  },

  async getSkyboxById(skyboxId: string): Promise<Skybox | null> {
    const skyboxRef = doc(db, 'skyboxes', skyboxId);
    const snapshot = await getDoc(skyboxRef);
    
    if (!snapshot.exists()) return null;
    
    return {
      id: snapshot.id,
      ...snapshot.data()
    } as Skybox;
  }
}; 