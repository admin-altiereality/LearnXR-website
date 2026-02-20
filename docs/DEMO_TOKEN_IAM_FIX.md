# Demo Token: Fix "Permission iam.serviceAccounts.signBlob denied"

## What’s going wrong

When someone uses **Demo login**, the API calls `admin.auth().createCustomToken()`. That requires the **service account that runs your Cloud Function** to have permission to sign blobs (JWTs).  
On **Cloud Functions v2 (Cloud Run)**, the runtime uses the **default Compute Engine service account**:

- `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`

If that account doesn’t have the right IAM permission, you see:

```text
Permission 'iam.serviceAccounts.signBlob' denied on resource (or it may not exist).
```

and the client gets a **500** from `POST /auth/demo-token`.

## Fix: Grant "Service Account Token Creator" to the runtime account

The runtime service account needs the **Service Account Token Creator** role **on itself** so it can sign custom tokens.

### Option A: Run the script (recommended)

From the project root, with `gcloud` installed and logged in:

**PowerShell:**

```powershell
.\scripts\grant-demo-token-iam.ps1
```

**Bash:**

```bash
./scripts/grant-demo-token-iam.sh
```

The script uses your current `gcloud` project (or `learnxr-evoneuralai` by default), resolves the project number, and grants the role to the default compute service account.

### Option B: Manual gcloud

1. Get your project number:

   ```bash
   gcloud projects describe learnxr-evoneuralai --format="value(projectNumber)"
   ```

   Example output: `427897409662`.

2. Grant the role (replace `PROJECT_NUMBER` with the value from step 1):

   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     PROJECT_NUMBER-compute@developer.gserviceaccount.com \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/iam.serviceAccountTokenCreator" \
     --project=learnxr-evoneuralai
   ```

### Option C: Google Cloud Console

1. Open [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam) for project **learnxr-evoneuralai**.
2. Find the principal **Default compute service account** (e.g. `123456789-compute@developer.gserviceaccount.com`).
3. Click **Edit** (pencil).
4. **Add another role**: **Service Account Token Creator**.
5. In “Assign access to”, restrict to the **same** service account (the default compute one) if the UI allows; otherwise add the role as above and ensure the principal is that same service account.
6. Save.

(If the console doesn’t let you scope the role to the same SA, use Option A or B.)

## After applying the fix

- No code or redeploy needed; IAM changes apply quickly.
- Try **Demo login** again on the preview site; `POST /auth/demo-token` should return **200** and a `token` instead of **500**.

## References

- [Firebase: Create custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens)  
- [Cloud IAM: Service Account Token Creator](https://cloud.google.com/iam/docs/service-account-permissions#token-creator-role)
