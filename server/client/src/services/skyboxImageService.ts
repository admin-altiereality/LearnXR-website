/**
 * Skybox Image Service
 * 
 * Handles uploading and replacing equirectangular skybox images
 */

import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, updateDoc, setDoc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_SKYBOX_GLB_URLS = 'skybox_glb_urls';

export interface SkyboxImageUploadOptions {
  chapterId: string;
  topicId: string;
  file: File;
  userId: string;
  existingSkyboxId?: string; // If replacing existing skybox
}

export interface SkyboxImageUploadResult {
  success: boolean;
  skyboxId?: string;
  imageUrl?: string;
  previewUrl?: string;
  error?: string;
  warning?: string; // Optional warning message (non-blocking)
}

/**
 * Check image aspect ratio (informational only - no blocking)
 * Returns a warning message if aspect ratio is not close to 2:1, but doesn't block upload
 */
export async function checkImageAspectRatio(file: File): Promise<{ warning?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const aspectRatio = img.width / img.height;
      const expectedRatio = 2; // Equirectangular images are ideally 2:1
      const tolerance = 0.2; // 20% tolerance for warning
      
      if (Math.abs(aspectRatio - expectedRatio) > tolerance) {
        resolve({
          warning: `Note: Image aspect ratio is ${aspectRatio.toFixed(2)}:1 (${img.width}x${img.height}). Equirectangular images work best at 2:1, but this image will still be used.`
        });
      } else {
        resolve({}); // No warning
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({}); // Don't block on image load error
    };
    
    img.src = url;
  });
}

/**
 * Upload and replace skybox image
 */
export async function uploadSkyboxImage(
  options: SkyboxImageUploadOptions
): Promise<SkyboxImageUploadResult> {
  const { chapterId, topicId, file, userId, existingSkyboxId } = options;
  
  // Note: localPrompt is not available here, will be set from chapter document

  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
      };
    }

    // Validate file size (max 50MB for skybox images)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File size too large. Maximum size is 50MB. Current: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      };
    }

    // Check aspect ratio (informational warning only, doesn't block)
    let aspectWarning: string | undefined;
    const aspectCheck = await checkImageAspectRatio(file);
    if (aspectCheck.warning) {
      aspectWarning = aspectCheck.warning;
      console.log('ℹ️ Aspect ratio warning:', aspectWarning);
      // Note: We continue with upload even if aspect ratio is not ideal
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `skybox_${chapterId}_${topicId}_${timestamp}.${fileExtension}`;
    const storagePath = `skyboxes/${chapterId}/${topicId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Upload to Firebase Storage
    console.log('📤 Uploading skybox image to:', storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    console.log('✅ Skybox image uploaded:', downloadUrl);

    // Generate or use existing skybox ID
    const skyboxId = existingSkyboxId || uuidv4();

    // Find existing skybox_glb_urls document for this topic
    const skyboxQuery = query(
      collection(db, COLLECTION_SKYBOX_GLB_URLS),
      where('chapter_id', '==', chapterId),
      where('topic_id', '==', topicId)
    );
    const existingDocs = await getDocs(skyboxQuery);
    
    let skyboxDocRef: any;
    const skyboxData: any = {
      chapter_id: chapterId,
      topic_id: topicId,
      skybox_id: skyboxId,
      glb_url: downloadUrl, // Store equirectangular image URL as glb_url
      preview_url: downloadUrl, // Also use as preview
      prompt_used: 'User uploaded equirectangular image',
      status: 'complete',
      updated_at: serverTimestamp(),
    };

    if (!existingDocs.empty) {
      // Update existing document (use first match)
      skyboxDocRef = doc(db, COLLECTION_SKYBOX_GLB_URLS, existingDocs.docs[0].id);
      await updateDoc(skyboxDocRef, skyboxData);
      console.log('✅ Updated existing skybox_glb_urls document:', existingDocs.docs[0].id);
    } else {
      // Create new document
      skyboxDocRef = doc(collection(db, COLLECTION_SKYBOX_GLB_URLS));
      await setDoc(skyboxDocRef, {
        ...skyboxData,
        created_at: serverTimestamp(),
      });
      console.log('✅ Created new skybox_glb_urls document:', skyboxDocRef.id);
    }

    // Update chapter document to reference the skybox
    // This ensures the skybox is linked to the topic and reflects everywhere
    const chapterRef = doc(db, 'curriculum_chapters', chapterId);
    const chapterSnap = await getDoc(chapterRef);
    
    if (chapterSnap.exists()) {
      const chapter = chapterSnap.data();
      const topics = chapter.topics || [];
      const topicIndex = topics.findIndex((t: any) => t.topic_id === topicId);
      
      if (topicIndex !== -1) {
        const updatedTopics = [...topics];
        const currentTopic = updatedTopics[topicIndex];
        const currentSkyboxIds = currentTopic.skybox_ids || [];
        
        // Ensure skyboxId is in the array (no duplicates)
        const updatedSkyboxIds = currentSkyboxIds.includes(skyboxId) 
          ? currentSkyboxIds 
          : [...currentSkyboxIds, skyboxId];
        
        // Get current prompt from topic if available
        const currentPrompt = currentTopic.in3d_prompt || '';
        
        updatedTopics[topicIndex] = {
          ...currentTopic,
          // Update sharedAssets (language-independent, used by all lesson players)
          sharedAssets: {
            ...(currentTopic.sharedAssets || {}),
            skybox_id: skyboxId,
          },
          // Legacy fields for backward compatibility (used by VR/XR players)
          skybox_id: skyboxId,
          skybox_ids: updatedSkyboxIds,
          skybox_url: downloadUrl, // Used by VRLessonPlayer and MainSection
          skybox_glb_url: downloadUrl, // Used by XRLessonPlayerV3
          status: 'generated',
          generatedAt: new Date().toISOString(),
        };

        await updateDoc(chapterRef, {
          topics: updatedTopics,
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Updated chapter document with skybox reference - changes will reflect everywhere');
        
        // Also update the prompt_used in skybox_glb_urls if we have a prompt
        if (currentPrompt && skyboxDocRef) {
          await updateDoc(skyboxDocRef, {
            prompt_used: currentPrompt,
            updated_at: serverTimestamp(),
          });
          console.log('✅ Updated skybox_glb_urls with prompt from topic');
        }

        await updateDoc(chapterRef, {
          topics: updatedTopics,
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Updated chapter document with skybox reference - changes will reflect everywhere');
      } else {
        console.warn('⚠️ Topic not found in chapter document');
      }
    } else {
      console.warn('⚠️ Chapter document not found');
    }

    return {
      success: true,
      skyboxId,
      imageUrl: downloadUrl,
      previewUrl: downloadUrl,
      warning: aspectWarning, // Include warning if aspect ratio is off
    };
  } catch (error) {
    console.error('❌ Error uploading skybox image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload skybox image'
    };
  }
}
