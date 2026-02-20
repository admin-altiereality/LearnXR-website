# Branch Comparison: Local Demo-LMS vs Remote origin/Demo-LMS

**Generated:** 2026-02-19

## Summary

| Aspect | Local (Demo-LMS) | Remote (origin/Demo-LMS) |
|--------|------------------|---------------------------|
| **Latest commit** | `4efc3a85` Sync LMS changes | `3564a66f` with latest version |
| **Common ancestor** | `4efc3a85` | |
| **Total files changed** | 92 files | |
| **Net diff** | Local has +6,374 / -1,731 vs remote | Remote has different feature set |

---

## Key Differences

### What LOCAL has (that remote doesn't)

- **ClassSessionProvider** + **ClassSceneViewer** – Class scene viewing feature
- **Route `/class-scene`** – Protected route for class scene
- **Assessments removed** – TeacherAssessments, StudentAssessments, TakeAssessment routes removed
- **ErrorBoundary** – Benign error handling (extension/iframe errors)
- **EmailJS** – Email service (replaced Resend)
- **3D asset proxy** – Meshy proxy for WebXR/Meta Quest
- **FaRobot** – Sidebar icon fix
- **curriculumChangeRequestService** – New service for curriculum change requests
- **Merge conflict resolutions** – ProductionLogs, MainSection, SchoolManagement

### What REMOTE has (that local doesn't) – Studio / Content

Remote has **more lines** in these studio files (+360 insertions, -136 deletions):

| File | Remote has more |
|------|-----------------|
| `ChapterTable.tsx` | +94 lines changed |
| `LaunchLessonButton.tsx` | +54 lines changed |
| `AvatarTo3dTab.tsx` | +103 lines changed |
| `SourceTab.tsx` | +143 lines changed |
| `TextTo3DUnified.tsx` | +100 lines changed |
| `ChapterEditor.tsx` | +2 lines changed |

**Note:** The "krpano" implementation:
- `LearnXR-website-main/` – Standalone demo folder with krpano.js (360° tours). Both branches have it. Not integrated into `/studio/content`.
- `Skybox360Viewer.tsx` – Both branches have this (360° equirectangular viewer)
- `SourceTab.tsx` – **Remote adds PDF upload** (upload PDF when missing, update chapter with pdf_storage_url, invalidateLessonBundleCache)

---

## Merge Options

### Option A: Merge remote into local (recommended if you want krpano/studio updates)

```bash
git fetch origin Demo-LMS
git merge origin/Demo-LMS
# Resolve any conflicts – you'll keep local's ClassSession, ErrorBoundary, etc.
# but get remote's studio tab changes (SourceTab, ChapterTable, etc.)
```

### Option B: Cherry-pick only studio files from remote

```bash
# Get specific commits that touched studio
git log origin/Demo-LMS --oneline -- server/client/src/Components/studio/ server/client/src/screens/studio/
# Then: git cherry-pick <commit-hash> for each
```

### Option C: Inspect remote files first, then selectively merge

```bash
# View remote's SourceTab (likely krpano/360 preview)
git show origin/Demo-LMS:server/client/src/Components/studio/tabs/SourceTab.tsx > /tmp/remote_source_tab.tsx

# Compare
git diff server/client/src/Components/studio/tabs/SourceTab.tsx /tmp/remote_source_tab.tsx
```

---

## Files to Review Before Merging

1. **`server/client/src/Components/studio/tabs/SourceTab.tsx`** – 143-line diff (likely skybox/360/krpano preview)
2. **`server/client/src/Components/studio/ChapterTable.tsx`** – 94-line diff
3. **`server/client/src/Components/studio/LaunchLessonButton.tsx`** – 54-line diff
4. **`server/client/src/Components/studio/tabs/AvatarTo3dTab.tsx`** – 103-line diff
5. **`server/client/src/Components/studio/tabs/TextTo3DUnified.tsx`** – 100-line diff

---

## Recommendation

1. **Back up your work:** `git stash` or commit any uncommitted changes.
2. **Merge remote:** `git merge origin/Demo-LMS` to bring in SourceTab PDF upload, ChapterTable/LaunchLessonButton/AvatarTo3dTab/TextTo3DUnified updates, and lesson bundle cache.
3. **Resolve conflicts:** You may need to resolve conflicts where both branches changed (e.g. App.jsx).
