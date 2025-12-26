/**
 * Migration Script: Backfill Style Usage Statistics
 * 
 * This script migrates existing style usage data from the skyboxes collection
 * to the new style_usage_stats collection. Run this once to initialize the
 * style usage tracking system with historical data.
 * 
 * Usage:
 *   - Deploy as a Firebase Function
 *   - Call via HTTP: POST /api/skybox/migrate-style-usage
 *   - Or run locally with Firebase Admin SDK
 */

import * as admin from 'firebase-admin';

/**
 * Migrate style usage statistics from existing skyboxes
 * @param dryRun - If true, only count without writing (default: false)
 * @returns Migration statistics
 */
export async function migrateStyleUsage(dryRun: boolean = false): Promise<{
  success: boolean;
  totalSkyboxes: number;
  completedSkyboxes: number;
  stylesProcessed: number;
  styleCounts: Record<string, number>;
  errors: string[];
}> {
  const db = admin.firestore();
  const errors: string[] = [];
  const styleCounts: Record<string, number> = {};
  
  try {
    console.log('🔄 Starting style usage migration...');
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (will write to Firestore)'}`);
    
    // Get all completed skyboxes
    const skyboxesRef = db.collection('skyboxes');
    const completedQuery = skyboxesRef.where('status', '==', 'completed');
    const snapshot = await completedQuery.get();
    
    console.log(`📊 Found ${snapshot.size} completed skyboxes`);
    
    let processedCount = 0;
    let stylesProcessed = 0;
    
    // Process in batches to avoid overwhelming Firestore
    const batchSize = 100;
    const docs = snapshot.docs;
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(docs.length / batchSize)} (${batch.length} skyboxes)`);
      
      // Count style usage in this batch
      batch.forEach((doc) => {
        const data = doc.data();
        const styleId = data.style_id;
        
        if (styleId !== null && styleId !== undefined) {
          const styleIdStr = styleId.toString();
          styleCounts[styleIdStr] = (styleCounts[styleIdStr] || 0) + 1;
          processedCount++;
        }
      });
      
      // If not dry run, update style usage stats
      if (!dryRun) {
        // Update style usage stats for this batch
        const updatePromises = Object.entries(styleCounts).map(async ([styleId, count]) => {
          try {
            // Only increment for styles in this batch that we haven't processed yet
            // We'll do a final update at the end
            return { styleId, count };
          } catch (error) {
            errors.push(`Error processing style ${styleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
          }
        });
        
        await Promise.all(updatePromises);
      }
    }
    
    // Final update: set the total counts for each style
    if (!dryRun) {
      console.log('💾 Writing style usage statistics to Firestore...');
      
      const finalUpdatePromises = Object.entries(styleCounts).map(async ([styleId, count]) => {
        try {
          const styleUsageRef = db.collection('style_usage_stats').doc(styleId);
          
          // Use transaction to set the count
          await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(styleUsageRef);
            
            if (doc.exists) {
              // If document exists, add to existing count
              const existingCount = doc.data()?.usageCount || 0;
              transaction.update(styleUsageRef, {
                usageCount: existingCount + count,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              // Create new document
              transaction.set(styleUsageRef, {
                styleId: styleId,
                usageCount: count,
                firstUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          
          stylesProcessed++;
          return true;
        } catch (error) {
          errors.push(`Error updating style ${styleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return false;
        }
      });
      
      await Promise.all(finalUpdatePromises);
    } else {
      // In dry run, just count unique styles
      stylesProcessed = Object.keys(styleCounts).length;
    }
    
    const result = {
      success: errors.length === 0,
      totalSkyboxes: snapshot.size,
      completedSkyboxes: processedCount,
      stylesProcessed,
      styleCounts,
      errors
    };
    
    console.log('✅ Migration completed!');
    console.log(`   Total skyboxes: ${result.totalSkyboxes}`);
    console.log(`   Completed skyboxes with style_id: ${result.completedSkyboxes}`);
    console.log(`   Unique styles: ${result.stylesProcessed}`);
    console.log(`   Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.error('⚠️ Errors during migration:');
      result.errors.forEach((error, index) => {
        console.error(`   ${index + 1}. ${error}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      totalSkyboxes: 0,
      completedSkyboxes: 0,
      stylesProcessed: 0,
      styleCounts: {},
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

