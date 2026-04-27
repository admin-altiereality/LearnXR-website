/**
 * krpano XML for equirectangular 360° video using the official videoplayer plugin.
 * Place videoplayer.js from the krpano 1.23 package in public/krpano/plugins/ if you use this with embedKrpano.
 * @see https://krpano.com/docu/xml/ — Sphere with Video-Input, videoplayer plugin
 */

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pluginUrl(origin: string | undefined, basePath: string, pluginFile: string): string {
  if (origin) {
    return `${origin.replace(/\/$/, '')}${basePath.replace(/\/$/, '')}/plugins/${pluginFile}`;
  }
  return `plugins/${pluginFile}`;
}

export interface Krpano360VideoXmlOptions {
  /** Absolute or site-root URL to equirectangular 360 video (e.g. https://host/videovrtour/tour-1.mp4) */
  videoUrl: string;
  basePath?: string;
  /** window.location.origin for plugin includes when loading XML from a blob */
  origin?: string;
  /** Initial view */
  hlookat?: number;
  vlookat?: number;
  fov?: number;
  /** Include WebVR (requires webvr plugin includes like buildKrpanoXml) */
  webvr?: boolean;
}

/**
 * Produces krpano XML: sphere with plugin:video + videoplayer with videourl.
 * Requires public/krpano/plugins/videoplayer.js from a licensed krpano build.
 */
export function buildKrpano360VideoXml(options: Krpano360VideoXmlOptions): string {
  const {
    videoUrl,
    basePath = '/krpano/',
    origin,
    hlookat = 0,
    vlookat = 0,
    fov = 90,
  } = options;

  const safeVideo = escapeXml(videoUrl);
  const videoPlugin = pluginUrl(origin, basePath, 'videoplayer.js');
  const onviewchangeJs = 'js( window.__krpanoOnViewChange &amp;&amp; window.__krpanoOnViewChange(get(view.hlookat), get(view.vlookat), get(view.fov)) );';
  const webvrInclude =
    options.webvr && origin
      ? `  <include url="${escapeXml(pluginUrl(origin, basePath, 'webvr.xml'))}" />\n`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<krpano version="1.23" onstart="" bgcolor="0x050810">
${webvrInclude}  <view hlookat="${hlookat}" vlookat="${vlookat}" fov="${fov}" fovmin="1" fovmax="179" />
  <events onviewchange="${onviewchangeJs}" />
  <image>
    <sphere url="plugin:video" />
  </image>
  <plugin name="video" url="${escapeXml(videoPlugin)}" videourl="${safeVideo}" />
  <control mouse="drag" touch="drag" />
</krpano>`;
}
