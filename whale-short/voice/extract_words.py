import json, os, wave
import numpy as np
from faster_whisper import WhisperModel

voice_dir = os.path.dirname(os.path.abspath(__file__))
wav_16k = os.path.join(voice_dir, "voice_16k.wav")
out_path = os.path.join(voice_dir, "words.json")

with wave.open(wav_16k, "rb") as wf:
    n = wf.getnframes()
    sr = wf.getframerate()
    audio = np.frombuffer(wf.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    duration = n / sr

print(f"Loaded {duration:.3f}s audio, loading cached base.en...", flush=True)
model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=2, local_files_only=True)
segs, _ = model.transcribe(audio, word_timestamps=True, beam_size=1, best_of=1, condition_on_previous_text=False)
words = []
for s in segs:
    for w in s.words:
        words.append({
            "word": w.word.strip(),
            "start": round(w.start, 3),
            "end": round(w.end, 3),
            "startFrame": int(round(w.start * 30)),
            "endFrame": int(round(w.end * 30)),
        })
total_frames = int(round(duration * 30)) + 15
with open(out_path, "w", encoding="utf-8") as f:
    json.dump({"duration": round(duration, 3), "fps": 30, "totalFrames": total_frames, "words": words}, f, indent=2)
print(f"DURATION: {duration:.3f}s | TOTAL_FRAMES: {total_frames} | WORDS: {len(words)}", flush=True)
for i, w in enumerate(words):
    print(f"{i:3d} f{w['startFrame']:4d}-f{w['endFrame']:4d} ({w['start']:6.2f}s) {w['word']}")
