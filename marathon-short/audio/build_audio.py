"""
build_audio.py — Synthesize 1904 Ragtime-March score + 28 frame-exact cartoon Foley SFX
and mix cleanly under the untouched user voiceover (48 kHz, exact 99.000 s = 2970 frames).

Follows cartoon-3d-short/SKILL.md:
- Voice unchanged (pure, crystal-clear lead)
- Music ducked dynamically under speech, lifted gently in pauses (+3 dB relative bed)
- SFX timed 0-3 frames before their exact spoken cue in words.json (-6 dB punch)
"""

import os
import math
import wave
import numpy as np
from scipy import signal

SR = 48000
FPS = 30
TOTAL_FRAMES = 2970
TOTAL_SAMPLES = int(round((TOTAL_FRAMES / FPS) * SR))

BASE = r"c:\Users\NATHANIEL\Videos\Video Animation\marathon-short"
VOICE_WAV = os.path.join(BASE, "voice", "voice.wav")
AUDIO_DIR = os.path.join(BASE, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


def save_wav(path: str, mono_or_stereo: np.ndarray):
    arr = np.clip(mono_or_stereo, -0.98, 0.98)
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
# 1. ORIGINAL 1904 RAGTIME-MARCH SCORE (122 BPM)
# ---------------------------------------------------------------------------
def synth_tuba_note(freq: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / 0.018) * np.exp(-t * 4.5)
    sig = (
        0.65 * np.sin(2 * np.pi * freq * t)
        + 0.35 * np.sin(2 * np.pi * freq * 2 * t)
        + 0.18 * np.sin(2 * np.pi * freq * 3 * t)
        + 0.08 * np.sin(2 * np.pi * freq * 4 * t)
    )
    return lowpass(sig * env, 480)


def synth_piano_pluck(freq: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / 0.004) * np.exp(-t * 7.2)
    # Slightly detuned 1904 tack-piano / banjo bounce!
    sig = (
        0.55 * np.sin(2 * np.pi * freq * t)
        + 0.25 * np.sin(2 * np.pi * freq * 2.002 * t)
        + 0.14 * np.sin(2 * np.pi * freq * 3.004 * t)
        + 0.06 * np.sin(2 * np.pi * freq * 4.0 * t)
    )
    return sig * env


def synth_fife_note(freq: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1.0 + 0.008 * np.sin(2 * np.pi * 5.8 * t)
    ph = 2 * np.pi * np.cumsum(freq * vib) / SR
    env = np.minimum(1.0, t / 0.025) * np.minimum(1.0, (dur - t) / 0.04)
    env = np.clip(env, 0, 1)
    sig = 0.72 * np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    return sig * env


def synth_snare_hit(rng, accent=1.0) -> np.ndarray:
    dur = 0.14
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    snap = bandpass(noise, 1100, 6200) * np.exp(-t * 28.0)
    body = np.sin(2 * np.pi * 195 * t * np.exp(-t * 8)) * np.exp(-t * 24.0)
    return (snap * 0.7 + body * 0.5) * accent


def synth_kick_hit() -> np.ndarray:
    dur = 0.18
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 24) + 46
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 14)


def midi_hz(m: int) -> float:
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


def build_music() -> np.ndarray:
    rng = np.random.default_rng(1904)
    buf = np.zeros(TOTAL_SAMPLES, dtype=np.float64)
    bpm = 122.0
    beat_sec = 60.0 / bpm
    step_sec = beat_sec / 2.0  # 8th notes
    total_steps = int((TOTAL_FRAMES / FPS) / step_sec)

    # Classic bouncy C-major ragtime/march 8-bar progression (64 eighth-note steps per loop)
    # Chords: C | C | G7 | C | F | C | G7 | C
    bass_roots = [48, 43, 48, 43, 43, 38, 48, 43, 41, 45, 48, 43, 43, 38, 48, 48]  # per half-bar (4 steps)
    chord_tones = [
        [60, 64, 67], [60, 64, 67], [59, 62, 67], [60, 64, 67],
        [60, 65, 69], [60, 64, 67], [59, 62, 67], [60, 64, 67],
    ]
    melody = [
        # Bar 1-4 (jaunty 1904 march)
        72, 0, 76, 79, 76, 0, 72, 67,
        74, 0, 71, 67, 72, 0, 0, 0,
        77, 0, 76, 74, 72, 0, 69, 67,
        74, 76, 74, 71, 72, 0, 0, 0,
        # Bar 5-8 (playful turnaround)
        79, 0, 76, 72, 74, 76, 79, 0,
        81, 0, 79, 76, 74, 0, 0, 0,
        77, 76, 74, 72, 71, 74, 79, 0,
        76, 74, 72, 0, 72, 0, 0, 0,
    ]

    for step in range(total_steps):
        t_sec = step * step_sec
        frame = t_sec * FPS
        if frame >= 2866:
            # Drop music abruptly on final deadpan collapse for comedy timing!
            break

        # Section energy shaping so the score breathes with the story!
        if frame < 272:
            energy = 0.85  # Punchy hook
        elif 1698 <= frame < 1944:
            energy = 0.65  # Tense weird hallucination / rat-poison section
        elif 1944 <= frame < 2104:
            energy = 1.15  # Glorious golden-hour carried finish!
        elif 2104 <= frame < 2234:
            energy = 0.45  # Deadpan lull ("Luckily nobody died...")
        elif 2789 <= frame < 2866:
            energy = 0.90  # Warm golden medal buildup
        else:
            energy = 0.88

        bar_idx = (step // 8) % 8
        half_idx = (step // 4) % 16
        in_bar = step % 8
        m_note = melody[step % len(melody)]

        # Oom-pah tuba bass on beats 1 and 3
        if in_bar in (0, 4):
            note_m = bass_roots[half_idx]
            if 1698 <= frame < 1944:
                note_m -= 3  # Minor/tense shift during rat poison!
            add_at(buf, synth_tuba_note(midi_hz(note_m), step_sec * 1.6), frame, 0.36 * energy)
            add_at(buf, synth_kick_hit(), frame, 0.28 * energy)

        # Off-beat ragtime piano chord + crisp march snare on beats 2 and 4
        if in_bar in (2, 6):
            add_at(buf, synth_snare_hit(rng, 0.85), frame, 0.22 * energy)
            for ct in chord_tones[bar_idx]:
                if 1698 <= frame < 1944 and ct == 64:
                    ct = 63  # Eb minor tension!
                add_at(buf, synth_piano_pluck(midi_hz(ct), step_sec * 1.1), frame, 0.095 * energy)

        # Light marching snare grace tap on step 7 every second bar
        if in_bar == 7 and (bar_idx % 2 == 1):
            add_at(buf, synth_snare_hit(rng, 0.48), frame, 0.16 * energy)

        # Fife / tack-piano ragtime melody
        if m_note > 0 and energy > 0.55:
            pitch = m_note - 1 if (1698 <= frame < 1944 and m_note in (76, 81)) else m_note
            add_at(buf, synth_piano_pluck(midi_hz(pitch), step_sec * 1.4), frame, 0.14 * energy)
            if 1944 <= frame < 2104 or frame < 272 or 2696 <= frame < 2789:
                # Joyous marching fife double during Hook, Carried Climax, and Water Stations!
                add_at(buf, synth_fife_note(midi_hz(pitch), step_sec * 1.35), frame, 0.12 * energy)

    # Normalize gently so the ragtime-march bed sits warmly & clearly under voice
    peak = np.max(np.abs(buf)) + 1e-9
    return buf * (0.78 / peak)


# ---------------------------------------------------------------------------
# 2. CARTOON FOLEY & SFX GENERATORS (28 exact frame-locked events!)
# ---------------------------------------------------------------------------
def sfx_pistol(rng):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    crack = highpass(rng.standard_normal(n), 600) * np.exp(-t * 32)
    boom = np.sin(2 * np.pi * (140 * np.exp(-t * 14) + 45) * t) * np.exp(-t * 11)
    return np.tanh((crack * 1.6 + boom * 0.9) * 1.4) * 0.85


def sfx_car_horn():
    # Classic 1904 brass bulb horn "HONK-HONK!"
    dur = 0.68
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for start_t, length, base_f in [(0.0, 0.22, 345.0), (0.30, 0.30, 340.0)]:
        mask = (t >= start_t) & (t < start_t + length)
        lt = t[mask] - start_t
        env = np.minimum(1, lt / 0.015) * np.minimum(1, (length - lt) / 0.04)
        f = base_f * (1.0 - 0.05 * (lt / length))
        tone = (
            0.55 * np.sin(2 * np.pi * f * lt)
            + 0.45 * np.sin(2 * np.pi * f * 2 * lt)
            + 0.32 * np.sin(2 * np.pi * f * 3 * lt)
            + 0.2 * np.sin(2 * np.pi * f * 5 * lt)
        )
        out[mask] += np.tanh(tone * 1.5) * env
    return bandpass(out, 260, 2800) * 0.65


def sfx_chug_engine(rng, dur=2.2, speed=11.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.25)
    pulses = np.maximum(0, np.sin(2 * np.pi * speed * t)) ** 4
    rumble = lowpass(rng.standard_normal(n), 320) * (0.4 + 1.4 * pulses)
    putt = np.sin(2 * np.pi * 68 * t) * pulses * 0.6
    rattle = bandpass(rng.standard_normal(n), 900, 2600) * (np.maximum(0, np.sin(2 * np.pi * speed * 2 * t)) ** 6) * 0.25
    return (rumble + putt + rattle) * env * 0.65


def sfx_dust_whoosh(rng, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 0.8
    w = bandpass(rng.standard_normal(n), 280, 1800)
    return w * env * 0.68


def sfx_scissors_snip(rng):
    # Double metallic "SNIP-SNIP!"
    dur = 0.55
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st in [0.0, 0.22]:
        mask = (t >= st) & (t < st + 0.18)
        lt = t[mask] - st
        scrape = bandpass(rng.standard_normal(len(lt)), 2800, 8200) * np.exp(-lt * 26)
        ring = np.sin(2 * np.pi * 4150 * lt) * np.exp(-lt * 34) * 0.45
        click = np.sin(2 * np.pi * 1650 * lt) * np.exp(-lt * 55) * 0.5
        out[mask] += scrape + ring + click
    return out * 0.85


def sfx_crunch_apple(rng):
    dur = 0.72
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st in [0.0, 0.24, 0.46]:
        mask = (t >= st) & (t < st + 0.16)
        lt = t[mask] - st
        c = bandpass(rng.standard_normal(len(lt)), 900, 4800) * np.exp(-lt * 24)
        out[mask] += c * (0.7 + 0.3 * np.sin(2 * np.pi * 75 * lt))
    return out * 0.78


def sfx_water_drip():
    dur = 0.28
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 680 + 1350 * (t / dur) ** 1.3
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.008) * np.exp(-t * 18)
    return np.sin(ph) * env * 0.78


def sfx_wild_dogs(rng, dur=2.2):
    # Pack of cartoon barks "ARF! WOOF! YIP! ARF!"
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    barks = [(0.0, 0.18, 320, 170), (0.24, 0.16, 460, 240), (0.52, 0.22, 260, 145),
             (0.84, 0.15, 510, 280), (1.08, 0.20, 310, 165), (1.42, 0.18, 420, 210), (1.72, 0.22, 280, 150)]
    for st, l, f0, f1 in barks:
        mask = (t >= st) & (t < st + l)
        lt = t[mask] - st
        f = f0 + (f1 - f0) * (lt / l)
        ph = 2 * np.pi * np.cumsum(f) / SR
        env = np.minimum(1, lt / 0.015) * np.exp(-lt * 11)
        growl = np.tanh((np.sin(ph) + 0.6 * np.sin(2 * ph) + 0.3 * rng.standard_normal(len(lt))) * 1.4)
        out[mask] += bandpass(growl, 220, 2400) * env
    return out * 0.68


def sfx_whistle():
    # Piercing referee brass pea-whistle!
    dur = 0.75
    n = int(dur * SR)
    t = np.arange(n) / SR
    pea = 1.0 + 0.045 * np.sin(2 * np.pi * 34 * t)
    f = 2850 * pea
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.08)
    am = 0.78 + 0.22 * np.sin(2 * np.pi * 34 * t)
    return (np.sin(ph) * 0.7 + np.sin(2 * ph) * 0.15) * env * am * 0.55


def sfx_hallucinate():
    # Wobbly cartoon dizzy theremin shimmer
    dur = 1.4
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 540 + 180 * np.sin(2 * np.pi * 5.2 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.sin(np.pi * t / dur)
    return np.sin(ph) * env * 0.42


def sfx_poison_boing():
    # Bubbly poison gulp + wild electric cartoon spring BOIOIOING!
    dur = 0.85
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 190 + 360 * np.exp(-t * 2.4) * (0.5 + 0.5 * np.sin(2 * np.pi * 16 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.01) * np.exp(-t * 3.2)
    return np.tanh((np.sin(ph) + 0.4 * np.sin(2 * ph)) * 1.3) * env * 0.68


def sfx_crowd_cheer(rng, dur=3.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.6)
    noise = rng.standard_normal(n)
    roar = bandpass(noise, 450, 2600) * (0.7 + 0.3 * np.sin(2 * np.pi * 1.8 * t))
    return roar * env * 0.42


def sfx_clock_ticks(rng, dur=2.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    step = 0.16
    for i in range(int(dur / step)):
        st = i * step
        mask = (t >= st) & (t < st + 0.05)
        lt = t[mask] - st
        f = 1250 if i % 2 == 0 else 980
        out[mask] += (np.sin(2 * np.pi * f * lt) + 0.3 * rng.standard_normal(len(lt))) * np.exp(-lt * 65)
    return out * 0.65


def sfx_radiator_pop_steam(rng):
    # POP! + loud pressurized hiss PSSSSSHHHH!
    dur = 2.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    pop = np.sin(2 * np.pi * (380 * np.exp(-t * 28) + 95) * t) * np.exp(-t * 22) * 1.1
    steam = highpass(rng.standard_normal(n), 1800) * np.minimum(1, t / 0.04) * np.exp(-t * 0.9) * 0.68
    return np.tanh(pop + steam) * 0.78


def sfx_engine_seize(rng):
    dur = 0.9
    n = int(dur * SR)
    t = np.arange(n) / SR
    clank = (np.sin(2 * np.pi * 240 * t) + np.sin(2 * np.pi * 615 * t) + 0.5 * rng.standard_normal(n)) * np.exp(-t * 10)
    screech = np.sin(2 * np.pi * (1400 * np.exp(-t * 3.5) + 320) * t) * np.exp(-t * 5) * 0.35
    return np.tanh(clank + screech) * 0.75


def sfx_gavel_slam(rng):
    dur = 0.75
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for st in [0.0, 0.28]:
        mask = (t >= st) & (t < st + 0.25)
        lt = t[mask] - st
        wood = np.sin(2 * np.pi * 175 * lt) * np.exp(-lt * 20) + np.sin(2 * np.pi * 420 * lt) * np.exp(-lt * 32) * 0.6
        crack = bandpass(rng.standard_normal(len(lt)), 700, 3200) * np.exp(-lt * 40) * 0.5
        out[mask] += wood + crack
    return out * 0.85


def sfx_water_splash(rng):
    dur = 1.1
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.08) * np.exp(-t * 2.2)
    splash = bandpass(rng.standard_normal(n), 800, 5200) * env
    chime = np.sin(2 * np.pi * 1046.5 * t) * np.exp(-t * 4.5) * 0.28 + np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 4.0) * 0.22
    return (splash * 0.55 + chime) * 0.72


def sfx_medal_ding():
    dur = 0.85
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1568 * t) * 0.6 + np.sin(2 * np.pi * 3136 * t) * 0.25) * np.exp(-t * 4.2) * 0.62


def sfx_collapse_tuba(rng):
    # Heavy comic body thud + classic deadpan downward tuba "wah-waaaah"!
    dur = 1.55
    n = int(dur * SR)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * (95 * np.exp(-t * 14) + 36) * t) * np.exp(-t * 9) * 0.95
    # Two downward brass notes starting at 0.18s
    wah = np.zeros(n)
    for st, l, f0, f1 in [(0.18, 0.34, 220.0, 207.0), (0.56, 0.85, 196.0, 142.0)]:
        mask = (t >= st) & (t < st + l)
        lt = t[mask] - st
        f = f0 + (f1 - f0) * ((lt / l) ** 1.3)
        ph = 2 * np.pi * np.cumsum(f) / SR
        env = np.minimum(1, lt / 0.025) * np.minimum(1, (l - lt) / 0.12)
        brass = 0.65 * np.sin(ph) + 0.38 * np.sin(2 * ph) + 0.22 * np.sin(3 * ph)
        wah[mask] += lowpass(brass, 750) * env
    return thud * 0.7 + wah * 0.58


def build_sfx():
    rng = np.random.default_rng(1932)
    buf = np.zeros(TOTAL_SAMPLES, dtype=np.float64)
    cues = [
        (36, "Starting pistol BANG", sfx_pistol(rng), 0.75),
        (45, "Opening stadium cheer", sfx_crowd_cheer(rng, 2.4), 0.45),
        (151, "1904 car horn (Hook)", sfx_car_horn(), 0.70),
        (202, "Poison electric boing (Hook)", sfx_poison_boing(), 0.68),
        (271, "Hook white flash whoosh", sfx_dust_whoosh(rng, 0.45), 0.55),
        (595, "Single sad water drip (Well)", sfx_water_drip(), 0.80),
        (632, "Second water drip (Well)", sfx_water_drip(), 0.72),
        (668, "Noisy 1904 official car chugging", sfx_chug_engine(rng, 3.6, 11.5), 0.65),
        (782, "Thick red dust cloud blast", sfx_dust_whoosh(rng, 2.2), 0.72),
        (992, "Giant scissors SNIP-SNIP!", sfx_scissors_snip(rng), 0.88),
        (1068, "Rotten orchard apple crunch", sfx_crunch_apple(rng), 0.82),
        (1178, "Quick zip past rivals", sfx_dust_whoosh(rng, 0.65), 0.52),
        (1265, "Pack of wild dogs barking!", sfx_wild_dogs(rng, 2.8), 0.78),
        (1412, "Lorz joyride car chug", sfx_chug_engine(rng, 3.4, 12.5), 0.52),
        (1474, "Lorz smug horn HONK-HONK!", sfx_car_horn(), 0.74),
        (1550, "Fake finish crowd cheer", sfx_crowd_cheer(rng, 1.8), 0.48),
        (1598, "Referee WHISTLE BUST!", sfx_whistle(), 0.78),
        (1706, "Hallucinating woozy shimmer", sfx_hallucinate(), 0.65),
        (1904, "Strychnine rat poison BOING!", sfx_poison_boing(), 0.82),
        (1955, "Golden-hour stadium cheer roar", sfx_crowd_cheer(rng, 4.4), 0.62),
        (2252, "Giant stadium clock rapid ticks", sfx_clock_ticks(rng, 2.8), 0.72),
        (2375, "Jalopy straining uphill", sfx_chug_engine(rng, 4.8, 13.5), 0.64),
        (2535, "Radiator cap POP + steam hiss!", sfx_radiator_pop_steam(rng), 0.86),
        (2577, "Engine SEIZES metal clank!", sfx_engine_seize(rng), 0.85),
        (2638, "Committee GAVEL SLAM!", sfx_gavel_slam(rng), 0.88),
        (2720, "Water station splash & chime", sfx_water_splash(rng), 0.75),
        (2842, "Gold medal DING!", sfx_medal_ding(), 0.78),
        (2867, "Deadpan collapse THUD + wah-wah!", sfx_collapse_tuba(rng), 0.85),
    ]
    lines = ["# Audio SFX Cue Sheet (30 fps)\n"]
    for f, desc, sig, g in cues:
        add_at(buf, sig, f, g)
        lines.append(f"- `f{f:04d}` ({f/FPS:6.2f}s): {desc}")
    with open(os.path.join(AUDIO_DIR, "cues.md"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    return buf


def main():
    print("Loading voice.wav...")
    voice = load_voice()

    print("Synthesizing 1904 ragtime-march score...")
    music = build_music()

    print("Synthesizing 28 frame-exact Foley SFX...")
    sfx = build_sfx()

    # Smooth voice envelope for gentle sidechain ducking of music under speech
    abs_v = np.abs(voice)
    win = int(0.18 * SR)
    kernel = np.ones(win) / win
    env_v = np.convolve(abs_v, kernel, mode="same")
    speech_mask = np.clip(env_v / 0.032, 0.0, 1.0)
    # Music sits lively under speech (~-10 dB under voice) and blooms warmly in pauses
    duck = 0.62 - 0.30 * speech_mask
    music_ducked = music * duck

    # Mix per SKILL.md: voice unchanged (1.0), music +3 dB warm groove, SFX -6 dB (0.50)
    mix = voice * 1.0 + music_ducked * 0.74 + sfx * 0.50
    # Transparent soft-clip limiter only above 0.94 so voice stays 100% crisp
    peak = np.max(np.abs(mix))
    if peak > 0.94:
        mix = np.tanh(mix / 0.94) * 0.94

    save_wav(os.path.join(AUDIO_DIR, "music.wav"), music_ducked)
    save_wav(os.path.join(AUDIO_DIR, "sfx.wav"), sfx)
    save_wav(os.path.join(AUDIO_DIR, "mix.wav"), mix)
    print(f"Done! Wrote mix.wav ({TOTAL_SAMPLES/SR:.3f}s, 48kHz stereo), music.wav, sfx.wav, cues.md")


if __name__ == "__main__":
    main()
