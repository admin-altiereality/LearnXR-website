# LearnXR Website Enhancement — Deployment Summary

**Release:** Case Studies & Research Hub, Channel Partner Program, and Enhanced Web Preview
**Target:** Firebase Hosting — project `lexrn1`, site `altiereality`, channel `preview`
**Frontend:** Vite + React 18 SPA (`server/client/`)
**Status at hand-off:** Code complete and dependency-verified. Final build + deploy is run from a normal (non-sandboxed) terminal — see "Build environment" below.

---

## 1. What shipped

### 1.1 XR Case Studies & Research Hub — `/case-studies`
A new evidence-based, citation-driven research section.

- **Page:** `server/client/src/screens/CaseStudies.tsx`
- **Components:** `server/client/src/Components/casestudies/`
  - `StatCard.tsx` — animated headline statistics
  - `CaseStudyCard.tsx` — institution/outcome cards
  - `SourcedBarChart.tsx` — `recharts` infographics (themed via CSS tokens)
  - `WorldAdoptionMap.tsx` — interactive global adoption map (`react-simple-maps` + `d3-geo`)
  - `ImpactFramework.tsx` — LearnXR Impact Framework + traditional-vs-XR comparison
  - `CitationChip.tsx` — clickable source attributions
  - `ReportDownloadCard.tsx` — branded PDF download CTAs (loading/success/error states)
- **Verified data layer:** `server/client/src/data/caseStudies/`
  - `sources.ts` (central citation registry), `india.ts`, `global.ts`, `frameworks.ts`
- **Research deliverable:** `docs/research/xr-education-research.md`
- **Integrity rule:** every published claim carries a `sourceId` resolving to a credible URL. Unverifiable claims are omitted and listed in the research doc.

### 1.2 Client-side PDF report workflow
- **Location:** `server/client/src/lib/pdf/` using `@react-pdf/renderer`
- Branded India / Global / Future-of-XR reports, generated on demand in the browser (no server load), each with cover, table of contents, sourced content, and a references page.
- Entry point: `downloadReport(reportId)` in `generateReport.tsx`.

### 1.3 Global Channel Partner Program — `/channel-partners`
- **Page:** `server/client/src/screens/ChannelPartners.tsx`
- **Components:** `server/client/src/Components/partners/`
  - `PartnerBenefits.tsx`, `PartnerTypes.tsx`, `GlobalReachMap.tsx`, `PartnerForm.tsx`
- **Static content:** `server/client/src/data/partners.ts`
- **Form:** full validation, accessible labels, honeypot anti-spam field (`companyFax`), UTM + page-URL capture, success/error states.
- **Client service:** `server/client/src/services/partnerService.ts` → `POST /partners/register`.

### 1.4 Partner backend (Firestore + lead scoring)
- **Cloud Function route:** `functions/src/routes/partners.ts` (mounted in `functions/src/index.ts` before auth).
- **Express mirror:** `server/src/routes/partners.ts` (kept for parity with the existing `leads.ts` pattern; not currently mounted in Express).
- Writes to Firestore collection **`partner_registrations`** via Admin SDK, computes `leadScore` + `tier` (A/B/C), stores UTM/source/timestamp, optionally forwards to n8n (`N8N_PARTNER_WEBHOOK_URL`).
- **Auth:** `/partners/register` added to `PUBLIC_PATHS` in `functions/src/middleware/auth.ts`.
- **Security rules:** `firestore.rules` — `partner_registrations` is `allow read: if isAdminOrSuperadmin(); allow write: if false;` (writes only via Admin SDK).

### 1.5 Enhanced Web Preview — `/web-preview`
- **Page (refactored):** `server/client/src/screens/WebAppShowcase.tsx`
- **Components:** `server/client/src/Components/webpreview/`
  - `MasonryGallery.tsx` (CSS columns), `Lightbox.tsx` (Framer Motion + keyboard/swipe), `ImageWithSkeleton.tsx` (lazy load + skeleton + hover zoom)
- Scroll-reveal motion, `loading="lazy"`, mobile swipe, fixed broken image reference.

### 1.6 SEO + routing infrastructure
- `react-helmet-async` wired via `HelmetProvider` in `server/client/src/main.jsx`.
- Reusable `server/client/src/Components/seo/Seo.tsx` applied to all three pages (title, description, canonical, OG/Twitter).
- `public/robots.txt` and `public/sitemap.xml` updated for the new routes.
- Routes registered in **both** `<Routes>` blocks in `App.jsx`, plus `publicPages` and `isStandaloneMarketing`.
- Cross-links added in `Landing.jsx` and `MinimalFooter.jsx`.

> **Note / out of scope:** client-side meta improves shared-link and social previews. Full crawler SEO would require SSR/prerender (this SPA does not prerender).

---

## 2. New dependencies (`server/client/package.json`)
- `@react-pdf/renderer` — client-side branded PDFs
- `react-simple-maps` + `d3-geo` — interactive world maps
- `react-helmet-async` — per-page `<title>`/meta/OG
- dev types: `@types/react-simple-maps`, `@types/d3-geo`

All four packages were confirmed present in `server/client/node_modules`.

---

## 3. Build environment (important)

During preparation, two toolchain issues were found and worked around:

1. **System Node 25** caused `npm install` / `npx` network fetches to hang. Resolved by installing **Node 22 LTS** (Homebrew, keg-only): `/opt/homebrew/opt/node@22/bin`.
2. The automated agent shell runs commands in a **sandbox that breaks pipe back-pressure** between Node and esbuild's helper process. Small in-memory esbuild transforms succeed, but any sizeable file (or esbuild's file-reading bundler) deadlocks at 0% CPU. This makes `vite build` unable to complete **inside that sandbox only**. A normal terminal is unaffected.

**Therefore the build + deploy is run from a standard terminal**, with Node 22 on `PATH`.

---

## 4. Deploy procedure

From a normal terminal (not the agent sandbox):

```bash
# 1) One-time: refresh expired Firebase credentials
firebase login --reauth          # sign in as info.altiereality@gmail.com

# 2) Build + deploy to the lexrn1 'preview' channel
cd /Users/gaurav/Desktop/LearnXR-website-main
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
firebase use lexrn1
firebase hosting:channel:deploy preview -c firebase.lexrn1.json --expires 30d
```

- The hosting config `firebase.lexrn1.json` has a **predeploy** hook (`npm --prefix "server/client" run build`) that builds the Vite client automatically, so a separate build step is not required.
- The command prints a temporary **Channel URL** (form: `https://altiereality--preview-<hash>.web.app`). Use that URL for QA — see `QA-CHECKLIST.md`.
- This deploys to a **preview channel only**; the `live` site is not touched.

### Optional: build separately first (to see build output)
```bash
cd /Users/gaurav/Desktop/LearnXR-website-main/server/client
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run build      # outputs to server/client/dist
```

---

## 5. Backend deploy (only if partner registration is being activated)

The partner API lives in Cloud Functions. If the registration endpoint must go live, deploy functions and rules separately (these are **not** part of the hosting channel deploy):

```bash
firebase deploy --only functions:api,firestore:rules
```

Set `N8N_PARTNER_WEBHOOK_URL` in the functions environment if CRM forwarding is desired (optional; Firestore write happens regardless).

---

## 6. Rollback
- Hosting preview channels are non-destructive; simply let the channel expire or redeploy.
- To remove the channel: `firebase hosting:channel:delete preview -c firebase.lexrn1.json`.

---

## 7. Pre-flight checklist (done)
- [x] New pages and components created
- [x] Routes registered in both `App.jsx` blocks + `publicPages` + `isStandaloneMarketing`
- [x] New dependencies installed and verified in `node_modules`
- [x] Export/import shapes spot-checked (default vs named) for page entry points
- [x] `robots.txt` / `sitemap.xml` updated
- [x] Node 22 LTS installed for a working build toolchain
- [ ] Production build executed in a normal terminal (run by operator)
- [ ] Deployed to `lexrn1` `preview` channel (run by operator)
- [ ] QA pass on the channel URL (see `QA-CHECKLIST.md`)
