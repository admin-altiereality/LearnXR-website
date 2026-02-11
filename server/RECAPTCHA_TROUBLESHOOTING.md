# reCAPTCHA Troubleshooting — Why It's Not Working

## What Happens When reCAPTCHA Fails

The **"Add domain to allowed domains"** or **"Invalid site key or not loaded"** error occurs **client-side** before any request reaches our backend. The flow is:

1. User visits `/secretbackend` on `learnxr-evoneuralai--manav-fk25v518.web.app`
2. reCAPTCHA script loads: `https://www.google.com/recaptcha/api.js?render=6Lfo1Gcs...`
3. User clicks **Sign in**
4. `grecaptcha.execute(siteKey, {action: 'login'})` runs
5. **Google validates the current hostname** against the reCAPTCHA key's allowed domains
6. If the domain is not allowed → Google throws the error **immediately** (our backend is never called)

So the problem is **100% on the Google reCAPTCHA Admin side** — the domain must be added correctly for the key you're using.

---

## Why It Might Still Fail After You “Added” the Domain

### 1. Wrong reCAPTCHA key

You may have multiple keys in [reCAPTCHA Admin](https://www.google.com/recaptcha/admin). The app uses:

- **Site Key**: `6Lfo1GcsAAAAANTu5jQ5GpKkjpflFrS3BWO_M5LH` (from `server/client/.env.production`)

Add the domain to **this specific key**, not another one. Check the key’s label if needed.

### 2. Domain typo — single vs double hyphen

Firebase preview channels use a **double hyphen** (`--`):

| Correct (double hyphen)         | Incorrect (single hyphen)        |
|--------------------------------|----------------------------------|
| `learnxr-evoneuralai--manav-fk25v518.web.app` | `learnxr-evoneuralai-manav-fk25v518.web.app` |

Add exactly: `learnxr-evoneuralai--manav-fk25v518.web.app` — no `http://`, no `https://`, no trailing slash, no path.

### 3. Wildcards not supported

Google reCAPTCHA **does not support wildcards** such as `*.web.app`. You must add each domain explicitly, for example:

- `learnxr-evoneuralai.web.app`
- `learnxr-evoneuralai.firebaseapp.com`
- `learnxr-evoneuralai--manav-fk25v518.web.app`
- `localhost` (for local dev)
- `127.0.0.1` (for local dev)

### 4. Propagation delay

Domain changes can take 5–15 minutes to apply. After adding a domain, wait a few minutes, then:

- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Or use an incognito/private window

### 5. Site key vs secret key mismatch

The **Site Key** (public, in frontend) and **Secret Key** (private, in backend) must be from the **same** reCAPTCHA key:

- Frontend: `VITE_RECAPTCHA_SITE_KEY` in `server/client/.env.production`
- Backend: `RECAPTCHA_SECRET_KEY` in Firebase Secrets (`firebase functions:secrets:set RECAPTCHA_SECRET_KEY`)

If they come from different keys, verification will fail even after the domain is correct.

### 6. Wrong key type (v2 vs v3)

The app uses **reCAPTCHA v3**. Do not use v2 (checkbox) keys. When creating the key:

- Choose **reCAPTCHA v3** (Score)
- Platform: **Website**

---

## Verification Checklist

1. Go to [reCAPTCHA Admin](https://www.google.com/recaptcha/admin).
2. Select the key whose Site Key is `6Lfo1GcsAAAAANTu5jQ5GpKkjpflFrS3BWO_M5LH`.
3. In **Domains**, ensure you have exactly: `learnxr-evoneuralai--manav-fk25v518.web.app` (no protocol).
4. Save. Wait 5–10 minutes.
5. Hard refresh or use incognito on the Staff Login page.
6. If it still fails, add `localhost` and test locally to confirm the keys work.

---

## Quick Test — Local

1. Add `localhost` and `127.0.0.1` to the same key.
2. Run the app locally: `npm run dev` in `server/client`.
3. Visit `http://localhost:5173/secretbackend` (or your dev port).
4. If it works locally but not on the preview channel, the domain configuration on that key is wrong or not propagated yet.
