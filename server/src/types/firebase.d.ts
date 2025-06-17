declare module '../config/firebase' {
  import { Firestore } from 'firebase-admin/firestore';
  export const db: Firestore;
} 