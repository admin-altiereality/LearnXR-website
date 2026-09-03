/**
 * One Draco decoder location for every GLTFLoader in the app.
 *
 * Before this, four call sites pointed at `/draco/` - a directory that does not exist
 * in `public/`, so any Draco-compressed model would have failed to decode there - and
 * two others used the gstatic CDN on two different versions, which meant the browser
 * downloaded and cached the decoder twice.
 *
 * Nothing in the pipeline currently *writes* Draco geometry (glbCompression.ts
 * compresses textures only), so this removes a latent trap rather than enabling
 * anything today. If Draco encoding is ever turned on, prefer vendoring the decoder
 * into `public/draco/` so the player does not depend on a third-party host.
 */
export const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
