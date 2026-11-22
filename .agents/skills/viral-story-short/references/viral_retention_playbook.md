# Viral Retention Playbook & Production Lessons

Distilled from quantitative study of viral short-form history TikToks and our own 3D Remotion productions (`The 1904 Olympic Marathon`). Treat all studied reference videos strictly as private analysis — never copy scripts, characters, or shots.

---

## 1. Viral TikTok Retention Benchmarks (Measured)

| Metric | Low-Retention Draft | High-Retention Viral Target |
| :--- | :--- | :--- |
| **Total Runtime** | 95–110 s | **50–68 s** (sweet spot for completion rate) |
| **Word Count (CapCut TTS ~2.2–2.7 w/s)** | 240–270 words | **115–185 words** |
| **Sentence Length** | 18–30 words (multi-clause) | **4–12 words** (instant zero-friction scan) |
| **Hook Strategy (0:00–0:05)** | Reveals full outcome immediately | **Curiosity gap** — withholds key reveal/twist |
| **Pattern Interrupts** | Continuous unbroken flow | **2 sharp blackout + sub-bass hits** (~5 s and ~26 s) |
| **Visual Cut Cadence** | 8 stills (~8 s/shot) | **22–42 shots (~1.8–2.5 s/shot)** |
| **Audio Style** | Flat background loop | **Dynamic score + risers + ticking pulse + frame-exact Foley** |
| **Hero Close-Ups** | Distant medium shots | **1–2 iconic stare-into-the-lens close-ups** (glowing/dizzy/deadpan eyes) |

---

## 2. Audio Design Recipes

### A. `trailer-cinematic` (Best for War, Disasters, Mysteries, Ironic Contrast)
- **Sub-Bass Drop (`45–55 Hz`):** Pitch-swept sine + subtle warm saturation decaying over `0.9 s` synced to blackout title cuts and twist reveals.
- **Ticking Tension Pulse:** Crisp filtered wood/clock tick on 8th-note grid (`115–128 BPM`) with subtle velocity alternation underneath narration.
- **Riser Sweep:** Bandpass-filtered noise sweeping `300 Hz → 3200 Hz` over `0.8 s` terminating cleanly 2 frames before a blackout or explosion hit.
- **Layered In-Sentence Foley:** Place vivid SFX directly *inside* key spoken words (gunfire bursts, shell casings, screams/animal calls, rumbling engines, crashing impacts) at `-6 dB` relative to untouched voice.

### B. `cartoon-groove` (Best for Physical Slapstick & Chaotic Comedy)
- Era-matched rhythmic bed (e.g., 122 BPM ragtime-march tuba/snare/tack-piano, or 1970s bass/organ groove) sidechain-ducked smoothly via voice envelope (`-10 dB` under speech, blooming in pauses).
- Abruptly drop music to silence on the final deadpan punchline/collapse for comic timing (`thud + tuba wah-wah`).

---

## 3. Remotion + Three.js Technical Gotchas (Windows / Intel UHD 600)

1. **Initialization Order in React (`Marathon.tsx`):** Create `WebGLRenderer` and `EffectComposer` inside `useLayoutEffect` declared *before* the per-frame `useLayoutEffect`, never inside `useEffect`, or frame 0 renders blank.
2. **World Ink vs. `NOINK` Character Cards (`ink.ts`):** Pass BOTH `uWorldDepth` (layer 0 only) and `uSceneDepth` (alpha-tested full scene depth with `colorMask(false)`). Skip world ink wherever `uSceneDepth + 0.00015 < uWorldDepth` so world outlines never bleed across character faces.
3. **Transparent Planes & Ink:** Place alpha-tested transparent banners/bunting/flags on layer `NOINK` so world ink never outlines their invisible rectangular quad edges.
4. **Terrain-Locked Cameras (`story.ts`):** On sloped/hilly zones, ALWAYS derive camera `pos.y` and `look.y` from `computeGroundY(x, z)` — never hardcode flat `y` coordinates.
5. **9:16 Narrow Horizontal FOV:** At `fov = 38°`, horizontal FOV is ~`21.8°` (only `~1.9 m` wide at `5 m`). Stage two-shots tight (`0.9–1.1 m` apart) or pull camera back to `5.5–7 m`.
6. **Fast Shared-Browser Still Checks:** Run `openBrowser("chrome")` ONCE inside `@remotion/renderer` and loop `renderStill` from inside `studio/` (reuses cached Chrome Headless Shell, renders 20 stills in ~1 min instead of 12 min).
7. **2-Core Intel UHD 600 Performance:**
   - Render distant crowd actors at `0.4×` canvas resolution and redraw every 2nd frame (`15 fps` background animation = ~12× CPU savings, zero visible quality loss).
   - Use `--scale=1.0` (`1080×1920`) and `--concurrency=2` to stay cleanly inside 1 GB VRAM (~1.5–2.2 fps steady).
8. **Whisper on Windows Python 3.12:** Avoid `faster_whisper`'s `av.open(..., metadata_errors=...)` crash by decoding `voice_16k.wav` via Python's built-in `wave` + `numpy.frombuffer(..., np.int16)` float32 array and passing the array directly to `model.transcribe(audio, word_timestamps=True)`.
9. **PowerShell Command Chaining:** Windows PowerShell 5.1 rejects `&&`; run Node/npm chains inside `cmd /c "..."` or use `;` + `$LASTEXITCODE`.
