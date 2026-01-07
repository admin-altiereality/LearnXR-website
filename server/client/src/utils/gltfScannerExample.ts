/**
 * Example usage of GLTF Scanner
 * 
 * This file demonstrates how to use the GLTF scanner utility
 * to analyze GLTF/GLB JSON structures.
 */

import { quickScanGLTF, scanGLTF, printGLTFScanReport, GLTFStructure } from './gltfScanner';

/**
 * Example: Scan a GLTF JSON structure
 */
export function exampleScanGLTF() {
  // Example GLTF JSON structure (from Avaturn.me)
  const exampleGLTF: GLTFStructure = {
    "asset": {
      "version": "2.0",
      "generator": "Avaturn.me | Blender"
    },
    "scenes": [
      {
        "name": "Scene",
        "nodes": [64]
      }
    ],
    "scene": 0,
    "nodes": [
      {
        "rotation": [0.2365223470569805, 0.0006644121647944756, -0.0020511536074557684, 0.9716236569104874],
        "translation": [-2.7033426441835928e-8, 0.15371260634473272, -1.3706702953197869e-8],
        "scale": [1.0000001258594777, 1.000000231933468, 1.0000001140319852],
        "name": "LeftToeBase",
        "isBone": true
      },
      {
        "name": "Body_Mesh",
        "mesh": 0,
        "skin": 0
      }
    ]
  };

  // Quick scan and print report
  console.log('=== Example GLTF Scan ===');
  const result = quickScanGLTF(exampleGLTF);
  
  // Access scan results programmatically
  console.log('\n=== Programmatic Access ===');
  console.log(`Total bones found: ${result.totalBones}`);
  console.log(`Face bones: ${result.faceBones.join(', ')}`);
  console.log(`Has skeleton: ${result.hasSkeleton}`);
  
  return result;
}

/**
 * Scan GLTF from a file or URL
 * 
 * Usage:
 *   const gltfJson = await fetch('/path/to/model.gltf').then(r => r.json());
 *   const scanResult = scanGLTFFromJSON(gltfJson);
 */
export function scanGLTFFromJSON(gltfJson: any): ReturnType<typeof scanGLTF> {
  return scanGLTF(gltfJson);
}

