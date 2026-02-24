# krpano viewer for VR Lesson Player

This folder contains the krpano HTML5 viewer so the VR Lesson Player (krpano version) can load 360° panoramas and 3D assets (GLB/GLTF) via the Three.js plugin.

## Version and contents

- **krpano 1.23.3** (from `krpano-1.23.3/viewer/` in this repo).
- **Main script**: `krpano.js`
- **Plugins** (in `plugins/`):
  - **webvr.xml**, **webvr.js** – WebVR / headset support
  - **threejs_krpanoplugin.js** – Three.js plugin for 3D model hotspots (GLB/GLTF)
  - **controls3d.xml** – 3D controls (movement, collision)
  - **drag3d.xml** – Drag 3D objects in the scene
  - **iphone_fullscreen_swipe.xml** – iPhone fullscreen swipe helper

## Resulting structure

```
public/krpano/
  README.md
  krpano.js
  plugins/
    webvr.xml
    webvr.js
    controls3d.xml
    drag3d.xml
    iphone_fullscreen_swipe.xml
    threejs_krpanoplugin.js
```

## Note

When lessons have both a skybox and 3D assets (GLB), the player uses krpano with the Three.js plugin to render 3D models as `type="threejs"` hotspots inside the same 360° view. Lessons with only a skybox use krpano with sphere + WebVR; lessons with only a GLB (no skybox) use the React Three Fiber model-only path.

## License

The license is embedded in the viewer file (`krpano.js`), not in the app code. If you see **"Registered to: ... (old license)"** in the browser console after renewing:

1. Open **krpano Tools**, go to registration, and paste your **new** license code.
2. **Re-generate the viewer**: run the **Update Tool** or use **kprotect** to produce a new `krpano.js`.
3. **Replace** this folder’s `krpano.js` with the newly generated file, then rebuild and redeploy hosting.

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
   - **View**: You can drag to look around the panorama; optional WebVR / Enter VR on supported devices.
   - **3D assets**: If the lesson has GLB/GLTF assets, they appear as 3D objects in the scene (draggable when drag3d is used).
   - **Flow**: Welcome screen → “Start Lesson” → TTS/avatar, MCQs, chat, etc., behave the same as the original player.

5. **If there’s no skybox**  
   You’ll see “No skybox available” and the lesson can still start (scene is marked ready). Use a topic with a skybox URL to test the full 360° + krpano path.

6. **Console checks**  
   - Open DevTools (F12) → Console.  
   - No `Failed to load krpano script` or `embedpano not available`.  
   - Optional: set `DEBUG = true` in `VRLessonPlayerKrpano.tsx` for `[VRPlayer]` logs (skybox URL, TTS, etc.).
