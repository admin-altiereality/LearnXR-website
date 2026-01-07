/**
 * GLTF Scanner Utility
 * Analyzes GLTF/GLB JSON structures to extract model capabilities
 */

export interface GLTFNode {
  name?: string;
  rotation?: number[];
  translation?: number[];
  scale?: number[];
  children?: number[];
  mesh?: number;
  skin?: number;
  isBone?: boolean;
  [key: string]: any;
}

export interface GLTFStructure {
  asset?: {
    version?: string;
    generator?: string;
  };
  scenes?: Array<{
    name?: string;
    nodes?: number[];
  }>;
  scene?: number;
  nodes?: GLTFNode[];
  meshes?: any[];
  skins?: any[];
  animations?: any[];
}

export interface BoneAnalysis {
  name: string;
  index: number;
  isBone: boolean;
  hasChildren: boolean;
  children: string[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

export interface GLTFScanResult {
  // Model info
  generator: string;
  version: string;
  
  // Bone analysis
  totalBones: number;
  boneHierarchy: Map<string, BoneAnalysis>;
  rootBones: string[];
  
  // Categorized bones
  faceBones: string[];
  headBones: string[];
  armBones: string[];
  handBones: string[];
  bodyBones: string[];
  legBones: string[];
  eyeBones: string[];
  
  // Mesh analysis
  totalMeshes: number;
  meshNodes: Array<{
    name: string;
    meshIndex: number;
    skinIndex?: number;
  }>;
  
  // Capabilities
  hasSkeleton: boolean;
  hasFaceBones: boolean;
  hasBodyBones: boolean;
  hasHandBones: boolean;
  hasEyeBones: boolean;
  
  // Hierarchy structure
  boneTree: string;
}

/**
 * Scans a GLTF JSON structure and extracts detailed information
 */
export function scanGLTF(gltfData: GLTFStructure): GLTFScanResult {
  const nodes = gltfData.nodes || [];
  const boneHierarchy = new Map<string, BoneAnalysis>();
  const meshNodes: Array<{ name: string; meshIndex: number; skinIndex?: number }> = [];
  
  // First pass: identify all bones and meshes
  nodes.forEach((node, index) => {
    if (node.isBone || node.name) {
      const boneName = node.name || `Bone_${index}`;
      const hasChildren = node.children && node.children.length > 0;
      
      boneHierarchy.set(boneName, {
        name: boneName,
        index,
        isBone: node.isBone || false,
        hasChildren,
        children: [],
        translation: node.translation,
        rotation: node.rotation,
        scale: node.scale,
      });
    }
    
    if (node.mesh !== undefined) {
      meshNodes.push({
        name: node.name || `Mesh_${node.mesh}`,
        meshIndex: node.mesh,
        skinIndex: node.skin,
      });
    }
  });
  
  // Second pass: build parent-child relationships
  const rootBones: string[] = [];
  nodes.forEach((node, index) => {
    if (node.children) {
      const parentName = node.name || `Bone_${index}`;
      const parentBone = boneHierarchy.get(parentName);
      
      if (parentBone) {
        node.children.forEach((childIndex) => {
          const childNode = nodes[childIndex];
          if (childNode && childNode.name) {
            parentBone.children.push(childNode.name);
          }
        });
      }
    }
    
    // Find root bones (bones with no parent or are in scene root)
    if (node.isBone && node.name) {
      const isRoot = !nodes.some((n) => 
        n.children && n.children.includes(index)
      );
      if (isRoot) {
        rootBones.push(node.name);
      }
    }
  });
  
  // Categorize bones
  const faceBones: string[] = [];
  const headBones: string[] = [];
  const armBones: string[] = [];
  const handBones: string[] = [];
  const bodyBones: string[] = [];
  const legBones: string[] = [];
  const eyeBones: string[] = [];
  
  const faceKeywords = ['face', 'head', 'brow', 'eyebrow', 'cheek', 'nose', 'mouth', 'jaw', 'chin', 'ear', 'forehead', 'temple'];
  const headKeywords = ['head', 'neck', 'skull', 'cranium'];
  const armKeywords = ['arm', 'forearm', 'upperarm', 'shoulder', 'elbow'];
  const handKeywords = ['hand', 'wrist', 'finger', 'thumb', 'index', 'middle', 'ring', 'pinky', 'toe'];
  const bodyKeywords = ['spine', 'chest', 'torso', 'pelvis', 'hip'];
  const legKeywords = ['leg', 'foot', 'knee', 'ankle', 'toe'];
  const eyeKeywords = ['eye'];
  
  boneHierarchy.forEach((bone, name) => {
    const lowerName = name.toLowerCase();
    
    if (faceKeywords.some(kw => lowerName.includes(kw))) {
      faceBones.push(name);
    }
    if (headKeywords.some(kw => lowerName.includes(kw))) {
      headBones.push(name);
    }
    if (armKeywords.some(kw => lowerName.includes(kw))) {
      armBones.push(name);
    }
    if (handKeywords.some(kw => lowerName.includes(kw))) {
      handBones.push(name);
    }
    if (bodyKeywords.some(kw => lowerName.includes(kw))) {
      bodyBones.push(name);
    }
    if (legKeywords.some(kw => lowerName.includes(kw))) {
      legBones.push(name);
    }
    if (eyeKeywords.some(kw => lowerName.includes(kw))) {
      eyeBones.push(name);
    }
  });
  
  // Build bone tree visualization
  const boneTree = buildBoneTree(nodes, rootBones, boneHierarchy);
  
  return {
    generator: gltfData.asset?.generator || 'Unknown',
    version: gltfData.asset?.version || 'Unknown',
    totalBones: Array.from(boneHierarchy.values()).filter(b => b.isBone).length,
    boneHierarchy,
    rootBones,
    faceBones,
    headBones,
    armBones,
    handBones,
    bodyBones,
    legBones,
    eyeBones,
    totalMeshes: meshNodes.length,
    meshNodes,
    hasSkeleton: boneHierarchy.size > 0,
    hasFaceBones: faceBones.length > 0,
    hasBodyBones: bodyBones.length > 0 || armBones.length > 0 || legBones.length > 0,
    hasHandBones: handBones.length > 0,
    hasEyeBones: eyeBones.length > 0,
    boneTree,
  };
}

/**
 * Builds a text tree representation of the bone hierarchy
 */
function buildBoneTree(
  nodes: GLTFNode[],
  rootBones: string[],
  boneHierarchy: Map<string, BoneAnalysis>,
  indent: string = '',
  visited: Set<string> = new Set()
): string {
  let tree = '';
  
  // If no root bones specified, find them
  const roots = rootBones.length > 0 
    ? rootBones 
    : Array.from(boneHierarchy.keys()).filter(name => {
        const bone = boneHierarchy.get(name);
        return bone && !nodes.some((n, idx) => 
          n.children && n.children.includes(bone.index)
        );
      });
  
  roots.forEach((rootName, idx) => {
    if (visited.has(rootName)) return;
    visited.add(rootName);
    
    const bone = boneHierarchy.get(rootName);
    if (!bone) return;
    
    const isLast = idx === roots.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    tree += `${indent}${connector}${rootName}${bone.isBone ? ' (BONE)' : ''}\n`;
    
    if (bone.children.length > 0) {
      const newIndent = indent + (isLast ? '    ' : '│   ');
      bone.children.forEach((childName, childIdx) => {
        const childBone = boneHierarchy.get(childName);
        if (childBone) {
          const isLastChild = childIdx === bone.children.length - 1;
          const childConnector = isLastChild ? '└── ' : '├── ';
          tree += `${newIndent}${childConnector}${childName}${childBone.isBone ? ' (BONE)' : ''}\n`;
          
          // Recursively add grandchildren
          if (childBone.children.length > 0) {
            const grandIndent = newIndent + (isLastChild ? '    ' : '│   ');
            tree += buildBoneTree(nodes, childBone.children, boneHierarchy, grandIndent, visited);
          }
        }
      });
    }
  });
  
  return tree;
}

/**
 * Prints a formatted scan report to console
 */
export function printGLTFScanReport(scanResult: GLTFScanResult): void {
  console.log('🔍 ===== GLTF STRUCTURE SCAN REPORT =====');
  console.log('');
  console.log('📦 MODEL INFO:');
  console.log(`   Generator: ${scanResult.generator}`);
  console.log(`   GLTF Version: ${scanResult.version}`);
  console.log('');
  
  console.log('🦴 SKELETON ANALYSIS:');
  console.log(`   Total Bones: ${scanResult.totalBones}`);
  console.log(`   Root Bones: ${scanResult.rootBones.length}`);
  if (scanResult.rootBones.length > 0) {
    scanResult.rootBones.forEach(root => {
      console.log(`      - ${root}`);
    });
  }
  console.log('');
  
  console.log('📋 BONE CATEGORIES:');
  console.log(`   😊 Face Bones: ${scanResult.faceBones.length}`);
  if (scanResult.faceBones.length > 0) {
    scanResult.faceBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log(`   🗣️  Head Bones: ${scanResult.headBones.length}`);
  if (scanResult.headBones.length > 0) {
    scanResult.headBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log(`   👁️  Eye Bones: ${scanResult.eyeBones.length}`);
  if (scanResult.eyeBones.length > 0) {
    scanResult.eyeBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log(`   💪 Arm Bones: ${scanResult.armBones.length}`);
  if (scanResult.armBones.length > 0) {
    scanResult.armBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log(`   ✋ Hand Bones: ${scanResult.handBones.length}`);
  if (scanResult.handBones.length > 0) {
    scanResult.handBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log(`   🏃 Body Bones: ${scanResult.bodyBones.length}`);
  if (scanResult.bodyBones.length > 0) {
    scanResult.bodyBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log(`   🦵 Leg Bones: ${scanResult.legBones.length}`);
  if (scanResult.legBones.length > 0) {
    scanResult.legBones.forEach(bone => console.log(`      ✅ ${bone}`));
  }
  console.log('');
  
  console.log('🎨 MESH ANALYSIS:');
  console.log(`   Total Meshes: ${scanResult.totalMeshes}`);
  if (scanResult.meshNodes.length > 0) {
    scanResult.meshNodes.forEach(mesh => {
      console.log(`      ✅ ${mesh.name} (mesh: ${mesh.meshIndex}${mesh.skinIndex !== undefined ? `, skin: ${mesh.skinIndex}` : ''})`);
    });
  }
  console.log('');
  
  console.log('✅ CAPABILITIES:');
  console.log(`   Skeleton: ${scanResult.hasSkeleton ? '✅ YES' : '❌ NO'}`);
  console.log(`   Face Movement: ${scanResult.hasFaceBones ? '✅ YES' : '❌ NO'}`);
  console.log(`   Body Movement: ${scanResult.hasBodyBones ? '✅ YES' : '❌ NO'}`);
  console.log(`   Hand Movement: ${scanResult.hasHandBones ? '✅ YES' : '❌ NO'}`);
  console.log(`   Eye Movement: ${scanResult.hasEyeBones ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  if (scanResult.boneTree) {
    console.log('🌳 BONE HIERARCHY TREE:');
    console.log(scanResult.boneTree);
  }
  
  console.log('🔍 ===== END SCAN REPORT =====');
}

/**
 * Quick scan function that takes raw JSON and prints report
 */
export function quickScanGLTF(gltfJson: any): GLTFScanResult {
  const result = scanGLTF(gltfJson);
  printGLTFScanReport(result);
  return result;
}

