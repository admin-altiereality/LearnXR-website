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
  README.md          (this file)
  krpano.js          (copy of eiffeltower.js)
  plugins/
    webvr.js
    webvr.xml
```

## Note

The krpano viewer in LearnXR-website-main is version **1.20.9**. For production you may use a licensed krpano build; the embed API is the same.

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
