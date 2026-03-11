# Standalone VR Player – Integration Notes

The `/vrplayer-standalone` page accepts the following URL query parameters.

## Required (always)

- `chapterId` – curriculum chapter ID
- `topicId` – topic ID (optional but recommended)
- `idToken` – Firebase ID token (Bearer) for `GET /api/lesson-bundle`
- `lang` – optional, default `en`

## Class session sync (student)

When the student has joined a class session, the Flutter (or other) client should append:

- `sessionId` – class session document ID (from join session API)
- `studentUid` – current user’s Firebase UID

Example:

```
/vrplayer-standalone?chapterId=xxx&topicId=yyy&idToken=zzz&sessionId=sessionDocId&studentUid=firebaseUid
```

With these, the standalone player will:

- Subscribe to the session document and follow the teacher’s view (teacher view control).
- Report the student’s current phase (intro, explanation, outro, quiz, completed) and quiz result to the session progress subcollection.
- Report the student’s current 360° view (throttled) so the teacher can see “what they see”.

## Flutter `api_config.dart` change

When building the lesson player URL from the Flutter app, if the user is in an active class session (e.g. they joined via code and you have `sessionId` and current user’s `uid`), add them to the query string:

```dart
// In lessonPlayerUrl() or equivalent, add optional parameters:
static String lessonPlayerUrl({
  String? sessionId,
  String? chapterId,
  String? topicId,
  String? idToken,
  String? studentUid, // current user uid when in session
}) {
  final base = webAppBaseUrl.endsWith('/') ? webAppBaseUrl : '$webAppBaseUrl/';
  final path = 'vrplayer-standalone';
  final query = <String, String>{
    if (chapterId != null) 'chapterId': chapterId,
    if (topicId != null) 'topicId': topicId ?? '',
    if (idToken != null) 'idToken': idToken,
    if (sessionId != null) 'sessionId': sessionId,
    if (studentUid != null) 'studentUid': studentUid,
  };
  final qs = query.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
  return '$base$path?$qs';
}
```

Call this with `sessionId` and `studentUid` when opening the lesson from the “joined class” flow.
