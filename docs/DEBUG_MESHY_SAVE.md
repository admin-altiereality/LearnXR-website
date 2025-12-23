# 🐛 Debugging: Meshy 3D Asset Not Saving to Firestore

If you're not seeing `meshUrl`, `meshResult`, and `meshyAsset` fields in Firestore, follow these debugging steps:

## 🔍 Step 1: Check Browser Console

After generating a skybox with 3D asset, open browser DevTools (F12) and look for these logs:

### ✅ Expected Success Logs:

```
🔍 DEBUG: About to save Meshy asset to Firestore
   - user?.uid: [your-user-id]
   - generationId: [generation-id]
   - skyboxGenerationId: [generation-id]
   - variations.length: 1

💾 Starting to save Meshy 3D asset to skybox document: [generation-id]
✅ Skybox document exists, proceeding with Meshy asset save...
📤 Attempting to update skybox document with Meshy asset data...
✅ Successfully saved Meshy 3D asset to skybox document: [generation-id]
✅ Verified: Meshy asset is now synced with skybox in Firestore
```

### ❌ Error Logs to Watch For:

**Error 1: Missing Data**
```
❌ CRITICAL: Cannot save Meshy asset - missing required data
   User ID: Missing
   Generation ID: Missing
```

**Error 2: Document Doesn't Exist**
```
❌ Skybox document does not exist: [generation-id]
```

**Error 3: Firestore Error**
```
❌ CRITICAL ERROR: Failed to save Meshy 3D asset to skybox document
   Error code: [error-code]
   Error message: [error-message]
```

## 🔧 Step 2: Verify the Code is Executing

Add this temporary debug code to check if the save block is reached:

1. **Check if 3D asset generation completes:**
   - Look for: `✅ 3D asset generated successfully`
   - If you don't see this, the 3D asset generation might be failing

2. **Check if save code is reached:**
   - Look for: `🔍 DEBUG: About to save Meshy asset to Firestore`
   - If you don't see this, the code isn't reaching the save block

3. **Check conditions:**
   - Look for the debug logs showing `user?.uid` and `generationId`
   - Both should have values

## 🔍 Step 3: Check Firestore Document

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database**
3. Open the `skyboxes` collection
4. Find your generation document (use the generation ID from console logs)
5. Check if the document exists and has these fields:
   - `userId` ✅
   - `promptUsed` ✅
   - `imageUrl` ✅
   - `meshUrl` ❓ (should be present)
   - `meshResult` ❓ (should be present)
   - `meshyAsset` ❓ (should be present)

## 🛠️ Step 4: Manual Test Script

Run this in your browser console after generating:

```javascript
// Replace with your actual generation ID from console logs
const testGenerationId = 'YOUR_GENERATION_ID_HERE';

// Import Firebase functions
const { db } = await import('./config/firebase');
const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');

// Check if document exists
const ref = doc(db, 'skyboxes', testGenerationId);
const snap = await getDoc(ref);

console.log('📄 Document exists:', snap.exists());
if (snap.exists()) {
  const data = snap.data();
  console.log('📦 Current document fields:', Object.keys(data));
  console.log('📦 Has meshUrl:', !!data.meshUrl);
  console.log('📦 Has meshResult:', !!data.meshResult);
  console.log('📦 Has meshyAsset:', !!data.meshyAsset);
  
  // Try manual save
  if (!data.meshUrl) {
    console.log('🔧 Attempting manual save...');
    await setDoc(ref, {
      meshUrl: 'test-url',
      meshResult: { status: 'test' },
      meshyAsset: { id: 'test' },
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Verify
    const verifySnap = await getDoc(ref);
    const verifyData = verifySnap.data();
    console.log('✅ Manual save result:', {
      hasMeshUrl: !!verifyData.meshUrl,
      hasMeshResult: !!verifyData.meshResult,
      hasMeshyAsset: !!verifyData.meshyAsset
    });
  }
} else {
  console.error('❌ Document does not exist!');
}
```

## 🎯 Common Issues & Solutions

### Issue 1: "Cannot save Meshy asset - missing required data"

**Cause:** `user?.uid` or `generationId` is null/undefined

**Solution:**
- Check if user is logged in
- Verify skybox generation completed successfully
- Check console for the generation ID

### Issue 2: "Skybox document does not exist"

**Cause:** The skybox document wasn't saved before trying to update it

**Solution:**
- Check if skybox save completed successfully
- Look for: `✅ Successfully saved skybox generation to Firestore`
- Ensure skybox save happens before 3D asset save

### Issue 3: Firestore Permission Error

**Cause:** Firestore rules don't allow updates

**Solution:**
- Check `firestore.rules` file
- Ensure rules allow users to update their own documents:
  ```javascript
  match /skyboxes/{skyboxId} {
    allow update: if request.auth != null && 
                     request.auth.uid == resource.data.userId;
  }
  ```

### Issue 4: Network/Connection Error

**Cause:** Network issue or Firebase connection problem

**Solution:**
- Check network tab in DevTools
- Verify Firebase is initialized correctly
- Check for CORS errors

## 📊 Debugging Checklist

- [ ] Browser console shows "About to save Meshy asset"
- [ ] `user?.uid` has a value
- [ ] `generationId` has a value
- [ ] Skybox document exists in Firestore
- [ ] No Firestore permission errors
- [ ] No network errors
- [ ] Save operation completes without errors
- [ ] Verification shows fields are present

## 🆘 Still Not Working?

If after checking all the above you still don't see the fields:

1. **Share the console logs** - Copy all logs from generation start to finish
2. **Check Firestore rules** - Verify permissions are correct
3. **Test with manual save** - Use the test script above
4. **Check Firebase project** - Ensure you're looking at the correct project

The enhanced logging should now show exactly where the process is failing. Look for the `🔍 DEBUG` and `❌ CRITICAL` messages to identify the issue.

