/**
 * Resolve a playable URL for Spiral / Meshy generated 3D assets (shared UI + class launch).
 */
export function resolveGenerated3DAssetUrl(asset: Record<string, unknown> | null | undefined): string {
  if (!asset || typeof asset !== 'object') return '';

  let url =
    (typeof asset.downloadUrl === 'string' && asset.downloadUrl) ||
    (typeof asset.previewUrl === 'string' && asset.previewUrl) ||
    (typeof asset.url === 'string' && asset.url) ||
    '';

  const meta = asset.metadata as Record<string, unknown> | undefined;
  if (!url && meta && typeof meta === 'object') {
    const modelUrls = meta.model_urls as Record<string, string> | undefined;
    if (modelUrls) {
      url =
        modelUrls.glb ||
        modelUrls.fbx ||
        modelUrls.obj ||
        modelUrls.usdz ||
        modelUrls.draco ||
        '';
    }
    if (!url) {
      url =
        (typeof meta.url === 'string' && meta.url) ||
        (typeof meta.downloadUrl === 'string' && meta.downloadUrl) ||
        (typeof meta.modelUrl === 'string' && meta.modelUrl) ||
        (typeof meta.fileUrl === 'string' && meta.fileUrl) ||
        '';
    }
  }

  const result = asset.result as Record<string, unknown> | undefined;
  if (!url && result && typeof result === 'object') {
    url =
      (typeof result.downloadUrl === 'string' && result.downloadUrl) ||
      (typeof result.previewUrl === 'string' && result.previewUrl) ||
      (typeof result.url === 'string' && result.url) ||
      '';
  }

  return url || '';
}
