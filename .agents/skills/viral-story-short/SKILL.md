---
name: viral-story-short
description: >-
  Dynamic variation skill for producing high-retention 50-75s vertical TikTok,
  Reels, and Shorts story videos. Automatically adapts visual style (articulated
  3D cartoon world in Three.js + Remotion, moody graphic-novel comic scenes with
  animated FX, or hybrid), script tone (TikTok-relatable slang or dead-serious
  movie-trailer contrast), blackout pattern-interrupts, and cinematic/Foley
  audio design to match the specific story or script. Use when the user asks to
  make a viral story short, adapt a script dynamically, or build a TikTok-style
  animated history/comedy/mystery short.
---

# Viral Story Short — Dynamic Variation Skill

An adaptive vertical short-form video pipeline (9:16, 30 fps) that builds on `cartoon-3d-short` and dynamically selects the right **visual style**, **script tone**, **retention edits**, and **sound engine** based on the story.

## 1. Dynamic Style & Tone Router (Decide First!)

Inspect the story or script and choose one option per axis before writing `SCRIPT.md` or code. Always confirm the script with the user first when they provide their own CapCut voiceover.

| Axis | Option A | Option B | Option C |
| :--- | :--- | :--- | :--- |
| **Visual Lane** | **`cartoon-3d`** — Articulated 2D bean-head characters (moving arms, pumping legs, blinking, 16 faces, props) in a painted 3D Three.js + Remotion world with world ink & DOF bokeh. Best for chaotic physical comedy, chases, vehicles, absurd stunts. | **`graphic-novel`** — Unified moody illustrated comic style (locked single color palette, e.g., warm amber sunset + crisp ink) driven in Remotion with live animated particles (muzzle flashes, dust, rain, flying debris), glowing eyes, camera punch-ins, and impact shakes. Best for dramatic war, survival, dark myths, eerie true stories. | **`hybrid`** — Animated `cartoon-3d` world punctuated by stark pitch-black pattern-interrupt title cards and stylized stare-into-the-camera close-up inserts. |
| **Script Tone** | **`tiktok-relatable`** — Conversational, short punchy lines, zero textbook jargon, natural TikTok slang (`cooked`, `delulu`, `aura`, `rage-quit`, `locked in`). Best for wild comedy & chaotic true events. | **`dead-serious-epic`** — Ultra-short 4–7 word blockbuster trailer fragments treating an absurd or tense story 100% seriously. Best for ironic contrast (e.g., bird wars, bizarre disasters, mysteries). | — |
| **Audio Engine** | **`trailer-cinematic`** — Deep 45–60 Hz sub-bass hits on twists, continuous ticking tension pulse, sweeping risers into cuts, vivid layered Foley inside sentences. | **`cartoon-groove`** — Era-matched upbeat synthesized score (e.g., ragtime-march, surf/funk) auto-ducked under speech + 25–30 frame-exact comedy Foley SFX. | — |
| **Captions / Blackouts** | **`clean-for-capcut`** — Zero baked-in subtitles (only optional blackout title hits) so user adds CapCut Auto Captions in one click. | **`baked-minimal`** — Clean 2–3 word bold uppercase captions positioned safely above the bottom TikTok UI bar + centered blackout cards. | — |

---

## 2. Viral Retention Script Formula

Follow these quantitative targets (see [viral_retention_playbook.md](./references/viral_retention_playbook.md)):

1. **Curiosity-Gap Hook (0:00–0:05) — NEVER spoil the ending first.**
   - Open with an unanswered tension gap (*"this time, the enemy wasn't human"*, *"an eight-ton problem... half a ton of dynamite. It did not go as planned"*).
   - Hold the final payoff reveal for the last 3–5 seconds.
2. **Tight Word Budget for CapCut TTS (~2.2–2.7 words/s):**
   - Target **115–185 words** → **50–70 seconds** final runtime.
   - Keep sentences short (4–12 words), zero stiff documentary vocabulary, zero wasted clauses.
   - Verify all facts via web search and log sources at the top of `SCRIPT.md`.
3. **Two Pattern-Interrupt Blackout Beats (when using `trailer-cinematic` or `hybrid`):**
   - **Interrupt #1 (~4–6 s, end of Hook):** Slam to black (`0.6–0.9 s`), cut music, hit a deep sub-bass drop, then reveal the core subject.
   - **Interrupt #2 (~24–28 s, mid-story twist):** Slam to black (`0.6–0.9 s`) on the turning point (*"But within days..."*, *"Then they looked up."*) with a riser + boom into an **iconic stare-into-the-lens close-up** (glowing eyes, wild dizzy eyes, or deadpan stare).

---

## 3. End-to-End Production Pipeline

### Step 1 — Script & Voiceover Alignment
1. Save verified facts + script in `<project>/SCRIPT.md`.
2. Receive user's voiceover (or generate if requested) → convert to 48 kHz WAV (`voice/voice.wav`, **keep voice 100% untouched** unless user asks for speed changes) and 16 kHz WAV (`voice/voice_16k.wav`).
3. Extract exact word-level timestamps (`voice/words.json`) using `faster-whisper` (`base.en`, passing numpy float32 array directly from `wave` to avoid PyAV compatibility bugs on Windows).
4. Lock every cut, camera kick, blackout hit, and Foley SFX **0–3 frames BEFORE** its target word in `words.json`.

### Step 2 — Visual Production (22–42 Fast-Cut Scenes, ~1.8–2.5 s/shot)
- **If `cartoon-3d` or `hybrid`:**
  - Start from the proven Remotion + Three.js architecture in `marathon-short/studio/src/videos/marathon/`:
    - `lights.ts` (`day` / `heat` / `golden` camera-relative frozen-per-shot sun), `shade.ts` (two-tone cel + `untone()` for readable banners/clocks), `paint.ts` (Canvas2D painted textures), `ink.ts` (world-only layer 0 outlines + depth occlusion against `NOINK` cards), `lensblur.ts` (two-pass DOF bokeh), `grade.ts` (saturation + white flash/blackout fade, film grain OFF).
    - `toon.ts` + `cast.ts` + `cardshade.ts`: articulated 600×1000 bean-head characters (arms, elbows, legs, knees, torso lean, bob, blinks, 16 faces, hand props) on `NOINK` layer with tight contact shadows and inner-only golden rim.
    - `build.ts` + `world.ts` + `story.ts`: multi-zone 3D sets, `computeGroundY()` terrain-locked cameras, 4–4.6° Dutch tilts, 7-frame alternating impact flip-shakes (`KICKS`), sight-line culling, and creeping camera motion on every hold (never static ≥ 12f).
  - **9:16 Framing Rule:** At `fov = 38°`, horizontal visible width is only `~0.38 × distance` (`~1.9 m` at `5 m`). Place two-shot characters within `±0.55 m` or pull back to `5.5–7 m`, and keep props clear of faces.
- **If `graphic-novel`:**
  - Lock ONE unified visual style prompt (consistent palette, lighting, line weight, aspect 9:16, zero baked text).
  - Generate 20–26 distinct sequential scenes (never reuse 8 static images across 60s!).
  - Composite in Remotion with live layered motion on every shot: dynamic zoom/pan curves, impact shakes, animated Canvas/WebGL particles (muzzle flashes, flying shells, dust clouds, sparks, rain, glowing eye pulses), blackout title cards, and snappy transitions.

### Step 3 — Look-Check Validation (Mandatory Before Full Render)
1. Bundle ONCE (`npx remotion bundle`) and render 16–20 key stills across all shots in **ONE shared Chromium instance** via `@remotion/renderer` (`openBrowser` + `renderStill`) at `scale = 0.5`.
2. Pack into labeled contact sheets and visually inspect every shot with `read_file`.
3. Fix any terrain-height offset, 9:16 edge clipping, prop occlusion, or unintended ink edge, then re-verify the fixed frames.

### Step 4 — Master Audio Synthesis (`48 kHz` Stereo)
1. Synthesize `music.wav` (matching chosen `trailer-cinematic` or `cartoon-groove` engine) + 20–30 frame-exact Foley cues in `sfx.wav` + `cues.md`.
2. Auto-duck music smoothly under the voice envelope (`mean_volume` ~`-20 dB`, `max_volume` < `-1.5 dB`, voice untouched at 1.0x, zero clipping).
3. Export `audio/mix.wav` matching exact video frame duration (`totalFrames / 30`).

### Step 5 — Final Render, QA & CapCut Delivery
1. Always set `TEMP` and `TMP` to `<project>/tmp` so Remotion bundles never bloat the system temp folder.
2. Hardware-tuned render on 2-core Intel UHD 600:
   - Use `scale=1.0` (`1080×1920`), `concurrency=2`, `--codec=h264 --crf=16 --gl=angle`, and downscale distant crowd canvases (`0.4×`, redraw every 2nd frame).
   - Scale to `1.3333` (2K) only on dedicated GPU machines.
3. Mux video + master audio:
   `ffmpeg -y -i silent.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart final.mp4`
4. Run `short_qa.py` to confirm: exact frame count, `0` accidental black frames (excluding intentional blackout windows), `0` unexpected white frames, `0` frozen spans ≥ 12 frames, clean audio levels.
5. Auto-register the finished MP4 into CapCut Desktop (`C:\Users\NATHANIEL\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft\`) with a crisp extracted cover frame, and wipe `<project>/tmp/*` after completion.

---

## References
- [Viral Retention Playbook & Quantitative Lessons](./references/viral_retention_playbook.md)
