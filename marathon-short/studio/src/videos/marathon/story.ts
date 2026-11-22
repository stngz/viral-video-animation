import { LightMode } from "./lights";
import { computeGroundY } from "./build";

export const FPS = 30;
export const TOTAL_FRAMES = 2970; // 99.00s exact match for voice.wav (98.85s)

export interface CamPose {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  roll?: number; // degrees
}

export interface ShotDef {
  id: string;
  /** Inclusive start frame */
  a: number;
  /** Exclusive end frame */
  b: number;
  light: LightMode;
  /** Zone center for sky / horizon placement */
  zone: "stadium" | "road" | "well" | "orchard" | "dogs" | "hill" | "modern";
  /** Depth-of-field blur radius in pixels at 1080x1920 (0 = sharp wide/aerial) */
  cInf: number;
  /** Focus distance in meters (defaults to camera-to-look distance if omitted) */
  focusDist?: number;
  /** Focus sharp band half-width in meters */
  focusRange?: number;
  /** Per-shot camera function given local normalized t in [0..1] and local frame lf */
  cam: (t: number, lf: number) => CamPose;
}

export interface KickDef {
  f: number;
  amp: number;
  dur?: number;
}

export function smootherstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function glide(a: CamPose, b: CamPose, t: number): CamPose {
  const e = smootherstep(t);
  return {
    pos: lerp3(a.pos, b.pos, e),
    look: lerp3(a.look, b.look, e),
    fov: lerp(a.fov, b.fov, e),
    roll: lerp(a.roll ?? 0, b.roll ?? 0, e),
  };
}

/** Helper to anchor camera height directly above terrain elevation computeGroundY(x, z) */
function groundCam(
  tx: number,
  tz: number,
  dx: number,
  camH: number,
  dz: number,
  lookH: number,
  fov: number,
  roll = 0
): CamPose {
  const gy = computeGroundY(tx, tz);
  return {
    pos: [tx + dx, gy + camH, tz + dz],
    look: [tx, gy + lookH, tz],
    fov,
    roll,
  };
}

export const FLASH_AT = 273;

export const KICKS: KickDef[] = [
  { f: 36, amp: 0.48, dur: 7 }, // Starting pistol BANG!
  { f: 151, amp: 0.45, dur: 7 }, // "rode a car" snap cut
  { f: 200, amp: 0.55, dur: 7 }, // "ran on rat poison" snap cut
  { f: 668, amp: 0.5, dur: 7 }, // "Worse, officials drove noisy cars"
  { f: 782, amp: 0.65, dur: 8 }, // "blasting thick clouds of red dust"
  { f: 994, amp: 0.62, dur: 7 }, // "snipped into shorts" SCISSORS SNAP!
  { f: 1308, amp: 0.6, dur: 7 }, // "wild dogs" lunge!
  { f: 1600, amp: 0.72, dur: 8 }, // "officials caught him" WHISTLE BUST!
  { f: 1906, amp: 0.65, dur: 7 }, // "strychnine rat poison" WILD GULP!
  { f: 2008, amp: 0.45, dur: 7 }, // Hicks breaking finish tape!
  { f: 2536, amp: 0.78, dur: 8 }, // "body overheats" RADIATOR CAP POP!
  { f: 2578, amp: 0.85, dur: 9 }, // "engine seizes" HARD SEIZE!
  { f: 2639, amp: 0.75, dur: 7 }, // "nearly banned" GAVEL SLAM!
  { f: 2868, amp: 0.72, dur: 8 }, // "collapsed" DEADPAN FLOP!
];

/**
 * 42-SHOT RAPID-FIRE CHOREOGRAPHY locked directly to words.json!
 * All hill cameras use exact computeGroundY() and 9:16 vertical framing math.
 */
export const SHOTS: ShotDef[] = [
  // =========================================================================
  // BEAT 1: THE HOOK (f0 - f272)
  // =========================================================================
  {
    id: "S01_hook_stadium",
    a: 0,
    b: 83,
    light: "day",
    zone: "stadium",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [-0.3, 2.5, 17.5], look: [0.0, 1.55, 5.5], fov: 44, roll: -1.5 },
        { pos: [0.4, 2.1, 13.0], look: [0.0, 1.35, 4.5], fov: 40, roll: 1.5 },
        t
      ),
  },
  {
    id: "S02_hook_lorz_finish",
    a: 83,
    b: 151,
    light: "day",
    zone: "stadium",
    cInf: 13,
    cam: (t) =>
      glide(
        { pos: [2.4, 1.55, 6.2], look: [0.0, 1.25, 0.2], fov: 38, roll: 3.8 },
        { pos: [1.5, 1.45, 4.4], look: [0.0, 1.35, -0.4], fov: 33, roll: 4.2 },
        t
      ),
  },
  {
    id: "S03_hook_lorz_car",
    a: 151,
    b: 200,
    light: "heat",
    zone: "road",
    cInf: 11,
    focusRange: 3.4,
    cam: (t) => {
      const cz = lerp(12, 3, t);
      return groundCam(200.0, cz + 0.4, 5.6, 2.25, 4.4, 1.55, lerp(42, 37, t), -3.5);
    },
  },
  {
    id: "S04_hook_hicks_poison",
    a: 200,
    b: 272,
    light: "heat",
    zone: "road",
    cInf: 14,
    focusRange: 2.8,
    cam: (t) =>
      glide(
        groundCam(200.0, -20.0, 1.8, 1.5, 4.6, 1.25, 36, -4.0),
        groundCam(200.0, -20.0, 1.0, 1.45, 3.6, 1.32, 30, 4.0),
        t
      ),
  },

  // =========================================================================
  // BEAT 2: THE SETTING (f272 - f666)
  // =========================================================================
  {
    id: "S05_st_louis_grand",
    a: 272,
    b: 368,
    light: "day",
    zone: "stadium",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [-7.2, 6.8, 22.0], look: [0.0, 2.0, -2.0], fov: 46, roll: 0 },
        { pos: [5.5, 4.2, 14.5], look: [0.0, 1.4, 2.5], fov: 42, roll: 0 },
        t
      ),
  },
  {
    id: "S06_dusty_hills",
    a: 368,
    b: 452,
    light: "heat",
    zone: "road",
    cInf: 0,
    cam: (t) =>
      glide(
        groundCam(200.0, -4.0, 5.2, 6.5, 24.0, 1.4, 46, 0),
        groundCam(200.0, -8.0, -3.5, 3.8, 16.0, 1.2, 42, 2.0),
        t
      ),
  },
  {
    id: "S07_90_degree_heat",
    a: 452,
    b: 502,
    light: "heat",
    zone: "road",
    cInf: 12,
    cam: (t) =>
      glide(
        groundCam(200.0, 1.2, 1.8, 1.4, 5.2, 2.6, 42, 3.2),
        groundCam(200.0, 1.2, 1.2, 1.45, 4.0, 1.32, 32, 3.8),
        t
      ),
  },
  {
    id: "S08_organizer_sullivan",
    a: 502,
    b: 574,
    light: "heat",
    zone: "well",
    cInf: 11,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [402.5, 1.55, 7.6], look: [401.0, 1.28, 1.4], fov: 38, roll: -2.0 },
        { pos: [402.2, 1.5, 5.6], look: [401.3, 1.35, 1.5], fov: 32, roll: -3.0 },
        t
      ),
  },
  {
    id: "S09_no_water_well",
    a: 574,
    b: 666,
    light: "heat",
    zone: "well",
    cInf: 12,
    focusRange: 3.0,
    cam: (t) =>
      glide(
        { pos: [400.6, 1.85, 4.4], look: [400.0, 1.65, 0.0], fov: 34, roll: 0 },
        { pos: [403.4, 2.5, 11.2], look: [400.0, 1.45, -1.5], fov: 44, roll: 1.5 },
        t
      ),
  },

  // =========================================================================
  // BEAT 3: OFFICIALS' DUST CARS (f666 - f886)
  // =========================================================================
  {
    id: "S10_noisy_cars_cu",
    a: 666,
    b: 730,
    light: "heat",
    zone: "road",
    cInf: 12,
    focusRange: 3.5,
    cam: (t) => {
      const cz = lerp(18, 2, t);
      return groundCam(200.0, cz + 0.3, 5.2, 1.85, 4.2, 1.35, lerp(42, 36, t), 4.2);
    },
  },
  {
    id: "S11_in_front_of_pack",
    a: 730,
    b: 782,
    light: "heat",
    zone: "road",
    cInf: 8,
    focusRange: 4.5,
    cam: (t) => {
      const cz = lerp(2, -10, t);
      return groundCam(200.0, cz + 2.5, 6.4, 2.8, 9.2, 1.25, lerp(40, 48, t), -3.0);
    },
  },
  {
    id: "S12_thick_red_dust",
    a: 782,
    b: 842,
    light: "heat",
    zone: "road",
    cInf: 10,
    focusRange: 4.0,
    cam: (t) => {
      const cz = lerp(-10, -22, t);
      return groundCam(200.0, cz + 5.2, -5.2, 2.0, 8.2, 1.35, lerp(44, 36, t), -4.2);
    },
  },
  {
    id: "S13_runners_lungs_cough",
    a: 842,
    b: 886,
    light: "heat",
    zone: "road",
    cInf: 14,
    focusRange: 3.0,
    cam: (t) =>
      glide(
        groundCam(200.0, -17.5, 1.6, 1.45, 5.2, 1.25, 36, 4.0),
        groundCam(200.0, -17.5, 1.1, 1.42, 4.1, 1.32, 30, 4.5),
        t
      ),
  },

  // =========================================================================
  // BEAT 4: CUBAN MAILMAN FÉLIX CARVAJAL (f886 - f1220)
  // =========================================================================
  {
    id: "S14_cuban_mailman_trousers",
    a: 886,
    b: 978,
    light: "day",
    zone: "stadium",
    cInf: 11,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [2.6, 1.4, 15.6], look: [0.0, 1.15, 9.4], fov: 40, roll: -1.5 },
        { pos: [1.8, 1.25, 13.0], look: [0.0, 1.05, 8.2], fov: 34, roll: 1.5 },
        t
      ),
  },
  {
    id: "S15_pants_snipped_shorts",
    a: 978,
    b: 1063,
    light: "day",
    zone: "stadium",
    cInf: 14,
    focusRange: 3.0,
    cam: (t) =>
      glide(
        { pos: [0.25, 1.0, 13.8], look: [0.2, 0.92, 8.2], fov: 36, roll: 3.5 },
        { pos: [0.6, 1.35, 14.5], look: [0.2, 1.05, 8.2], fov: 40, roll: -2.5 },
        t
      ),
  },
  {
    id: "S16_rotten_apples",
    a: 1063,
    b: 1118,
    light: "day",
    zone: "orchard",
    cInf: 12,
    focusRange: 3.0,
    cam: (t) =>
      glide(
        { pos: [604.2, 1.5, 3.8], look: [601.5, 1.25, -1.2], fov: 38, roll: 2.5 },
        { pos: [603.2, 1.4, 2.2], look: [601.5, 1.28, -1.2], fov: 31, roll: -3.5 },
        t
      ),
  },
  {
    id: "S17_roadside_nap",
    a: 1118,
    b: 1163,
    light: "day",
    zone: "orchard",
    cInf: 10,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [603.4, 1.35, 3.4], look: [601.5, 0.55, -1.2], fov: 38, roll: -1.5 },
        { pos: [605.4, 2.2, 5.6], look: [601.2, 0.75, -1.2], fov: 44, roll: 0 },
        t
      ),
  },
  {
    id: "S18_still_placed_fourth",
    a: 1163,
    b: 1220,
    light: "day",
    zone: "road",
    cInf: 10,
    focusRange: 3.5,
    cam: (t) => {
      const fz = lerp(24, 12, t);
      return groundCam(200.0, fz, 3.6, 1.55, -5.2, 1.15, lerp(40, 34, t), 3.8);
    },
  },

  // =========================================================================
  // BEAT 5: WILD DOGS & FRED LORZ CAR CHEAT (f1220 - f1632)
  // =========================================================================
  {
    id: "S19_barefoot_runner",
    a: 1220,
    b: 1258,
    light: "day",
    zone: "dogs",
    cInf: 12,
    focusRange: 3.0,
    cam: (t) => {
      const lz = lerp(12, 5, t);
      return {
        pos: [803.2, 1.15, lz - 4.8],
        look: [800.0, 0.95, lz],
        fov: lerp(38, 34, t),
        roll: -2.0,
      };
    },
  },
  {
    id: "S20_chased_off_course",
    a: 1258,
    b: 1306,
    light: "day",
    zone: "dogs",
    cInf: 7,
    focusRange: 4.5,
    cam: (t) => {
      const lx = lerp(801, 809, t);
      const lz = lerp(3, -1, t);
      return {
        pos: [lx + 4.5, 2.35, lz + 7.2],
        look: [lx - 1.4, 1.1, lz],
        fov: lerp(38, 48, t),
        roll: -4.2,
      };
    },
  },
  {
    id: "S21_wild_dogs_pack",
    a: 1306,
    b: 1353,
    light: "day",
    zone: "dogs",
    cInf: 10,
    focusRange: 4.5,
    cam: (t) => {
      const lx = lerp(809, 816, t);
      const lz = lerp(-1, -4, t);
      return {
        pos: [lx + 0.2, 1.35, lz + 7.6],
        look: [lx - 0.2, 0.9, lz],
        fov: lerp(45, 40, t),
        roll: 4.4,
      };
    },
  },
  {
    id: "S22_lorz_intro_hop",
    a: 1353,
    b: 1411,
    light: "heat",
    zone: "road",
    cInf: 11,
    focusRange: 3.5,
    cam: (t) =>
      glide(
        groundCam(200.2, 23.8, 5.2, 2.2, 6.2, 1.25, 42, 2.0),
        groundCam(200.0, 23.8, 4.4, 1.9, 4.8, 1.35, 36, -2.0),
        t
      ),
  },
  {
    id: "S23_lorz_11_miles_car",
    a: 1411,
    b: 1474,
    light: "heat",
    zone: "road",
    cInf: 9,
    focusRange: 4.0,
    cam: (t) => {
      const cz = lerp(22, 4, t);
      return groundCam(200.0, cz + 0.4, 6.8, 2.4, 5.2, 1.45, lerp(44, 39, t), -3.0);
    },
  },
  {
    id: "S24_lorz_waving_runners",
    a: 1474,
    b: 1528,
    light: "heat",
    zone: "road",
    cInf: 13,
    focusRange: 3.8,
    cam: (t) => {
      const cz = lerp(4, -8, t);
      return groundCam(199.6, cz + 0.6, 5.2, 2.0, -4.4, 1.45, lerp(40, 34, t), 3.4);
    },
  },
  {
    id: "S25_lorz_finish_jog",
    a: 1528,
    b: 1582,
    light: "day",
    zone: "stadium",
    cInf: 10,
    cam: (t) =>
      glide(
        { pos: [-2.6, 1.55, 6.0], look: [0.0, 1.25, 0.2], fov: 40, roll: -2.5 },
        { pos: [-1.4, 1.5, 4.4], look: [0.0, 1.35, -0.5], fov: 33, roll: 2.0 },
        t
      ),
  },
  {
    id: "S26_officials_caught_him",
    a: 1582,
    b: 1632,
    light: "day",
    zone: "stadium",
    cInf: 14,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [1.4, 1.5, 4.2], look: [0.1, 1.28, -1.6], fov: 38, roll: -3.8 },
        { pos: [0.9, 1.48, 3.0], look: [0.1, 1.32, -1.6], fov: 32, roll: -4.4 },
        t
      ),
  },

  // =========================================================================
  // BEAT 6: THE SNAP — THOMAS HICKS + RAT POISON + CARRIED FINISH (f1632 - f2104)
  // =========================================================================
  {
    id: "S27_hicks_in_first",
    a: 1632,
    b: 1698,
    light: "heat",
    zone: "road",
    cInf: 11,
    cam: (t) => {
      const hz = lerp(-14, -22, t);
      return groundCam(200.0, hz, 2.6, 1.5, -5.0, 1.25, lerp(40, 34, t), 2.0);
    },
  },
  {
    id: "S28_hicks_hallucinating",
    a: 1698,
    b: 1744,
    light: "heat",
    zone: "road",
    cInf: 14,
    cam: (t) =>
      glide(
        groundCam(200.0, -28.0, 1.5, 1.55, 4.4, 1.35, 34, 4.4),
        groundCam(200.0, -28.0, -1.3, 1.5, 3.8, 1.4, 29, -4.4),
        t
      ),
  },
  {
    id: "S29_refused_water",
    a: 1744,
    b: 1800,
    light: "heat",
    zone: "road",
    cInf: 12,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        groundCam(200.1, -28.0, 1.6, 1.5, 6.0, 1.25, 38, -2.0),
        groundCam(200.1, -28.0, 1.1, 1.48, 4.9, 1.32, 34, -3.0),
        t
      ),
  },
  {
    id: "S30_egg_whites_mix",
    a: 1800,
    b: 1864,
    light: "heat",
    zone: "road",
    cInf: 14,
    focusRange: 3.0,
    cam: (t) =>
      glide(
        groundCam(200.6, -28.1, 1.2, 1.5, 4.8, 1.3, 36, 3.4),
        groundCam(200.8, -28.1, 0.8, 1.48, 4.0, 1.35, 30, 4.2),
        t
      ),
  },
  {
    id: "S31_brandy_rat_poison",
    a: 1864,
    b: 1944,
    light: "heat",
    zone: "road",
    cInf: 15,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        groundCam(200.1, -28.0, -1.6, 1.52, 5.4, 1.32, 36, -3.8),
        groundCam(199.9, -28.0, -1.0, 1.5, 4.4, 1.38, 30, 4.2),
        t
      ),
  },
  {
    id: "S32_carried_over_finish",
    a: 1944,
    b: 2030,
    light: "golden",
    zone: "stadium",
    cInf: 10,
    focusRange: 3.6,
    cam: (t) => {
      const hz = lerp(7.5, -1.8, t);
      return {
        pos: [3.6, 1.65, hz - 5.6],
        look: [0.0, 1.28, hz],
        fov: lerp(42, 36, t),
        roll: -2.6,
      };
    },
  },
  {
    id: "S33_legs_pumping_midair",
    a: 2030,
    b: 2104,
    light: "golden",
    zone: "stadium",
    cInf: 13,
    focusRange: 3.2,
    cam: (t) => {
      const hz = lerp(-1.8, -6.5, t);
      return {
        pos: [1.8, 0.95, hz - 4.2],
        look: [0.0, 0.98, hz],
        fov: lerp(38, 31, t),
        roll: 3.8,
      };
    },
  },

  // =========================================================================
  // BEAT 7: DEADPAN DOUBLE LINE + SLOWEST CLOCK (f2104 - f2340)
  // =========================================================================
  {
    id: "S34_luckily_nobody_died",
    a: 2104,
    b: 2160,
    light: "day",
    zone: "stadium",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [5.5, 2.2, 12.2], look: [0.0, 1.1, 4.0], fov: 44, roll: 0 },
        { pos: [4.2, 1.95, 10.6], look: [0.0, 1.05, 4.0], fov: 40, roll: 0 },
        t
      ),
  },
  {
    id: "S35_half_runners_quit",
    a: 2160,
    b: 2234,
    light: "day",
    zone: "stadium",
    cInf: 10,
    cam: (t) =>
      glide(
        { pos: [-4.8, 1.95, 13.0], look: [0.8, 0.55, 5.5], fov: 42, roll: -2.0 },
        { pos: [3.6, 1.75, 11.4], look: [-0.6, 0.55, 5.2], fov: 38, roll: 2.0 },
        t
      ),
  },
  {
    id: "S36_slowest_clock_tower",
    a: 2234,
    b: 2340,
    light: "day",
    zone: "stadium",
    cInf: 10,
    focusRange: 4.5,
    cam: (t) =>
      glide(
        { pos: [2.2, 4.2, -18.5], look: [0.0, 9.2, -31.5], fov: 42, roll: -1.5 },
        { pos: [0.8, 9.0, -21.8], look: [0.0, 9.5, -31.5], fov: 32, roll: 2.0 },
        t
      ),
  },

  // =========================================================================
  // BEAT 8: RADIATOR ANALOGY (f2340 - f2618)
  // =========================================================================
  {
    id: "S37_empty_radiator_car",
    a: 2340,
    b: 2477,
    light: "heat",
    zone: "hill",
    cInf: 10,
    focusRange: 4.2,
    cam: (t) => {
      const cz = lerp(12, -4, t);
      return groundCam(1000.0, cz, 6.4, 2.3, -5.8, 1.45, lerp(45, 40, t), -3.0);
    },
  },
  {
    id: "S38_overheats_seizes",
    a: 2477,
    b: 2618,
    light: "heat",
    zone: "hill",
    cInf: 12,
    focusRange: 4.2,
    cam: (t) =>
      glide(
        groundCam(1000.0, -6.2, 6.2, 2.4, -6.0, 1.85, 44, 3.6),
        groundCam(1000.0, -6.2, 5.4, 2.3, -5.2, 2.25, 38, -3.8),
        t
      ),
  },

  // =========================================================================
  // BEAT 9: CONSEQUENCE + CALLBACK TWIST (f2618 - f2970)
  // =========================================================================
  {
    id: "S39_committee_banned_gavel",
    a: 2618,
    b: 2696,
    light: "day",
    zone: "stadium",
    cInf: 13,
    focusRange: 3.5,
    cam: (t) =>
      glide(
        { pos: [34.0, 1.85, 6.8], look: [34.0, 1.35, -0.8], fov: 40, roll: -2.8 },
        { pos: [34.0, 1.8, 5.4], look: [34.0, 1.4, -0.8], fov: 34, roll: 3.2 },
        t
      ),
  },
  {
    id: "S40_modern_water_stations",
    a: 2696,
    b: 2789,
    light: "day",
    zone: "modern",
    cInf: 10,
    focusRange: 4.2,
    cam: (t) => {
      const mz = lerp(8, -6, t);
      return {
        pos: [1203.2, 1.85, mz + 6.8],
        look: [1197.8, 1.3, mz - 1.5],
        fov: lerp(42, 37, t),
        roll: 1.5,
      };
    },
  },
  {
    id: "S41_hicks_gold_medal",
    a: 2789,
    b: 2866,
    light: "golden",
    zone: "stadium",
    cInf: 14,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [1.8, 1.5, 5.2], look: [0.3, 1.35, 0.0], fov: 38, roll: -1.5 },
        { pos: [1.2, 1.5, 4.0], look: [0.3, 1.4, 0.0], fov: 32, roll: 1.5 },
        t
      ),
  },
  {
    id: "S42_collapsed_retired_end",
    a: 2866,
    b: TOTAL_FRAMES,
    light: "golden",
    zone: "stadium",
    cInf: 11,
    focusRange: 3.6,
    cam: (t) =>
      glide(
        { pos: [1.6, 1.25, 4.6], look: [0.4, 0.65, 0.0], fov: 36, roll: 3.2 },
        { pos: [3.6, 2.2, 7.6], look: [0.5, 0.65, 0.0], fov: 42, roll: 0.0 },
        t
      ),
  },
];

export function shotAt(frame: number): ShotDef {
  for (const s of SHOTS) {
    if (frame >= s.a && frame < s.b) return s;
  }
  return SHOTS[SHOTS.length - 1];
}

export function kickOffsetAt(frame: number): { dx: number; dy: number; droll: number } {
  let dx = 0;
  let dy = 0;
  let droll = 0;
  for (const k of KICKS) {
    const dur = k.dur ?? 7;
    if (frame >= k.f && frame < k.f + dur) {
      const age = frame - k.f;
      const decay = Math.pow(1 - age / dur, 1.45);
      const sign = age % 2 === 0 ? 1 : -1;
      dx += sign * k.amp * 0.14 * decay;
      dy += (age % 3 === 0 ? 1 : -1) * k.amp * 0.11 * decay;
      droll += sign * k.amp * 2.8 * decay;
    }
  }
  return { dx, dy, droll };
}

export function flashAt(frame: number): number {
  const dist = Math.abs(frame - FLASH_AT);
  if (dist > 5) return 0;
  return Math.pow(1 - dist / 5, 1.6);
}
