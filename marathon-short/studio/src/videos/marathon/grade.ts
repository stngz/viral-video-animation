import * as THREE from "three";
import { Effect } from "postprocessing";

const GRADE_FRAGMENT = /* glsl */ `
  uniform float uSat;
  uniform float uFlash;
  uniform float uGoldenTint;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 col = inputColor.rgb;

    // Saturation control (day 1.08, heat 1.10, golden 1.12 — no film grain per SKILL.md!)
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSat);

    // Subtle warm golden lift in golden-hour shots without crushing shadows
    if (uGoldenTint > 0.01) {
      col *= mix(vec3(1.0), vec3(1.04, 0.99, 0.94), uGoldenTint);
    }

    // Gentle non-crushing contrast curve keeping median luma ~0.57
    col = clamp(col, 0.0, 1.0);

    // Crisp white flash after the hook (FLASH_AT)
    if (uFlash > 0.001) {
      col = mix(col, vec3(1.0), clamp(uFlash, 0.0, 1.0));
    }

    outputColor = vec4(col, inputColor.a);
  }
`;

export class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", GRADE_FRAGMENT, {
      uniforms: new Map<string, THREE.Uniform<unknown>>([
        ["uSat", new THREE.Uniform(1.08)],
        ["uFlash", new THREE.Uniform(0.0)],
        ["uGoldenTint", new THREE.Uniform(0.0)],
      ]),
    });
  }

  setParams(sat: number, flash: number, goldenTint: number) {
    this.uniforms.get("uSat")!.value = sat;
    this.uniforms.get("uFlash")!.value = flash;
    this.uniforms.get("uGoldenTint")!.value = goldenTint;
  }
}
