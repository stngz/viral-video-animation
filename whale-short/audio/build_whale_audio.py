"""
build_whale_audio.py — Trailer-Cinematic audio engine (from viral-story-short skill!)
Synthesizes:
- Deep 45-55 Hz movie-trailer sub-bass braaam hits on blackout cards & explosion
- Continuous ticking tension pulse building urgency up to the plunger slam
- Sweeping cinematic risers into both blackout pattern-interrupts
- 24 frame-exact Foley SFX (ocean surf, disgusted gagging, heavy TNT crate thuds,
  angry warning yell, plunger click-slam, MASSIVE DYNAMITE EXPLOSION ROAR, crowd cheer,
  abrupt eerie silence, whistling falling blubber + wet splats + panic scramble,
  HUGE METALLIC CAR-CRUSHING CRASH, angry seagull squawks, metal shovel scrapes,
  warm golden sunset park chime!)
- Untouched user voiceover (1.0x, 48 kHz stereo master mix)
"""

import os
import wave
import numpy as np
from scipy import signal

SR = 48000
FPS = 30
TOTAL_FRAMES = 2520  # 84.000 s
TOTAL_SAMPLES = int(round((TOTAL_FRAMES / FPS) * SR))

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_WAV = os.path.join(BASE, "voice", "voice.wav")
AUDIO_DIR = os.path.join(BASE, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


def save_wav(path: str, arr: np.ndarray):
    arr = np.clip(arr, -0.98, 0.98)
    if arr.ndim == 1:
        arr = np.stack([arr, arr], axis=1)
    pcm = (arr * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def load_voice() -> np.ndarray:
    with wave.open(VOICE_WAV, "rb") as wf:
        raw = wf.readframes(wf.getnframes())
        ch = wf.getnchannels()
        arr = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
        if ch > 1:
            arr = arr.reshape(-1, ch).mean(axis=1)
    out = np.zeros(TOTAL_SAMPLES, dtype=np.float64)
    n = min(len(arr), TOTAL_SAMPLES)
    out[:n] = arr[:n]
    return out


def add_at(buf: np.ndarray, sig: np.ndarray, frame: float, gain: float = 1.0):
    start = int(round((frame / FPS) * SR))
    if start < 0:
        sig = sig[-start:]
        start = 0
    end = min(len(buf), start + len(sig))
    if end > start:
        buf[start:end] += sig[: end - start] * gain


def bandpass(x, lo, hi):
    sos = signal.butter(3, [lo, hi], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x, cut):
    sos = signal.butter(3, cut, btype="lowpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def highpass(x, cut):
    sos = signal.butter(2, cut, btype="highpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


# ---------------------------------------------------------------------------
# 1. TRAILER-CINEMATIC TENSION SCORE (Dark pulse + ticking clock + golden finale!)
# ---------------------------------------------------------------------------
def synth_tick(rng, accent=1.0):
    n = int(0.055 * SR)
    t = np.arange(n) / SR
    click = bandpass(rng.standard_normal(n), 1800, 5600) * np.exp(-t * 95)
    tone = np.sin(2 * np.pi * (1450 if accent > 0.8 else 1120) * t) * np.exp(-t * 80) * 0.45
    return (click + tone) * accent


def synth_sub_pulse(freq=55.0, dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.02) * np.exp(-t * 5.2)
    return np.tanh((np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t)) * 1.3) * env


def synth_warm_pad(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.65) * np.minimum(1, (dur - t) / 0.8)
    env = np.clip(env, 0, 1)
    s = np.zeros(n)
    for f in freqs:
        s += np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2 * t)
    return lowpass(s / len(freqs), 1200) * env


def build_trailer_score() -> np.ndarray:
    rng = np.random.default_rng(1970)
    buf = np.zeros(TOTAL_SAMPLES, dtype=np.float64)

    # Ticking clock tension pulse (126 BPM eighth-note ticks) during suspense sections!
    step_sec = (60.0 / 126.0) / 2.0
    total_steps = int((TOTAL_FRAMES / FPS) / step_sec)
    for step in range(total_steps):
        frame = (step * step_sec) * FPS
        # Cut music abruptly during Blackout #2 ("Then they looked up.") and deadpan car reveal!
        if 1408 <= frame < 1456:
            continue
        if 1918 <= frame < 2010:
            continue
        if frame >= 2340:
            break

        # Build tension toward the dynamite blast!
        if frame < 198:
            lvl = 0.42
        elif frame < 316:
            lvl = 0.28
        elif frame < 1268:
            lvl = 0.45 + 0.35 * ((frame - 316) / 952.0)
        elif frame < 1303:
            lvl = 0.95  # Peak urgency on plunger!
        elif frame < 1722:
            lvl = 0.72  # Chaotic raining blubber!
        else:
            lvl = 0.36

        in_bar = step % 8
        accent = 1.0 if in_bar in (0, 4) else 0.55
        add_at(buf, synth_tick(rng, accent), frame, 0.24 * lvl)
        if in_bar == 0:
            root_hz = 55.0 if (step // 8) % 4 != 3 else 49.0  # A1 -> G1 dark trailer drone
            add_at(buf, synth_sub_pulse(root_hz, 0.7), frame, 0.38 * lvl)
        if in_bar == 4 and frame >= 900:
            add_at(buf, synth_sub_pulse(65.4, 0.45), frame, 0.26 * lvl)

    # Dark cinematic low string drone underneath tension acts (f320 - f1298 and f1458 - f1900)
    add_at(buf, synth_warm_pad([110.0, 164.8, 220.0], 32.0), 320, 0.22)
    add_at(buf, synth_warm_pad([110.0, 146.8, 164.8], 14.5), 1460, 0.24)

    # Warm uplifting golden-hour major chord swell for Exploding Whale Memorial Park finale!
    add_at(buf, synth_warm_pad([130.8, 196.0, 261.6, 329.6, 392.0], 6.4), 2340, 0.45)

    peak = np.max(np.abs(buf)) + 1e-9
    return buf * (0.72 / peak)


# ---------------------------------------------------------------------------
# 2. CINEMATIC TRAILER HITS + 24 FRAME-EXACT FOLEY SFX
# ---------------------------------------------------------------------------
def sfx_sub_boom(dur=1.4, f0=95.0, f1=38.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 7.5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.012) * np.exp(-t * 2.4)
    hit = np.tanh((np.sin(ph) * 1.2 + 0.45 * np.sin(2 * ph)) * 1.45) * env
    return hit * 0.92


def sfx_riser(rng, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    prog = t / dur
    f = 180.0 * (2.0 ** (prog * 3.2))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * (prog ** 1.8) * 0.45
    noise = bandpass(rng.standard_normal(n), 400, 4200) * (prog ** 2.1) * 0.55
    return (tone + noise) * 0.78


def sfx_ocean_surf(rng, dur=5.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    wave_env = (0.45 + 0.55 * np.sin(np.pi * t / dur)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.45 * t))
    return bandpass(rng.standard_normal(n), 180, 1400) * wave_env * 0.35


def sfx_crate_thuds(rng):
    dur = 2.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st in [0.0, 0.55, 1.05, 1.55, 2.05]:
        mask = (t >= st) & (t < st + 0.22)
        lt = t[mask] - st
        thud = np.sin(2 * np.pi * (140 * np.exp(-lt * 16) + 55) * lt) * np.exp(-lt * 18)
        wood = bandpass(rng.standard_normal(len(lt)), 400, 1800) * np.exp(-lt * 32) * 0.5
        out[mask] += thud + wood
    return out * 0.72


def sfx_plunger_slam(rng):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    clack = bandpass(rng.standard_normal(n), 1200, 5200) * np.exp(-t * 42)
    thump = np.sin(2 * np.pi * 160 * t) * np.exp(-t * 25)
    return (clack * 0.9 + thump * 0.8) * 0.85


def sfx_massive_explosion(rng):
    # HUGE cinematic dynamite roar + low shockwave + debris crackle!
    dur = 3.2
    n = int(dur * SR)
    t = np.arange(n) / SR
    shock = np.sin(2 * np.pi * (110 * np.exp(-t * 9) + 34) * t) * np.exp(-t * 1.8) * 1.4
    roar = lowpass(rng.standard_normal(n), 620) * np.minimum(1, t / 0.015) * np.exp(-t * 1.15) * 1.3
    crack = highpass(rng.standard_normal(n), 950) * np.exp(-t * 14.0) * 0.9
    debris = bandpass(rng.standard_normal(n), 500, 2800) * (np.maximum(0, np.sin(2 * np.pi * 19 * t)) ** 4) * np.exp(-t * 1.4) * 0.45
    return np.tanh((shock + roar + crack + debris) * 1.2) * 0.95


def sfx_crowd_cheer(rng, dur=2.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.35)
    return bandpass(rng.standard_normal(n), 500, 2600) * env * 0.48


def sfx_whistle_drop():
    # Cartoon falling bomb whistle descending straight down from orbit!
    dur = 1.65
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 1650 * ((0.22) ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.12) * np.minimum(1, (dur - t) / 0.06)
    return (np.sin(ph) * 0.72 + np.sin(2 * ph) * 0.16) * env * 0.55


def sfx_wet_splats(rng, dur=4.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st in [0.15, 0.72, 1.18, 1.75, 2.25, 2.88, 3.45]:
        mask = (t >= st) & (t < st + 0.24)
        lt = t[mask] - st
        sq = np.sin(2 * np.pi * (280 * np.exp(-lt * 12) + 75) * lt) * np.exp(-lt * 16)
        slap = bandpass(rng.standard_normal(len(lt)), 700, 3600) * np.exp(-lt * 26) * 0.75
        out[mask] += sq + slap
    return out * 0.72


def sfx_car_pancake_crash(rng):
    # HUGE metallic crunch + glass shatter + spring boing!
    dur = 1.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (120 * np.exp(-t * 14) + 40) * t) * np.exp(-t * 5.0) * 1.1
    metal = bandpass(rng.standard_normal(n), 600, 5800) * np.exp(-t * 7.5) * 1.2
    clang = (np.sin(2 * np.pi * 430 * t) + np.sin(2 * np.pi * 785 * t) + np.sin(2 * np.pi * 1210 * t)) * np.exp(-t * 9.0) * 0.45
    glass = highpass(rng.standard_normal(n), 3800) * np.minimum(1, np.maximum(0, (t - 0.08) / 0.02)) * np.exp(-np.maximum(0, t - 0.08) * 6.5) * 0.55
    return np.tanh((boom + metal + clang + glass) * 1.2) * 0.92


def sfx_seagulls(rng):
    dur = 2.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st, l, f0, f1 in [(0.05, 0.34, 1550, 980), (0.48, 0.28, 1780, 1120), (0.92, 0.36, 1450, 860), (1.42, 0.3, 1680, 1020)]:
        mask = (t >= st) & (t < st + l)
        lt = t[mask] - st
        f = f0 + (f1 - f0) * (lt / l)
        ph = 2 * np.pi * np.cumsum(f) / SR
        env = np.minimum(1, lt / 0.03) * np.minimum(1, (l - lt) / 0.05)
        call = np.tanh((np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.15 * rng.standard_normal(len(lt))) * 1.3)
        out[mask] += bandpass(call, 700, 3800) * env
    return out * 0.58


def sfx_shovels(rng):
    dur = 2.4
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st in [0.1, 0.85, 1.6]:
        mask = (t >= st) & (t < st + 0.42)
        lt = t[mask] - st
        scrape = bandpass(rng.standard_normal(len(lt)), 1100, 4800) * np.sin(np.pi * lt / 0.42)
        out[mask] += scrape
    return out * 0.65


def sfx_park_chime():
    dur = 1.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = (
        np.sin(2 * np.pi * 523.25 * t) * 0.45
        + np.sin(2 * np.pi * 659.25 * t) * 0.38
        + np.sin(2 * np.pi * 783.99 * t) * 0.35
        + np.sin(2 * np.pi * 1046.5 * t) * 0.28
    ) * np.minimum(1, t / 0.015) * np.exp(-t * 2.2)
    return sig * 0.65


def build_sfx():
    rng = np.random.default_rng(19701112)
    buf = np.zeros(TOTAL_SAMPLES, dtype=np.float64)
    cues = [
        (5, "Coastal Pacific ocean surf", sfx_ocean_surf(rng, 5.5), 0.55),
        (116, "Sub-bass reveal hit (8-ton problem)", sfx_sub_boom(1.1, 88, 42), 0.78),
        (198, "Blackout #1 sub-bass drop (Their solution?)", sfx_sub_boom(1.3, 95, 38), 0.88),
        (244, "Half a ton of dynamite BOOM", sfx_sub_boom(1.5, 108, 36), 0.94),
        (345, "Ocean surf establishing", sfx_ocean_surf(rng, 4.0), 0.45),
        (558, "Stink whoosh riser", sfx_riser(rng, 0.75), 0.52),
        (816, "Delulu confidence comedic boom", sfx_sub_boom(0.85, 110, 52), 0.65),
        (902, "20 wooden TNT crates thudding", sfx_crate_thuds(rng), 0.72),
        (1245, "Cinematic riser into plunger slam", sfx_riser(rng, 1.35), 0.78),
        (1287, "TNT plunger SLAM!", sfx_plunger_slam(rng), 0.92),
        (1302, "MASSIVE DYNAMITE EXPLOSION ROAR!", sfx_massive_explosion(rng), 0.98),
        (1356, "Beach crowd cheering", sfx_crowd_cheer(rng, 1.9), 0.58),
        (1412, "Blackout #2 tension drop + riser (Then they looked up)", sfx_riser(rng, 1.45), 0.82),
        (1460, "Blubber rain sub-hit", sfx_sub_boom(1.1, 92, 40), 0.78),
        (1490, "Wet blubber splats raining across beach", sfx_wet_splats(rng, 4.8), 0.76),
        (1795, "Orbital falling chunk whistle drop!", sfx_whistle_drop(), 0.74),
        (1840, "HUGE OLDSMOBILE PANCAKE CAR CRASH!", sfx_car_pancake_crash(rng), 0.95),
        (1916, "Deadpan silence sub-thud (owned by the guy)", sfx_sub_boom(0.95, 76, 40), 0.65),
        (2122, "Grumpy seagulls rage-quitting squawks!", sfx_seagulls(rng), 0.76),
        (2268, "Grumpy crew digging sand with shovels", sfx_shovels(rng), 0.72),
        (2344, "Golden sunset park warm chime", sfx_park_chime(), 0.68),
    ]
    lines = ["# Exploding Whale Audio SFX Cue Sheet (30 fps)\n"]
    for f, desc, sig, g in cues:
        add_at(buf, sig, f, g)
        lines.append(f"- `f{f:04d}` ({f/FPS:6.2f}s): {desc}")
    with open(os.path.join(AUDIO_DIR, "cues.md"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    return buf


def main():
    print("Loading whale voice.wav...")
    voice = load_voice()
    print("Synthesizing trailer-cinematic tension score...")
    music = build_trailer_score()
    print("Synthesizing 21 cinematic & Foley SFX cues...")
    sfx = build_sfx()

    # Smooth auto-ducking of music bed under speech
    abs_v = np.abs(voice)
    win = int(0.16 * SR)
    env_v = np.convolve(abs_v, np.ones(win) / win, mode="same")
    speech_mask = np.clip(env_v / 0.032, 0.0, 1.0)
    duck = 0.68 - 0.34 * speech_mask
    music_ducked = music * duck

    # Mix: voice untouched (1.0), trailer bed warm & tense, SFX crisp (-6 dB)
    mix = voice * 1.0 + music_ducked * 0.66 + sfx * 0.52
    peak = np.max(np.abs(mix))
    if peak > 0.94:
        mix = np.tanh(mix / 0.94) * 0.94

    save_wav(os.path.join(AUDIO_DIR, "music.wav"), music_ducked)
    save_wav(os.path.join(AUDIO_DIR, "sfx.wav"), sfx)
    save_wav(os.path.join(AUDIO_DIR, "mix.wav"), mix)
    print(f"Done! Wrote mix.wav ({TOTAL_SAMPLES/SR:.3f}s, 48kHz stereo)")


if __name__ == "__main__":
    main()
