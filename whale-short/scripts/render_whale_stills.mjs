import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const studioDir = path.resolve("c:/Users/NATHANIEL/Videos/Video Animation/marathon-short/studio");
const outDir = path.resolve("c:/Users/NATHANIEL/Videos/Video Animation/whale-short/out/stills");
const bundleDir = path.resolve("c:/Users/NATHANIEL/Videos/Video Animation/whale-short/out/bundle");
const tmpDir = path.resolve("c:/Users/NATHANIEL/Videos/Video Animation/whale-short/tmp");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

process.env.TEMP = tmpDir;
process.env.TMP = tmpDir;

const framesArg =
  process.argv[2] ||
  "45,230,395,550,790,940,1080,1260,1360,1415,1520,1640,1835,1935,2120,2245,2440";
const scale = Number(process.argv[3] || "0.5");
const frames = framesArg.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));

for (const f of fs.readdirSync(outDir)) {
  if (f.startsWith("f_") && f.endsWith(".jpg")) fs.unlinkSync(path.join(outDir, f));
}

console.log("Bundling WhaleShort studio ONCE...");
execSync(`npx remotion bundle src/index.ts --out-dir "${bundleDir}"`, {
  cwd: studioDir,
  env: process.env,
  stdio: "inherit",
});

const require = createRequire(path.join(studioDir, "package.json"));
const { openBrowser, selectComposition, renderStill } = require("@remotion/renderer");

console.log(`Opening ONE shared Chromium browser for ${frames.length} stills @ scale=${scale}...`);
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
try {
  const composition = await selectComposition({
    serveUrl: bundleDir,
    id: "WhaleShort",
    puppeteerInstance: browser,
  });
  for (const frame of frames) {
    const outPath = path.join(outDir, `f_${String(frame).padStart(4, "0")}.jpg`);
    const t0 = Date.now();
    await renderStill({
      composition,
      serveUrl: bundleDir,
      puppeteerInstance: browser,
      frame,
      output: outPath,
      imageFormat: "jpeg",
      jpegQuality: 88,
      scale,
    });
    console.log(`Rendered f_${String(frame).padStart(4, "0")} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
} finally {
  await browser.close({ silent: false });
}
console.log("Whale stills done!");
