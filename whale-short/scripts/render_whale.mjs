import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const baseDir = path.resolve("c:/Users/NATHANIEL/Videos/Video Animation/whale-short");
const studioDir = path.resolve("c:/Users/NATHANIEL/Videos/Video Animation/marathon-short/studio");
const bundleDir = path.join(baseDir, "out", "bundle");
const outDir = path.join(baseDir, "out");
const tmpDir = path.join(baseDir, "tmp");
const silentMp4 = path.join(outDir, "whale_silent.mp4");
const mixWav = path.join(baseDir, "audio", "mix.wav");
const finalMp4 = path.join(outDir, "the_1970_exploding_whale.mp4");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

const scale = process.argv[2] || "1.0";
const concurrency = process.argv[3] || "2";
const env = { ...process.env, TEMP: tmpDir, TMP: tmpDir };

console.log("=== 1/3 Bundling WhaleShort ===");
execSync(`npx remotion bundle src/index.ts --out-dir "${bundleDir}"`, {
  cwd: studioDir,
  env,
  stdio: "inherit",
});

console.log(`=== 2/3 Rendering full WhaleShort (scale=${scale}, concurrency=${concurrency}, CRF=16) ===`);
execSync(
  `npx remotion render "${bundleDir}" WhaleShort "${silentMp4}" --codec=h264 --crf=16 --scale=${scale} --concurrency=${concurrency} --gl=angle --image-format=jpeg --jpeg-quality=92`,
  { cwd: studioDir, env, stdio: "inherit" }
);

console.log("=== 3/3 Muxing video + 48kHz cinematic trailer audio mix ===");
execSync(
  `ffmpeg -y -i "${silentMp4}" -i "${mixWav}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart "${finalMp4}"`,
  { cwd: baseDir, env, stdio: "inherit" }
);

console.log("SUCCESS! Final Exploding Whale video:", finalMp4);
