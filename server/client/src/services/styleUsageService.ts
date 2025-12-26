/**
 * Style Usage Service
 * Client-side service to track and fetch style usage statistics
 */

import { doc, getDoc, setDoc, runTransaction, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const STYLE_USAGE_COLLECTION = 'style_usage_stats';

/**
 * Increment the usage count for a specific style
 * @param styleId - The ID of the style to increment
 * @param incrementBy - Amount to increment (default: 1)
 */
export async function incrementStyleUsage(
  styleId: number | string,
  incrementBy: number = 1
): Promise<void> {
  try {
    if (!db) {
      console.warn('⚠️ Firestore db is not available, cannot track style usage');
      return;
    }

    const styleIdStr = styleId.toString();
    const styleUsageRef = doc(db, STYLE_USAGE_COLLECTION, styleIdStr);

    // Use Firestore transaction to safely increment
    await runTransaction(db, async (transaction) => {
      const styleUsageDoc = await transaction.get(styleUsageRef);
      
      if (styleUsageDoc.exists()) {
        const currentCount = styleUsageDoc.data()?.usageCount || 0;
        transaction.update(styleUsageRef, {
          usageCount: currentCount + incrementBy,
          lastUsedAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        // Create new document if it doesn't exist
        transaction.set(styleUsageRef, {
          styleId: styleIdStr,
          usageCount: incrementBy,
          firstUsedAt: new Date(),
          lastUsedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    console.log(`✅ Incremented style usage for style ${styleIdStr} by ${incrementBy}`);
  } catch (error) {
    console.error(`❌ Error incrementing style usage for style ${styleId}:`, error);
    // Don't throw - we don't want to break the main flow if tracking fails
  }
}

/**
 * Get usage count for a specific style
 * @param styleId - The ID of the style
 * @returns The usage count, or 0 if not found
 */
export async function getStyleUsageCount(
  styleId: number | string
): Promise<number> {
  try {
    if (!db) {
      console.warn('⚠️ Firestore db is not available');
      return 0;
    }

    const styleIdStr = styleId.toString();
    const styleUsageRef = doc(db, STYLE_USAGE_COLLECTION, styleIdStr);
    const styleUsageDoc = await getDoc(styleUsageRef);

    if (styleUsageDoc.exists()) {
      return styleUsageDoc.data()?.usageCount || 0;
    }
    return 0;
  } catch (error) {
    console.error(`❌ Error getting style usage count for style ${styleId}:`, error);
    return 0;
  }
}

/**
 * Get usage counts for multiple styles
 * @param styleIds - Array of style IDs
 * @returns Object mapping style IDs to usage counts
 */
export async function getStyleUsageCounts(
  styleIds: (number | string)[]
): Promise<Record<string, number>> {
  try {
    if (!db) {
      console.warn('⚠️ Firestore db is not available');
      return {};
    }

    const usageCounts: Record<string, number> = {};

    // Fetch all style usage documents in parallel
    const promises = styleIds.map(async (styleId) => {
      const styleIdStr = styleId.toString();
      const styleUsageRef = doc(db, STYLE_USAGE_COLLECTION, styleIdStr);
      const styleUsageDoc = await getDoc(styleUsageRef);
      usageCounts[styleIdStr] = styleUsageDoc.exists() ? (styleUsageDoc.data()?.usageCount || 0) : 0;
    });

    await Promise.all(promises);
    return usageCounts;
  } catch (error) {
    console.error(`❌ Error getting style usage counts:`, error);
    return {};
  }
}

/**
 * Get all style usage statistics
 * @returns Object mapping style IDs to usage counts
 */
export async function getAllStyleUsageStats(): Promise<Record<string, number>> {
  try {
    if (!db) {
      console.warn('⚠️ Firestore db is not available');
      return {};
    }

    const styleUsageRef = collection(db, STYLE_USAGE_COLLECTION);
    const snapshot = await getDocs(styleUsageRef);
    const stats: Record<string, number> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      stats[doc.id] = data.usageCount || 0;
    });

    return stats;
  } catch (error) {
    console.error(`❌ Error getting all style usage stats:`, error);
    return {};
  }
}

