#!/usr/bin/env npx tsx

/**
 * Generate PNG icons from SVG for PWA and App Store
 * Run: npx tsx scripts/generate-icons.ts
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512, 1024];
const ICONS_DIR = "public/icons";

async function generateIcons() {
  console.log("Generating PNG icons from SVG...\n");

  // Read SVG file
  const svgPath = join(ICONS_DIR, "icon.svg");
  const svgBuffer = readFileSync(svgPath);

  // Generate each size
  for (const size of ICON_SIZES) {
    const outputPath = join(ICONS_DIR, `icon-${size}x${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Created: ${outputPath}`);
  }

  // Generate Apple Touch Icon (180x180)
  const appleTouchPath = join(ICONS_DIR, "apple-touch-icon.png");
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(appleTouchPath);
  console.log(`Created: ${appleTouchPath}`);

  // Generate favicon (32x32)
  const faviconPath = join("public", "favicon.png");
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconPath);
  console.log(`Created: ${faviconPath}`);

  console.log("\nDone! Update manifest.json with new icons.");
}

generateIcons().catch(console.error);
