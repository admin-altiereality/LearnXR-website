/**
 * Meshy Auto-Rigging & Animation workflow and animation library.
 * See https://docs.meshy.ai/en/api/rigging-and-animation and
 * https://docs.meshy.ai/api/animation-library
 */

import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { meshyApiService } from './meshyApiService';

export interface MeshyAnimationLibraryItem {
  id: number;
  name: string;
  category: string;
  subCategory: string;
}

/** Subset of Meshy animation library (id, name, category, subCategory) for UI picker */
export const MESHY_ANIMATION_LIBRARY: MeshyAnimationLibraryItem[] = [
  { id: 0, name: 'Idle', category: 'DailyActions', subCategory: 'Idle' },
  { id: 1, name: 'Walking_Woman', category: 'WalkAndRun', subCategory: 'Walking' },
  { id: 2, name: 'Alert', category: 'DailyActions', subCategory: 'LookingAround' },
  { id: 4, name: 'Attack', category: 'Fighting', subCategory: 'AttackingwithWeapon' },
  { id: 5, name: 'BackLeft_run', category: 'WalkAndRun', subCategory: 'Running' },
  { id: 16, name: 'RunFast', category: 'WalkAndRun', subCategory: 'Running' },
  { id: 22, name: 'FunnyDancing_01', category: 'Dancing', subCategory: 'Dancing' },
  { id: 25, name: 'Agree_Gesture', category: 'DailyActions', subCategory: 'Interacting' },
  { id: 28, name: 'Big_Wave_Hello', category: 'DailyActions', subCategory: 'Interacting' },
  { id: 30, name: 'Casual_Walk', category: 'WalkAndRun', subCategory: 'Walking' },
  { id: 41, name: 'Formal_Bow', category: 'DailyActions', subCategory: 'Interacting' },
  { id: 49, name: 'Motivational_Cheer', category: 'DailyActions', subCategory: 'Interacting' },
  { id: 59, name: 'Victory_Cheer', category: 'BodyMovements', subCategory: 'Acting' },
  { id: 63, name: 'Arm_Circle_Shuffle', category: 'Dancing', subCategory: 'Dancing' },
  { id: 74, name: 'Gangnam_Groove', category: 'Dancing', subCategory: 'Dancing' },
  { id: 82, name: 'Shake_It_Off_Dance', category: 'Dancing', subCategory: 'Dancing' },
  { id: 87, name: 'Boxing_Practice', category: 'Fighting', subCategory: 'Punching' },
  { id: 96, name: 'Kung_Fu_Punch', category: 'Fighting', subCategory: 'Punching' },
  { id: 106, name: 'Confident_Walk', category: 'WalkAndRun', subCategory: 'Walking' },
  { id: 117, name: 'Red_Carpet_Walk', category: 'WalkAndRun', subCategory: 'Walking' },
];

export interface RigAndAnimateOptions {
  assetId: string;
  glbUrl: string;
  actionId: number;
  collectionName: 'text_to_3d_assets' | 'meshy_assets' | 'avatar_to_3d_assets';
  meshyAssetId?: string;
  onProgress?: (stage: string, progress: number, message: string) => void;
}

export interface RigAndAnimateResult {
  success: boolean;
  animated_glb_url?: string;
  rig_task_id?: string;
  animation_task_id?: string;
  error?: string;
}

const RIG_POLL_INTERVAL_MS = 3000;
const RIG_POLL_MAX_ATTEMPTS = 60;
const ANIM_POLL_INTERVAL_MS = 3000;
const ANIM_POLL_MAX_ATTEMPTS = 60;

export const meshyRiggingAnimationService = {
  MESHY_ANIMATION_LIBRARY,

  /**
   * Run full workflow: rig -> animate -> download -> upload to Storage -> update Firestore.
   */
  async rigAndAnimateAsset(options: RigAndAnimateOptions): Promise<RigAndAnimateResult> {
    const { assetId, glbUrl, actionId, collectionName, meshyAssetId, onProgress } = options;

    if (!glbUrl?.trim()) {
      return { success: false, error: 'GLB URL is required' };
    }

    try {
      onProgress?.('rigging', 5, 'Creating rigging task...');
      const rigCreate = await meshyApiService.createRiggingTask({
        model_url: glbUrl.trim(),
        height_meters: 1.7,
      });
      const rigTaskId = rigCreate.result;
      if (!rigTaskId) {
        return { success: false, error: 'No rigging task ID returned' };
      }

      onProgress?.('rigging', 10, 'Rigging in progress...');
      for (let i = 0; i < RIG_POLL_MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, RIG_POLL_INTERVAL_MS));
        const rig = await meshyApiService.getRiggingTask(rigTaskId);
        const pct = 10 + Math.min(40, (i / RIG_POLL_MAX_ATTEMPTS) * 40);
        onProgress?.('rigging', Math.round(pct), `Rigging... ${rig.progress ?? 0}%`);
        if (rig.status === 'SUCCEEDED') {
          break;
        }
        if (rig.status === 'FAILED' || rig.status === 'CANCELED') {
          const msg = rig.task_error?.message || rig.status;
          return { success: false, error: `Rigging ${msg}`, rig_task_id: rigTaskId };
        }
      }

      const rigFinal = await meshyApiService.getRiggingTask(rigTaskId);
      if (rigFinal.status !== 'SUCCEEDED') {
        return { success: false, error: 'Rigging did not complete in time', rig_task_id: rigTaskId };
      }

      onProgress?.('animation', 55, 'Creating animation task...');
      const animCreate = await meshyApiService.createAnimationTask({
        rig_task_id: rigTaskId,
        action_id: actionId,
      });
      const animTaskId = animCreate.result;
      if (!animTaskId) {
        return { success: false, error: 'No animation task ID returned', rig_task_id: rigTaskId };
      }

      onProgress?.('animation', 60, 'Animating...');
      for (let j = 0; j < ANIM_POLL_MAX_ATTEMPTS; j++) {
        await new Promise(r => setTimeout(r, ANIM_POLL_INTERVAL_MS));
        const anim = await meshyApiService.getAnimationTask(animTaskId);
        const pct = 60 + Math.min(25, (j / ANIM_POLL_MAX_ATTEMPTS) * 25);
        onProgress?.('animation', Math.round(pct), `Animation... ${anim.progress ?? 0}%`);
        if (anim.status === 'SUCCEEDED') {
          break;
        }
        if (anim.status === 'FAILED' || anim.status === 'CANCELED') {
          const msg = anim.task_error?.message || anim.status;
          return {
            success: false,
            error: `Animation ${msg}`,
            rig_task_id: rigTaskId,
            animation_task_id: animTaskId,
          };
        }
      }

      const animFinal = await meshyApiService.getAnimationTask(animTaskId);
      if (animFinal.status !== 'SUCCEEDED' || !animFinal.result?.animation_glb_url) {
        return {
          success: false,
          error: 'Animation did not complete or no GLB URL',
          rig_task_id: rigTaskId,
          animation_task_id: animTaskId,
        };
      }

      const animationGlbUrl = animFinal.result.animation_glb_url;
      onProgress?.('upload', 88, 'Downloading animated model...');

      const res = await fetch(animationGlbUrl);
      if (!res.ok) {
        return {
          success: false,
          error: `Failed to download animation GLB: ${res.status}`,
          rig_task_id: rigTaskId,
          animation_task_id: animTaskId,
        };
      }
      const blob = await res.blob();

      onProgress?.('upload', 92, 'Uploading to storage...');
      const storagePath = `${collectionName}/${assetId}/animated_model.glb`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      const animatedGlbUrl = await getDownloadURL(storageRef);

      onProgress?.('done', 98, 'Saving...');

      const updatePayload: Record<string, unknown> = {
        animated_glb_url: animatedGlbUrl,
        rig_task_id: rigTaskId,
        animation_task_id: animTaskId,
        animation_action_id: actionId,
        updated_at: serverTimestamp(),
      };

      const docRef = doc(db, collectionName, assetId);
      await updateDoc(docRef, updatePayload);

      if (meshyAssetId && (collectionName === 'text_to_3d_assets' || collectionName === 'avatar_to_3d_assets')) {
        const meshyRef = doc(db, 'meshy_assets', meshyAssetId);
        await updateDoc(meshyRef, {
          animated_glb_url: animatedGlbUrl,
          rig_task_id: rigTaskId,
          animation_task_id: animTaskId,
          animation_action_id: actionId,
          updated_at: serverTimestamp(),
        });
      }

      onProgress?.('done', 100, 'Done.');
      return {
        success: true,
        animated_glb_url: animatedGlbUrl,
        rig_task_id: rigTaskId,
        animation_task_id: animTaskId,
      };
    } catch (err: any) {
      const message = err?.message || String(err);
      return { success: false, error: message };
    }
  },
};
