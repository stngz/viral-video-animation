import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(scriptDir, "..");
const studioDir = path.join(baseDir, "studio");
const outDir = path.join(baseDir, "out", "stills");
const bundleDir = path.join(baseDir, "out", "bundle");
const tmpDir = path.join(baseDir, "tmp");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

process.env.TEMP = tmpDir;
process.env.TMP = tmpDir;

const framesArg =
  process.argv[2] ||
  "40,175,240,605,705,815,865,998,1095,1140,1325,1606,1915,1995,2065,2555,2645,2745,2850,2920";
const scale = Number(process.argv[3] || "0.5");
const skipBundle = process.argv[4] === "--skip-bundle";
const frames = framesArg
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => !Number.isNaN(n));

// Clean old stills before batch
for (const f of fs.readdirSync(outDir)) {
  if (f.startsWith("f_") && f.endsWith(".jpg")) fs.unlinkSync(path.join(outDir, f));
}

if (!skipBundle) {
  console.log("Bundling Remotion studio ONCE...");
  execSync(`npx remotion bundle src/index.ts --out-dir "${bundleDir}"`, {
    cwd: studioDir,
    env: process.env,
    stdio: "inherit",
  });
}

const require = createRequire(path.join(studioDir, "package.json"));
const { openBrowser, selectComposition, renderStill } = require("@remotion/renderer");

console.log(`Opening ONE shared Chromium browser for ${frames.length} stills @ scale=${scale}...`);
const browser = await openBrowser("chrome", {
  chromiumOptions: { gl: "angle" },
});

try {
  const composition = await selectComposition({
    serveUrl: bundleDir,
    id: "MarathonShort",
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
console.log("All stills done!");
