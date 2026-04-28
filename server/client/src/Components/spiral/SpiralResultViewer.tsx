import AssetViewerWithSkybox from '../AssetViewerWithSkybox';
import SkyboxFullScreen from '../../screens/SkyboxFullScreen';
import { resolveGenerated3DAssetUrl } from '../../utils/generatedAssetUrl';

type AssetFormat = 'glb' | 'usdz' | 'obj' | 'fbx';

interface SpiralResultViewerProps {
  generatedVariations: any[];
  currentVariationIndex: number;
  generated3DAsset: any | null;
}

function resolveSkybox(variations: any[], index: number): any | null {
  if (!variations.length) return null;
  return variations[index] || variations[0] || null;
}

function resolveSkyboxUrl(skybox: any | null): string | undefined {
  if (!skybox) return undefined;
  return skybox.image || skybox.image_jpg || skybox.file_url || skybox.preview_url;
}

function resolveAssetFormat(asset: any | null): AssetFormat {
  const format = String(asset?.format || 'glb').toLowerCase();
  if (format === 'usdz' || format === 'obj' || format === 'fbx') return format;
  return 'glb';
}

export const SpiralResultViewer = ({
  generatedVariations,
  currentVariationIndex,
  generated3DAsset,
}: SpiralResultViewerProps) => {
  const skybox = resolveSkybox(generatedVariations, currentVariationIndex);
  const skyboxUrl = resolveSkyboxUrl(skybox);
  const assetUrl = resolveGenerated3DAssetUrl(generated3DAsset);

  if (assetUrl) {
    return (
      <AssetViewerWithSkybox
        assetUrl={assetUrl}
        skyboxImageUrl={skyboxUrl}
        assetFormat={resolveAssetFormat(generated3DAsset)}
        className="h-full w-full"
        autoRotate={false}
      />
    );
  }

  if (skyboxUrl) {
    return (
      <SkyboxFullScreen
        isBackground
        skyboxData={{
          ...skybox,
          image: skyboxUrl,
          image_jpg: skybox.image_jpg || skyboxUrl,
        }}
      />
    );
  }

  return <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0b1224_0%,#000_70%)]" />;
};

export default SpiralResultViewer;

