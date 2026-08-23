/**
 * Build krpano viewer XML for VR Lesson Player.
 * Uses sphere for equirectangular skybox; supports optional depthmap, WebVR,
 * guided lookat by phase, and hotspots.
 * @see https://krpano.com/docu/xml/
 */

/** Look-at target in degrees (hlookat, vlookat) and optional FOV */
export interface LookatTarget {
  h: number;
  v: number;
  fov?: number;
}

/** Look-at targets keyed by lesson phase (intro, explanation, outro) */
export type LookatByPhase = Record<string, LookatTarget>;

/** Single hotspot: spherical position (ath, atv in degrees) and label/caption */
export interface KrpanoHotspotOption {
  name: string;
  ath: number;
  atv: number;
  /** Caption or HTML for text hotspot */
  label: string;
  /** Optional icon image URL; if omitted, a text hotspot is used */
  url?: string;
  /** Depth in cm (default 1000) */
  depth?: number;
}

export interface KrpanoXmlOptions {
  /** Equirectangular image URL for 360° background */
  sphereUrl: string;
  /** Optional depthmap image or 3D model URL for parallax/VR */
  depthmapUrl?: string;
  /** Base path for plugin includes (e.g. "/krpano/") */
  basePath?: string;
  /** Origin (e.g. window.location.origin) so plugin includes use absolute URLs when XML is loaded from a blob */
  origin?: string;
  /** Include WebVR plugin for headset support */
  webvr?: boolean;
  /** Initial view hlookat (degrees) */
  hlookat?: number;
  /** Initial view vlookat (degrees) */
  vlookat?: number;
  /** Initial FOV (degrees) */
  fov?: number;
  /** Optional look-at targets per lesson phase (intro, explanation, outro); used for initial view and by player for guided lookto */
  lookatByPhase?: LookatByPhase;
  /** Optional hotspots to place in the pano; onclick will call window.__krpanoOnHotspotClick(name) */
  hotspots?: KrpanoHotspotOption[];
  /** Optional GLB/GLTF URLs to render as threejs 3D hotspots (requires Three.js plugin) */
  threeJsAssetUrls?: string[];
  /** Stable content asset IDs parallel to `threeJsAssetUrls`, used for XR selection and class sync. */
  assetInteractionIds?: string[];
  /** Optional per-asset spherical placement, parallel to `threeJsAssetUrls` (same index, same length).
   * When an entry is present, it overrides the default grid layout for that asset — used for
   * Street View Tour "floating" assets placed by the author (ath/atv in degrees, depth in cm). */
  assetPlacements?: Array<{ ath?: number; atv?: number; depth?: number; scale?: number; rotationY?: number } | undefined>;
  /** Optional teacher avatar GLB URL; when set, adds teacher_avatar threejs hotspot and soundinterface for directional TTS */
  avatarModelUrl?: string;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Default pin icon as data URL (small orange circle) so hotspots work without external image */
const DEFAULT_HOTSPOT_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="%23f97316" stroke="%23fff" stroke-width="3" opacity="0.95"/><circle cx="24" cy="24" r="8" fill="%23fff"/></svg>'
  );

const KRPANO_ASSET_VERSION = '1.23.3-r12';

/**
 * Build hotspot XML for one hotspot. Uses image url or a default pin icon.
 * onclick calls window.__krpanoOnHotspotClick(name) for React.
 */
function buildHotspotXml(spot: KrpanoHotspotOption, index: number): string {
  const name = `lesson_hotspot_${index}`;
  const ath = Number.isFinite(Number(spot.ath)) ? Number(spot.ath) : 0;
  const atv = Number.isFinite(Number(spot.atv)) ? Number(spot.atv) : 0;
  const depthValue = spot.depth ?? 1000;
  const depth = Number.isFinite(Number(depthValue)) ? Number(depthValue) : 1000;
  const hotspotId = escapeXml(String(spot.name || name));
  const onclick = "jscall('window.__krpanoOnHotspotClick(caller.datahotspotid)');";
  const url = spot.url ? escapeXml(spot.url) : DEFAULT_HOTSPOT_ICON;
  const title = escapeXml(spot.label);
  return `<hotspot name="${name}" datahotspotid="${hotspotId}" ath="${ath}" atv="${atv}" depth="${depth}" url="${url}" tooltip="${title}" scale="0.4" distorted="false" zoom="false" onover="tween(scale,0.5)" onout="tween(scale,0.4)" onclick="${onclick}" />`;
}

/** Resolve plugin URL for blob-loaded XML (origin + basePath + plugins/name) */
function pluginUrl(origin: string | undefined, basePath: string, pluginFile: string): string {
  const pluginWithVersion = `${pluginFile}?v=${KRPANO_ASSET_VERSION}`;
  if (origin) {
    return `${origin.replace(/\/$/, '')}${basePath.replace(/\/$/, '')}/plugins/${pluginWithVersion}`;
  }
  return `plugins/${pluginWithVersion}`;
}

/** Only GLB/GLTF URLs are valid for threejs hotspots; filter out images and other formats. */
function isGlbOrGltfUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /\.(glb|gltf)([?#]|$)/i.test(url) || /\.glb\b/i.test((url.split('?')[0] ?? '').trim());
}

function isBlobModelUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('blob:') && isGlbOrGltfUrl(url);
}

/** True if url is a proxy URL that points to a GLB (target in query param). Caller already validated original as GLB. */
function isProxyToGlb(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (!lower.includes('proxy-asset') && !lower.includes('proxy_asset')) return false;
  try {
    const u = new URL(url);
    const target = u.searchParams.get('url') || '';
    return isGlbOrGltfUrl(target);
  } catch {
    return false;
  }
}

/**
 * Build krpano XML string for embedding.
 * Plugin includes are relative to basePath (e.g. plugins/webvr.xml).
 */
export function buildKrpanoXml(options: KrpanoXmlOptions): string {
  const {
    sphereUrl,
    depthmapUrl,
    basePath = '/krpano/',
    origin,
    webvr = true,
    hlookat: optH = 0,
    vlookat: optV = -5,
    fov: optFov = 90,
    lookatByPhase,
    hotspots = [],
    threeJsAssetUrls = [],
    assetInteractionIds = [],
    assetPlacements = [],
    avatarModelUrl,
  } = options;

  // Include direct .glb/.gltf URLs and proxy URLs that point to GLB (proxy-asset?url=...).
  // `assetPlacements` (when provided) is kept aligned index-for-index with `threeJsAssetUrls`.
  const safe3dEntries = threeJsAssetUrls
    .map((url, i) => ({ url, placement: assetPlacements[i], interactionId: assetInteractionIds[i] || `asset_${i}` }))
    .filter((e) => isGlbOrGltfUrl(e.url) || isProxyToGlb(e.url) || isBlobModelUrl(e.url));
  const safe3dUrls = safe3dEntries.map((e) => e.url);
  const has3dAssets = safe3dUrls.length > 0;
  const hasAvatar = !!(avatarModelUrl && (isGlbOrGltfUrl(avatarModelUrl) || avatarModelUrl.endsWith('.glb') || avatarModelUrl.endsWith('.gltf')));
  // Include threejs block when we have 3D assets and/or teacher avatar, or WebVR (for immersive UI panel)
  const has3d = has3dAssets || hasAvatar;
  const needThreeJs = has3d || webvr;

  // Initial view: use first phase lookat if provided, else options
  const firstLookat = lookatByPhase && (lookatByPhase.intro ?? lookatByPhase.explanation ?? lookatByPhase.outro);
  const hlookat = firstLookat?.h ?? optH;
  const vlookat = firstLookat?.v ?? optV;
  const fov = firstLookat?.fov ?? optFov;

  const safeSphereUrl = escapeXml(sphereUrl);

  const webvrIncludeUrl = pluginUrl(origin, basePath, 'webvr.xml');
  const immersiveUiIncludeUrl = pluginUrl(origin, basePath, 'immersive_ui.xml');
  const xrInputIncludeUrl = pluginUrl(origin, basePath, 'xr_input.xml');
  const nativeVrLessonUiIncludeUrl = pluginUrl(origin, basePath, 'native_vr_lesson_ui.xml');
  const ambienceIncludeUrl = pluginUrl(origin, basePath, 'classroom_ambience.xml');
  const annotationLayerIncludeUrl = pluginUrl(origin, basePath, 'annotation_layer.xml');
  const gyro2PluginUrl = pluginUrl(origin, basePath, 'gyro2.js');
  const includeWebVr = webvr
    ? `  <include url="${escapeXml(webvrIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(immersiveUiIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(xrInputIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(nativeVrLessonUiIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(ambienceIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(annotationLayerIncludeUrl)}" />\n`
    : '';
  const gyroBlock = `  <plugin name="gyro" url="${escapeXml(gyro2PluginUrl)}" keep="true" keepaliveduration="60" />\n`;

  // Three.js plugin + controls3d + drag3d when we have 3D assets, avatar, or WebVR (immersive UI)
  const threeJsPluginUrl = pluginUrl(origin, basePath, 'threejs_krpanoplugin.js');
  const soundinterfaceUrl = pluginUrl(origin, basePath, 'soundinterface.js');
  const controls3dIncludeUrl = pluginUrl(origin, basePath, 'controls3d.xml');
  const drag3dIncludeUrl = pluginUrl(origin, basePath, 'drag3d.xml');
  const iphoneSwipeIncludeUrl = pluginUrl(origin, basePath, 'iphone_fullscreen_swipe.xml');
  // controls3d + drag3d are restored to HEAD's behaviour (always included with the
  // threejs plugin). They provide the on-screen joypad and level control, and HEAD —
  // where dragging worked — loaded them with control.dragscale linked to 0. So neither
  // the plugin nor dragscale disables panning; removing them was my error.
  const threeJsBlock = needThreeJs
    ? `  <include url="${escapeXml(controls3dIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(drag3dIncludeUrl)}" />\n` +
      `  <include url="${escapeXml(iphoneSwipeIncludeUrl)}" />\n` +
      `  <plugin api="threejs" keep="true" url="${escapeXml(threeJsPluginUrl)}" />\n` +
      (hasAvatar ? `  <plugin name="soundinterface" url="${escapeXml(soundinterfaceUrl)}" preload="true" keep="true" />\n` : '') +
      `  <threejs ambientlight="0.3" shadowmap="pcf" />\n` +
      `  <display depthbuffer="true" depthrange="5,100000" />\n` +
      `  <hotspot name="lesson_light" type="threejslight" mode="sun" intensity="2.0" castshadow="true" ath="-90" atv="45" keep="true" />\n`
    : '';

  const depthmapBlock = depthmapUrl
    ? `    <depthmap url="${escapeXml(depthmapUrl)}" enabled="true" />\n`
    : '';

  const hotspotBlocks = hotspots.map((spot, index) => '  ' + buildHotspotXml(spot, index)).join('\n');
  const hotspotsSection = hotspotBlocks ? '\n' + hotspotBlocks + '\n' : '';

  // 3D model hotspots (type="threejs"). When an author-specified placement (ath/atv/depth)
  // is provided (Street View Tour floating assets), position on the sphere directly;
  // otherwise fall back to the default spaced-out grid so assets don't overlap (Quest + Web).
  const threeJsHotspotBlocks = safe3dEntries
    .map(({ url, placement, interactionId }, i) => {
      const safeUrl = escapeXml(url);
      const name = `asset_${i}`;
      const safeInteractionId = escapeXml(interactionId);
      const scale = placement?.scale ?? 1;
      const roty = placement?.rotationY !== undefined ? ` ry="${placement.rotationY}"` : '';
      const interaction = ` dataassetid="${safeInteractionId}" onclick="js(window.__krpanoLicensedModelAction &amp;&amp; window.__krpanoLicensedModelAction(get(caller.dataassetid)));" onup="js(window.__krpanoLicensedModelTransform &amp;&amp; window.__krpanoLicensedModelTransform(get(caller.dataassetid), get(caller.tx), get(caller.ty), get(caller.tz), get(caller.rx), get(caller.ry), get(caller.rz), get(caller.scale)));"`;
      if (placement && (placement.ath !== undefined || placement.atv !== undefined)) {
        const ath = placement.ath ?? 0;
        const atv = placement.atv ?? 0;
        const depth = placement.depth ?? 500;
        return `  <hotspot name="${name}" type="threejs" url="${safeUrl}" ath="${ath}" atv="${atv}" depth="${depth}" scale="${scale}"${roty}${interaction} hittest="true" capture="true" handcursor="true" castshadow="true" receiveshadow="true" convertmaterials="all-to-standard" ondown="drag3d();" />`;
      }
      const col = i % 3;
      const row = Math.floor(i / 3);
      const tx = 40 + (col - 1) * 90;
      const ty = -20 - row * 25;
      const tz = 180 + row * 90;
      return `  <hotspot name="${name}" type="threejs" url="${safeUrl}" depth="0" scale="${scale}" tx="${tx}" ty="${ty}" tz="${tz}"${roty}${interaction} hittest="true" capture="true" handcursor="true" castshadow="true" receiveshadow="true" convertmaterials="all-to-standard" ondown="drag3d();" />`;
    })
    .join('\n');
  // Teacher avatar: center, standing (feet near floor, head near eye level).
  const avatarUrlResolved = hasAvatar && avatarModelUrl
    ? (avatarModelUrl.startsWith('http') ? avatarModelUrl : `${(origin || '').replace(/\/$/, '')}${avatarModelUrl.startsWith('/') ? '' : '/'}${avatarModelUrl}`.trim())
    : '';
  const teacherAvatarHotspot = hasAvatar && avatarUrlResolved
    ? `  <hotspot name="teacher_avatar" type="threejs" url="${escapeXml(avatarUrlResolved)}" depth="0" scale="1" tx="-80" ty="-60" tz="180" hittest="false" visible="false" castshadow="false" receiveshadow="false" convertmaterials="all-to-standard" />\n`
    : '';
  const threeJsHotspotsSection = threeJsHotspotBlocks || teacherAvatarHotspot ? '\n' + (teacherAvatarHotspot + threeJsHotspotBlocks) + '\n' : '';

  // The Three.js canvas is visual-only; aligned KRPano hotspots provide XR hit targets.
  const iuPanel =
    '  <hotspot name="iu_panel_3d" type="threejs" url="custom" depth="0" scale="1" tx="0" ty="10" tz="250" hittest="false" keep="true" onloaded="immersive_ui_build_hotspot();" />';
  // Teacher marker layer: an equirect-textured BackSide sphere just inside the
  // panorama. Because strokes are stored as (ath, atv) they map straight to canvas
  // pixels, so this needs no raycasting and no per-frame work.
  const annotationLayer =
    '  <hotspot name="annotation_layer_3d" type="threejs" url="custom" depth="0" scale="1" hittest="false" keep="true" onloaded="annotation_layer_build();" />';
  const immersiveUiThreeJsHotspotsSection =
    webvr && needThreeJs
      ? '\n' + iuPanel + '\n' + annotationLayer + '\n'
      : '';

  // View sync per krpano docs: view.hlookat (-180..180), view.vlookat (-90..90), view.fov (degrees).
  // https://krpano.com/docu/xml/#view - onviewchange fires when view changes (drag, zoom). Use it to sync.
  const onviewchangeJs = 'js( window.__krpanoOnViewChange &amp;&amp; window.__krpanoOnViewChange(get(view.hlookat), get(view.vlookat), get(view.fov)) );';
  return `<?xml version="1.0" encoding="UTF-8"?>
<krpano version="1.23" onstart="" bgcolor="0x050810">
${includeWebVr}${threeJsBlock}${gyroBlock}
  <view hlookat="${hlookat}" vlookat="${vlookat}" fov="${fov}" fovmin="1" fovmax="179" />
  <events onviewchange="${onviewchangeJs}" />
  <action name="sync_view_to_js">js( window.__krpanoOnViewChange &amp;&amp; window.__krpanoOnViewChange(get(view.hlookat), get(view.vlookat), get(view.fov)) );</action>
  <image>
    <sphere url="${safeSphereUrl}" />
${depthmapBlock}  </image>
  <control mouse="drag" touch="drag" />${hotspotsSection}${threeJsHotspotsSection}${immersiveUiThreeJsHotspotsSection}</krpano>`;
}
