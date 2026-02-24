# krpano viewer for VR Lesson Player

This folder must contain the krpano HTML5 viewer so the VR Lesson Player (krpano version) can load 360° panoramas.

## Setup

1. **Copy the main viewer script** from the LearnXR-website-main repo:
   - From: `LearnXR-website-main/js/eiffeltower.js`
   - To: **`krpano.js`** (this folder, i.e. `public/krpano/krpano.js`)

2. **Copy the WebVR plugin** (and any other plugins you need):
   - Create a subfolder: `public/krpano/plugins/`
   - From: `LearnXR-website-main/swf/plugins/`
   - Copy at least:
     - `webvr.js`
     - `webvr.xml`
   - Optional: copy other plugins (e.g. `videoplayer.js`) if you use them.

## Resulting structure

```
public/krpano/
  README.md                    (this file)
  krpano.js                    (HTML5 viewer, see below)
  plugins/
    webvr.js
    webvr.xml
    threejs_krpanoplugin.js    (required for 3D model rendering)
```

## Krpano 1.22+ and Three.js plugin (3D models)

To render **3D assets (GLB/GLTF)** inside the same Krpano viewer as the 360° sphere, you need **krpano 1.22 or newer** and the **Three.js plugin**. The Three.js plugin is not available for 1.20.x.

1. **Obtain krpano 1.22+**  
   From [krpano.com](https://krpano.com/) (Downloads): get the **HTML5 viewer** for version **1.22** (or 1.23). Replace `krpano.js` with this build.

2. **WebVR plugin for 1.22+**  
   From the same krpano package, copy the 1.22+ **WebVR plugin** (`webvr.js`, `webvr.xml`) into `plugins/` so they match the viewer version.

3. **Three.js plugin**  
   From [krpano.com/plugins/threejs/](https://krpano.com/plugins/threejs/): download **threejs_krpanoplugin.js** for the same viewer version (1.22 or 1.23). Place it as `plugins/threejs_krpanoplugin.js`. An opensource version of the plugin is also available from krpano; use the file name specified in their docs if different.

**License**: The commercial krpano viewer and some plugins may require a license. The opensource Three.js plugin variant can be used according to krpano’s terms.

### License upgrade (remove "old license" / "license upgrade required")

The licensee name and license state are **embedded in the krpano viewer file** (`krpano.js`). Updating the license at krpano.com does not change the deployed file; you must replace it with the viewer from your **new** licensed package.

1. Register the new license at [krpano.com/buy/howtoregister/](https://krpano.com/buy/howtoregister/).
2. In krpano Tools, generate the viewer for the same version (e.g. 1.23.3) and download the viewer package.
3. **Replace** `server/client/public/krpano/krpano.js` with the new `krpano.js` from that viewer folder.
4. Rebuild and redeploy so the hosted site serves the new file (e.g. `npm run build:hosting` then deploy to Firebase).

4. **Plugin is enabled by default**  
   The app uses the Three.js plugin when `krpano.js` is 1.22+ and `threejs_krpanoplugin.js` is present. Set `VITE_KRPANO_USE_THREEJS_PLUGIN=false` in `.env` to disable and use the integrated R3F scene for 3D instead.

## Note

This project uses **krpano 1.23.3** with the **Three.js plugin** for 3D model rendering inside the same viewer as the 360° sphere. If you need to fall back to the integrated R3F scene (e.g. when using an older krpano build), set `VITE_KRPANO_USE_THREEJS_PLUGIN=false`.

---

## How to test the krpano VR Lesson Player

1. **Start the app**  
   From the project root (or `server/client`):  
   `npm run dev` (or your usual start command).

2. **Open a lesson the normal way**  
   - Log in, go to **Lessons**.
   - Pick a lesson that has a **skybox** (360° image). Start it so you land on the **original** VR player at `/vrlessonplayer`.  
   - Wait until the welcome screen appears (lesson data and skybox are loaded).

3. **Switch to the krpano player**  
   - In the browser address bar, change the URL from  
     `/vrlessonplayer`  
     to  
     `/vrlessonplayer-krpano`  
     and press Enter.  
   - The same lesson is used (from `sessionStorage.activeLesson`).

4. **Check that it works**  
   - **Loading**: “Loading environment...” then the 360° view appears (no red errors in console).
   - **View**: You can drag to look around the panorama; optional WebVR button if the plugin is present.
   - **Flow**: Welcome screen → “Start Lesson” → TTS/avatar, MCQs, chat, etc., behave the same as the original player.

5. **If there’s no skybox**  
   You’ll see “No skybox available” and the lesson can still start (scene is marked ready). Use a topic with a skybox URL to test the full 360° + krpano path.

6. **Console checks**  
   - Open DevTools (F12) → Console.  
   - No `Failed to load krpano script` or `embedpano not available`.  
   - Optional: set `DEBUG = true` in `VRLessonPlayerKrpano.tsx` for `[VRPlayer]` logs (skybox URL, TTS, etc.).

### "Unknown action: 90" in console

Action code `90` is an internal krpano/plugin action. It can appear when the viewer is in a restricted/demo state (e.g. old license) or when the Three.js plugin expects features not available. After fixing the license (replace `krpano.js` with the new licensed build) and ensuring 3D model URLs use the proxy path ending in `model.glb` (so format is detected), rebuild and test again. If the message disappears or decreases, it was likely license/plugin-related. If it persists, check krpano 1.23 release notes or the forum for "action 90" with your exact viewer and plugin build dates.
