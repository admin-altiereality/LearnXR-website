/**
 * Generates Android launcher icon PNGs from the master 512x512 source.
 * Output: standard mipmap densities (mdpi → xxxhdpi) for ic_launcher.png
 */
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const sourcePath = path.join(iconsDir, 'ic_launcher_512.png');
const androidDir = path.join(iconsDir, 'android');

const SIZES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function main() {
  try {
    let image = sharp(sourcePath);
    const meta = await image.metadata();
    const w = meta.width || 512;
    const h = meta.height || 512;
    if (w !== h) {
      const crop = Math.min(w, h);
      const left = Math.floor((w - crop) / 2);
      const top = Math.floor((h - crop) / 2);
      image = image.extract({ left, top, width: crop, height: crop });
      console.warn('Source was not square; center-cropped to', crop, 'x', crop);
    }

    for (const { folder, size } of SIZES) {
      const outDir = path.join(androidDir, folder);
      await mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, 'ic_launcher.png');
      await image
        .clone()
        .resize(size, size)
        .png()
        .toFile(outPath);
      console.log(`Created ${folder}/ic_launcher.png (${size}x${size})`);
    }
    // High-res for Play Store / PWA
    const storePath = path.join(androidDir, 'ic_launcher_512.png');
    await image.clone().resize(512, 512).png().toFile(storePath);
    console.log('Created ic_launcher_512.png (512x512, for store/PWA)');
    console.log('Done. Icons written to public/icons/android/');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
