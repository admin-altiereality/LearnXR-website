# App icons

LearnXR launcher icons use the app primary color (violet/purple `#7c3aed`) and a minimal “XR” mark, aligned with current Android and global brand icon style.

## Contents

- **`ic_launcher_512.png`** – Master asset (512×512). Use or replace this to regenerate all densities.
- **`android/`** – Android launcher icon set:
  - `mipmap-mdpi/ic_launcher.png` (48×48)
  - `mipmap-hdpi/ic_launcher.png` (72×72)
  - `mipmap-xhdpi/ic_launcher.png` (96×96)
  - `mipmap-xxhdpi/ic_launcher.png` (144×144)
  - `mipmap-xxxhdpi/ic_launcher.png` (192×192)
  - `ic_launcher_512.png` – High-res for Play Store / PWA

## Regenerating icons

1. Replace `ic_launcher_512.png` with your new 512×512 source (or keep the existing one).
2. From `server/client`: `npm run icons:android`

If the source is not square, the script center-crops it to a square before resizing.
