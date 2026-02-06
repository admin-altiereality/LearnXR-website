# TTS Regenerate – Verification

## 1. New audio replaces old (no duplicates)

- **Storage:** Files are written to a **fixed path** and overwritten:
  - `chapter_tts/{chapterId}/{topicId}/{topicId}_{scriptType}_{language}.mp3`
- **Firestore:** Same document ID is updated with `set(..., { merge: true })`:
  - `chapter_tts/{topicId}_{scriptType}_{language}_female_professional`
- So each regenerate **replaces** the previous file and doc; no new files or docs are created.

## 2. Lesson structure is unchanged

- **Updated:** Only the `chapter_tts` collection (audio URLs) and, when needed, the topic’s TTS ID lists.
- **Chapter doc:** `curriculum_chapters/{chapterId}` is updated **only when** the topic did not already have these TTS IDs for this language (`needsChapterUpdate`). Then only:
  - `topics[topicIndex].tts_ids_by_language[language]`
  - `topics[topicIndex].tts_ids`
  - `updatedAt`
  are written. No change to topic titles, order, scripts, MCQs, assets, or other lesson structure.

## 3. How the lesson player gets audio

- **Bundle:** When a lesson is opened/played, `getLessonBundle()` runs and fetches the latest `chapter_tts` docs by ID (from `tts_ids_by_language` or legacy `tts_ids`).
- **Player:** Uses `bundle.tts` (each item has `audio_url`). So after a regenerate, the **next** time the lesson is loaded, the bundle contains the **new** `audio_url` and the player plays the new audio.

## 4. How to verify by playing

1. **Regenerate in Studio**
   - Open the chapter/topic in the studio → Avatar Scripts tab.
   - Optionally change a script line.
   - Click **Regenerate Audios** (choose language, e.g. GB English).
   - Wait for success.

2. **Play the lesson**
   - Go to the lesson list (dashboard or wherever you launch lessons).
   - Open/select **the same chapter and topic** (this triggers a new `getLessonBundle()` fetch).
   - Click **Play** and enter the VR/lesson player.

3. **Check audio**
   - Play through the lesson and confirm the avatar/lesson audio is the **new** content (e.g. the line you changed).
   - Intro / explanation / outro should all reflect the regenerated TTS.

4. **Optional: confirm in Firestore**
   - In Firebase Console → Firestore → `chapter_tts`, find the doc IDs for that topic (e.g. `{topicId}_intro_en_female_professional`). Check that `audio_url` is the new public URL and `updated_at` is recent.
   - In `curriculum_chapters` → the chapter doc → `topics` → that topic: confirm only `tts_ids_by_language` / `tts_ids` (and chapter `updatedAt`) changed; nothing else in the lesson structure changed.

## 5. Summary

| Check                         | Expected behavior                                      |
|------------------------------|--------------------------------------------------------|
| New audios generated         | Yes; same storage path and same `chapter_tts` doc IDs. |
| Old audios replaced           | Yes; file and doc are overwritten, not duplicated.    |
| Lesson structure unchanged    | Yes; only TTS IDs (and timestamps) updated when needed.|
| Playing lesson uses new audio | Yes; after opening/playing again, bundle has new URLs.|
