# GLTF Scanner Usage Guide

## Overview

The GLTF Scanner utility analyzes GLTF/GLB JSON structures to extract detailed information about:
- Bone hierarchy and structure
- Mesh nodes
- Skeleton capabilities
- Categorized bones (face, head, arms, hands, body, legs, eyes)

## Usage

### Method 1: Browser Console (Recommended)

After the TeacherAvatar component loads, you can scan GLTF JSON directly in the browser console:

```javascript
// Paste your GLTF JSON object here
const gltfJson = {
  "asset": {
    "version": "2.0",
    "generator": "Avaturn.me | Blender"
  },
  "scenes": [...],
  "nodes": [...]
};

// Scan it
window.scanGLTFJSON(gltfJson);
```

### Method 2: Import and Use in Code

```typescript
import { quickScanGLTF, scanGLTF, printGLTFScanReport } from '../utils/gltfScanner';

// Quick scan with automatic console output
const result = quickScanGLTF(gltfJsonObject);

// Or scan without console output
const result = scanGLTF(gltfJsonObject);
printGLTFScanReport(result); // Print when ready
```

### Method 3: Programmatic Access

```typescript
import { scanGLTF } from '../utils/gltfScanner';

const result = scanGLTF(gltfJsonObject);

// Access results
console.log(`Total bones: ${result.totalBones}`);
console.log(`Face bones: ${result.faceBones.join(', ')}`);
console.log(`Has skeleton: ${result.hasSkeleton}`);
console.log(`Has face bones: ${result.hasFaceBones}`);
console.log(`Has body bones: ${result.hasBodyBones}`);

// View bone hierarchy
console.log(result.boneTree);

// Access bone details
result.boneHierarchy.forEach((bone, name) => {
  console.log(`${name}:`, bone);
});
```

## Example Output

When you run the scanner, you'll see output like:

```
🔍 ===== GLTF STRUCTURE SCAN REPORT =====

📦 MODEL INFO:
   Generator: Avaturn.me | Blender
   GLTF Version: 2.0

🦴 SKELETON ANALYSIS:
   Total Bones: 65
   Root Bones: 1
      - Hips

📋 BONE CATEGORIES:
   😊 Face Bones: 2
      ✅ Head
      ✅ Neck

   🗣️  Head Bones: 2
      ✅ Head
      ✅ Neck

   👁️  Eye Bones: 2
      ✅ LeftEye
      ✅ RightEye

   💪 Arm Bones: 6
      ✅ LeftArm
      ✅ LeftForeArm
      ✅ LeftShoulder
      ✅ RightArm
      ✅ RightForeArm
      ✅ RightShoulder

   ✋ Hand Bones: 20
      ✅ LeftHand
      ✅ LeftHandIndex1
      ✅ LeftHandIndex2
      ✅ LeftHandIndex3
      ✅ LeftHandMiddle1
      ✅ LeftHandMiddle2
      ✅ LeftHandMiddle3
      ✅ LeftHandPinky1
      ✅ LeftHandPinky2
      ✅ LeftHandPinky3
      ✅ LeftHandRing1
      ✅ LeftHandRing2
      ✅ LeftHandRing3
      ✅ LeftHandThumb1
      ✅ LeftHandThumb2
      ✅ LeftHandThumb3
      ✅ RightHand
      ✅ RightHandIndex1
      ✅ RightHandIndex2
      ✅ RightHandIndex3

   🏃 Body Bones: 4
      ✅ Spine
      ✅ Spine1
      ✅ Spine2
      ✅ Hips

   🦵 Leg Bones: 12
      ✅ LeftLeg
      ✅ LeftUpLeg
      ✅ LeftFoot
      ✅ LeftToeBase
      ✅ RightLeg
      ✅ RightUpLeg
      ✅ RightFoot
      ✅ RightToeBase

🎨 MESH ANALYSIS:
   Total Meshes: 10
      ✅ Body_Mesh (mesh: 0, skin: 0)
      ✅ Eye_Mesh (mesh: 1, skin: 0)
      ✅ EyeAO_Mesh (mesh: 2, skin: 0)
      ✅ Eyelash_Mesh (mesh: 3, skin: 0)
      ✅ Head_Mesh (mesh: 4, skin: 0)
      ✅ Teeth_Mesh (mesh: 5, skin: 0)
      ✅ Tongue_Mesh (mesh: 6, skin: 0)
      ✅ avaturn_hair_0 (mesh: 7, skin: 0)
      ✅ avaturn_shoes_0 (mesh: 8, skin: 0)
      ✅ avaturn_look_0 (mesh: 9, skin: 0)

✅ CAPABILITIES:
   Skeleton: ✅ YES
   Face Movement: ✅ YES
   Body Movement: ✅ YES
   Hand Movement: ✅ YES
   Eye Movement: ✅ YES

🌳 BONE HIERARCHY TREE:
└── Hips (BONE)
    ├── LeftUpLeg (BONE)
    │   └── LeftLeg (BONE)
    │       └── LeftFoot (BONE)
    │           └── LeftToeBase (BONE)
    ├── RightUpLeg (BONE)
    │   └── RightLeg (BONE)
    │       └── RightFoot (BONE)
    │           └── RightToeBase (BONE)
    └── Spine (BONE)
        └── Spine1 (BONE)
            └── Spine2 (BONE)
                ├── Neck (BONE)
                │   └── Head (BONE)
                │       ├── LeftEye (BONE)
                │       └── RightEye (BONE)
                ├── LeftShoulder (BONE)
                │   └── LeftArm (BONE)
                │       └── LeftForeArm (BONE)
                │           └── LeftHand (BONE)
                │               ├── LeftHandThumb1 (BONE)
                │               ├── LeftHandIndex1 (BONE)
                │               ├── LeftHandMiddle1 (BONE)
                │               ├── LeftHandRing1 (BONE)
                │               └── LeftHandPinky1 (BONE)
                └── RightShoulder (BONE)
                    └── RightArm (BONE)
                        └── RightForeArm (BONE)
                            └── RightHand (BONE)
                                ├── RightHandThumb1 (BONE)
                                ├── RightHandIndex1 (BONE)
                                ├── RightHandMiddle1 (BONE)
                                ├── RightHandRing1 (BONE)
                                └── RightHandPinky1 (BONE)

🔍 ===== END SCAN REPORT =====
```

## API Reference

### `scanGLTF(gltfData: GLTFStructure): GLTFScanResult`

Scans a GLTF structure and returns detailed analysis.

**Parameters:**
- `gltfData`: The GLTF JSON structure object

**Returns:** `GLTFScanResult` object with:
- `generator`: Model generator name
- `version`: GLTF version
- `totalBones`: Number of bones found
- `boneHierarchy`: Map of bone names to bone analysis
- `rootBones`: Array of root bone names
- `faceBones`, `headBones`, `armBones`, `handBones`, `bodyBones`, `legBones`, `eyeBones`: Categorized bone arrays
- `totalMeshes`: Number of mesh nodes
- `meshNodes`: Array of mesh node information
- `hasSkeleton`, `hasFaceBones`, `hasBodyBones`, `hasHandBones`, `hasEyeBones`: Boolean capability flags
- `boneTree`: Text representation of bone hierarchy

### `quickScanGLTF(gltfJson: any): GLTFScanResult`

Scans GLTF JSON and automatically prints a formatted report to console.

### `printGLTFScanReport(scanResult: GLTFScanResult): void`

Prints a formatted scan report to the console.

## Notes

- The scanner automatically categorizes bones based on naming conventions
- Bone hierarchy is built from parent-child relationships in the nodes array
- Mesh nodes are identified by the presence of a `mesh` property
- The scanner works with both GLTF and GLB formats (JSON portion)

