import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  useGLTF,
  useAnimations,
  Html
} from '@react-three/drei';
import * as THREE from 'three';
import { getApiBaseUrl } from '../utils/apiConfig';
import api from '../config/axios';
import { VisemeType, VisemeFrame, VISEME_BLEND_SHAPE_NAMES } from '../services/lipSyncService';
import { quickScanGLTF, GLTFStructure } from '../utils/gltfScanner';

interface TeacherAvatarProps {
  avatarModelUrl?: string; // URL to GLB/GLTF teacher avatar model
  onMessage?: (message: string) => void;
  onResponse?: (response: string) => void;
  onReady?: () => void; // Callback when avatar is ready
  position?: [number, number, number];
  scale?: number;
  className?: string;
  curriculum?: string;
  class?: string;
  subject?: string;
  useAvatarKey?: boolean;
  externalThreadId?: string | null; // If provided, use this thread instead of creating one
}

interface AvatarModelProps {
  modelUrl: string;
  audioUrl: string | null;
  visemes: VisemeFrame[];
  isSpeaking: boolean;
  onTestBodyMovement?: (testFn: () => void) => void;
  onTestAllBlendShapes?: (testFn: () => void) => void;
  onTestLipMovement?: (testFn: () => void) => void;
}

function AvatarModel({ 
  modelUrl, 
  audioUrl, 
  visemes,
  isSpeaking,
  onModelLoad,
  onTestBodyMovement,
  onTestLipMovement
}: AvatarModelProps & { onModelLoad?: () => void }) {
  const { scene, animations } = useGLTF(modelUrl, undefined, undefined, (error) => {
    console.error('❌ Error loading avatar model:', error);
    console.error('   Model URL:', modelUrl);
    console.error('   Full path:', window.location.origin + modelUrl);
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
      console.error('   Stack:', error.stack);
    }
  });
  const { actions } = useAnimations(animations, scene);
  const meshRef = useRef<THREE.Group>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentViseme, setCurrentViseme] = useState<VisemeType>(VisemeType.SILENCE);
  const animationFrameRef = useRef<number | null>(null);
  const [modelCentered, setModelCentered] = useState(false);

  // Fix texture paths and ensure materials are loaded correctly
  useEffect(() => {
    if (!scene) return;

    console.log('🔧 Fixing textures and materials for model...');
    let textureCount = 0;
    let fixedTextureCount = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          
          materials.forEach((material: THREE.Material) => {
            // Fix texture paths - check all texture properties
            const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
            
            textureProps.forEach(prop => {
              if (prop in material) {
                const texture = (material as any)[prop];
                if (texture instanceof THREE.Texture) {
                  textureCount++;
                  
                  // If texture failed to load, try to fix the path
                  if (!texture.image || texture.image.width === 0) {
                    const imagePath = texture.image?.src || texture.source?.data?.src;
                    if (imagePath) {
                      console.log(`   ⚠️  Texture may have failed to load: ${imagePath}`);
                      
                      // Try to construct correct path relative to model location
                      // If model is at /models/teacher-joe/source/teacher-avatar.glb
                      // and texture is referenced as ../textures/file.png
                      // it should resolve to /models/teacher-joe/textures/file.png
                      const modelDir = modelUrl.substring(0, modelUrl.lastIndexOf('/'));
                      const textureName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
                      const possibleTexturePath = `${modelDir}/../textures/${textureName}`;
                      
                      console.log(`   💡 Trying alternative path: ${possibleTexturePath}`);
                      
                      // Create new texture with corrected path
                      const loader = new THREE.TextureLoader();
                      loader.load(
                        possibleTexturePath,
                        (newTexture) => {
                          (material as any)[prop] = newTexture;
                          newTexture.needsUpdate = true;
                          fixedTextureCount++;
                          console.log(`   ✅ Fixed texture: ${textureName}`);
                        },
                        undefined,
                        () => {
                          console.warn(`   ⚠️  Could not load texture from alternative path: ${possibleTexturePath}`);
                        }
                      );
                    }
                  } else {
                    // Texture loaded successfully
                    texture.needsUpdate = true;
                  }
                }
              }
            });
            
            // Ensure material is properly configured
            material.needsUpdate = true;
            if ('side' in material) {
              (material as any).side = THREE.DoubleSide;
            }
          });
        }
      }
    });
    
    console.log(`✅ Texture check complete: ${textureCount} textures found, ${fixedTextureCount} fixed`);
  }, [scene, modelUrl]);

  // Center and scale the model when loaded
  useEffect(() => {
    if (scene && !modelCentered) {
      // Wait a frame to ensure scene is fully loaded
      requestAnimationFrame(() => {
        try {
          // Calculate bounding box
          const box = new THREE.Box3().setFromObject(scene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          // Only center if we have valid dimensions
          if (size.x > 0 && size.y > 0 && size.z > 0) {
            // Calculate scale to fit in view (target height ~2 units)
            const targetHeight = 2;
            const scale = targetHeight / Math.max(size.x, size.y, size.z);
            
            // Center the model at origin
            scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            scene.scale.set(scale, scale, scale);
            
            console.log('✅ Avatar model centered and scaled:', { center, size, scale });
          } else {
            // If no valid bounding box, just center at origin
            scene.position.set(0, 0, 0);
            console.log('✅ Avatar model positioned at origin (no bounding box)');
          }
          
          setModelCentered(true);
          
          if (onModelLoad) {
            console.log('✅ Avatar model loaded successfully');
            onModelLoad();
          }
        } catch (error) {
          console.error('❌ Error centering model:', error);
          // Still mark as loaded even if centering fails
          setModelCentered(true);
          if (onModelLoad) {
            onModelLoad();
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, modelCentered]);

  // AVATURN ARKIT BLEND SHAPE MAPPING
  // Based on Avaturn T2 avatars with ARKit blend shapes
  // Reference: https://docs.avaturn.me/docs/integration/bodies/
  const arkitBlendShapesRef = useRef<{
    jawOpen: number | null;
    mouthSmile: number | null;
    mouthFrown: number | null;
    mouthPucker: number | null;
    mouthRollLower: number | null;
    mouthRollUpper: number | null;
    mouthShrugLower: number | null;
    mouthShrugUpper: number | null;
    mouthClose: number | null;
    jawForward: number | null;
    jawLeft: number | null;
    jawRight: number | null;
  }>({
    jawOpen: null,
    mouthSmile: null,
    mouthFrown: null,
    mouthPucker: null,
    mouthRollLower: null,
    mouthRollUpper: null,
    mouthShrugLower: null,
    mouthShrugUpper: null,
    mouthClose: null,
    jawForward: null,
    jawLeft: null,
    jawRight: null,
  });
  
  // Initialize ARKit blend shapes when mesh is ready
  const initializeARKitBlendShapes = (mesh: THREE.SkinnedMesh): boolean => {
    if (!mesh.morphTargetDictionary) return false;
    
    const dict = mesh.morphTargetDictionary;
    const shapes = arkitBlendShapesRef.current;
    
    // ARKit standard blend shape names (case-insensitive matching)
    const findBlendShape = (names: string[]): number | null => {
      for (const name of names) {
        // Try exact match first
        if (dict[name] !== undefined) return dict[name];
        // Try case-insensitive
        for (const key of Object.keys(dict)) {
          if (key.toLowerCase() === name.toLowerCase()) {
            return dict[key];
          }
        }
      }
      return null;
    };
    
    shapes.jawOpen = findBlendShape(['jawOpen', 'JawOpen', 'JAW_OPEN', 'jaw_open']);
    shapes.mouthSmile = findBlendShape(['mouthSmile', 'MouthSmile', 'MOUTH_SMILE', 'mouth_smile']);
    shapes.mouthFrown = findBlendShape(['mouthFrown', 'MouthFrown', 'MOUTH_FROWN', 'mouth_frown']);
    shapes.mouthPucker = findBlendShape(['mouthPucker', 'MouthPucker', 'MOUTH_PUCKER', 'mouth_pucker']);
    shapes.mouthRollLower = findBlendShape(['mouthRollLower', 'MouthRollLower', 'MOUTH_ROLL_LOWER', 'mouth_roll_lower']);
    shapes.mouthRollUpper = findBlendShape(['mouthRollUpper', 'MouthRollUpper', 'MOUTH_ROLL_UPPER', 'mouth_roll_upper']);
    shapes.mouthShrugLower = findBlendShape(['mouthShrugLower', 'MouthShrugLower', 'MOUTH_SHRUG_LOWER', 'mouth_shrug_lower']);
    shapes.mouthShrugUpper = findBlendShape(['mouthShrugUpper', 'MouthShrugUpper', 'MOUTH_SHRUG_UPPER', 'mouth_shrug_upper']);
    shapes.mouthClose = findBlendShape(['mouthClose', 'MouthClose', 'MOUTH_CLOSE', 'mouth_close']);
    shapes.jawForward = findBlendShape(['jawForward', 'JawForward', 'JAW_FORWARD', 'jaw_forward']);
    shapes.jawLeft = findBlendShape(['jawLeft', 'JawLeft', 'JAW_LEFT', 'jaw_left']);
    shapes.jawRight = findBlendShape(['jawRight', 'JawRight', 'JAW_RIGHT', 'jaw_right']);
    
    const found = Object.values(shapes).filter(v => v !== null).length;
    if (found > 0) {
      console.log(`✅ Found ${found} ARKit blend shapes for Avaturn T2 avatar`);
      if (shapes.jawOpen !== null) console.log(`   ✅ jawOpen at index ${shapes.jawOpen}`);
      if (shapes.mouthSmile !== null) console.log(`   ✅ mouthSmile at index ${shapes.mouthSmile}`);
      if (shapes.mouthPucker !== null) console.log(`   ✅ mouthPucker at index ${shapes.mouthPucker}`);
      if (shapes.mouthClose !== null) console.log(`   ✅ mouthClose at index ${shapes.mouthClose}`);
      return true;
    }
    
    return false;
  };
  
  // Apply viseme to ARKit blend shapes (Avaturn T2 standard)
  const applyVisemeToBlendShapes = (
    mesh: THREE.SkinnedMesh,
    foundViseme: VisemeType,
    logPrefix: string = ''
  ): boolean => {
    if (!mesh.morphTargetInfluences || !mesh.morphTargetDictionary) {
      return false;
    }
    
    const influences = mesh.morphTargetInfluences;
    const shapes = arkitBlendShapesRef.current;
    
    // Initialize ARKit blend shapes if not done yet
    if (shapes.jawOpen === null && shapes.mouthSmile === null) {
      if (!initializeARKitBlendShapes(mesh)) {
        // Fallback: try to find any mouth-related blend shape
        const dict = mesh.morphTargetDictionary;
        const allBlendShapes = Object.keys(dict);
        const mouthKeywords = ['jaw', 'mouth', 'open', 'close'];
        
        for (const bs of allBlendShapes) {
          const lowerBs = bs.toLowerCase();
          if (mouthKeywords.some(kw => lowerBs.includes(kw))) {
            const index = dict[bs];
            if (index !== undefined) {
              // Use first found as jawOpen fallback
              if (shapes.jawOpen === null) {
                shapes.jawOpen = index;
                console.log(`⚠️  Using "${bs}" as jawOpen fallback`);
                break;
              }
            }
          }
        }
      }
    }
    
    // Reset all blend shapes first
    for (let i = 0; i < influences.length; i++) {
      influences[i] = 0;
    }
    
    const visemeTypeName = VisemeType[foundViseme];
    let applied = false;
    
    // Map visemes to ARKit blend shape combinations
    switch (foundViseme) {
      case VisemeType.SILENCE:
        // Closed mouth
        if (shapes.mouthClose !== null) {
          influences[shapes.mouthClose] = 0.8;
          applied = true;
        }
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.0;
          applied = true;
        }
        break;
        
      case VisemeType.A:
        // "Ah" - wide open mouth
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.9;
          applied = true;
        }
        if (shapes.mouthShrugLower !== null) {
          influences[shapes.mouthShrugLower] = 0.6;
        }
        break;
        
      case VisemeType.E:
        // "Eh" - medium open, slight smile
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.5;
          applied = true;
        }
        if (shapes.mouthSmile !== null) {
          influences[shapes.mouthSmile] = 0.3;
        }
        break;
        
      case VisemeType.I:
        // "Ee" - small opening, wide smile
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.2;
          applied = true;
        }
        if (shapes.mouthSmile !== null) {
          influences[shapes.mouthSmile] = 0.7;
        }
        break;
        
      case VisemeType.O:
        // "Oh" - medium open, rounded
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.6;
          applied = true;
        }
        if (shapes.mouthPucker !== null) {
          influences[shapes.mouthPucker] = 0.5;
        }
        break;
        
      case VisemeType.U:
        // "Oo" - small opening, pucker
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.3;
          applied = true;
        }
        if (shapes.mouthPucker !== null) {
          influences[shapes.mouthPucker] = 0.8;
        }
        break;
        
      case VisemeType.FV:
        // "F", "V" - lower lip roll
        if (shapes.mouthRollLower !== null) {
          influences[shapes.mouthRollLower] = 0.7;
          applied = true;
        }
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.1;
        }
        break;
        
      case VisemeType.MBP:
        // "M", "B", "P" - closed lips
        if (shapes.mouthClose !== null) {
          influences[shapes.mouthClose] = 0.9;
          applied = true;
        }
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.0;
        }
        break;
        
      case VisemeType.TH:
        // "Th" - tongue between teeth
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.3;
          applied = true;
        }
        if (shapes.mouthShrugLower !== null) {
          influences[shapes.mouthShrugLower] = 0.4;
        }
        break;
        
      case VisemeType.TD:
      case VisemeType.KG:
      case VisemeType.CHSH:
      case VisemeType.NNG:
      case VisemeType.L:
      case VisemeType.R:
      case VisemeType.SZ:
        // Other sounds - use jawOpen with medium intensity
        if (shapes.jawOpen !== null) {
          influences[shapes.jawOpen] = 0.5;
          applied = true;
        }
        break;
    }
    
    // Force Three.js to update
    mesh.updateMorphTargets();
    if (mesh.geometry && mesh.geometry.attributes.position) {
      mesh.geometry.attributes.position.needsUpdate = true;
    }
    
    if (logPrefix && applied && foundViseme !== VisemeType.SILENCE) {
      const activeShapes: string[] = [];
      if (shapes.jawOpen !== null && influences[shapes.jawOpen] > 0.1) {
        activeShapes.push(`jawOpen:${influences[shapes.jawOpen].toFixed(2)}`);
      }
      if (shapes.mouthSmile !== null && influences[shapes.mouthSmile] > 0.1) {
        activeShapes.push(`mouthSmile:${influences[shapes.mouthSmile].toFixed(2)}`);
      }
      if (shapes.mouthPucker !== null && influences[shapes.mouthPucker] > 0.1) {
        activeShapes.push(`mouthPucker:${influences[shapes.mouthPucker].toFixed(2)}`);
      }
      if (activeShapes.length > 0) {
        console.log(`${logPrefix}👄 ${visemeTypeName} → ${activeShapes.join(', ')}`);
      }
    }
    
    return applied;
  };

  // Find the mesh with blend shapes (usually the head/face)
  const faceMesh = React.useMemo(() => {
    let found: THREE.SkinnedMesh | null = null;
    let allMeshes: THREE.SkinnedMesh[] = [];
    
    scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        allMeshes.push(child);
        if (child.morphTargetDictionary && Object.keys(child.morphTargetDictionary).length > 0) {
          if (!found) {
            found = child;
            console.log('✅ Found face mesh with blend shapes:', child.name || 'unnamed');
            console.log('   Blend shapes:', Object.keys(child.morphTargetDictionary));
          }
        }
      }
    });
    
    if (!found && allMeshes.length > 0) {
      console.warn('⚠️  No mesh with blend shapes found, but found meshes:', allMeshes.map(m => m.name || 'unnamed'));
      // Try to use the first SkinnedMesh anyway
      found = allMeshes[0];
      console.log('   Using first SkinnedMesh as fallback:', found.name || 'unnamed');
    }
    
    if (!found) {
      console.error('❌ No SkinnedMesh found in scene!');
    }
    
    return found;
  }, [scene]);

  // Comprehensive scan: Check model capabilities for lipsync, face movement, and body movement
  useEffect(() => {
    if (!scene || !modelCentered) return;

    console.log('🔍 ===== COMPREHENSIVE MODEL SCAN =====');
    console.log('📦 Scanning GLB file: avatar3.glb');
    console.log('');
    
    // Check for lipsync support (morph targets/blend shapes)
    let hasLipsync = false;
    let allBlendShapes: string[] = [];
    let lipBlendShapes: string[] = [];
    let faceBlendShapes: string[] = [];
    
    scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
        hasLipsync = true;
        const dict = child.morphTargetDictionary;
        allBlendShapes = Object.keys(dict);
        
        console.log('✅ LIP MOVEMENT SUPPORT: Found mesh with morph targets/blend shapes');
        console.log(`   Total blend shapes: ${allBlendShapes.length}`);
        console.log('');
        console.log('   📋 ALL BLEND SHAPES:');
        allBlendShapes.forEach((name, index) => {
          console.log(`      ${index + 1}. "${name}"`);
        });
        console.log('');
        
        // Categorize blend shapes
        const lipKeywords = ['lip', 'mouth', 'viseme', 'jaw', 'open', 'close', 'ah', 'oh', 'ee', 'oo', 'sil', 'smile', 'frown'];
        const faceKeywords = ['eye', 'brow', 'eyebrow', 'cheek', 'nose', 'forehead', 'face', 'blink', 'wink', 'squint'];
        
        allBlendShapes.forEach((name) => {
          const lowerName = name.toLowerCase();
          if (lipKeywords.some(kw => lowerName.includes(kw))) {
            lipBlendShapes.push(name);
          }
          if (faceKeywords.some(kw => lowerName.includes(kw))) {
            faceBlendShapes.push(name);
          }
        });
        
        console.log(`   👄 LIP-RELATED BLEND SHAPES (${lipBlendShapes.length}):`);
        if (lipBlendShapes.length > 0) {
          lipBlendShapes.forEach(name => console.log(`      ✅ "${name}"`));
        } else {
          console.log('      ⚠️  No lip-related blend shapes found');
          console.log('      💡 Looking for keywords: lip, mouth, viseme, jaw, open, close, ah, oh, ee, oo, sil, smile, frown');
        }
        console.log('');
        
        console.log(`   😊 FACE-RELATED BLEND SHAPES (${faceBlendShapes.length}):`);
        if (faceBlendShapes.length > 0) {
          faceBlendShapes.forEach(name => console.log(`      ✅ "${name}"`));
        } else {
          console.log('      ⚠️  No face-related blend shapes found');
          console.log('      💡 Looking for keywords: eye, brow, eyebrow, cheek, nose, forehead, face, blink, wink, squint');
        }
        console.log('');
        
        // Check for expected viseme names
        const expectedVisemes = Object.values(VISEME_BLEND_SHAPE_NAMES);
        const foundVisemes: string[] = [];
        const missingVisemes: string[] = [];
        
        expectedVisemes.forEach(visemeName => {
          if (dict[visemeName] !== undefined) {
            foundVisemes.push(visemeName);
          } else {
            missingVisemes.push(visemeName);
          }
        });
        
        console.log(`   🎯 VISEME COMPATIBILITY: ${foundVisemes.length}/${expectedVisemes.length} standard visemes found`);
        if (foundVisemes.length > 0) {
          console.log('      ✅ Found:', foundVisemes.join(', '));
        }
        if (missingVisemes.length > 0) {
          console.log(`      ⚠️  Missing ${missingVisemes.length} standard visemes`);
          console.log('      💡 The code will try common naming variations as fallback');
        }
        console.log('');
      }
    });
    
    if (!hasLipsync) {
      console.log('❌ LIP MOVEMENT SUPPORT: No mesh with morph targets found');
      console.log('   The model does not support lip movement. You need a model with blend shapes/morph targets.');
      console.log('');
    }
    
    // Check for face movement support (face bones)
    let hasSkeleton = false;
    let allBones: string[] = [];
    let faceBones: string[] = [];
    let headBones: string[] = [];
    let armBones: string[] = [];
    let bodyBones: string[] = [];
    
    scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.skeleton) {
        hasSkeleton = true;
        const bones = object.skeleton.bones;
        allBones = bones.map(b => b.name);
        
        console.log('✅ FACE & BODY MOVEMENT SUPPORT: Found skeleton');
        console.log(`   Total bones: ${allBones.length}`);
        console.log('');
        console.log('   📋 ALL BONES:');
        allBones.forEach((name, index) => {
          console.log(`      ${index + 1}. "${name}"`);
        });
        console.log('');
        
        // Categorize bones
        const faceKeywords = ['face', 'head', 'eye', 'brow', 'eyebrow', 'cheek', 'nose', 'mouth', 'jaw', 'chin', 'ear', 'forehead', 'temple'];
        const headKeywords = ['head', 'neck', 'skull', 'cranium'];
        const armKeywords = ['arm', 'hand', 'forearm', 'upperarm', 'shoulder', 'elbow', 'wrist', 'finger', 'thumb'];
        const bodyKeywords = ['spine', 'chest', 'torso', 'pelvis', 'hip', 'leg', 'foot', 'knee', 'ankle', 'toe'];
        
        bones.forEach((bone) => {
          const boneName = bone.name.toLowerCase();
          
          if (faceKeywords.some(kw => boneName.includes(kw))) {
            faceBones.push(bone.name);
          }
          if (headKeywords.some(kw => boneName.includes(kw))) {
            headBones.push(bone.name);
          }
          if (armKeywords.some(kw => boneName.includes(kw))) {
            armBones.push(bone.name);
          }
          if (bodyKeywords.some(kw => boneName.includes(kw))) {
            bodyBones.push(bone.name);
          }
        });
        
        console.log(`   😊 FACE BONES (${faceBones.length}):`);
        if (faceBones.length > 0) {
          faceBones.forEach(name => console.log(`      ✅ "${name}"`));
          console.log('      ✅ Face movement is supported!');
        } else {
          console.log('      ⚠️  No face bones found');
          console.log('      💡 Looking for keywords: face, head, eye, brow, eyebrow, cheek, nose, mouth, jaw, chin, ear, forehead, temple');
        }
        console.log('');
        
        console.log(`   🗣️  HEAD BONES (${headBones.length}):`);
        if (headBones.length > 0) {
          headBones.forEach(name => console.log(`      ✅ "${name}"`));
        } else {
          console.log('      ⚠️  No head bones found');
        }
        console.log('');
        
        console.log(`   💪 ARM/HAND BONES (${armBones.length}):`);
        if (armBones.length > 0) {
          armBones.forEach(name => console.log(`      ✅ "${name}"`));
          console.log('      ✅ Hand/arm movement is supported!');
        } else {
          console.log('      ⚠️  No arm/hand bones found');
          console.log('      💡 Looking for keywords: arm, hand, forearm, upperarm, shoulder, elbow, wrist, finger, thumb');
        }
        console.log('');
        
        console.log(`   🏃 BODY BONES (${bodyBones.length}):`);
        if (bodyBones.length > 0) {
          bodyBones.forEach(name => console.log(`      ✅ "${name}"`));
          console.log('      ✅ Body movement is supported!');
        } else {
          console.log('      ⚠️  No body bones found');
        }
        console.log('');
      }
    });
    
    if (!hasSkeleton) {
      console.log('❌ FACE & BODY MOVEMENT SUPPORT: No skeleton found');
      console.log('   The model does not support face/body movement. You need a rigged model with bones.');
      console.log('');
    }
    
    // Final Summary
    console.log('📊 ===== FINAL SUMMARY =====');
    console.log(`   👄 Lip Movement: ${hasLipsync ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
    if (hasLipsync) {
      console.log(`      - ${allBlendShapes.length} total blend shapes`);
      console.log(`      - ${lipBlendShapes.length} lip-related blend shapes`);
      console.log(`      - ${faceBlendShapes.length} face-related blend shapes`);
    }
    console.log(`   😊 Face Movement: ${hasSkeleton && faceBones.length > 0 ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
    if (hasSkeleton && faceBones.length > 0) {
      console.log(`      - ${faceBones.length} face bones found`);
    }
    console.log(`   💪 Body Movement: ${hasSkeleton && (armBones.length > 0 || bodyBones.length > 0) ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
    if (hasSkeleton) {
      console.log(`      - ${allBones.length} total bones`);
      console.log(`      - ${armBones.length} arm/hand bones`);
      console.log(`      - ${bodyBones.length} body bones`);
    }
    console.log('');
    console.log('🔍 ===== END SCAN =====');
    console.log('');
    console.log('💡 TIP: Check the console output above for detailed information about blend shapes and bones.');
    console.log('💡 TIP: If lip movement is not working, check which blend shapes are available and update the viseme mapping if needed.');
    
    // Expose GLTF JSON scanner to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).scanGLTFJSON = (gltfJson: GLTFStructure) => {
        console.log('🔍 ===== SCANNING GLTF JSON STRUCTURE =====');
        console.log('');
        return quickScanGLTF(gltfJson);
      };
      console.log('💡 TIP: You can scan GLTF JSON by calling: window.scanGLTFJSON(gltfJsonObject)');
    }
  }, [scene, modelCentered]);

  // Audio playback and lip sync
  useEffect(() => {
    if (!faceMesh) {
      console.log('⚠️  Lip sync skipped: faceMesh not found');
      return;
    }

    // If we have visemes but no audio, animate lip sync based on time (for testing)
    if (!audioUrl && visemes.length > 0) {
      console.log('🧪 Testing lip sync without audio (visemes only)');
      console.log('   Visemes count:', visemes.length);
      console.log('   Face mesh found:', !!faceMesh);
      
      const mesh: THREE.SkinnedMesh = faceMesh;
      
      // Debug: Log available blend shapes
      if (mesh.morphTargetDictionary) {
        console.log('📋 Available blend shapes in model:', Object.keys(mesh.morphTargetDictionary));
        console.log('📋 Total morph targets:', mesh.morphTargetInfluences?.length || 0);
      } else {
        console.error('❌ No morphTargetDictionary found on mesh!');
        console.log('   Mesh type:', mesh.constructor.name);
        console.log('   Mesh name:', mesh.name);
        console.log('   Has morphTargetInfluences:', !!mesh.morphTargetInfluences);
      }
      
      const startTime = Date.now();
      let lastViseme = -1;
      
      const updateLipSync = () => {
        if (!mesh || !visemes.length) {
          console.warn('⚠️  Update skipped: mesh or visemes missing');
          return;
        }
        
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const totalDuration = visemes[visemes.length - 1].startTime + 
                             visemes[visemes.length - 1].duration;
        
        if (elapsed < totalDuration) {
          // Find current viseme
          let foundViseme = VisemeType.SILENCE;
          for (const frame of visemes) {
            if (elapsed >= frame.startTime && elapsed < frame.startTime + frame.duration) {
              foundViseme = frame.viseme;
              break;
            }
          }
          
          // Only log when viseme changes
          if (foundViseme !== lastViseme) {
            console.log(`👄 Viseme changed: ${VisemeType[foundViseme]} (${foundViseme}) at ${elapsed.toFixed(2)}s`);
            lastViseme = foundViseme;
          }
          
          setCurrentViseme(foundViseme);
          
          // Apply viseme using comprehensive matching
          const visemeApplied = applyVisemeToBlendShapes(mesh, foundViseme, '   ');
          
          // Log active influences for debugging (only when viseme changes)
          if (foundViseme !== lastViseme && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            const dict = mesh.morphTargetDictionary;
            const influences = mesh.morphTargetInfluences;
            const activeInfluences = Array.from(influences)
              .map((val, idx) => {
                if (val > 0.1) {
                  const shapeName = Object.keys(dict)[idx] || `index_${idx}`;
                  return `${shapeName}:${val.toFixed(2)}`;
                }
                return null;
              })
              .filter((v): v is string => v !== null)
              .slice(0, 3);
            if (activeInfluences.length > 0) {
              console.log(`   📊 Active blend shapes:`, activeInfluences.join(', '));
            }
          }
          
          if (!visemeApplied) {
            console.error('❌ Cannot update lip sync: blend shape application failed');
          }
          
          requestAnimationFrame(updateLipSync);
        } else {
          // Reset to silence
          console.log('🔇 Speech ended, resetting to silence');
          setCurrentViseme(VisemeType.SILENCE);
          applyVisemeToBlendShapes(mesh, VisemeType.SILENCE, '   ');
        }
      };
      
      updateLipSync();
      
      return () => {
        // Cleanup
      };
    }

    // Normal audio playback with lip sync
    if (!audioUrl) {
      return;
    }

    console.log('🎵 Starting audio playback and lip sync...');
    console.log('   Audio URL:', audioUrl);
    console.log('   Visemes count:', visemes.length);

    // Store faceMesh in a local variable with proper typing for use in closures
    const mesh: THREE.SkinnedMesh = faceMesh;

    // Stop any previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Configure audio for better playback
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    let lastAppliedViseme = -1;
    const updateLipSync = () => {
      if (!audio || !visemes.length || !mesh) {
        return;
      }

      try {
        const currentTime = audio.currentTime;
        
        // Find current viseme based on audio time
        let foundViseme = VisemeType.SILENCE;
        for (const frame of visemes) {
          if (currentTime >= frame.startTime && currentTime < frame.startTime + frame.duration) {
            foundViseme = frame.viseme;
            break;
          }
        }

        // Only update if viseme changed (reduces console spam)
        if (foundViseme !== lastAppliedViseme) {
          setCurrentViseme(foundViseme);
          lastAppliedViseme = foundViseme;
          
          // Apply viseme using comprehensive matching
          const applied = applyVisemeToBlendShapes(mesh, foundViseme, '🎤 ');
          if (!applied) {
            console.warn(`⚠️  Could not apply viseme ${VisemeType[foundViseme]} at ${currentTime.toFixed(2)}s`);
          }
        } else {
          // Still apply even if viseme hasn't changed (for continuous updates)
          applyVisemeToBlendShapes(mesh, foundViseme);
        }
      } catch (error) {
        console.warn('Error updating lip sync:', error);
      }
    };

    const handleTimeUpdate = () => {
      // Update lip sync on every timeupdate event
      updateLipSync();
    };

    // Set up event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    const handleEnded = () => {
      console.log('🎵 Audio playback ended');
      setCurrentViseme(VisemeType.SILENCE);
      
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
        // Reset to silence
        const silenceName = VISEME_BLEND_SHAPE_NAMES[VisemeType.SILENCE];
        if (silenceName && mesh.morphTargetDictionary[silenceName] !== undefined) {
          const silenceIndex = mesh.morphTargetDictionary[silenceName];
          if (silenceIndex !== undefined && mesh.morphTargetInfluences[silenceIndex] !== undefined) {
            mesh.morphTargetInfluences[silenceIndex] = 1.0;
          }
        } else {
          // Reset all to 0 if silence viseme not found
          for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
            mesh.morphTargetInfluences[i] = 0;
          }
        }
      }
    };
    
    audio.addEventListener('ended', handleEnded);
    
    const handleError = (error: any) => {
      console.error('❌ Audio playback error:', error);
    };
    
    audio.addEventListener('error', handleError);
    
    const handleCanPlay = () => {
      console.log('✅ Audio can play, starting playback...');
    };
    
    audio.addEventListener('canplay', handleCanPlay);

    // Start playing audio
    const playAudio = async () => {
      try {
        console.log('▶️  Attempting to play audio...');
        await audio.play();
        console.log('✅ Audio playback started successfully');
        
        // Start lip sync immediately
        updateLipSync();
      } catch (error: any) {
        console.error('❌ Failed to play audio:', error);
        console.error('   Error details:', error.message);
        
        // Try to handle autoplay restrictions
        if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
          console.warn('⚠️  Autoplay blocked. User interaction may be required.');
        }
      }
    };

    // Wait a bit for audio to load, then play
    audio.addEventListener('loadeddata', () => {
      console.log('📦 Audio data loaded');
      playAudio();
    });

    // Also try playing immediately (in case loadeddata already fired)
    if (audio.readyState >= 2) {
      playAudio();
    } else {
      // Load the audio
      audio.load();
    }

    return () => {
      console.log('🧹 Cleaning up audio...');
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadeddata', playAudio);
      audio.pause();
      audio.src = '';
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [audioUrl, visemes, faceMesh]);

  // Store references to arm/hand bones for continuous adjustment
  const armBonesRef = useRef<THREE.Bone[]>([]);

  // Find and adjust hand/arm pose to have hands down
  useEffect(() => {
    if (scene && modelCentered) {
      const foundBones: THREE.Bone[] = [];
      
      // Find skeleton and identify arm/hand bones
      scene.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh && object.skeleton) {
          const bones = object.skeleton.bones;
          
          bones.forEach((bone) => {
            const boneName = bone.name.toLowerCase();
            
            // Find left and right arm/hand bones
            const isLeftArm = boneName.includes('left') && (boneName.includes('arm') || boneName.includes('hand') || boneName.includes('forearm') || boneName.includes('upperarm'));
            const isRightArm = boneName.includes('right') && (boneName.includes('arm') || boneName.includes('hand') || boneName.includes('forearm') || boneName.includes('upperarm'));
            
            if (isLeftArm || isRightArm) {
              foundBones.push(bone);
              console.log(`✅ Found arm/hand bone: ${bone.name}`);
            }
          });
        }
      });
      
      armBonesRef.current = foundBones;
      
      // Initial adjustment - rotate arms down
      foundBones.forEach((bone) => {
        // Rotate around X axis to lower the arm (adjust angle as needed)
        // Positive X rotation typically lowers the arm
        bone.rotation.x = Math.PI * 0.2; // ~36 degrees down
        // Also adjust Y rotation slightly for natural hanging position
        bone.rotation.y = 0;
        bone.rotation.z = 0;
      });
      
      // Update skeleton
      scene.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh && object.skeleton) {
          object.skeleton.update();
        }
      });
    }
  }, [scene, modelCentered]);

  // Test body movement: animate hands up and down
  const testBodyMovementRef = useRef<boolean>(false);
  const animationStartTimeRef = useRef<number>(0);
  
  // Expose test function to parent via callback
  useEffect(() => {
    if (onTestBodyMovement) {
      // Store the test function that parent can call
      const testFunction = () => {
        console.log('🧪 ===== BODY MOVEMENT TEST START =====');
        console.log('🧪 Testing hand/arm movement (up and down)');
        
        if (armBonesRef.current.length === 0) {
          console.error('❌ No arm/hand bones found!');
          alert('No arm/hand bones found. The model may not support body movement.');
          return;
        }
        
        console.log(`✅ Found ${armBonesRef.current.length} arm/hand bones to animate`);
        armBonesRef.current.forEach((bone, index) => {
          console.log(`   Bone ${index + 1}: ${bone.name}`);
        });
        
        testBodyMovementRef.current = true;
        animationStartTimeRef.current = Date.now();
        console.log('🔄 Starting hand animation (up and down)...');
      };
      
      // Call the callback to register our test function
      (onTestBodyMovement as any)(testFunction);
    }
  }, [onTestBodyMovement, scene, modelCentered]);

  // Continuously maintain hand position OR animate for testing
  useFrame(() => {
    if (armBonesRef.current.length > 0) {
      if (testBodyMovementRef.current) {
        // Test animation: move hands up and down
        const elapsed = (Date.now() - animationStartTimeRef.current) / 1000; // seconds
        const duration = 3.0; // 3 seconds total
        
        if (elapsed < duration) {
          // Create a smooth up and down motion using sine wave
          const cycle = Math.sin((elapsed / duration) * Math.PI * 4); // 2 full cycles
          // Convert to rotation: -0.5 (down) to 0.5 (up) radians
          const rotationX = (cycle * 0.5) + 0.2; // Range: -0.3 to 0.7 (about -17° to 40°)
          
          armBonesRef.current.forEach((bone) => {
            bone.rotation.x = rotationX;
          });
          
          // Update skeleton
          scene.traverse((object) => {
            if (object instanceof THREE.SkinnedMesh && object.skeleton) {
              object.skeleton.update();
            }
          });
        } else {
          // Animation complete, reset to default
          testBodyMovementRef.current = false;
          armBonesRef.current.forEach((bone) => {
            bone.rotation.x = Math.PI * 0.2; // ~36 degrees down (default)
          });
          
          // Update skeleton
          scene.traverse((object) => {
            if (object instanceof THREE.SkinnedMesh && object.skeleton) {
              object.skeleton.update();
            }
          });
          
          console.log('✅ Body movement test completed - hands reset to default position');
        }
      } else {
        // Normal behavior: keep hands down
        armBonesRef.current.forEach((bone) => {
          if (bone.rotation.x < Math.PI * 0.15) {
            bone.rotation.x = Math.PI * 0.2; // ~36 degrees down
          }
        });
      }
    }
  });

  // Test lip movement: animate mouth blend shapes up and down
  const testLipMovementRef = useRef<boolean>(false);
  const lipAnimationStartTimeRef = useRef<number>(0);
  const lipBlendShapeIndicesRef = useRef<number[]>([]);
  
  // Expose test function to parent via callback
  useEffect(() => {
    if (onTestLipMovement && faceMesh && faceMesh.morphTargetDictionary) {
      const testFunction = () => {
        console.log('🧪 ===== LIP MOVEMENT TEST START =====');
        console.log('🧪 Testing lip/mouth movement (up and down)');
        
        const dict = faceMesh.morphTargetDictionary!;
        const allBlendShapes = Object.keys(dict);
        
        // Find mouth-related blend shapes
        const mouthKeywords = ['mouth', 'viseme', 'lip', 'jaw', 'open', 'ah', 'oh', 'ee', 'oo', 'sil', 'close'];
        const foundBlendShapes: number[] = [];
        
        for (const key of allBlendShapes) {
          const lowerKey = key.toLowerCase();
          if (mouthKeywords.some(kw => lowerKey.includes(kw))) {
            const index = dict[key];
            foundBlendShapes.push(index);
            console.log(`   ✅ Found mouth-related blend shape: "${key}" at index ${index}`);
          }
        }
        
        // If no specific mouth shapes found, try common viseme names
        if (foundBlendShapes.length === 0) {
          const commonVisemes = ['viseme_sil', 'viseme_aa', 'viseme_A', 'jawOpen', 'mouthOpen', 'A', 'O', 'I'];
          for (const visemeName of commonVisemes) {
            if (dict[visemeName] !== undefined) {
              const index = dict[visemeName];
              foundBlendShapes.push(index);
              console.log(`   ✅ Found blend shape: "${visemeName}" at index ${index}`);
              break; // Use first found
            }
          }
        }
        
        // If still nothing, use first available blend shape
        if (foundBlendShapes.length === 0 && allBlendShapes.length > 0) {
          const firstKey = allBlendShapes[0];
          const firstIndex = dict[firstKey];
          foundBlendShapes.push(firstIndex);
          console.log(`   ⚠️  Using first available blend shape: "${firstKey}" at index ${firstIndex}`);
        }
        
        if (foundBlendShapes.length === 0) {
          console.error('❌ No blend shapes found!');
          alert('No blend shapes found. The model may not support lip movement.');
          return;
        }
        
        console.log(`✅ Found ${foundBlendShapes.length} blend shape(s) to animate`);
        lipBlendShapeIndicesRef.current = foundBlendShapes;
        testLipMovementRef.current = true;
        lipAnimationStartTimeRef.current = Date.now();
        console.log('🔄 Starting lip animation (up and down)...');
      };
      
      (onTestLipMovement as any)(testFunction);
    }
  }, [onTestLipMovement, faceMesh, modelCentered]);

  // Track test mode start time for elapsed time calculation
  const testModeStartTimeRef = useRef<number | null>(null);
  const lastVisemesLengthRef = useRef<number>(0);
  
  // Reset test mode timer when new visemes are set (for test mode)
  useEffect(() => {
    if (visemes.length > 0 && !audioUrl) {
      // New visemes set without audio = test mode
      if (visemes.length !== lastVisemesLengthRef.current) {
        testModeStartTimeRef.current = null; // Reset timer for new test
        lastVisemesLengthRef.current = visemes.length;
        console.log('🔄 Test mode timer reset - new visemes detected');
      }
    } else if (visemes.length === 0) {
      lastVisemesLengthRef.current = 0;
      testModeStartTimeRef.current = null;
    }
  }, [visemes.length, audioUrl]);
  
  // Continuously apply visemes in useFrame for smooth lip sync (runs every frame)
  // This ensures lip sync works for both audio mode and test mode
  const lastFrameVisemeRef = useRef<number>(-1);
  useFrame(() => {
    if (!faceMesh || !visemes.length) return;
    
    const mesh: THREE.SkinnedMesh = faceMesh;
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
      // Log once if mesh is not ready
      if (lastFrameVisemeRef.current === -2) return; // Already logged
      console.warn('⚠️  useFrame: Mesh not ready for lip sync');
      lastFrameVisemeRef.current = -2;
      return;
    }
    
    // Get current time from audio or use elapsed time for test mode
    let currentTime = 0;
    if (audioRef.current && !audioRef.current.paused && !audioRef.current.ended) {
      currentTime = audioRef.current.currentTime;
      testModeStartTimeRef.current = null; // Reset test mode when audio is playing
    } else if (visemes.length > 0) {
      // For test mode without audio, calculate elapsed time
      if (testModeStartTimeRef.current === null) {
        testModeStartTimeRef.current = Date.now();
        console.log('⏱️  Test mode started - timer initialized');
      }
      currentTime = (Date.now() - testModeStartTimeRef.current) / 1000; // seconds
      
      // Check if test animation is still running
      const totalDuration = visemes[visemes.length - 1].startTime + visemes[visemes.length - 1].duration;
      if (currentTime > totalDuration) {
        // Test animation finished, reset to silence
        if (lastFrameVisemeRef.current !== VisemeType.SILENCE) {
          applyVisemeToBlendShapes(mesh, VisemeType.SILENCE);
          lastFrameVisemeRef.current = VisemeType.SILENCE;
        }
        return;
      }
    } else {
      return;
    }
    
    // Find current viseme based on current time
    let foundViseme = VisemeType.SILENCE;
    for (const frame of visemes) {
      if (currentTime >= frame.startTime && currentTime < frame.startTime + frame.duration) {
        foundViseme = frame.viseme;
        break;
      }
    }
    
    // Apply viseme every frame for smooth animation
    // Only log when viseme changes to reduce console spam
    if (foundViseme !== lastFrameVisemeRef.current) {
      lastFrameVisemeRef.current = foundViseme;
      const isTestMode = !audioRef.current || audioRef.current.paused;
      if (isTestMode) {
        // Log in test mode with more detail
        console.log(`👄 Test mode: ${VisemeType[foundViseme]} (${foundViseme}) at ${currentTime.toFixed(2)}s`);
      }
    }
    
    // Always apply to ensure smooth continuous updates
    const applied = applyVisemeToBlendShapes(mesh, foundViseme);
    
    // Log if application failed (only once per viseme to avoid spam)
    if (!applied && foundViseme !== lastFrameVisemeRef.current && foundViseme !== VisemeType.SILENCE) {
      console.warn(`⚠️  Failed to apply viseme ${VisemeType[foundViseme]} - check if ARKit blend shapes are available`);
    }
  });

  // Animate lip movement test in useFrame
  useFrame(() => {
    if (testLipMovementRef.current && faceMesh && faceMesh.morphTargetInfluences && lipBlendShapeIndicesRef.current.length > 0) {
      const influences = faceMesh.morphTargetInfluences;
      const elapsed = (Date.now() - lipAnimationStartTimeRef.current) / 1000; // seconds
      const duration = 3.0; // 3 seconds total
      
      if (elapsed < duration) {
        // Create a smooth up and down motion using sine wave
        const cycle = Math.sin((elapsed / duration) * Math.PI * 4); // 2 full cycles
        // Convert to blend shape value: 0 (closed) to 1 (open)
        const blendValue = (cycle * 0.5) + 0.5; // Range: 0 to 1
        
        // Reset all blend shapes first
        for (let i = 0; i < influences.length; i++) {
          influences[i] = 0;
        }
        
        // Apply the animated value to all found lip blend shapes
        lipBlendShapeIndicesRef.current.forEach((index) => {
          if (index >= 0 && index < influences.length) {
            influences[index] = blendValue;
          }
        });
        
        // Force update
        const newInfluences = Array.from(influences);
        faceMesh.morphTargetInfluences = newInfluences;
        faceMesh.updateMorphTargets();
      } else {
        // Animation complete, reset to closed
        testLipMovementRef.current = false;
        lipBlendShapeIndicesRef.current = [];
        
        // Reset all blend shapes
        for (let i = 0; i < influences.length; i++) {
          influences[i] = 0;
        }
        const newInfluences = Array.from(influences);
        faceMesh.morphTargetInfluences = newInfluences;
        faceMesh.updateMorphTargets();
        
        console.log('✅ Lip movement test completed - mouth reset to closed');
      }
    }
  });

  // Idle animation
  useEffect(() => {
    if (actions && actions['idle']) {
      actions['idle'].play();
    } else if (actions && Object.keys(actions).length > 0) {
      // Play first available animation if 'idle' doesn't exist
      const firstAction = Object.values(actions)[0];
      if (firstAction) {
        firstAction.play();
      }
    }
  }, [actions]);

  return (
    <primitive 
      ref={meshRef} 
      object={scene} 
      scale={1}
    />
  );
}

// Helper function to get server API URL - uses centralized config
const getServerApiUrl = (): string => {
  return getApiBaseUrl();
};

export const TeacherAvatar = React.forwardRef<
  { sendMessage: (message: string) => Promise<void>; testLipSync: () => void; testBodyMovement: () => void; testLipMovement: () => void },
  TeacherAvatarProps
>(({
  avatarModelUrl = '/models/avatar3.glb',
  onMessage,
  onResponse,
  onReady,
  position = [0, 0, 0],
  scale = 1,
  className = '',
  curriculum,
  class: classLevel,
  subject,
  useAvatarKey = false,
  externalThreadId
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [visemes, setVisemes] = useState<VisemeFrame[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [threadReady, setThreadReady] = useState(false);
  const isProcessingRef = useRef<boolean>(false);
  const testBodyMovementRef = useRef<(() => void) | null>(null);
  const testLipMovementRef = useRef<(() => void) | null>(null);

  // Test function: Make model speak without OpenAI API
  const testLipSync = () => {
    console.log('🧪 ===== LIP SYNC TEST START =====');
    console.log('🧪 Testing lip sync with: "hello i am your teacher"');
    
    const testText = "hello i am your teacher";
    
    // Generate simple visemes for the test text
    const generateTestVisemes = (text: string): VisemeFrame[] => {
      const words = text.toLowerCase().split(/\s+/);
      const visemes: VisemeFrame[] = [];
      let currentTime = 0;
      const avgWordDuration = 0.4; // seconds per word
      
      // Simple phoneme mapping for test text
      const wordPhonemes: Record<string, VisemeType[]> = {
        'hello': [VisemeType.E, VisemeType.L, VisemeType.O],
        'i': [VisemeType.I],
        'am': [VisemeType.A, VisemeType.MBP],
        'your': [VisemeType.U, VisemeType.R],
        'teacher': [VisemeType.TD, VisemeType.E, VisemeType.CHSH, VisemeType.R]
      };
      
      for (const word of words) {
        const phonemes = wordPhonemes[word] || [VisemeType.A];
        const phonemeDuration = avgWordDuration / Math.max(phonemes.length, 1);
        
        for (const phoneme of phonemes) {
          visemes.push({
            viseme: phoneme,
            startTime: currentTime,
            duration: phonemeDuration
          });
          currentTime += phonemeDuration;
        }
        
        // Add small pause between words
        visemes.push({
          viseme: VisemeType.SILENCE,
          startTime: currentTime,
          duration: 0.1
        });
        currentTime += 0.1;
      }
      
      return visemes;
    };
    
    const testVisemes = generateTestVisemes(testText);
    console.log('✅ Generated test visemes:', testVisemes);
    console.log('   Total duration:', testVisemes[testVisemes.length - 1].startTime + testVisemes[testVisemes.length - 1].duration, 'seconds');
    console.log('   Viseme sequence:', testVisemes.map(v => `${VisemeType[v.viseme]}@${v.startTime.toFixed(2)}s`).join(' → '));
    
    // Set visemes - this will trigger lip sync animation via useFrame
    setVisemes(testVisemes);
    setIsSpeaking(true);
    
    console.log('🎬 Test lip sync started - useFrame will animate the mouth');
    console.log('   Check console for viseme changes and blend shape applications');
    
    // Use browser's Web Speech API for audio (no OpenAI needed)
    if ('speechSynthesis' in window) {
      // Stop any current speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        console.log('🎤 Speech started - lip sync should be animating');
      };
      
      utterance.onend = () => {
        console.log('🎤 Speech ended - resetting to silence');
        setIsSpeaking(false);
        // Keep visemes for a moment, then clear
        setTimeout(() => {
          setVisemes([]);
        }, 500);
      };
      
      utterance.onerror = (error) => {
        console.error('❌ Speech error:', error);
        setIsSpeaking(false);
        setVisemes([]);
      };
      
      // Start speaking
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('⚠️  Speech Synthesis not supported, testing lip sync only (no audio)');
      // Even without audio, test the lip sync animation
      const totalDuration = testVisemes[testVisemes.length - 1].startTime + 
                           testVisemes[testVisemes.length - 1].duration;
      
      setTimeout(() => {
        console.log('🧪 Test completed - resetting to silence');
        setIsSpeaking(false);
        setVisemes([]);
      }, (totalDuration + 0.5) * 1000);
    }
  };

  // Initialize thread
  useEffect(() => {
    // If external thread ID is provided, use it (don't create a new one)
    if (externalThreadId) {
      console.log('✅ Using external thread ID:', externalThreadId);
      if (threadId !== externalThreadId) {
        setThreadId(externalThreadId);
        setThreadReady(true);
        setError(null);
      }
      return;
    }

    // Only create thread if no external thread ID is provided and we don't have one
    if (threadId) {
      return; // Already have a thread
    }

    const initThread = async () => {
      try {
        console.log('🔗 Initializing teacher avatar...');
        
        const response = await api.post('/assistant/create-thread', {
          curriculum,
          class: classLevel,
          subject,
          useAvatarKey
        });
        
        console.log('📡 Thread creation response status:', response.status);
        
        const data = response.data;
        console.log('✅ Thread created successfully:', data.threadId);
        setThreadId(data.threadId);
        setThreadReady(true);
        setError(null); // Clear any previous errors
      } catch (error: any) {
        console.error('❌ Failed to create thread:', error);
        const errorMessage = error.message || 'Failed to initialize teacher avatar. Please check your connection.';
        setError(errorMessage);
      }
    };
    
    initThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalThreadId]);

  const sendMessage = async (message: string) => {
    if (!threadId) {
      setError('Thread not initialized. Please wait...');
      return;
    }

    // Prevent concurrent message sends
    if (isProcessingRef.current) {
      console.warn('⚠️  A message is already being processed. Please wait...');
      setError('Please wait for the current message to complete.');
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);
    setError(null);
    onMessage?.(message);

    try {
      // Get assistant response
      let responseRes;
      try {
        responseRes = await api.post('/assistant/message', { 
          threadId, 
          message,
          curriculum,
          class: classLevel,
          subject,
          useAvatarKey
        });
      } catch (error: any) {
        const errorResponse = error.response;
        if (!errorResponse) {
          throw error;
        }
        
        const errorData = errorResponse.data;
        let errorMessage = errorData?.error || errorData?.message || `Failed to get response: ${errorResponse.status} ${errorResponse.statusText}`;
        console.error('❌ API Error:', {
          status: errorResponse.status,
          statusText: errorResponse.statusText,
          error: errorMessage,
          details: errorData?.details
        });
        
        // Handle active run errors - retry after a delay
        if (errorResponse.status === 400 && (errorMessage.includes('already has an active run') || errorMessage.includes('active run'))) {
          console.warn('⚠️  Active run detected, waiting and retrying...');
          // Wait a bit and retry once
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const retryRes = await api.post('/assistant/message', { 
              threadId, 
              message,
              curriculum,
              class: classLevel,
              subject,
              useAvatarKey
            });
            
            const retryData = retryRes.data;
            const assistantText = retryData.response;
            
            // Show text response (audio/TTS disabled)
            onResponse?.(assistantText);
            console.log('📝 Text response received (retry, audio disabled):', assistantText.substring(0, 100));
            
            return; // Successfully retried, exit early
          } catch (retryError: any) {
            console.error('❌ Retry failed:', retryError);
            errorMessage = 'The previous message is still processing. Please wait a moment and try again.';
            throw new Error(errorMessage);
          }
        }
        
        // Handle rate limit errors with automatic retry
        if (errorResponse.status === 429) {
          const retryAfter = errorResponse.headers?.['retry-after'];
          const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : 5000; // Default 5 seconds
          
          console.warn(`⚠️ Rate limit exceeded. Retrying in ${retryDelay}ms...`);
          
          // Wait and retry once
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          try {
            const retryRes = await api.post('/assistant/message', { 
              threadId, 
              message,
              curriculum,
              class: classLevel,
              subject,
              useAvatarKey
            });
            
            const retryData = retryRes.data;
            const assistantText = retryData.response;
            
            // Show text response (audio/TTS disabled)
            onResponse?.(assistantText);
            console.log('📝 Text response received (retry after rate limit, audio disabled):', assistantText.substring(0, 100));
            
            return; // Successfully retried, exit early
          } catch (retryError: any) {
            errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            throw new Error(errorMessage);
          }
        }
        
        // Handle specific error statuses with user-friendly messages
        if (errorResponse.status === 401) {
          errorMessage = errorData?.message || errorData?.error || 'OpenAI API authentication failed. Please check your API key configuration.';
        } else if (errorResponse.status === 500) {
          errorMessage = errorData?.message || errorData?.error || 'Server error occurred. Please try again later.';
          setError(errorMessage);
        }
        
        throw new Error(errorMessage);
      }
      
      const responseData = responseRes.data;
      console.log('📦 Full response data:', responseData);
      
      if (!responseData || !responseData.response) {
        console.error('❌ Invalid response format:', responseData);
        throw new Error('Invalid response from server: missing response field');
      }
      const assistantText = responseData.response;

      // Show text response immediately (text-only mode)
      // Audio/TTS generation is disabled - only text responses are shown
      console.log('📝 Text response received (audio disabled):', assistantText);
      console.log('📝 Calling onResponse callback with:', assistantText.substring(0, 100));
      
      if (onResponse) {
        onResponse(assistantText);
        console.log('✅ onResponse callback called successfully');
      } else {
        console.warn('⚠️ onResponse callback is not defined');
      }

    } catch (error: any) {
      console.error('Error in conversation:', error);
      let errorMessage = error.message || 'Failed to process message. Please try again.';
      
      // Make rate limit errors more user-friendly
      if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please wait a few seconds and try again.';
      }
      
      setError(errorMessage);
      // Also show error in the message box with a friendlier message
      const userFriendlyMessage = errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')
        ? 'I\'m receiving too many requests right now. Please wait a moment and try again.'
        : `Sorry, I encountered an error: ${errorMessage}`;
      onResponse?.(userFriendlyMessage);
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  // Notify when both thread and model are ready
  useEffect(() => {
    if (threadReady && modelLoaded && onReady) {
      console.log('✅ Avatar fully ready (thread + model)');
      onReady();
    }
  }, [threadReady, modelLoaded, onReady]);

  // Test body movement function
  const testBodyMovement = () => {
    if (testBodyMovementRef.current) {
      testBodyMovementRef.current();
    } else {
      console.warn('⚠️  Body movement test not ready yet. Wait for model to load.');
    }
  };

  const testLipMovement = () => {
    if (testLipMovementRef.current) {
      testLipMovementRef.current();
    } else {
      console.warn('⚠️  Lip movement test not ready yet. Wait for model to load.');
    }
  };

  // Expose sendMessage, testLipSync, testBodyMovement, and testLipMovement methods via ref
  React.useImperativeHandle(ref, () => ({
    sendMessage,
    testLipSync,
    testBodyMovement,
    testLipMovement
  }), [threadId]);

  return (
    <div className={`teacher-avatar-container ${className}`} style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent', border: 'none', boxShadow: 'none', margin: 0, padding: 0 }}>
      <Canvas camera={{ position: [0, 1, 3], fov: 50 }} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', boxShadow: 'none', margin: 0, padding: 0 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.6} />
        <pointLight position={[0, 5, 0]} intensity={0.4} />
        
        <Suspense fallback={
          <Html center>
            <div className="text-gray-500">Loading avatar...</div>
          </Html>
        }>
          <AvatarModel
            modelUrl={avatarModelUrl}
            audioUrl={currentAudioUrl}
            visemes={visemes}
            isSpeaking={isSpeaking}
            onModelLoad={() => {
              console.log('✅ Model loaded, setting modelLoaded to true');
              setModelLoaded(true);
            }}
            onTestBodyMovement={(testFn) => {
              testBodyMovementRef.current = testFn;
            }}
            onTestAllBlendShapes={(testFn) => {
              // Store for later use if needed
            }}
            onTestLipMovement={(testFn) => {
              testLipMovementRef.current = testFn;
            }}
          />
        </Suspense>

        <OrbitControls 
          enablePan={false}
          minDistance={1.5}
          maxDistance={6}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 0, 0]}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white/90 px-4 py-2 rounded-lg shadow-lg">
            <span className="text-gray-800">Thinking...</span>
          </div>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 max-w-md">
          <div className="bg-red-900/90 backdrop-blur-0 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg shadow-lg">
            <div className="font-semibold mb-1">Error:</div>
            <div className="text-sm break-words">{error}</div>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-xs text-red-300 hover:text-red-100 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg">
            <span>Speaking...</span>
          </div>
        </div>
      )}
    </div>
  );
});

TeacherAvatar.displayName = 'TeacherAvatar';

