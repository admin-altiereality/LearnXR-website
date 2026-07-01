# LearnXR Website Enhancement — QA Checklist

Run this against the Firebase **preview channel URL** printed by the deploy
(`https://altiereality--preview-<hash>.web.app`). Test on at least one desktop
browser and one real mobile device (or device emulation).

Legend: ☐ = to verify

---

## 0. Build & deploy sanity
- ☐ `npm run build` completed without errors (run with Node 22 on `PATH`).
- ☐ Deploy command printed a Channel URL and it loads without a blank screen.
- ☐ Browser console shows no uncaught errors on first load of each new page.
- ☐ No 404s for JS/CSS chunks or images in the Network tab.

---

## 1. Routing & shell
- ☐ `/case-studies` loads as a standalone marketing page (no app sidebar, no 3D shell).
- ☐ `/channel-partners` loads as a standalone marketing page.
- ☐ `/web-preview` loads with the enhanced gallery.
- ☐ Deep-linking directly to each route works (SPA rewrite to `index.html`).
- ☐ Browser back/forward navigation behaves correctly.

---

## 2. Case Studies & Research Hub (`/case-studies`)
- ☐ Hero renders with both report CTAs.
- ☐ India stat cards animate in on scroll and show correct numbers.
- ☐ Sourced bar charts render and are readable in both light and dark themes.
- ☐ Case study cards display institution, location, year, outcome, and a citation chip.
- ☐ Citation chips open the correct source URL in a new tab.
- ☐ World adoption map renders; markers are clickable and reveal outcome detail.
- ☐ Impact Framework grid + traditional-vs-XR comparison render correctly.
- ☐ **PDF downloads:** India, Global, and Future reports each download a valid PDF.
  - ☐ Download button shows loading, then success state.
  - ☐ PDF opens with cover, table of contents, content, and a references/sources page.
  - ☐ Figures/claims in the PDF carry source attribution.
- ☐ No fabricated/uncited statistics appear anywhere on the page.

---

## 3. Channel Partner Program (`/channel-partners`)
- ☐ Hero + "Apply Now" scrolls to / focuses the registration form.
- ☐ Benefits and Partner Types grids render and animate.
- ☐ Global Reach map renders current vs expansion markets.
- ☐ **Registration form:**
  - ☐ Required-field validation fires with clear, accessible messages.
  - ☐ Email / URL fields validate format.
  - ☐ Labels are associated with inputs (screen-reader and click-to-focus work).
  - ☐ Honeypot field (`companyFax`) is visually hidden and not tab-focusable.
  - ☐ Successful submit shows a success state; form resets/locks appropriately.
  - ☐ Submit failure shows a graceful error (try with network offline).
- ☐ **Backend (only if functions + rules are deployed):**
  - ☐ A test submission creates a document in Firestore `partner_registrations`.
  - ☐ Document includes `leadScore`, `tier`, UTM params, `pageUrl`, and timestamp.
  - ☐ Honeypot-filled submission is rejected/flagged (no junk lead stored).
  - ☐ Non-admin client cannot read `partner_registrations` (rules deny).

---

## 4. Enhanced Web Preview (`/web-preview`)
- ☐ Masonry gallery lays out correctly across breakpoints (1 / 2 / 3+ columns).
- ☐ Images lazy-load with a skeleton placeholder; no layout shift jank.
- ☐ Hover zoom works on desktop.
- ☐ Clicking an image opens the lightbox.
  - ☐ Lightbox keyboard nav: Esc closes, ← / → navigate.
  - ☐ Mobile swipe left/right navigates; tap/over close dismisses.
  - ☐ Caption and image index display correctly.
- ☐ No broken image references (previously broken asset is fixed).

---

## 5. SEO & metadata
- ☐ Each new page sets a unique `<title>` (visible in the browser tab).
- ☐ `<meta name="description">` is present and page-specific (inspect `<head>`).
- ☐ Canonical URL is correct per page.
- ☐ OG/Twitter tags present (validate a link preview if possible).
- ☐ `/{robots.txt}` and `/sitemap.xml` are reachable and list the new routes.

---

## 6. Navigation & cross-linking
- ☐ Landing page nav links to Case Studies and Partners (desktop).
- ☐ Footer links to Case Studies and Partners on every page they appear.
- ☐ Cross-links between Case Studies ↔ Channel Partners ↔ Web Preview work.

---

## 7. Responsive & accessibility
- ☐ Mobile (≤375px), tablet (~768px), desktop (≥1280px) all render without horizontal scroll.
- ☐ Tap targets are adequately sized on mobile.
- ☐ Text contrast is acceptable in both light and dark themes.
- ☐ Interactive elements are keyboard-reachable with a visible focus state.
- ☐ Images have meaningful `alt` text.
- ☐ Animations are not nausea-inducing; respect reduced-motion where applicable.

---

## 8. Performance (spot check via Lighthouse / DevTools)
- ☐ Largest Contentful Paint is reasonable on the new pages.
- ☐ Images are lazy-loaded below the fold.
- ☐ No oversized chunks blocking first paint (heavy libs like the PDF renderer load on demand where possible).
- ☐ Map/chart libraries do not block initial render.

---

## 9. Regression (existing site)
- ☐ Home `/` and existing marketing pages still load and look correct.
- ☐ Login / app routes are unaffected by the routing changes.
- ☐ Existing lead form (`/leads`) still submits.

---

## Sign-off
- Tester: ______________________  Date: __________
- Channel URL tested: ___________________________________
- Result: ☐ Pass  ☐ Pass with notes  ☐ Fail
- Notes:
