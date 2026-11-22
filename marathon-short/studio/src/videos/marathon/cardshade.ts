import * as THREE from "three";
import { SharedLightUniforms } from "./lights";

/**
 * Lit material for 2D cutout cartoon character billboards on layer NOINK:
 * - Lit cleanly by the scene's sun preset (no emissive washout!)
 * - Preserves crisp plum #241726 ink lines
 * - Inner-only golden rim highlight in golden-hour shots (never an offset outer copy — SKILL.md)
 * - Smooth atmospheric fog matching the 3D world
 */
export function makeCardMaterial(
  texture: THREE.Texture,
  lightU: SharedLightUniforms,
  opts: { isFx?: boolean; opacity?: number } = {}
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: !opts.isFx,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: opts.opacity ?? 1.0 },
      uIsFx: { value: opts.isFx ? 1.0 : 0.0 },
      uSunDir: lightU.uSunDir,
      uLit: lightU.uLit,
      uShade: lightU.uShade,
      uLift: lightU.uLift,
      uFogColor: lightU.uFogColor,
      uFogNear: lightU.uFogNear,
      uFogFar: lightU.uFogFar,
      uCardRim: lightU.uCardRim,
      uCardRimColor: lightU.uCardRimColor,
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
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform float uIsFx;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uLift;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uCardRim;
      uniform vec3 uCardRimColor;

      varying vec2 vUv;
      varying float vViewDist;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float a = tex.a * uOpacity;
        if (a < 0.08) discard;

        vec3 base = tex.rgb;
        vec3 col;

        if (uIsFx > 0.5) {
          // Effect cards (dust, steam, sparkles) pick up gentle sky/sun warmth
          col = base * mix(vec3(0.95), uLit * 0.72, 0.35);
        } else {
          // Keep faces bright (~0.93) and colours crisp while integrating into day/golden light
          vec3 sceneKey = mix(vec3(1.0), clamp(uLit * 0.68, vec3(0.72), vec3(1.12)), 0.55);
          // Slight subtle vertical grounding gradient (slightly cooler near shoes)
          float groundGrad = smoothstep(0.0, 0.25, vUv.y);
          vec3 tint = mix(sceneKey * 0.91 + uLift * 0.35, sceneKey, groundGrad);
          col = base * tint;

          // Inner-only golden rim on head/torso silhouette (samples alpha inward, NEVER draws outside!)
          if (uCardRim > 0.05 && vUv.y > 0.28) {
            vec2 px = vec2(1.0 / 480.0, 1.0 / 800.0) * 5.0;
            float aL = texture2D(uMap, clamp(vUv + vec2(-px.x, 0.0), 0.0, 1.0)).a;
            float aR = texture2D(uMap, clamp(vUv + vec2(px.x, 0.0), 0.0, 1.0)).a;
            float aU = texture2D(uMap, clamp(vUv + vec2(0.0, px.y), 0.0, 1.0)).a;
            float innerEdge = 1.0 - min(aL, min(aR, aU));
            // Do not wash out dark plum ink lines
            float notInk = smoothstep(0.18, 0.38, dot(base, vec3(0.333)));
            col += uCardRimColor * innerEdge * uCardRim * 0.52 * notInk;
          }
        }

        // Fog blending matching world
        float fogT = clamp((vViewDist - uFogNear) / max(1.0, (uFogFar - uFogNear)), 0.0, 1.0);
        fogT = fogT * fogT * (3.0 - 2.0 * fogT);
        col = mix(col, uFogColor, fogT * 0.75);

        gl_FragColor = vec4(col, a);
      }
    `,
  });
}
