/**
 * Style Usage Tracker Utility
 * Tracks the number of times each skybox style is used across all users
 */

import * as admin from 'firebase-admin';

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
    const db = admin.firestore();
    const styleIdStr = styleId.toString();
    const styleUsageRef = db.collection(STYLE_USAGE_COLLECTION).doc(styleIdStr);

    // Use Firestore transaction to safely increment
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(styleUsageRef);
      
      if (doc.exists) {
        const currentCount = doc.data()?.usageCount || 0;
        transaction.update(styleUsageRef, {
          usageCount: currentCount + incrementBy,
          lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new document if it doesn't exist
        transaction.set(styleUsageRef, {
          styleId: styleIdStr,
          usageCount: incrementBy,
          firstUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
    const db = admin.firestore();
    const styleIdStr = styleId.toString();
    const styleUsageRef = db.collection(STYLE_USAGE_COLLECTION).doc(styleIdStr);
    const doc = await styleUsageRef.get();

    if (doc.exists) {
      return doc.data()?.usageCount || 0;
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
    const db = admin.firestore();
    const usageCounts: Record<string, number> = {};

    // Fetch all style usage documents in parallel
    const promises = styleIds.map(async (styleId) => {
      const styleIdStr = styleId.toString();
      const styleUsageRef = db.collection(STYLE_USAGE_COLLECTION).doc(styleIdStr);
      const doc = await styleUsageRef.get();
      usageCounts[styleIdStr] = doc.exists ? (doc.data()?.usageCount || 0) : 0;
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
    const db = admin.firestore();
    const snapshot = await db.collection(STYLE_USAGE_COLLECTION).get();
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

