"""
short_qa.py — Automated QA check per cartoon-3d-short/SKILL.md:
Checks every frame of the rendered MP4 for:
- Accidental black frames (mean luma < 8)
- Unintended white frames (mean luma > 246 outside FLASH_AT window)
- Frozen spans (>= 12 consecutive near-identical frames)
- Audio stream presence & integrated loudness / peak levels
"""
import json
import subprocess
import sys
import numpy as np

video_path = sys.argv[1]
flash_frame = 273

# Probe video info
probe = subprocess.check_output([
    "ffprobe", "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration",
    "-of", "json", video_path
]).decode("utf-8")
info = json.loads(probe)
print("Video stream:", json.dumps(info, indent=2))

# Downsample to 90x160 gray raw frames via ffmpeg pipe to inspect EVERY SINGLE FRAME in <3 seconds!
W, H = 90, 160
proc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", video_path, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
    stdout=subprocess.PIPE
)
raw = proc.stdout.read()
proc.wait()

frame_bytes = W * H
n_frames = len(raw) // frame_bytes
frames = np.frombuffer(raw[: n_frames * frame_bytes], dtype=np.uint8).reshape((n_frames, H, W)).astype(np.float32)

means = frames.mean(axis=(1, 2))
black_frames = [int(i) for i, m in enumerate(means) if m < 8.0]
white_frames = [int(i) for i, m in enumerate(means) if m > 246.0 and abs(i - flash_frame) > 7]

diffs = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
frozen_spans = []
run = 0
for i, d in enumerate(diffs):
    if d < 0.08:
        run += 1
    else:
        if run >= 12:
            frozen_spans.append((i - run, i, run))
        run = 0
if run >= 12:
    frozen_spans.append((len(diffs) - run, len(diffs), run))

print(f"Total frames analyzed: {n_frames}")
print(f"Median frame luma (0..1): {float(np.median(means)) / 255.0:.3f}")
print(f"Black frames (<8): {len(black_frames)} -> {black_frames[:10]}")
print(f"Unexpected white frames (>246): {len(white_frames)} -> {white_frames[:10]}")
print(f"Frozen spans (>=12f): {len(frozen_spans)} -> {frozen_spans[:10]}")

# Check audio loudness
res = subprocess.run(
    ["ffmpeg", "-i", video_path, "-af", "volumedetect", "-f", "null", "-"],
    capture_output=True, text=True
)
for line in res.stderr.splitlines():
    if "mean_volume" in line or "max_volume" in line or "Audio:" in line:
        print(line.strip())
