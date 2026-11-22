import * as THREE from "three";

export type LightMode = "day" | "heat" | "golden";

export interface LightPreset {
  /** Azimuth in degrees relative to camera forward direction */
  azDeg: number;
  /** Elevation in degrees above horizon */
  elDeg: number;
  /** Lit diffuse multiplier (linear-ish painterly scale) */
  lit: [number, number, number];
  /** Shadow diffuse multiplier (cool tint only in shade) */
  shade: [number, number, number];
  /** Ambient shadow lift so non-ink p5 stays ~0.23 (no crushed blacks) */
  lift: [number, number, number];
  /** Sky zenith color */
  skyTop: string;
  /** Sky horizon color (= fog color) */
  skyHorizon: string;
  /** Cloud tint */
  cloudColor: string;
  /** Fog start distance (m) */
  fogNear: number;
  /** Fog end distance (m) */
  fogFar: number;
  /** Far haze tint strength past 60m */
  hazeStrength: number;
  /** Grade saturation multiplier */
  sat: number;
  /** Whether to draw HDR sun disc in sky */
  showSunDisc: boolean;
  /** Sun disc color (HDR scaled for bloom) */
  sunDiscColor: string;
  /** Sun disc angular radius */
  sunDiscSize: number;
  /** Card golden inner rim strength (0 in day, >0 in golden) */
  cardRim: number;
  /** Card golden rim color */
  cardRimColor: [number, number, number];
}

export const LIGHTS: Record<LightMode, LightPreset> = {
  day: {
    azDeg: 75,
    elDeg: 48,
    lit: [1.58, 1.5, 1.33],
    shade: [0.3, 0.29, 0.36],
    lift: [0.05, 0.06, 0.11],
    skyTop: "#3e7fd2",
    skyHorizon: "#b8d0ec",
    cloudColor: "#f4f7fc",
    fogNear: 25,
    fogFar: 300,
    hazeStrength: 0.15,
    sat: 1.08,
    showSunDisc: false,
    sunDiscColor: "#fff4d6",
    sunDiscSize: 0.045,
    cardRim: 0.0,
    cardRimColor: [1.0, 0.85, 0.6],
  },
  heat: {
    azDeg: 55,
    elDeg: 62,
    lit: [1.66, 1.54, 1.26],
    shade: [0.34, 0.31, 0.37],
    lift: [0.06, 0.06, 0.09],
    skyTop: "#4489db",
    skyHorizon: "#dcd2bc",
    cloudColor: "#fff8eb",
    fogNear: 28,
    fogFar: 310,
    hazeStrength: 0.18,
    sat: 1.1,
    showSunDisc: true,
    sunDiscColor: "#ffe8a3",
    sunDiscSize: 0.068,
    cardRim: 0.12,
    cardRimColor: [1.0, 0.9, 0.65],
  },
  golden: {
    azDeg: 6,
    elDeg: 7,
    lit: [1.72, 1.24, 0.78],
    shade: [0.27, 0.26, 0.5],
    lift: [0.06, 0.05, 0.13],
    skyTop: "#8a6f8a",
    skyHorizon: "#ffc47c",
    cloudColor: "#ffdcb0",
    fogNear: 50,
    fogFar: 340,
    hazeStrength: 0.22,
    sat: 1.12,
    showSunDisc: true,
    sunDiscColor: "#ffcf9e",
    sunDiscSize: 0.095,
    cardRim: 0.65,
    cardRimColor: [1.0, 0.74, 0.44],
  },
};

/**
 * Compute camera-relative sun direction vector, frozen per shot anchor camera.
 * `camForwardXZ` is the normalized horizontal look direction of the shot's anchor camera.
 */
export function computeSunDir(
  mode: LightMode,
  camForwardXZ: THREE.Vector3
): THREE.Vector3 {
  const p = LIGHTS[mode];
  const baseYaw = Math.atan2(camForwardXZ.x, camForwardXZ.z);
  const az = baseYaw + THREE.MathUtils.degToRad(p.azDeg);
  const el = THREE.MathUtils.degToRad(p.elDeg);
  const cosEl = Math.cos(el);
  return new THREE.Vector3(
    Math.sin(az) * cosEl,
    Math.sin(el),
    Math.cos(az) * cosEl
  ).normalize();
}

export interface SharedLightUniforms {
  uSunDir: { value: THREE.Vector3 };
  uLit: { value: THREE.Vector3 };
  uShade: { value: THREE.Vector3 };
  uLift: { value: THREE.Vector3 };
  uFogColor: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
  uHaze: { value: number };
  uCardRim: { value: number };
  uCardRimColor: { value: THREE.Vector3 };
}

export function createLightUniforms(): SharedLightUniforms {
  const p = LIGHTS.day;
  return {
    uSunDir: { value: new THREE.Vector3(0.5, 0.75, 0.4).normalize() },
    uLit: { value: new THREE.Vector3(...p.lit) },
    uShade: { value: new THREE.Vector3(...p.shade) },
    uLift: { value: new THREE.Vector3(...p.lift) },
    uFogColor: { value: new THREE.Color(p.skyHorizon) },
    uFogNear: { value: p.fogNear },
    uFogFar: { value: p.fogFar },
    uHaze: { value: p.hazeStrength },
    uCardRim: { value: p.cardRim },
    uCardRimColor: { value: new THREE.Vector3(...p.cardRimColor) },
  };
}

export function applyLightPreset(
  u: SharedLightUniforms,
  mode: LightMode,
  sunDir: THREE.Vector3
): void {
  const p = LIGHTS[mode];
  u.uSunDir.value.copy(sunDir);
  u.uLit.value.set(...p.lit);
  u.uShade.value.set(...p.shade);
  u.uLift.value.set(...p.lift);
  u.uFogColor.value.set(p.skyHorizon);
  u.uFogNear.value = p.fogNear;
  u.uFogFar.value = p.fogFar;
  u.uHaze.value = p.hazeStrength;
  u.uCardRim.value = p.cardRim;
  u.uCardRimColor.value.set(...p.cardRimColor);
}
