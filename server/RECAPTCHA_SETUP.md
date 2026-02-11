# reCAPTCHA Setup for Secret Backend Login

The **Secret Backend Login** page (`/secretbackend`) is protected by **Google reCAPTCHA v3** (invisible, score-based) to reduce bot sign-in attempts and protect your database.

## What You Need to Do

### Step 1: Get reCAPTCHA keys from Google

1. Go to **https://www.google.com/recaptcha/admin**
2. Sign in with your Google account.
3. Click **Create** (or use an existing site).
4. **Label**: e.g. `LearnXR Secret Backend Login`
5. Choose **reCAPTCHA v3** → **Website** (Score).
6. **Critical – Add your domains:**
   - For local dev: add `localhost` and `127.0.0.1`
   - For Firebase Hosting: add `learnxr-evoneuralai.web.app`, `learnxr-evoneuralai.firebaseapp.com`
   - For preview channels: add your channel URL (e.g. `learnxr-evoneuralai--channelname.web.app`)
   - For custom domain: add your domain (e.g. `in3d.evoneural.ai`)
   - **If you see "Invalid site key or not loaded in api.js"**, the current domain is missing from this list.
7. Accept the terms and submit.
8. Copy the **Site Key** (ID) and **Secret Key** from the key identity section.

### Step 2: Configure the client (frontend)

In **`server/client/.env`** add:

```env
# reCAPTCHA v3 - Site Key (public, safe to expose in the browser)
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

Replace `your_site_key_here` with the **Site Key** from Step 1.

### Step 3: Configure the server (backend)

In **`server/.env`** add:

```env
# reCAPTCHA v3 - Secret Key (keep private, server-only)
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

Replace `your_secret_key_here` with the **Secret Key** from Step 1.

### Step 4: Restart and test

1. Restart the **Express server** (so it reads `RECAPTCHA_SECRET_KEY`).
2. Restart or refresh the **client** (so it picks up `VITE_RECAPTCHA_SITE_KEY`).
3. Open **/secretbackend** in the app.
4. reCAPTCHA v3 runs invisibly on form submit—no checkbox. Enter credentials and sign in as usual.

## Behavior

- **If both keys are set**: The security check runs invisibly when the user submits the login form. The backend verifies the token with Google and validates the score (rejects if &lt; 0.5).
- **If either key is missing**: reCAPTCHA is skipped and login works as before (no verification). Use this for local dev without keys, or until you finish setup.

## Production & Preview Channels

- **Firebase Functions**: The `functions/` app includes the auth route and uses Secret Manager. Before deploying, run:
  ```bash
  firebase functions:secrets:set RECAPTCHA_SECRET_KEY
  ```
  Enter your Secret Key when prompted. Then deploy:
  ```bash
  firebase deploy
  ```
- **Express server (local)**: Set `RECAPTCHA_SECRET_KEY` in `server/.env`.
- **Preview channels**: reCAPTCHA does **not** support wildcards. Add each preview domain explicitly, e.g. `learnxr-evoneuralai--channelname.web.app` (note the **double hyphen**). See [RECAPTCHA_TROUBLESHOOTING.md](./RECAPTCHA_TROUBLESHOOTING.md) if it still fails.
- Add your **production domain** to the reCAPTCHA admin console (Step 1) so verification is allowed on that domain.

## Security notes

- **Never** commit real keys to git. Use `.env` (already in `.gitignore`) and set keys in your deployment environment.
- The **Site Key** is public; the **Secret Key** must stay on the server only.
