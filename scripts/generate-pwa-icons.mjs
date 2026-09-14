#!/usr/bin/env node
/**
 * Generates the PWA / app icons into apps/web/public/icons/pwa/.
 *
 * The brand mark is the "t" glyph of the Trell wordmark (public/icon.svg),
 * rendered white on the blue brand gradient. Output is plain PNG so every
 * platform (Chrome, iOS, Android) can consume it:
 *
 *   icon-192.png / icon-512.png            rounded "any" icons
 *   icon-maskable-192.png / -512.png       full-bleed (safe-zone aware)
 *   apple-touch-icon.png                   180x180, opaque (iOS rounds it)
 *
 * `sharp` ships as a transitive optional dep of next, so we resolve it from
 * the next package instead of adding a direct dependency. Icons are committed,
 * so this only needs to run when the mark changes.
 *
 * Run:  node scripts/generate-pwa-icons.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "apps/web/public/icons/pwa");
const require = createRequire(import.meta.url);

function loadSharp() {
  const candidates = [
    resolve(ROOT, "apps/web"),
    resolve(ROOT),
    resolve(ROOT, "node_modules/.pnpm/node_modules"),
    resolve(ROOT, "node_modules/next"),
    resolve(ROOT, "apps/web/node_modules/next"),
  ];
  for (const paths of candidates) {
    try {
      return require(require.resolve("sharp", { paths: [paths] }));
    } catch {
      /* try next */
    }
  }
  throw new Error("sharp not found. It is normally pulled in by next. Run `pnpm install` at the repo root.");
}

// Bounds of the "t" glyph inside the wordmark viewBox (public/icon.svg).
const T_PATH =
  "M5.51176 4.90256C5.38542 4.96623 5.28277 5.0299 5.27487 5.03786C5.25908 5.04582 5.23539 6.91611 5.2117 9.1923L5.17221 13.3308L2.74009 13.3706L0.300067 13.4104L0.150034 13.6014C0.00789651 13.7765 0 13.9516 0 16.5939V19.4033L0.244792 19.6102L0.489584 19.8172H2.85064H5.2117V28.2295C5.2117 37.2388 5.21959 37.4059 5.61442 38.8226C6.60938 42.3881 9.42843 44.7438 13.503 45.4124C14.4664 45.5715 17.6329 45.6432 19.3228 45.5397C20.3888 45.484 20.6336 45.4442 20.7678 45.3248C20.9179 45.1895 20.9258 45.0781 20.9258 42.3721V39.5627L20.7125 39.3956C20.5151 39.2444 20.452 39.2364 19.4728 39.2921C17.6013 39.4035 16.4642 39.3637 15.7535 39.1648C14.1269 38.7032 13.203 37.8038 12.7371 36.236C12.6107 35.8142 12.5949 35.1218 12.5712 27.7918L12.5555 19.8172H16.3853C20.4283 19.8172 20.5862 19.8013 20.7204 19.459C20.7441 19.3874 20.7678 18.0742 20.7678 16.5461V13.7606L20.5704 13.5696L20.3809 13.3706H16.4642H12.5555V9.30373V5.23683L12.3265 5.00603L12.0975 4.77522H8.90726C6.23824 4.78318 5.69338 4.7991 5.51176 4.90256Z";
const T_VIEW = { x: 0, y: 4.77522, w: 20.9258, h: 40.86798 };

function glyphTransform(size, targetHeight) {
  const s = targetHeight / T_VIEW.h;
  const w = T_VIEW.w * s;
  const x = (size - w) / 2;
  const y = (size - targetHeight) / 2 - T_VIEW.y * s;
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(4)})`;
}

function iconSvg(size, { rounded, targetHeight }) {
  const radius = rounded ? Math.round(size * 0.225) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4d88f5"/>
      <stop offset="1" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)"/>
  <g transform="${glyphTransform(size, targetHeight)}">
    <path d="${T_PATH}" fill="#ffffff"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, rounded: true, targetHeight: 112 },
  { file: "icon-512.png", size: 512, rounded: true, targetHeight: 300 },
  { file: "icon-maskable-192.png", size: 192, rounded: false, targetHeight: 84 },
  { file: "icon-maskable-512.png", size: 512, rounded: false, targetHeight: 224 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, targetHeight: 104 },
];

async function main() {
  const sharp = loadSharp();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const t of TARGETS) {
    const svg = Buffer.from(iconSvg(t.size, t));
    await sharp(svg).png().toFile(resolve(OUT_DIR, t.file));
    console.log(`✅ ${t.file} (${t.size}x${t.size})`);
  }
  // Keep a copy at the site root so /apple-touch-icon.png resolves by convention.
  writeFileSync(
    resolve(ROOT, "apps/web/public/apple-touch-icon.png"),
    await sharp(Buffer.from(iconSvg(180, { rounded: false, targetHeight: 104 })))
      .png()
      .toBuffer(),
  );
  console.log("✅ apple-touch-icon.png (root)");
}

await main();
