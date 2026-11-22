import * as THREE from "three";
import { Effect } from "postprocessing";

/**
 * Layer index for 2D cutout character billboards and effect cards.
 * World ink pass renders ONLY layer 0, so characters NEVER receive world ink
 * outlines — they draw their own plum variable-width Canvas2D ink (SKILL.md).
 */
export const NOINK = 1;

const INK_FRAGMENT = /* glsl */ `
  uniform sampler2D uWorldDepth;
  uniform sampler2D uSceneDepth;
  uniform sampler2D uWorldNormal;
  uniform float uNear;
  uniform float uFar;
  uniform float uResScale;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uEnabled;

  float linearizeDepth(float d) {
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  vec3 unpackNormal(vec2 uv) {
    return normalize(texture2D(uWorldNormal, uv).xyz * 2.0 - 1.0);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uEnabled < 0.5) {
      outputColor = inputColor;
      return;
    }

    float rawW = texture2D(uWorldDepth, uv).r;
    float rawS = texture2D(uSceneDepth, uv).r;
    if (rawW >= 0.9999) {
      // Sky background — never draw horizon lines (SKILL.md)
      outputColor = inputColor;
      return;
    }

    // If a NOINK character card or FX card sits in front of the world pixel, never ink over it!
    if (rawS + 0.00015 < rawW) {
      outputColor = inputColor;
      return;
    }

    float d0 = linearizeDepth(rawW);
    // 5.1 px near (6 m) -> 3.3 px far (90 m) at 1080x1920, scaled by output height / 1920
    float distT = clamp((d0 - 6.0) / (90.0 - 6.0), 0.0, 1.0);
    float px = mix(5.1, 3.3, distT) * uResScale * 0.5;
    vec2 stepUv = (1.0 / resolution) * max(1.0, px);

    vec3 n0 = unpackNormal(uv);

    // 4-tap Roberts / cross sample for crisp silhouettes, depth jumps & normal creases
    vec2 offs[4];
    offs[0] = vec2(stepUv.x, 0.0);
    offs[1] = vec2(-stepUv.x, 0.0);
    offs[2] = vec2(0.0, stepUv.y);
    offs[3] = vec2(0.0, -stepUv.y);

    float maxDepthRel = 0.0;
    float maxNormalEdge = 0.0;

    for (int i = 0; i < 4; i++) {
      vec2 suv = clamp(uv + offs[i], vec2(0.001), vec2(0.999));
      float rds = texture2D(uWorldDepth, suv).r;
      if (rds >= 0.9999) {
        // Object-against-sky silhouette edge
        maxDepthRel = max(maxDepthRel, 1.0);
      } else {
        float ds = linearizeDepth(rds);
        // Only draw line on the nearer side (prevents double-thick halos)
        float rel = (ds - d0) / max(d0, 1.0);
        maxDepthRel = max(maxDepthRel, rel);

        // Normal crease from 35 deg (cos 35 = 0.819)
        vec3 ns = unpackNormal(suv);
        float nd = dot(n0, ns);
        // Suppress flat wall/floor joins slightly when depth difference is negligible and upward normal meets vertical gently
        float crease = smoothstep(0.82, 0.58, nd) * 0.8;
        maxNormalEdge = max(maxNormalEdge, crease);
      }
    }

    // Depth jumps from 1% (SKILL.md)
    float depthEdge = smoothstep(0.012, 0.045, maxDepthRel);
    float edge = clamp(max(depthEdge, maxNormalEdge), 0.0, 1.0);

    // Ink color #030303 with subtle 0.3 fog tint only far away
    float fogT = clamp((d0 - uFogNear) / max(1.0, (uFogFar - uFogNear)), 0.0, 1.0);
    vec3 inkCol = mix(vec3(0.012, 0.012, 0.012), uFogColor * 0.45, fogT * 0.3);

    vec3 outCol = mix(inputColor.rgb, inkCol, edge * 0.92);
    outputColor = vec4(outCol, inputColor.a);
  }
`;

export class InkEffect extends Effect {
  constructor() {
    super("InkEffect", INK_FRAGMENT, {
      uniforms: new Map<string, THREE.Uniform<unknown>>([
        ["uWorldDepth", new THREE.Uniform(null)],
        ["uSceneDepth", new THREE.Uniform(null)],
        ["uWorldNormal", new THREE.Uniform(null)],
        ["uNear", new THREE.Uniform(0.3)],
        ["uFar", new THREE.Uniform(450.0)],
        ["uResScale", new THREE.Uniform(1.0)],
        ["uFogColor", new THREE.Uniform(new THREE.Color("#b8d0ec"))],
        ["uFogNear", new THREE.Uniform(25.0)],
        ["uFogFar", new THREE.Uniform(300.0)],
        ["uEnabled", new THREE.Uniform(1.0)],
      ]),
    });
  }

  setParams(params: {
    worldDepth: THREE.DepthTexture;
    sceneDepth: THREE.DepthTexture;
    worldNormal: THREE.Texture;
    near: number;
    far: number;
    resHeight: number;
    fogColor: THREE.Color;
    fogNear: number;
    fogFar: number;
    enabled?: boolean;
  }) {
    this.uniforms.get("uWorldDepth")!.value = params.worldDepth;
    this.uniforms.get("uSceneDepth")!.value = params.sceneDepth;
    this.uniforms.get("uWorldNormal")!.value = params.worldNormal;
    this.uniforms.get("uNear")!.value = params.near;
    this.uniforms.get("uFar")!.value = params.far;
    this.uniforms.get("uResScale")!.value = params.resHeight / 1920.0;
    (this.uniforms.get("uFogColor")!.value as THREE.Color).copy(params.fogColor);
    this.uniforms.get("uFogNear")!.value = params.fogNear;
    this.uniforms.get("uFogFar")!.value = params.fogFar;
    this.uniforms.get("uEnabled")!.value = params.enabled === false ? 0.0 : 1.0;
  }
}
