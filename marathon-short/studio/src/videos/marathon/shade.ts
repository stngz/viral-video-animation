import * as THREE from "three";
import { SharedLightUniforms } from "./lights";

export interface TwoToneOpts {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  side?: THREE.Side;
  /** 0 = crisp toon split, higher = slightly softer painterly transition */
  softness?: number;
  /** Ambient brightness bias for ground/roofs */
  ambientBoost?: number;
  /** Extra emissive tint (e.g., glowing brass or sunlit windows) */
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  alphaTest?: number;
  vertexColors?: boolean;
}

/**
 * Painted 2-tone cel shader matching the cartoon-3d-short look:
 * - Lit side multiplies albedo by uLit
 * - Shadow side multiplies albedo by cool/violet uShade + uLift
 * - Smooth fog into horizon color + subtle distance haze past 60m
 */
export function makeTwoToneMaterial(
  lightU: SharedLightUniforms,
  opts: TwoToneOpts = {}
): THREE.ShaderMaterial {
  const col = new THREE.Color(opts.color ?? "#ffffff");
  const em = new THREE.Color(opts.emissive ?? "#000000");
  const hasMap = Boolean(opts.map);

  const mat = new THREE.ShaderMaterial({
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    uniforms: {
      uColor: { value: col },
      uMap: { value: opts.map ?? null },
      uHasMap: { value: hasMap ? 1.0 : 0.0 },
      uSoftness: { value: opts.softness ?? 0.16 },
      uAmbientBoost: { value: opts.ambientBoost ?? 0.0 },
      uEmissive: { value: em },
      uEmissiveIntensity: { value: opts.emissiveIntensity ?? 0.0 },
      uAlphaTest: { value: opts.alphaTest ?? 0.0 },
      uSunDir: lightU.uSunDir,
      uLit: lightU.uLit,
      uShade: lightU.uShade,
      uLift: lightU.uLift,
      uFogColor: lightU.uFogColor,
      uFogNear: lightU.uFogNear,
      uFogFar: lightU.uFogFar,
      uHaze: lightU.uHaze,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying float vViewDist;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPos = viewMatrix * worldPos;
        vViewDist = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform float uSoftness;
      uniform float uAmbientBoost;
      uniform vec3 uEmissive;
      uniform float uEmissiveIntensity;
      uniform float uAlphaTest;

      uniform vec3 uSunDir;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uLift;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uHaze;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying float vViewDist;

      void main() {
        vec4 texel = vec4(1.0);
        if (uHasMap > 0.5) {
          texel = texture2D(uMap, vUv);
          if (uAlphaTest > 0.0 && texel.a < uAlphaTest) discard;
        }
        vec3 albedo = uColor * texel.rgb;

        vec3 N = normalize(vWorldNormal);
        float ndotl = dot(N, normalize(uSunDir));
        float band = smoothstep(-uSoftness, uSoftness, ndotl - 0.06);

        // Subtle sky bounce on upward-facing shadowed surfaces
        float skyUp = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 shadeCol = albedo * (uShade + vec3(uAmbientBoost)) + uLift * (0.65 + 0.35 * skyUp);
        vec3 litCol = albedo * uLit * (0.94 + 0.08 * clamp(ndotl, 0.0, 1.0));

        vec3 col = mix(shadeCol, litCol, band);
        col += uEmissive * uEmissiveIntensity;

        // Atmospheric distance fog = horizon color + subtle blue/peach haze past 60m
        float fogT = clamp((vViewDist - uFogNear) / max(1.0, (uFogFar - uFogNear)), 0.0, 1.0);
        fogT = fogT * fogT * (3.0 - 2.0 * fogT);
        float farHaze = smoothstep(55.0, 140.0, vViewDist) * uHaze;
        col = mix(col, uFogColor, clamp(fogT + farHaze, 0.0, 0.92));

        gl_FragColor = vec4(col, texel.a);
      }
    `,
  });

  return mat;
}

/**
 * Unlit material for painted signs, banners, flags, and finish ribbons so they
 * never go grey-blue and unreadable when backlit by a side/low sun (SKILL.md rule).
 */
export function untone(
  lightU: SharedLightUniforms,
  opts: {
    color?: THREE.ColorRepresentation;
    map?: THREE.Texture | null;
    side?: THREE.Side;
    transparent?: boolean;
    alphaTest?: number;
    brightness?: number;
  } = {}
): THREE.ShaderMaterial {
  const col = new THREE.Color(opts.color ?? "#ffffff");
  return new THREE.ShaderMaterial({
    side: opts.side ?? THREE.DoubleSide,
    transparent: opts.transparent ?? false,
    uniforms: {
      uColor: { value: col },
      uMap: { value: opts.map ?? null },
      uHasMap: { value: opts.map ? 1.0 : 0.0 },
      uBrightness: { value: opts.brightness ?? 1.02 },
      uAlphaTest: { value: opts.alphaTest ?? 0.0 },
      uFogColor: lightU.uFogColor,
      uFogNear: lightU.uFogNear,
      uFogFar: lightU.uFogFar,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vViewDist;
      void main() {
        vUv = uv;
        vec4 mvPos = viewMatrix * modelMatrix * vec4(position, 1.0);
        vViewDist = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform float uBrightness;
      uniform float uAlphaTest;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying float vViewDist;
      void main() {
        vec4 texel = vec4(1.0);
        if (uHasMap > 0.5) {
          texel = texture2D(uMap, vUv);
          if (uAlphaTest > 0.0 && texel.a < uAlphaTest) discard;
        }
        vec3 col = uColor * texel.rgb * uBrightness;
        float fogT = clamp((vViewDist - uFogNear) / max(1.0, (uFogFar - uFogNear)), 0.0, 1.0);
        col = mix(col, uFogColor, fogT * 0.65);
        gl_FragColor = vec4(col, texel.a);
      }
    `,
  });
}
