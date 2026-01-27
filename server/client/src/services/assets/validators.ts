/**
 * Asset Validators
 * 
 * Validation utilities for asset operations
 */

/**
 * Valid file extensions
 */
export const VALID_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj'];

/**
 * Maximum file size (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file extension
 */
export function validateFileExtension(fileName: string): FileValidationResult {
  const fileNameLower = fileName.toLowerCase();
  const hasValidExtension = VALID_EXTENSIONS.some(ext => fileNameLower.endsWith(ext));

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file format. Please use ${VALID_EXTENSIONS.join(', ')} files.`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): FileValidationResult {
  if (fileSize > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `File is too large. Maximum size is ${maxSizeMB}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Validate file type by reading magic bytes
 */
export async function validateFileType(file: globalThis.File): Promise<FileValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer.slice(0, 12));

        // GLB file magic: "glTF" (0x67 0x6C 0x54 0x46)
        const isGLB = bytes.length >= 4 &&
          bytes[0] === 0x67 && bytes[1] === 0x6C && bytes[2] === 0x54 && bytes[3] === 0x46;

        // GLTF (JSON) files start with "{"
        const textDecoder = new TextDecoder();
        const textStart = textDecoder.decode(bytes.slice(0, 10));
        const isGLTF = textStart.trim().startsWith('{');

        // Check for JPEG
        const isJPEG = bytes.length >= 4 &&
          bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;

        // Check for PNG
        const isPNG = bytes.length >= 8 &&
          bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

        const fileName = file.name.toLowerCase();
        const hasGlbExtension = fileName.endsWith('.glb') || fileName.endsWith('.gltf');

        if (isJPEG || isPNG) {
          resolve({
            valid: false,
            error: `File "${file.name}" is an image file (${isJPEG ? 'JPEG' : 'PNG'}), not a 3D model.`,
          });
          return;
        }

        if (hasGlbExtension && !isGLB && !isGLTF) {
          resolve({
            valid: false,
            error: `File "${file.name}" has a .glb/.gltf extension but the file content doesn't match. The file may be corrupted.`,
          });
          return;
        }

        // For FBX/OBJ, we trust the extension
        if (fileName.endsWith('.fbx') || fileName.endsWith('.obj')) {
          resolve({ valid: true });
          return;
        }

        // For GLB/GLTF, require valid magic bytes
        if (hasGlbExtension && (isGLB || isGLTF)) {
          resolve({ valid: true });
          return;
        }

        // If extension doesn't match, reject
        if (!hasGlbExtension && !fileName.endsWith('.fbx') && !fileName.endsWith('.obj')) {
          resolve({
            valid: false,
            error: `File "${file.name}" has an unsupported format. Please use GLB, GLTF, FBX, or OBJ files.`,
          });
          return;
        }

        resolve({ valid: true });
      } catch (error) {
        resolve({
          valid: false,
          error: `Could not validate file type for "${file.name}". Please ensure it's a valid 3D model file.`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        error: `Could not read file "${file.name}" for validation.`,
      });
    };

    // Read first 12 bytes to check magic bytes
    const blob = file.slice(0, 12);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Validate file completely
 */
export async function validateFile(file: globalThis.File): Promise<FileValidationResult> {
  // Check extension
  const extensionCheck = validateFileExtension(file.name);
  if (!extensionCheck.valid) {
    return extensionCheck;
  }

  // Check size
  const sizeCheck = validateFileSize(file.size);
  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  // Check file type (magic bytes) for GLB/GLTF
  const fileNameLower = file.name.toLowerCase();
  if (fileNameLower.endsWith('.glb') || fileNameLower.endsWith('.gltf')) {
    return await validateFileType(file);
  }

  return { valid: true };
}
