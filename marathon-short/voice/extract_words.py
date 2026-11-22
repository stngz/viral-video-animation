import json
import wave
import numpy as np
from faster_whisper import WhisperModel

wav_16k = r"c:\Users\NATHANIEL\Videos\Video Animation\marathon-short\voice\voice_16k.wav"
out_path = r"c:\Users\NATHANIEL\Videos\Video Animation\marathon-short\voice\words.json"

with wave.open(wav_16k, "rb") as wf:
    n = wf.getnframes()
    sr = wf.getframerate()
    raw = wf.readframes(n)
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    duration = n / sr

print(f"Loaded {duration:.3f}s audio ({sr} Hz), running faster-whisper base.en...")
model = WhisperModel("base.en", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, word_timestamps=True, beam_size=5)

words = []
segs_out = []
for seg in segments:
    segs_out.append({
        "start": round(seg.start, 3),
        "end": round(seg.end, 3),
        "text": seg.text.strip(),
    })
    for w in seg.words:
        words.append({
            "word": w.word.strip(),
            "start": round(w.start, 3),
            "end": round(w.end, 3),
            "startFrame": int(round(w.start * 30)),
            "endFrame": int(round(w.end * 30)),
        })

data = {
    "duration": round(duration, 3),
    "fps": 30,
    "totalFrames": int(round(duration * 30)) + 15,
    "segments": segs_out,
    "words": words,
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"Extracted {len(words)} words -> {out_path}")
for i, w in enumerate(words):
    print(f"{i:3d}  f{w['startFrame']:4d}-f{w['endFrame']:4d} ({w['start']:6.2f}s)  {w['word']}")
