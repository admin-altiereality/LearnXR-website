import { NodeIO, type Document } from '@gltf-transform/core';
import sharp from 'sharp';

/**
 * Post-processing for Meshy GLBs before they land in storage.
 *
 * Motivation: a shipped lesson asset was 110MB — 639,263 triangles across 1,914,805
 * vertices (65MB of geometry) plus four PBR maps at up to 4096px (39MB). Both causes are
 * now fixed at the source (`should_remesh` was off so Meshy ignored `target_polycount`,
 * and `hd_texture` was on — see routes/meshy.ts and services/meshyAssetRegeneration.ts).
 * This module handles what those fixes can't: assets already generated under the old
 * settings, and any model arriving from a path that doesn't go through our Meshy params.
 *
 * Scope is deliberately limited to textures, based on measurement rather than assumption.
 * Running gltf-transform's geometry passes over a real Meshy asset achieved nothing:
 * dedup() changed no vertices, weld() changed no vertices, and simplify() removed 13 of
 * 639,263 triangles. Meshy exports a fully unshared triangle soup (exactly 3.0 verts per
 * triangle — every vertex differs from its neighbours in normal or UV), so there is no
 * shared topology for an edge-collapse simplifier to work with. Decimating it properly
 * means rebuilding UV seams, which Meshy already does correctly server-side. High-poly
 * legacy assets are therefore fixed by regeneration, not here.
 *
 * Textures are where the entire win is: on that asset, 39.2MB of maps compress to ~4.5MB.
 *
 * Note also that @gltf-transform/functions is deliberately NOT a dependency. It pulls in
 * ndarray-pixels, which ships its own nested copy of sharp; two native libvips instances
 * in one process corrupt libvips' global state and every encode fails with
 * "colourspace: parameter space not set". Keeping to @gltf-transform/core avoids that
 * entirely, and drops a WASM simplifier from the cold-start path for free.
 */

/** 2048px is indistinguishable from 4096px on a prop viewed at ~180 krpano units. */
const DEFAULT_MAX_TEXTURE_SIZE = 2048;

/** Meshy writes near-lossless JPEGs; 88 is visually clean at a fraction of the size. */
const JPEG_QUALITY = 88;

/**
 * Don't rewrite assets that are already small — re-encoding costs CPU and risks a
 * generation of quality loss for no meaningful transfer saving.
 */
const MIN_BYTES_TO_COMPRESS = 4 * 1024 * 1024;

export interface CompressGlbOptions {
  maxTextureSize?: number;
  /** Skip the size floor. Used by the backfill job when explicitly reprocessing. */
  force?: boolean;
}

export interface GlbCompressionResult {
  buffer: Buffer;
  originalBytes: number;
  compressedBytes: number;
  /** False when the input was returned untouched (too small, or compression failed). */
  changed: boolean;
  texturesRewritten: number;
  skippedReason?: string;
}

/**
 * Downsizes and re-encodes every embedded texture.
 *
 * Uses explicit target dimensions rather than `resize({ width, height, fit: 'inside' })`,
 * and returns the count of textures actually replaced.
 */
async function resizeTextures(doc: Document, maxTextureSize: number): Promise<number> {
  let rewritten = 0;

  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;

    const mimeType = texture.getMimeType();
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') continue;

    try {
      const source = Buffer.from(image);
      const meta = await sharp(source).metadata();
      if (!meta.width || !meta.height) continue;

      const longest = Math.max(meta.width, meta.height);
      const ratio = longest > maxTextureSize ? maxTextureSize / longest : 1;
      const targetWidth = Math.max(1, Math.round(meta.width * ratio));
      const targetHeight = Math.max(1, Math.round(meta.height * ratio));

      // Re-encode even when already within the size budget: a 2048px Meshy map can still
      // be ~5MB at their default quality. The `output < source` guard below discards any
      // re-encode that fails to help.
      const pipeline =
        ratio < 1 ? sharp(source).resize(targetWidth, targetHeight) : sharp(source);

      // Preserve the source format. Normal and metallicRoughness maps carry vector and
      // linear data rather than colour, so switching their encoding risks shading
      // artefacts for no benefit we need here.
      const output =
        mimeType === 'image/png'
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

      if (output.byteLength < source.byteLength) {
        texture.setImage(new Uint8Array(output));
        rewritten++;
      }
    } catch (error) {
      // One bad texture shouldn't cost us the savings on the rest of the asset.
      console.warn(`[glbCompression] Skipped texture "${texture.getName() || 'unnamed'}":`, error);
    }
  }

  return rewritten;
}

/**
 * Shrinks a GLB. Never throws and never returns a broken asset: on any failure the
 * original buffer comes back unchanged, because a slow-loading model is a far better
 * outcome than a model that no longer loads.
 */
export async function compressGlb(
  input: Buffer,
  options: CompressGlbOptions = {}
): Promise<GlbCompressionResult> {
  const originalBytes = input.byteLength;
  const maxTextureSize = options.maxTextureSize ?? DEFAULT_MAX_TEXTURE_SIZE;

  const unchanged = (skippedReason?: string): GlbCompressionResult => ({
    buffer: input,
    originalBytes,
    compressedBytes: originalBytes,
    changed: false,
    texturesRewritten: 0,
    skippedReason,
  });

  if (!options.force && originalBytes < MIN_BYTES_TO_COMPRESS) {
    return unchanged('below size threshold');
  }

  try {
    const io = new NodeIO();
    const doc = await io.readBinary(new Uint8Array(input));

    const texturesRewritten = await resizeTextures(doc, maxTextureSize);
    if (texturesRewritten === 0) {
      return unchanged('no textures reduced');
    }

    const output = Buffer.from(await io.writeBinary(doc));
    if (output.byteLength >= originalBytes) {
      return unchanged('no size reduction');
    }

    return {
      buffer: output,
      originalBytes,
      compressedBytes: output.byteLength,
      changed: true,
      texturesRewritten,
    };
  } catch (error) {
    console.warn('[glbCompression] Compression failed, storing original:', error);
    return unchanged(error instanceof Error ? error.message : 'compression error');
  }
}

export const GLB_COMPRESSION_VERSION = 'v1-jpeg2048-q88';
