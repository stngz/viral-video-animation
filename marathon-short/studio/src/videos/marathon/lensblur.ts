import * as THREE from "three";
import { Effect } from "postprocessing";

/**
 * Two-pass depth-of-field lens blur matching SKILL.md:
 * - lens pre (horizontal gather) -> lens main (vertical + disc bokeh gather)
 * - cInf in pixels at 1080x1920, scaled by output height / 1920
 * - Focus squarely on hero eyes; establishing & wide shots stay sharp (cInf = 0)
 */
function makeLensFragment(axis: "h" | "v"): string {
  const dirVec = axis === "h" ? "vec2(1.0, 0.0)" : "vec2(0.0, 1.0)";
  return /* glsl */ `
    uniform sampler2D uSceneDepth;
    uniform float uNear;
    uniform float uFar;
    uniform float uFocusDist;
    uniform float uFocusRange;
    uniform float uCInfPx;
    uniform float uResScale;

    float linDepth(float d) {
      float z = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }

    float cocAt(vec2 uv) {
      float rawD = texture2D(uSceneDepth, uv).r;
      float d = rawD >= 0.9999 ? uFar : linDepth(rawD);
      float diff = abs(d - uFocusDist);
      float normalized = clamp((diff - uFocusRange) / max(uFocusDist * 0.9, 4.0), 0.0, 1.0);
      return normalized * uCInfPx * uResScale;
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      if (uCInfPx < 0.25) {
        outputColor = inputColor;
        return;
      }

      float centerCoc = cocAt(uv);
      if (centerCoc < 0.35) {
        outputColor = inputColor;
        return;
      }

      vec2 texel = (1.0 / resolution) * ${dirVec};
      float radius = min(centerCoc, 22.0 * uResScale);
      vec3 acc = inputColor.rgb;
      float wSum = 1.0;

      // 8 symmetric taps along axis weighted to prevent sharp foreground bleeding into background
      for (int i = 1; i <= 5; i++) {
        float fi = float(i) / 5.0;
        vec2 off = texel * (fi * radius);

        vec2 uv1 = clamp(uv + off, vec2(0.001), vec2(0.999));
        float c1 = cocAt(uv1);
        float w1 = (1.0 - fi * 0.45) * smoothstep(0.0, 1.5, c1 + 0.35);
        acc += texture2D(inputBuffer, uv1).rgb * w1;
        wSum += w1;

        vec2 uv2 = clamp(uv - off, vec2(0.001), vec2(0.999));
        float c2 = cocAt(uv2);
        float w2 = (1.0 - fi * 0.45) * smoothstep(0.0, 1.5, c2 + 0.35);
        acc += texture2D(inputBuffer, uv2).rgb * w2;
        wSum += w2;
      }

      outputColor = vec4(acc / max(wSum, 0.001), inputColor.a);
    }
  `;
}

export class LensBlurEffect extends Effect {
  constructor(axis: "h" | "v") {
    super(axis === "h" ? "LensPreEffect" : "LensMainEffect", makeLensFragment(axis), {
      uniforms: new Map<string, THREE.Uniform<unknown>>([
        ["uSceneDepth", new THREE.Uniform(null)],
        ["uNear", new THREE.Uniform(0.3)],
        ["uFar", new THREE.Uniform(450.0)],
        ["uFocusDist", new THREE.Uniform(12.0)],
        ["uFocusRange", new THREE.Uniform(2.5)],
        ["uCInfPx", new THREE.Uniform(0.0)],
        ["uResScale", new THREE.Uniform(1.0)],
      ]),
    });
  }

  setParams(params: {
    sceneDepth: THREE.DepthTexture;
    near: number;
    far: number;
    focusDist: number;
    focusRange?: number;
    cInfPx: number;
    resHeight: number;
  }) {
    this.uniforms.get("uSceneDepth")!.value = params.sceneDepth;
    this.uniforms.get("uNear")!.value = params.near;
    this.uniforms.get("uFar")!.value = params.far;
    this.uniforms.get("uFocusDist")!.value = params.focusDist;
    this.uniforms.get("uFocusRange")!.value = params.focusRange ?? 2.2;
    this.uniforms.get("uCInfPx")!.value = params.cInfPx;
    this.uniforms.get("uResScale")!.value = params.resHeight / 1920.0;
  }
}
