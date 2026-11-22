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
import { createWhaleScene, WhaleSceneController } from "./whaleWorld";
import { InkEffect } from "../marathon/ink";
import { LensBlurEffect } from "../marathon/lensblur";
import { GradeEffect } from "../marathon/grade";
import { blackoutAt, whaleFlashAt } from "./whaleStory";

interface EngineState {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  ctrl: WhaleSceneController;
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

export const WhaleShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineState | null>(null);

  const blackout = blackoutAt(frame);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rw = Math.round(width * dpr);
    const rh = Math.round(height * dpr);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(rw, rh, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const ctrl = createWhaleScene();
    ctrl.camera.aspect = width / height;
    ctrl.camera.updateProjectionMatrix();

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
      intensity: 0.52,
      mipmapBlur: true,
      levels: 6,
      radius: 0.62,
    });
    const toneMap = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    const grade = new GradeEffect();

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

  useLayoutEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;

    // Skip expensive 3D WebGL passes on intentional pitch-black pattern-interrupt cards!
    if (blackout) return;

    const handle = delayRender(`whale-frame-${frame}`);
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

      const state = ctrl.update(frame);

      ctrl.camera.layers.set(0);
      ctrl.scene.overrideMaterial = normalMat;
      renderer.setRenderTarget(worldNormalRT);
      renderer.setClearColor(0x8080ff, 1);
      renderer.clear(true, true, false);
      renderer.render(ctrl.scene, ctrl.camera);
      ctrl.scene.overrideMaterial = null;

      ctrl.camera.layers.enableAll();
      renderer.setRenderTarget(fullDepthRT);
      const gl = renderer.getContext();
      gl.colorMask(false, false, false, false);
      renderer.clear(false, true, false);
      renderer.render(ctrl.scene, ctrl.camera);
      gl.colorMask(true, true, true, true);
      renderer.setRenderTarget(null);

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

      grade.setParams(state.sat, whaleFlashAt(frame), state.goldenTint);
      composer.render();
    } finally {
      continueRender(handle);
    }
  }, [frame, width, height, blackout]);

  return (
    <div style={{ width, height, background: "#000", overflow: "hidden", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          opacity: blackout ? 0 : 1,
        }}
      />
      {blackout && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#050507",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 72px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: blackout.big ? 114 : 96,
              fontWeight: 900,
              letterSpacing: 3,
              lineHeight: 1.06,
              textTransform: "uppercase",
              transform: `scale(${blackout.scale.toFixed(4)})`,
              textShadow: "0 8px 34px rgba(255, 165, 65, 0.25)",
            }}
          >
            {blackout.text}
          </div>
        </div>
      )}
    </div>
  );
};
