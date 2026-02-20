# Fix: Eventarc Service Agent permission when deploying Firestore-triggered functions

When you see:

```text
Permission denied while using the Eventarc Service Agent. If you recently started to use Eventarc, 
it may take a few minutes before all necessary permissions are propagated to the Service Agent.
```

Firebase 2nd Gen functions that use **Firestore triggers** (e.g. `onUserApprovalStatusChange`, `onSchoolApprovalStatusChange`, `onEditRequestStatusChange`) use Eventarc. The Eventarc Service Agent is created and granted roles the first time you use it; propagation can take **several minutes**.

## Option 1: Wait and retry (recommended first step)

1. Wait **5–10 minutes** after the first failed deploy.
2. Run again:
   ```bash
   firebase deploy --only functions
   ```
   Or deploy only the failing triggers:
   ```bash
   firebase deploy --only functions:onUserApprovalStatusChange,functions:onSchoolApprovalStatusChange,functions:onEditRequestStatusChange
   ```

Often this is enough; the message says: *"Since this is your first time using 2nd gen functions, we need a little bit longer to finish setting everything up."*

## Option 2: Grant Eventarc Service Agent role (if retry still fails)

1. Open [Google Cloud Console → IAM](https://console.cloud.google.com/iam-admin/iam) for project **learnxr-evoneuralai**.
2. Find the **Eventarc Service Agent** (e.g. `service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`).  
   If it doesn’t appear yet, wait a bit and refresh, or run:
   ```bash
   gcloud beta services identity create --service=eventarc.googleapis.com --project=learnxr-evoneuralai
   ```
3. Edit that service account and add the role: **Eventarc Service Agent** (`roles/eventarc.serviceAgent`).

Or use gcloud (replace `PROJECT_ID` and `PROJECT_NUMBER`):

```bash
# Get project number
gcloud projects describe learnxr-evoneuralai --format="value(projectNumber)"

# Grant Eventarc Service Agent role to the Eventarc service agent
# Replace PROJECT_NUMBER with the number from the command above
gcloud projects add-iam-policy-binding learnxr-evoneuralai \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/eventarc.serviceAgent"
```

## Option 3: Deploy as project owner

Deploy with an account that has **Owner** or **Security Admin** on the project so IAM can be updated if needed.

---

After the trigger functions deploy successfully, approval/rejection emails (EmailJS) will run when super admin approves or rejects users, schools, or edit requests.
