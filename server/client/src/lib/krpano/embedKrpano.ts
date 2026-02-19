/**
 * Load krpano viewer script and embed with dynamic XML.
 * Expects krpano viewer at /krpano/krpano.js and plugins at /krpano/plugins/.
 */

declare global {
  interface Window {
    krpanoJS?: {
      embedpano: (options: KrpanoEmbedOptions) => void;
    };
  }
}

export interface KrpanoEmbedOptions {
  xml: string;
  target: string | HTMLElement;
  basepath?: string;
  onready?: (krpano: unknown) => void;
  onerror?: (message: string) => void;
  id?: string;
  width?: string;
  height?: string;
  bgcolor?: string;
  initvars?: Record<string, string>;
}

const SCRIPT_ID = 'krpano-viewer-script';
const SCRIPT_URL = '/krpano/krpano.js';

/**
 * Load the krpano viewer script once. Resolves when krpanoJS.embedpano is available.
 */
export function loadKrpanoScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window undefined'));
  if (window.krpanoJS && typeof window.krpanoJS.embedpano === 'function') {
    return Promise.resolve();
  }
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.krpanoJS?.embedpano) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load krpano script')));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.krpanoJS && typeof window.krpanoJS.embedpano === 'function') {
        resolve();
      } else {
        reject(new Error('krpano embedpano not available after load'));
      }
    };
    script.onerror = () => reject(new Error(`Failed to load ${SCRIPT_URL}`));
    document.head.appendChild(script);
  });
}

/**
 * krpano expects xml to be a URL to an XML file (it fetches it via GET).
 * Passing inline XML as a string is treated as a URL and gets mangled (e.g. "=" → "-").
 * Convert inline XML to a Blob URL so the viewer fetches correct content.
 */
function toXmlUrlIfInline(xml: string): { url: string; revoke: () => void } {
  const isInline =
    typeof xml === 'string' &&
    xml.length > 10 &&
    (xml.trimStart().startsWith('<?xml') || xml.trimStart().startsWith('<krpano'));
  if (!isInline) {
    return { url: xml, revoke: () => {} };
  }
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke: () => {
      URL.revokeObjectURL(url);
    },
  };
}

/**
 * Embed krpano viewer into the given container with the provided XML.
 * Call loadKrpanoScript() first.
 * When xml is inline XML string, it is converted to a Blob URL so krpano receives valid XML.
 */
export function embedKrpano(options: KrpanoEmbedOptions): void {
  if (!window.krpanoJS || typeof window.krpanoJS.embedpano !== 'function') {
    options.onerror?.('krpano viewer not loaded. Call loadKrpanoScript() first.');
    return;
  }
  const { url: xmlUrl, revoke } = toXmlUrlIfInline(options.xml);
  const userOnready = options.onready;
  const opts: KrpanoEmbedOptions = {
    width: '100%',
    height: '100%',
    bgcolor: '#050810',
    basepath: '/krpano/',
    ...options,
    xml: xmlUrl,
    onready: userOnready
      ? (krpano: unknown) => {
          try {
            userOnready(krpano);
          } finally {
            revoke();
          }
        }
      : () => revoke(),
  };
  window.krpanoJS.embedpano(opts);
}
