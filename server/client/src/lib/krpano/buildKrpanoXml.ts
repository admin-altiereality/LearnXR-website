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
  /** Include the Three.js plugin for 3D model hotspots (krpano 1.22+). When true, threejsPluginUrl and threejsModelHotspots are used. */
  threejsPlugin?: boolean;
  /** Full URL to threejs_krpanoplugin.js, or relative path when no origin. Defaults to origin+basePath+plugins/threejs_krpanoplugin.js when origin set. */
  threejsPluginUrl?: string;
  /** 3D model hotspots (type="threejs"). Units: 1 = 1 cm. Omit or empty when not using Three.js plugin. */
  threejsModelHotspots?: Array<{
    name: string;
    url: string;
    tx?: number;
    ty?: number;
    tz?: number;
    scale?: number;
  }>;
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

/**
 * Build hotspot XML for one hotspot. Uses image url or a default pin icon.
 * onclick calls window.__krpanoOnHotspotClick(name) for React.
 */
function buildHotspotXml(spot: KrpanoHotspotOption): string {
  const name = escapeXml(spot.name);
  const ath = spot.ath;
  const atv = spot.atv;
  const depth = spot.depth ?? 1000;
  const onclick = `js( window.__krpanoOnHotspotClick && window.__krpanoOnHotspotClick('${name.replace(/'/g, "\\'")}') );`;
  const url = spot.url ? escapeXml(spot.url) : DEFAULT_HOTSPOT_ICON;
  const title = escapeXml(spot.label);
  return `<hotspot name="${name}" ath="${ath}" atv="${atv}" depth="${depth}" url="${url}" tooltip="${title}" scale="0.4" distorted="false" zoom="false" onover="tween(scale,0.5)" onout="tween(scale,0.4)" onclick="${onclick}" />`;
}

/**
 * Build krpano XML string for embedding.
 * Plugin includes are relative to basePath (e.g. plugins/webvr.xml).
 */
/**
 * Build one Three.js 3D model hotspot XML (krpano units: 1 = 1 cm).
 */
function buildThreejsHotspotXml(
  item: { name: string; url: string; tx?: number; ty?: number; tz?: number; scale?: number },
  index: number,
  total: number
): string {
  const n = total;
  const tx = item.tx ?? (index - (n - 1) / 2) * 300;
  const ty = item.ty ?? 0;
  const tz = item.tz ?? -500;
  const scale = item.scale ?? 100;
  const name = escapeXml(item.name);
  const url = escapeXml(item.url);
  return `  <hotspot name="${name}" type="threejs" url="${url}" depth="0" tx="${tx}" ty="${ty}" tz="${tz}" scale="${scale}" />`;
}

export function buildKrpanoXml(options: KrpanoXmlOptions): string {
  const {
    sphereUrl,
    depthmapUrl,
    basePath = '/krpano/',
    origin,
    webvr = true,
    hlookat: optH = 0,
    vlookat: optV = 0,
    fov: optFov = 90,
    lookatByPhase,
    hotspots = [],
    threejsPlugin = false,
    threejsPluginUrl: optThreejsPluginUrl,
    threejsModelHotspots = [],
  } = options;

  // Initial view: use first phase lookat if provided, else options
  const firstLookat = lookatByPhase && (lookatByPhase.intro ?? lookatByPhase.explanation ?? lookatByPhase.outro);
  const hlookat = firstLookat?.h ?? optH;
  const vlookat = firstLookat?.v ?? optV;
  const fov = firstLookat?.fov ?? optFov;

  const safeSphereUrl = escapeXml(sphereUrl);

  const webvrIncludeUrl = origin
    ? `${origin.replace(/\/$/, '')}${basePath.replace(/\/$/, '')}/plugins/webvr.xml`
    : 'plugins/webvr.xml';
  const includeWebVr = webvr ? `  <include url="${escapeXml(webvrIncludeUrl)}" />\n` : '';

  const threejsPluginUrl =
    optThreejsPluginUrl ??
    (origin
      ? `${origin.replace(/\/$/, '')}${basePath.replace(/\/$/, '')}/plugins/threejs_krpanoplugin.js`
      : 'plugins/threejs_krpanoplugin.js');
  const useThreejs = threejsPlugin && threejsModelHotspots.length > 0;
  const includeThreejs =
    useThreejs
      ? `  <plugin name="threejs" api="threejs" keep="true" url="${escapeXml(threejsPluginUrl)}" useembeddedthreejs="true" integratedrendering="true" adjustlightfalloff="true" cache="true" />\n  <threejs shadowmap="pcf" ambientlight="1.0" />\n`
      : '';

  const depthmapBlock = depthmapUrl
    ? `    <depthmap url="${escapeXml(depthmapUrl)}" enabled="true" />\n`
    : '';

  const hotspotBlocks = hotspots.map((spot) => '  ' + buildHotspotXml(spot)).join('\n');
  const hotspotsSection = hotspotBlocks ? '\n' + hotspotBlocks + '\n' : '';

  const threejsHotspotBlocks = threejsModelHotspots
    .map((item, i) => buildThreejsHotspotXml(item, i, threejsModelHotspots.length))
    .join('\n');
  const threejsHotspotsSection = threejsHotspotBlocks ? '\n' + threejsHotspotBlocks + '\n' : '';

  // View sync per krpano docs: onviewchange fires on every view change; sync_view_to_js allows JS to poll view (get(view.hlookat/vlookat/fov)).
  const onviewchangeJs = 'js( window.__krpanoOnViewChange &amp;&amp; window.__krpanoOnViewChange(get(view.hlookat), get(view.vlookat), get(view.fov)) );';
  const krpanoVersion = useThreejs ? '1.23' : '1.20';
  return `<?xml version="1.0" encoding="UTF-8"?>
<krpano version="${krpanoVersion}" onstart="" bgcolor="0x050810">
${includeWebVr}${includeThreejs}
  <view hlookat="${hlookat}" vlookat="${vlookat}" fov="${fov}" fovmin="1" fovmax="179" />
  <events onviewchange="${onviewchangeJs}" />
  <action name="sync_view_to_js">js( window.__krpanoOnViewChange &amp;&amp; window.__krpanoOnViewChange(get(view.hlookat), get(view.vlookat), get(view.fov)) );</action>
  <image>
    <sphere url="${safeSphereUrl}" />
${depthmapBlock}  </image>
  <control mouse="drag" touch="drag" />${hotspotsSection}${threejsHotspotsSection}</krpano>`;
}
