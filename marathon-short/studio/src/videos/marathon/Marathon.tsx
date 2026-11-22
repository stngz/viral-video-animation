import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig, continueRender, delayRender } from "remotion";
import * as THREE from "three";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { createMarathonScene, MarathonSceneController } from "./world";
import { InkEffect } from "./ink";
import { LensBlurEffect } from "./lensblur";
import { GradeEffect } from "./grade";
import { flashAt } from "./story";

interface EngineState {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  ctrl: MarathonSceneController;
  worldNormalRT: THREE.WebGLRenderTarget;
  worldDepthTex: THREE.DepthTexture;
  fullDepthRT: THREE.WebGLRenderTarget;
  sceneDepthTex: THREE.DepthTexture;
  normalMat: THREE.MeshNormalMaterial;
  inkEffect: InkEffect;
  lensPre: LensBlurEffect;
  lensMain: LensBlurEffect;
  grade: GradeEffect;
  width: number;
  height: number;
}

export const MarathonShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineState | null>(null);

  // Initialize Three.js WebGLRenderer + postprocessing pipeline synchronously before frame render
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rw = Math.round(width * dpr);
    const rh = Math.round(height * dpr);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA handled inside EffectComposer (multisampling: 4)
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(rw, rh, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // ToneMappingEffect handles NEUTRAL map

    const ctrl = createMarathonScene();
    ctrl.camera.aspect = width / height;
    ctrl.camera.updateProjectionMatrix();

    // Auxiliary render targets for World-only ink (layer 0) and Full alpha-tested scene depth
    const worldDepthTex = new THREE.DepthTexture(rw, rh);
    worldDepthTex.type = THREE.UnsignedIntType;
    const worldNormalRT = new THREE.WebGLRenderTarget(rw, rh, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      depthTexture: worldDepthTex,
    });

    const sceneDepthTex = new THREE.DepthTexture(rw, rh);
    sceneDepthTex.type = THREE.UnsignedIntType;
    const fullDepthRT = new THREE.WebGLRenderTarget(rw, rh, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      depthTexture: sceneDepthTex,
    });

    const normalMat = new THREE.MeshNormalMaterial();

    // Composer order strictly following SKILL.md:
    // ink -> lens pre -> lens main -> bloom -> NEUTRAL tone map -> grade (MSAA 4)
    const composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 4,
    });
    composer.setSize(rw, rh, false);

    const renderPass = new RenderPass(ctrl.scene, ctrl.camera);
    const inkEffect = new InkEffect();
    const lensPre = new LensBlurEffect("h");
    const lensMain = new LensBlurEffect("v");
    const bloomEffect = new BloomEffect({
      luminanceThreshold: 1.0,
      luminanceSmoothing: 0.15,
      intensity: 0.5,
      mipmapBlur: true,
      levels: 6,
      radius: 0.6,
    });
    const toneMap = new ToneMappingEffect({
      mode: ToneMappingMode.NEUTRAL,
    });
    const grade = new GradeEffect();

    // Ink MUST be its own pass BEFORE blur (SKILL.md gotcha!)
    composer.addPass(renderPass);
    composer.addPass(new EffectPass(ctrl.camera, inkEffect));
    composer.addPass(new EffectPass(ctrl.camera, lensPre));
    composer.addPass(new EffectPass(ctrl.camera, lensMain));
    composer.addPass(new EffectPass(ctrl.camera, bloomEffect, toneMap, grade));

    engineRef.current = {
      renderer,
      composer,
      ctrl,
      worldNormalRT,
      worldDepthTex,
      fullDepthRT,
      sceneDepthTex,
      normalMat,
      inkEffect,
      lensPre,
      lensMain,
      grade,
      width: rw,
      height: rh,
    };

    return () => {
      composer.dispose();
      worldNormalRT.dispose();
      fullDepthRT.dispose();
      normalMat.dispose();
      renderer.dispose();
      engineRef.current = null;
    };
  }, [width, height]);

  // Synchronous deterministic render per Remotion frame!
  useLayoutEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;

    const handle = delayRender(`marathon-frame-${frame}`);
    try {
      const {
        renderer,
        composer,
        ctrl,
        worldNormalRT,
        worldDepthTex,
        fullDepthRT,
        sceneDepthTex,
        normalMat,
        inkEffect,
        lensPre,
        lensMain,
        grade,
      } = eng;

      // Update world, characters, camera, sun & sight-line culling for exact frame
      const state = ctrl.update(frame);

      // Pass A: World-only normals & depth (layer 0 ONLY -> excludes NOINK cards & sky!)
      ctrl.camera.layers.set(0);
      ctrl.scene.overrideMaterial = normalMat;
      renderer.setRenderTarget(worldNormalRT);
      renderer.setClearColor(0x8080ff, 1);
      renderer.clear(true, true, false);
      renderer.render(ctrl.scene, ctrl.camera);
      ctrl.scene.overrideMaterial = null;

      // Pass B: Full scene depth including alpha-tested NOINK character silhouettes (color writes off)
      ctrl.camera.layers.enableAll();
      renderer.setRenderTarget(fullDepthRT);
      const gl = renderer.getContext();
      gl.colorMask(false, false, false, false);
      renderer.clear(false, true, false);
      renderer.render(ctrl.scene, ctrl.camera);
      gl.colorMask(true, true, true, true);
      renderer.setRenderTarget(null);

      // Update post uniforms scaled by current output height / 1920
      const fogCol = ctrl.lightU.uFogColor.value;
      const fogNear = ctrl.lightU.uFogNear.value;
      const fogFar = ctrl.lightU.uFogFar.value;

      inkEffect.setParams({
        worldDepth: worldDepthTex,
        sceneDepth: sceneDepthTex,
        worldNormal: worldNormalRT.texture,
        near: ctrl.camera.near,
        far: ctrl.camera.far,
        resHeight: eng.height,
        fogColor: fogCol,
        fogNear,
        fogFar,
        enabled: true,
      });

      lensPre.setParams({
        sceneDepth: sceneDepthTex,
        near: ctrl.camera.near,
        far: ctrl.camera.far,
        focusDist: state.focusDist,
        focusRange: state.focusRange,
        cInfPx: state.cInf,
        resHeight: eng.height,
      });
      lensMain.setParams({
        sceneDepth: sceneDepthTex,
        near: ctrl.camera.near,
        far: ctrl.camera.far,
        focusDist: state.focusDist,
        focusRange: state.focusRange,
        cInfPx: state.cInf,
        resHeight: eng.height,
      });

      grade.setParams(state.sat, flashAt(frame), state.goldenTint);

      // Pass C: Full HDR composer render
      composer.render();
    } finally {
      continueRender(handle);
    }
  }, [frame, width, height]);

  return (
    <div style={{ width, height, background: "#000", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
};
