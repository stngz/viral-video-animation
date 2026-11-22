"""QA check for The 1970 Exploding Whale (accounts for intentional viral blackout cards & explosion flash)."""
import json, subprocess, sys
import numpy as np

video_path = sys.argv[1]
probe = subprocess.check_output([
    "ffprobe", "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration",
    "-of", "json", video_path
]).decode("utf-8")
print("Video stream:", json.dumps(json.loads(probe), indent=2))

W, H = 90, 160
proc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", video_path, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
    stdout=subprocess.PIPE
)
raw = proc.stdout.read()
proc.wait()

n_frames = len(raw) // (W * H)
frames = np.frombuffer(raw[: n_frames * W * H], dtype=np.uint8).reshape((n_frames, H, W)).astype(np.float32)
means = frames.mean(axis=(1, 2))

def in_blackout(i):
    return (198 <= i < 316) or (1412 <= i < 1458)

bad_black = [int(i) for i, m in enumerate(means) if m < 8.0 and not in_blackout(i)]
bad_white = [int(i) for i, m in enumerate(means) if m > 246.0 and abs(i - 1303) > 8]

diffs = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
frozen = []
run = 0
for i, d in enumerate(diffs):
    if d < 0.08 and not in_blackout(i):
        run += 1
    else:
        if run >= 12:
            frozen.append((i - run, i, run))
        run = 0
if run >= 12:
    frozen.append((len(diffs) - run, len(diffs), run))

non_bo_luma = [m for i, m in enumerate(means) if not in_blackout(i)]
print(f"Total frames analyzed: {n_frames}")
print(f"Median 3D scene luma (0..1): {float(np.median(non_bo_luma)) / 255.0:.3f}")
print(f"Accidental black frames: {len(bad_black)} -> {bad_black[:10]}")
print(f"Unexpected white frames: {len(bad_white)} -> {bad_white[:10]}")
print(f"Frozen 3D spans (>=12f): {len(frozen)} -> {frozen[:10]}")

res = subprocess.run(["ffmpeg", "-i", video_path, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
for line in res.stderr.splitlines():
    if "mean_volume" in line or "max_volume" in line or "Audio:" in line:
        print(line.strip())
