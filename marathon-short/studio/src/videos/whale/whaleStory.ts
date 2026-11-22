import { LightMode } from "../marathon/lights";
import { CamPose, KickDef, lerp, smootherstep } from "../marathon/story";

export const WHALE_FPS = 30;
export const WHALE_TOTAL_FRAMES = 2520; // 84.000s (voice is 83.32s)

export interface WhaleShotDef {
  id: string;
  a: number;
  b: number;
  light: LightMode;
  cInf: number;
  focusDist?: number;
  focusRange?: number;
  cam: (t: number, lf: number) => CamPose;
}

export interface BlackoutCard {
  text: string;
  scale: number;
  big?: boolean;
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

/**
 * Two viral TikTok pattern-interrupt blackout cards (viral-story-short skill!):
 * 1) End of hook (f198-f314): "THEIR SOLUTION?" -> "HALF A TON OF DYNAMITE."
 * 2) Mid-story twist (f1412-f1458): "THEN THEY LOOKED UP."
 */
export function blackoutAt(frame: number): BlackoutCard | null {
  if (frame >= 198 && frame < 245) {
    const t = (frame - 198) / 47;
    return { text: "THEIR SOLUTION?", scale: 0.96 + t * 0.09 };
  }
  if (frame >= 245 && frame < 316) {
    const t = (frame - 245) / 71;
    return { text: "HALF A TON\nOF DYNAMITE.", scale: 0.94 + t * 0.12, big: true };
  }
  if (frame >= 1412 && frame < 1458) {
    const t = (frame - 1412) / 46;
    return { text: "THEN THEY\nLOOKED UP.", scale: 0.95 + t * 0.11, big: true };
  }
  return null;
}

/** Explosion white flash right when Thornton slams the plunger & dynamite ignites! */
export function whaleFlashAt(frame: number): number {
  const dist = Math.abs(frame - 1303);
  if (dist > 6) return 0;
  return Math.pow(1 - dist / 6, 1.5);
}

/** 7-frame alternating impact flip-shakes locked 0-3 frames before punch words */
export const WHALE_KICKS: KickDef[] = [
  { f: 118, amp: 0.48, dur: 7 }, // "eight-ton problem" whale reveal
  { f: 316, amp: 0.58, dur: 7 }, // TNT stack reveal after blackout
  { f: 560, amp: 0.45, dur: 7 }, // "whole town was gagging"
  { f: 818, amp: 0.5, dur: 7 }, // "pure delulu confidence"
  { f: 1112, amp: 0.55, dur: 7 }, // "way too much" veteran warning
  { f: 1288, amp: 0.72, dur: 7 }, // "slammed the plunger"
  { f: 1303, amp: 1.05, dur: 11 }, // MASSIVE DYNAMITE EXPLOSION!
  { f: 1460, amp: 0.65, dur: 8 }, // Sky blubber reveal after blackout #2
  { f: 1545, amp: 0.52, dur: 7 }, // Wet blubber splat!
  { f: 1841, amp: 0.98, dur: 10 }, // "pancaked a brand-new car" CAR CRUSH!
  { f: 2124, amp: 0.48, dur: 7 }, // "seagulls rage-quit"
];

export function whaleKickAt(frame: number): { dx: number; dy: number; droll: number } {
  let dx = 0;
  let dy = 0;
  let droll = 0;
  for (const k of WHALE_KICKS) {
    const dur = k.dur ?? 7;
    if (frame >= k.f && frame < k.f + dur) {
      const age = frame - k.f;
      const decay = Math.pow(1 - age / dur, 1.45);
      const sign = age % 2 === 0 ? 1 : -1;
      dx += sign * k.amp * 0.16 * decay;
      dy += (age % 3 === 0 ? 1 : -1) * k.amp * 0.12 * decay;
      droll += sign * k.amp * 3.1 * decay;
    }
  }
  return { dx, dy, droll };
}

export const WHALE_SHOTS: WhaleShotDef[] = [
  // =========================================================================
  // HOOK: 0.0s - 11.5s (f0 - f345)
  // =========================================================================
  {
    id: "W01_quiet_beach_town",
    a: 0,
    b: 115,
    light: "day",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [-4.5, 9.5, 22.0], look: [14.0, 4.5, -16.0], fov: 46, roll: 0 },
        { pos: [6.5, 6.2, 16.0], look: [0.0, 2.2, 0.0], fov: 42, roll: 0 },
        t
      ),
  },
  {
    id: "W02_eight_ton_problem",
    a: 115,
    b: 198,
    light: "day",
    cInf: 9,
    focusRange: 5.5,
    cam: (t) =>
      glide(
        { pos: [14.2, 3.9, 13.0], look: [0.0, 1.5, 0.5], fov: 44, roll: -2.8 },
        { pos: [11.6, 3.1, 9.8], look: [0.0, 1.5, 1.2], fov: 38, roll: -3.5 },
        t
      ),
  },
  // f198-f316 = BLACKOUT #1 ("THEIR SOLUTION?" -> "HALF A TON OF DYNAMITE.")
  {
    id: "W03_tnt_reveal_flash",
    a: 198,
    b: 345,
    light: "heat",
    cInf: 14,
    focusRange: 3.0,
    cam: (t) =>
      glide(
        { pos: [6.4, 1.45, 6.2], look: [2.35, 0.85, 2.6], fov: 38, roll: 4.0 },
        { pos: [5.0, 1.35, 4.9], look: [2.35, 0.9, 2.6], fov: 28, roll: 4.5 },
        t
      ),
  },

  // =========================================================================
  // SETTING & COOKED SMELL: 11.5s - 24.4s (f345 - f728)
  // =========================================================================
  {
    id: "W04_florence_establishing",
    a: 345,
    b: 425,
    light: "day",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [14.0, 6.8, 18.0], look: [-1.0, 1.8, -4.0], fov: 46, roll: 0 },
        { pos: [11.5, 4.2, 13.0], look: [0.0, 1.5, 0.5], fov: 42, roll: 1.5 },
        t
      ),
  },
  {
    id: "W05_45ft_whale_track",
    a: 425,
    b: 504,
    light: "day",
    cInf: 10,
    focusRange: 4.8,
    cam: (t) =>
      glide(
        { pos: [8.5, 1.85, -5.5], look: [0.0, 1.25, -4.5], fov: 40, roll: -2.0 },
        { pos: [8.0, 2.05, 5.8], look: [0.0, 1.55, 3.6], fov: 36, roll: 2.5 },
        t
      ),
  },
  {
    id: "W06_cooked_stink_fumes",
    a: 504,
    b: 560,
    light: "heat",
    cInf: 12,
    focusRange: 4.0,
    cam: (t) =>
      glide(
        { pos: [7.5, 2.2, 7.0], look: [0.0, 2.4, 2.0], fov: 42, roll: 3.5 },
        { pos: [6.2, 2.6, 5.8], look: [0.0, 3.0, 2.0], fov: 35, roll: -3.5 },
        t
      ),
  },
  {
    id: "W07_town_gagging",
    a: 560,
    b: 628,
    light: "heat",
    cInf: 14,
    focusRange: 3.4,
    cam: (t) =>
      glide(
        { pos: [12.5, 1.55, 12.2], look: [12.5, 1.32, 6.2], fov: 40, roll: -3.8 },
        { pos: [12.5, 1.5, 10.6], look: [12.5, 1.38, 6.2], fov: 32, roll: 3.8 },
        t
      ),
  },
  {
    id: "W08_nobody_bury_chop",
    a: 628,
    b: 728,
    light: "day",
    cInf: 11,
    focusRange: 4.0,
    cam: (t) =>
      glide(
        { pos: [9.8, 1.65, 11.2], look: [7.8, 1.3, 5.2], fov: 40, roll: 2.0 },
        { pos: [11.2, 1.8, 12.8], look: [6.8, 1.35, 4.5], fov: 44, roll: -2.0 },
        t
      ),
  },

  // =========================================================================
  // GEORGE THORNTON & 20 CRATES OF DYNAMITE: 24.4s - 34.4s (f728 - f1048)
  // =========================================================================
  {
    id: "W09_thornton_pulls_up",
    a: 728,
    b: 818,
    light: "day",
    cInf: 12,
    focusRange: 3.5,
    cam: (t) =>
      glide(
        { pos: [9.6, 1.45, 10.8], look: [6.6, 1.25, 6.0], fov: 38, roll: -2.0 },
        { pos: [8.4, 1.45, 9.0], look: [6.2, 1.32, 5.8], fov: 32, roll: 2.0 },
        t
      ),
  },
  {
    id: "W10_pure_delulu_shrug",
    a: 818,
    b: 902,
    light: "day",
    cInf: 15,
    focusRange: 2.8,
    cam: (t) =>
      glide(
        { pos: [7.4, 1.52, 9.4], look: [6.0, 1.4, 5.8], fov: 32, roll: 4.2 },
        { pos: [6.8, 1.55, 8.3], look: [6.0, 1.46, 5.8], fov: 25, roll: -4.2 },
        t
      ),
  },
  {
    id: "W11_hauling_20_crates",
    a: 902,
    b: 978,
    light: "day",
    cInf: 10,
    focusRange: 4.5,
    cam: (t) =>
      glide(
        { pos: [9.5, 1.7, 9.2], look: [4.2, 1.15, 4.0], fov: 42, roll: -2.5 },
        { pos: [7.4, 1.5, 7.6], look: [3.2, 1.1, 3.2], fov: 36, roll: 2.5 },
        t
      ),
  },
  {
    id: "W12_stacked_under_whale",
    a: 978,
    b: 1048,
    light: "day",
    cInf: 14,
    focusRange: 3.4,
    cam: (t) =>
      glide(
        { pos: [6.8, 1.35, 6.8], look: [2.3, 0.95, 2.6], fov: 40, roll: 3.5 },
        { pos: [5.4, 1.15, 5.4], look: [2.3, 0.95, 2.6], fov: 31, roll: 4.2 },
        t
      ),
  },

  // =========================================================================
  // VETERAN WARNING & PLUNGER SLAM: 34.4s - 43.4s (f1048 - f1302)
  // =========================================================================
  {
    id: "W13_veteran_warns",
    a: 1048,
    b: 1112,
    light: "day",
    cInf: 12,
    focusRange: 3.4,
    cam: (t) =>
      glide(
        { pos: [8.8, 1.5, 10.6], look: [6.6, 1.3, 5.6], fov: 38, roll: -3.2 },
        { pos: [8.0, 1.48, 9.2], look: [6.6, 1.34, 5.6], fov: 32, roll: -4.0 },
        t
      ),
  },
  {
    id: "W14_way_too_much_cu",
    a: 1112,
    b: 1165,
    light: "day",
    cInf: 15,
    focusRange: 2.8,
    cam: (t) =>
      glide(
        { pos: [7.5, 1.52, 8.8], look: [7.1, 1.42, 5.6], fov: 30, roll: 4.4 },
        { pos: [7.3, 1.52, 8.1], look: [7.1, 1.46, 5.6], fov: 25, roll: 4.6 },
        t
      ),
  },
  {
    id: "W15_thornton_brushes_off",
    a: 1165,
    b: 1220,
    light: "day",
    cInf: 14,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [5.5, 1.5, 9.6], look: [6.3, 1.35, 5.6], fov: 36, roll: -2.2 },
        { pos: [5.8, 1.52, 8.4], look: [6.1, 1.4, 5.6], fov: 30, roll: -3.0 },
        t
      ),
  },
  {
    id: "W16_backed_crowd_up",
    a: 1220,
    b: 1268,
    light: "day",
    cInf: 8,
    cam: (t) =>
      glide(
        { pos: [16.8, 2.4, 21.5], look: [12.0, 1.35, 13.5], fov: 44, roll: 0 },
        { pos: [15.5, 2.0, 19.2], look: [12.0, 1.35, 14.0], fov: 39, roll: 2.0 },
        t
      ),
  },
  {
    id: "W17_slammed_plunger",
    a: 1268,
    b: 1302,
    light: "heat",
    cInf: 13,
    focusRange: 3.4,
    cam: (t) =>
      glide(
        { pos: [14.0, 1.55, 19.6], look: [11.7, 1.1, 14.0], fov: 38, roll: -3.6 },
        { pos: [13.4, 1.38, 18.2], look: [11.7, 1.0, 14.0], fov: 31, roll: 4.0 },
        t
      ),
  },

  // =========================================================================
  // KABOOM! -> CHEER -> BLACKOUT #2 -> RAINING BLUBBER: 43.4s - 57.5s (f1302 - f1722)
  // =========================================================================
  {
    id: "W18_massive_explosion",
    a: 1302,
    b: 1358,
    light: "heat",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [11.5, 2.4, 15.5], look: [0.0, 3.2, 2.0], fov: 46, roll: 4.5 },
        { pos: [14.5, 4.0, 19.5], look: [0.0, 6.2, 2.0], fov: 50, roll: -3.5 },
        t
      ),
  },
  {
    id: "W19_everyone_cheered",
    a: 1358,
    b: 1412,
    light: "day",
    cInf: 11,
    focusRange: 3.6,
    cam: (t) =>
      glide(
        { pos: [12.5, 1.6, 20.8], look: [12.2, 1.35, 14.2], fov: 40, roll: -2.0 },
        { pos: [12.5, 1.55, 18.8], look: [12.2, 1.4, 14.2], fov: 34, roll: 2.0 },
        t
      ),
  },
  // f1412-f1458 = BLACKOUT #2 ("THEN THEY LOOKED UP.")
  {
    id: "W20_looked_up_sky_rain",
    a: 1412,
    b: 1518,
    light: "heat",
    cInf: 12,
    focusRange: 3.8,
    cam: (t) =>
      glide(
        { pos: [12.2, 1.35, 18.6], look: [12.2, 2.8, 13.8], fov: 42, roll: 3.8 },
        { pos: [12.2, 1.25, 17.4], look: [12.2, 4.4, 13.8], fov: 46, roll: -4.0 },
        t
      ),
  },
  {
    id: "W21_blubber_raining_wide",
    a: 1518,
    b: 1592,
    light: "heat",
    cInf: 6,
    cam: (t) =>
      glide(
        { pos: [16.5, 3.2, 22.0], look: [10.0, 1.8, 12.5], fov: 46, roll: -4.2 },
        { pos: [14.5, 2.4, 19.0], look: [11.0, 1.5, 13.0], fov: 42, roll: 4.2 },
        t
      ),
  },
  {
    id: "W22_people_sprinting_cover",
    a: 1592,
    b: 1662,
    light: "heat",
    cInf: 11,
    focusRange: 4.0,
    cam: (t) => {
      const px = lerp(11.0, 16.5, t);
      return {
        pos: [px + 3.8, 1.55, 19.6],
        look: [px, 1.25, 14.2],
        fov: lerp(40, 34, t),
        roll: 4.4,
      };
    },
  },
  {
    id: "W23_nobody_got_hit",
    a: 1662,
    b: 1722,
    light: "day",
    cInf: 14,
    focusRange: 3.2,
    cam: (t) =>
      glide(
        { pos: [14.6, 1.48, 18.5], look: [14.0, 1.3, 14.0], fov: 36, roll: -1.5 },
        { pos: [14.3, 1.48, 17.2], look: [14.0, 1.35, 14.0], fov: 30, roll: 1.5 },
        t
      ),
  },

  // =========================================================================
  // THE OLDSMOBILE PANCAKE & VETERAN DEADPAN: 57.5s - 70.6s (f1722 - f2120)
  // =========================================================================
  {
    id: "W24_shiny_brand_new_car",
    a: 1722,
    b: 1795,
    light: "day",
    cInf: 10,
    focusRange: 4.5,
    cam: (t) =>
      glide(
        { pos: [205.8, 2.0, 6.2], look: [200.0, 1.15, 0.0], fov: 42, roll: -1.5 },
        { pos: [204.6, 1.85, 5.0], look: [200.0, 1.2, 0.0], fov: 36, roll: 1.5 },
        t
      ),
  },
  {
    id: "W25_chunk_from_orbit",
    a: 1795,
    b: 1842,
    light: "heat",
    cInf: 8,
    cam: (t) =>
      glide(
        { pos: [204.8, 1.5, 5.2], look: [200.0, 7.2, 0.0], fov: 44, roll: 4.0 },
        { pos: [204.6, 1.8, 5.2], look: [200.0, 2.2, 0.0], fov: 40, roll: -3.5 },
        t
      ),
  },
  {
    id: "W26_pancaked_oldsmobile",
    a: 1842,
    b: 1915,
    light: "heat",
    cInf: 11,
    focusRange: 5.0,
    cam: (t) =>
      glide(
        { pos: [206.9, 2.35, 7.4], look: [200.0, 1.15, 0.0], fov: 44, roll: -4.0 },
        { pos: [205.8, 2.05, 6.2], look: [200.0, 1.05, 0.0], fov: 38, roll: 3.2 },
        t
      ),
  },
  {
    id: "W27_veteran_car_keys",
    a: 1915,
    b: 2015,
    light: "day",
    cInf: 13,
    focusRange: 3.4,
    cam: (t) =>
      glide(
        { pos: [203.2, 1.5, 7.6], look: [201.4, 1.28, 2.2], fov: 38, roll: -1.5 },
        { pos: [202.4, 1.48, 6.2], look: [201.5, 1.32, 2.4], fov: 32, roll: 0 },
        t
      ),
  },
  {
    id: "W28_whale_of_a_deal_cu",
    a: 2015,
    b: 2120,
    light: "day",
    cInf: 15,
    focusRange: 2.6,
    cam: (t) =>
      glide(
        { pos: [202.2, 1.48, 5.8], look: [201.6, 1.38, 2.4], fov: 30, roll: 0 },
        { pos: [201.9, 1.52, 4.7], look: [201.6, 1.46, 2.4], fov: 23, roll: 2.0 },
        t
      ),
  },

  // =========================================================================
  // SEAGULLS RAGE-QUIT + HALF WHALE + SHOVELS + GOLDEN PARK: 70.6s - 84.0s (f2120 - f2520)
  // =========================================================================
  {
    id: "W29_seagulls_rage_quit",
    a: 2120,
    b: 2196,
    light: "day",
    cInf: 11,
    focusRange: 4.0,
    cam: (t) =>
      glide(
        { pos: [6.5, 3.6, 6.2], look: [0.5, 3.2, 0.5], fov: 42, roll: -3.2 },
        { pos: [8.0, 4.4, 4.5], look: [3.2, 4.6, -2.0], fov: 38, roll: 3.5 },
        t
      ),
  },
  {
    id: "W30_half_whale_unmoved",
    a: 2196,
    b: 2268,
    light: "day",
    cInf: 8,
    cam: (t) =>
      glide(
        { pos: [9.8, 3.2, 6.2], look: [0.0, 1.0, -1.8], fov: 44, roll: 1.5 },
        { pos: [8.4, 2.5, 3.8], look: [0.0, 1.0, -2.5], fov: 39, roll: -1.5 },
        t
      ),
  },
  {
    id: "W31_bury_with_shovels",
    a: 2268,
    b: 2342,
    light: "golden",
    cInf: 12,
    focusRange: 3.8,
    cam: (t) =>
      glide(
        { pos: [7.8, 1.65, 6.4], look: [2.8, 1.15, 1.4], fov: 40, roll: -2.0 },
        { pos: [6.6, 1.55, 5.2], look: [2.8, 1.2, 1.4], fov: 34, roll: 2.0 },
        t
      ),
  },
  {
    id: "W32_memorial_park_sunset",
    a: 2342,
    b: 2425,
    light: "golden",
    cInf: 0,
    cam: (t) =>
      glide(
        { pos: [405.5, 4.8, 10.5], look: [400.0, 2.8, -2.5], fov: 44, roll: 0 },
        { pos: [401.2, 3.2, 7.2], look: [400.0, 3.2, -2.5], fov: 40, roll: 0 },
        t
      ),
  },
  {
    id: "W33_park_sign_finale",
    a: 2425,
    b: WHALE_TOTAL_FRAMES,
    light: "golden",
    cInf: 9,
    focusRange: 5.2,
    cam: (t) =>
      glide(
        { pos: [401.2, 2.9, 9.2], look: [400.0, 3.2, -2.3], fov: 42, roll: -1.0 },
        { pos: [400.0, 3.1, 6.8], look: [400.0, 3.5, -2.3], fov: 36, roll: 0 },
        t
      ),
  },
];

export function whaleShotAt(frame: number): WhaleShotDef {
  for (const s of WHALE_SHOTS) {
    if (frame >= s.a && frame < s.b) return s;
  }
  return WHALE_SHOTS[WHALE_SHOTS.length - 1];
}
