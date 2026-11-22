import * as THREE from "three";
import {
  LIGHTS,
  SharedLightUniforms,
  applyLightPreset,
  computeSunDir,
  createLightUniforms,
} from "./lights";
import { buildMarathonWorld, WorldRefs, TouringCarRig, computeGroundY } from "./build";
import {
  CAST_DESIGNS,
  CharActor,
  CarriedHicksActor,
  DogActor,
  FxActor,
  makeExtraRunnerDesign,
  makeSpectatorDesign,
} from "./cast";
import { NOINK } from "./ink";
import { SHOTS, ShotDef, shotAt, kickOffsetAt, lerp } from "./story";

export interface MarathonSceneController {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lightU: SharedLightUniforms;
  update: (frame: number) => {
    shot: ShotDef;
    focusDist: number;
    focusRange: number;
    cInf: number;
    sat: number;
    goldenTint: number;
  };
}

/** Custom painted sky dome shader (saturated top->horizon + cartoon clouds + HDR sun disc) */
function createSkyDome() {
  const uniforms = {
    uTopColor: { value: new THREE.Color("#3e7fd2") },
    uHorizonColor: { value: new THREE.Color("#b8d0ec") },
    uCloudColor: { value: new THREE.Color("#f4f7fc") },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
    uSunColor: { value: new THREE.Color("#ffcf9e") },
    uShowSun: { value: 0.0 },
    uSunSize: { value: 0.08 },
    uTime: { value: 0.0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uCloudColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uShowSun;
      uniform float uSunSize;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.52 * noise(p);
        v += 0.28 * noise(p * 2.1 + 3.7);
        v += 0.14 * noise(p * 4.3 + 9.1);
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        // Bright saturated cartoon sky gradient (horizon ~1.28x brighter than top)
        float grad = pow(h, 0.58);
        vec3 col = mix(uHorizonColor, uTopColor, grad);

        // Soft painterly cartoon cumulus cloud puffs in upper sky
        if (d.y > 0.04) {
          vec2 cuv = d.xz / (d.y + 0.34) * 1.45 + vec2(uTime * 0.015, 0.0);
          float cl = fbm(cuv);
          float cloudMask = smoothstep(0.56, 0.67, cl) * smoothstep(0.04, 0.22, d.y) * (1.0 - smoothstep(0.68, 0.95, d.y));
          col = mix(col, uCloudColor, cloudMask * 0.72);
        }

        // HDR glowing sun disc (triggers bloom cleanly > 1.0 in golden & scorching heat!)
        if (uShowSun > 0.5) {
          float sunDot = dot(d, normalize(uSunDir));
          float halo = pow(max(sunDot, 0.0), 18.0) * 0.42;
          float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.65), sunDot);
          col += uSunColor * halo;
          col = mix(col, uSunColor * 1.85, disc);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(280, 24, 16), mat);
  mesh.layers.set(NOINK);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

function animateCar(
  rig: TouringCarRig,
  x: number,
  z: number,
  yaw: number,
  wheelSpin: number,
  bouncePhase: number,
  bounceAmp: number,
  hoodRattle = 0,
  capLift = 0
) {
  const gy = computeGroundY(x, z);
  const gyAhead = computeGroundY(x, z - 1.5);
  const pitch = Math.atan2(gyAhead - gy, 1.5);

  rig.group.visible = true;
  rig.group.position.set(x, gy, z);
  rig.group.rotation.set(pitch, yaw, 0);

  // Chassis bounce over bumpy dirt tracks!
  rig.body.position.y = Math.abs(Math.sin(bouncePhase)) * bounceAmp;
  rig.body.rotation.z = Math.sin(bouncePhase * 1.7) * bounceAmp * 0.42;
  rig.body.rotation.x = Math.cos(bouncePhase * 1.3) * bounceAmp * 0.2;

  for (const w of rig.wheels) {
    w.rotation.x = wheelSpin;
  }

  if (rig.hood) {
    rig.hood.position.y = 1.12 + Math.abs(Math.sin(bouncePhase * 3.1)) * hoodRattle;
    rig.hood.rotation.z = Math.sin(bouncePhase * 3.7) * hoodRattle * 0.9;
  }
  if (rig.radiatorCap) {
    rig.radiatorCap.position.y = 1.64 + capLift;
    rig.radiatorCap.rotation.z = capLift * 2.4;
    rig.radiatorCap.rotation.x = capLift * 1.7;
  }
}

export function createMarathonScene(): MarathonSceneController {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.3, 450);
  const lightU = createLightUniforms();

  const sky = createSkyDome();
  scene.add(sky.mesh);

  const world: WorldRefs = buildMarathonWorld(lightU);
  scene.add(world.root);

  // Build Hero Cast!
  const fredLorz = new CharActor(CAST_DESIGNS.fredLorz, lightU, 1.98);
  const thomasHicks = new CharActor(CAST_DESIGNS.thomasHicks, lightU, 1.96);
  const felixCarvajal = new CharActor(CAST_DESIGNS.felixCarvajal, lightU, 1.9);
  const lenTaunyane = new CharActor(CAST_DESIGNS.lenTaunyane, lightU, 1.98);
  const sullivan = new CharActor(CAST_DESIGNS.sullivan, lightU, 2.05);
  const sheridan = new CharActor(CAST_DESIGNS.sheridan, lightU, 2.02);
  const trainerA = new CharActor(CAST_DESIGNS.trainerA, lightU, 1.98);
  const trainerB = new CharActor(CAST_DESIGNS.trainerB, lightU, 1.96);
  const official = new CharActor(CAST_DESIGNS.official, lightU, 2.02);

  // Additional committee / volunteers / extra runners / stadium crowd
  const extras: CharActor[] = [];
  for (let i = 0; i < 12; i++) {
    extras.push(new CharActor(makeExtraRunnerDesign(i), lightU, 1.92, 0.65));
  }
  const spectators: CharActor[] = [];
  for (let i = 0; i < 24; i++) {
    spectators.push(new CharActor(makeSpectatorDesign(i), lightU, 1.84, 0.4));
  }

  const carriedHicks = new CarriedHicksActor(lightU);
  const dogs: DogActor[] = [
    new DogActor("#8a5d3b", lightU),
    new DogActor("#5c4435", lightU),
    new DogActor("#a87d4e", lightU),
    new DogActor("#4a3b34", lightU),
  ];

  // Animated 2D FX cards on NOINK layer!
  const fxDust: FxActor[] = [];
  for (let i = 0; i < 9; i++) fxDust.push(new FxActor(lightU));
  const fxSteam: FxActor[] = [];
  for (let i = 0; i < 6; i++) fxSteam.push(new FxActor(lightU));
  const fxBang = new FxActor(lightU);
  const fxDizzy = new FxActor(lightU);
  const fxSplash: FxActor[] = [];
  for (let i = 0; i < 3; i++) fxSplash.push(new FxActor(lightU));

  const allActors = [
    fredLorz,
    thomasHicks,
    felixCarvajal,
    lenTaunyane,
    sullivan,
    sheridan,
    trainerA,
    trainerB,
    official,
    ...extras,
    ...spectators,
  ];
  for (const a of allActors) scene.add(a.group);
  scene.add(carriedHicks.group);
  for (const d of dogs) scene.add(d.group);
  for (const fx of [...fxDust, ...fxSteam, fxBang, fxDizzy, ...fxSplash]) {
    scene.add(fx.mesh);
  }

  // Precompute frozen sun direction per shot anchor (SKILL.md!)
  const shotSunDirs = new Map<string, THREE.Vector3>();
  for (const s of SHOTS) {
    const midCam = s.cam(0.5, Math.floor((s.b - s.a) * 0.5));
    const fwd = new THREE.Vector3(
      midCam.look[0] - midCam.pos[0],
      0,
      midCam.look[2] - midCam.pos[2]
    );
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    else fwd.normalize();
    shotSunDirs.set(s.id, computeSunDir(s.light, fwd));
  }

  const raycaster = new THREE.Raycaster();
  const tmpCamPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function hideEverything() {
    for (const a of allActors) a.hide();
    carriedHicks.hide();
    for (const d of dogs) d.hide();
    for (const fx of [...fxDust, ...fxSteam, fxBang, fxDizzy, ...fxSplash]) {
      fx.hide();
    }
    world.officialCar.group.visible = false;
    world.lorzCar.group.visible = false;
    world.jalopyCar.group.visible = false;
    // Only show finish tape on finish-line shots (prevents cutting across runners' heads at start!)
    world.finishTapeL.visible = false;
    world.finishTapeR.visible = false;
    world.finishTapeL.rotation.set(0, 0, 0);
    world.finishTapeR.rotation.set(0, 0, 0);
  }

  /** Populate animated cheering spectators in the Francis Field grandstands! */
  function placeStadiumCrowd(frame: number, camPos: THREE.Vector3, sunDir: THREE.Vector3, cheer = true) {
    for (let i = 0; i < spectators.length; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const idx = Math.floor(i / 2);
      const row = idx % 3;
      const col = Math.floor(idx / 3);
      const sx = side * (10.1 + row * 1.25);
      const sy = 2.65 + row * 0.78;
      const sz = -14 + col * 8.2 + (row % 2) * 2.5;
      spectators[i].place(
        sx,
        sy,
        sz,
        {
          pose: cheer ? "crowd_cheer" : "idle",
          face: cheer ? "proud" : "neutral",
          phase: frame * 0.24 + i * 0.9,
          facing: side > 0 ? -1 : 1,
          seed: 40 + i,
          frame,
          propR: i % 3 === 0 ? "pennant" : "none",
        },
        camPos,
        sunDir,
        false,
        2
      );
    }
  }

  function update(frame: number) {
    const shot = shotAt(frame);
    const lf = frame - shot.a;
    const dur = Math.max(1, shot.b - shot.a);
    const t = Math.max(0, Math.min(1, lf / dur));
    const sec = frame / 30;

    // 1. Apply camera pose + impact flip-shake kicks
    const c = shot.cam(t, lf);
    const kick = kickOffsetAt(frame);
    tmpCamPos.set(c.pos[0] + kick.dx, c.pos[1] + kick.dy, c.pos[2]);
    tmpLook.set(c.look[0], c.look[1], c.look[2]);
    camera.position.copy(tmpCamPos);
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(tmpLook);
    const rollDeg = (c.roll ?? 0) + kick.droll;
    if (Math.abs(rollDeg) > 0.01) {
      camera.rotateZ(THREE.MathUtils.degToRad(rollDeg));
    }

    // 2. Apply shot-frozen lighting preset & sky dome
    const sunDir = shotSunDirs.get(shot.id)!;
    const preset = LIGHTS[shot.light];
    applyLightPreset(lightU, shot.light, sunDir);

    sky.mesh.position.copy(camera.position);
    sky.uniforms.uTopColor.value.set(preset.skyTop);
    sky.uniforms.uHorizonColor.value.set(preset.skyHorizon);
    sky.uniforms.uCloudColor.value.set(preset.cloudColor);
    sky.uniforms.uSunDir.value.copy(sunDir);
    sky.uniforms.uSunColor.value.set(preset.sunDiscColor);
    sky.uniforms.uShowSun.value = preset.showSunDisc ? 1.0 : 0.0;
    sky.uniforms.uSunSize.value = preset.sunDiscSize;
    sky.uniforms.uTime.value = sec;

    // Ripple 1904 stadium flags gently in the breeze
    for (let i = 0; i < world.flags.length; i++) {
      world.flags[i].rotation.y = Math.sin(sec * 4.5 + i * 1.1) * 0.22;
    }

    // 3. Reset & choreograph EVERY SINGLE ONE OF THE 42 SHOTS!
    hideEverything();
    const camPos = camera.position;

    switch (shot.id) {
      // ---------------------------------------------------------------------
      // BEAT 1: HOOK
      // ---------------------------------------------------------------------
      case "S01_hook_stadium": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        // Sullivan firing starting pistol cleanly INSIDE the 9:16 vertical frame!
        sullivan.place(
          -1.85, 0, 6.2,
          { pose: "fire_pistol", face: "proud", phase: lf >= 34 ? (lf - 34) * 0.45 : 0.0, facing: 1, seed: 1, frame, propR: "pistol" },
          camPos, sunDir
        );
        if (lf >= 35 && lf < 45) {
          fxBang.place(-1.2, 1.55, 6.3, 1.0, "bang", frame * 0.6, camPos);
        }
        const started = lf >= 36;
        const runOff = started ? (lf - 36) * 0.075 : 0;
        for (let i = 0; i < 6; i++) {
          const rx = -1.6 + (i % 3) * 1.65 + (i >= 3 ? 0.55 : 0);
          const rz = 5.4 + Math.floor(i / 3) * 2.1 - runOff;
          extras[i].place(
            rx, 0, rz,
            { pose: started ? "sprint" : "walk", face: "determined", phase: frame * (started ? 0.56 : 0.22) + i, facing: 1, seed: 10 + i, frame },
            camPos, sunDir
          );
        }
        thomasHicks.place(
          0.95, 0, 5.2 - runOff,
          { pose: started ? "sprint" : "walk", face: "determined", phase: frame * (started ? 0.58 : 0.22), facing: 1, seed: 2, frame },
          camPos, sunDir
        );
        break;
      }

      case "S02_hook_lorz_finish": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        world.finishTapeL.visible = true;
        world.finishTapeR.visible = true;
        const lz = lerp(2.2, -1.6, t);
        fredLorz.place(
          0, 0, lz,
          { pose: lz < 0.1 ? "victory_arms" : "run", face: "smug", phase: frame * 0.42, facing: 1, seed: 3, frame },
          camPos, sunDir
        );
        if (lz < 0.2) {
          const snap = Math.min(1, (0.2 - lz) * 0.85);
          world.finishTapeL.rotation.y = snap * 0.95;
          world.finishTapeR.rotation.y = -snap * 0.95;
        }
        break;
      }

      case "S03_hook_lorz_car": {
        const cz = lerp(12, 3, t);
        animateCar(world.lorzCar, 200, cz, Math.PI, frame * 0.55, frame * 0.6, 0.16);
        const gy = computeGroundY(200, cz);
        // Manager driving + Fred Lorz riding high in back seat smugly waving!
        trainerB.place(
          199.65, gy + 0.82, cz + 0.25,
          { pose: "car_wave", face: "determined", phase: frame * 0.18, facing: -1, seed: 19, frame },
          camPos, sunDir, false
        );
        fredLorz.place(
          200.2, gy + 0.92, cz + 1.15,
          { pose: "car_wave", face: "smug", phase: frame * 0.36, facing: 1, seed: 3, frame },
          camPos, sunDir, false
        );
        for (let i = 0; i < 4; i++) {
          const dz = cz + 2.5 + i * 1.4;
          fxDust[i].place(200 + (i % 2 === 0 ? -0.6 : 0.7), computeGroundY(200, dz) + 0.9 + i * 0.25, dz, 1.5 + i * 0.35, "dust", frame * 0.25 + i, camPos, 0.85);
        }
        break;
      }

      case "S04_hook_hicks_poison": {
        const gy = computeGroundY(200, -20);
        thomasHicks.place(
          200, gy, -20,
          { pose: "wild_gulp", face: "wild_eyed", phase: frame * 0.45, facing: 1, seed: 2, frame, propR: "poison_vial", jitter: 0.9 },
          camPos, sunDir
        );
        fxDizzy.place(200, gy + 2.18, -19.8, 1.35, "dizzy_stars", frame * 0.22, camPos);
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 2: THE SETTING
      // ---------------------------------------------------------------------
      case "S05_st_louis_grand": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        for (let i = 0; i < 10; i++) {
          const rx = -4.2 + (i % 5) * 2.1;
          const rz = 4.5 + Math.floor(i / 5) * 2.6 - t * 4.5;
          extras[i].place(
            rx, 0, rz,
            { pose: "run", face: "proud", phase: frame * 0.44 + i * 0.7, facing: 1, seed: 10 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      case "S06_dusty_hills": {
        // Pack of animated runners cresting the undulating Missouri red-clay hills!
        for (let i = 0; i < 10; i++) {
          const rz = 8 - i * 3.8 - t * 6.5;
          const rx = 200 + ((i % 3) - 1) * 2.1;
          extras[i].place(
            rx, computeGroundY(rx, rz), rz,
            { pose: "run", face: "panting", phase: frame * 0.44 + i * 0.8, facing: 1, seed: 20 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      case "S07_90_degree_heat": {
        const gy = computeGroundY(200, 1.2);
        thomasHicks.place(
          200, gy, 1.2,
          { pose: "run", face: "panting", phase: frame * 0.36, facing: 1, seed: 2, frame },
          camPos, sunDir
        );
        extras[0].place(
          197.6, computeGroundY(197.6, 3.8), 3.8,
          { pose: "cough_wave", face: "exhausted", phase: frame * 0.3, facing: 1, seed: 11, frame },
          camPos, sunDir
        );
        break;
      }

      case "S08_organizer_sullivan": {
        sullivan.place(
          401.8, 0, 1.6,
          { pose: "arms_crossed", face: "smug", phase: frame * 0.18, facing: -1, seed: 5, frame, propL: "clipboard" },
          camPos, sunDir
        );
        // Exhausted runner begging slightly behind him
        extras[1].place(
          398.2, 0, -1.8,
          { pose: "wobble_dizzy", face: "panting", phase: frame * 0.25, facing: 1, seed: 12, frame },
          camPos, sunDir
        );
        break;
      }

      case "S09_no_water_well": {
        // Bucket gently sways + ONE sad slow animated blue water droplet falls from bucket into well!
        world.wellBucket.rotation.z = Math.sin(sec * 2.2) * 0.08;
        const dropCycle = (lf % 34) / 34;
        world.wellDrop.position.set(400, 1.9 - dropCycle * dropCycle * 0.92, 0);
        // Distant gasping runners on dry horizon
        for (let i = 0; i < 4; i++) {
          extras[i].place(
            395 + i * 3.4, 0, -4.8 - (i % 2) * 2.2,
            { pose: "wobble_dizzy", face: "exhausted", phase: frame * 0.22 + i, facing: 1, seed: 14 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 3: OFFICIALS' NOISY CARS & THICK RED DUST
      // ---------------------------------------------------------------------
      case "S10_noisy_cars_cu": {
        const cz = lerp(18, 2, t);
        animateCar(world.officialCar, 200, cz, Math.PI, frame * 0.72, frame * 0.85, 0.24);
        const gy = computeGroundY(200, cz);
        official.place(
          200.1, gy + 0.88, cz + 0.35,
          { pose: "car_wave", face: "proud", phase: frame * 0.35, facing: 1, seed: 9, frame },
          camPos, sunDir, false
        );
        for (let i = 0; i < 5; i++) {
          const dz = cz + 2.2 + i * 1.1;
          fxDust[i].place(200 + Math.sin(i * 2) * 1.1, computeGroundY(200, dz) + 0.65 + i * 0.22, dz, 1.4 + i * 0.32, "dust", frame * 0.38 + i, camPos, 0.88);
        }
        break;
      }

      case "S11_in_front_of_pack": {
        const cz = lerp(2, -10, t);
        animateCar(world.officialCar, 200, cz, Math.PI, frame * 0.72, frame * 0.85, 0.22);
        const gy = computeGroundY(200, cz);
        official.place(200.1, gy + 0.88, cz + 0.35, { pose: "car_wave", face: "smug", phase: frame * 0.35, facing: 1, seed: 9, frame }, camPos, sunDir, false);
        for (let i = 0; i < 7; i++) {
          const rz = cz + 4.4 + (i % 4) * 2.1;
          const rx = 200 + ((i % 3) - 1) * 1.9;
          extras[i].place(
            rx, computeGroundY(rx, rz), rz,
            { pose: "sprint", face: "shocked", phase: frame * 0.48 + i, facing: 1, seed: 25 + i, frame },
            camPos, sunDir
          );
        }
        for (let i = 0; i < 6; i++) {
          const dz = cz + 2.4 + i * 1.0;
          fxDust[i].place(200 + Math.cos(i * 1.9) * 1.6, computeGroundY(200, dz) + 1.0 + (i % 3) * 0.35, dz, 1.9 + i * 0.25, "dust", frame * 0.4 + i, camPos, 0.9);
        }
        break;
      }

      case "S12_thick_red_dust": {
        const cz = lerp(-10, -22, t);
        animateCar(world.officialCar, 200, cz, Math.PI, frame * 0.75, frame * 0.9, 0.24);
        // Massive wall of 9 billowing red clay dust clouds strictly behind the official car!
        for (let i = 0; i < 9; i++) {
          const dz = cz + 3.4 + i * 0.9;
          const dx = 200 + Math.sin(frame * 0.14 + i * 1.7) * 2.1;
          fxDust[i].place(dx, computeGroundY(dx, dz) + 1.15 + (i % 3) * 0.55, dz, 2.2 + (i % 3) * 0.5, "dust", frame * 0.35 + i, camPos, 0.78);
        }
        for (let i = 0; i < 5; i++) {
          const rz = cz + 5.6 + i * 1.25;
          const rx = 200 + (i - 2) * 1.25;
          extras[i].place(
            rx, computeGroundY(rx, rz), rz,
            { pose: "cough_wave", face: "coughing", phase: frame * 0.45 + i, facing: 1, seed: 30 + i, frame, jitter: 0.5 },
            camPos, sunDir
          );
        }
        break;
      }

      case "S13_runners_lungs_cough": {
        const gy = computeGroundY(200, -17.5);
        extras[0].place(
          200, gy, -17.5,
          { pose: "cough_wave", face: "coughing", phase: frame * 0.55, facing: 1, seed: 31, frame, jitter: 0.7 },
          camPos, sunDir
        );
        extras[1].place(
          198.2, computeGroundY(198.2, -19.2), -19.2,
          { pose: "cough_wave", face: "coughing", phase: frame * 0.52 + 2, facing: -1, seed: 32, frame, jitter: 0.6 },
          camPos, sunDir
        );
        for (let i = 0; i < 4; i++) {
          fxDust[i].place(200 + (i - 1.5) * 1.5, gy + 1.25 + (i % 2) * 0.5, -18.5 + (i % 2) * 2.2, 2.3, "dust", frame * 0.3 + i, camPos, 0.72);
        }
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 4: CUBAN MAILMAN FÉLIX CARVAJAL
      // ---------------------------------------------------------------------
      case "S14_cuban_mailman_trousers": {
        placeStadiumCrowd(frame, camPos, sunDir, false);
        // Félix jogging cheerfully up to starting line in FULL LONG DRESS TROUSERS & beret!
        felixCarvajal.place(
          0, 0, lerp(11.0, 8.2, t),
          { pose: "walk", face: "proud", phase: frame * 0.34, facing: 1, seed: 4, frame, snippedOverride: false },
          camPos, sunDir
        );
        // Other runners staring deadpan at his dress pants!
        extras[0].place(-2.4, 0, 7.2, { pose: "idle", face: "shocked", phase: frame * 0.12, facing: 1, seed: 40, frame }, camPos, sunDir);
        extras[1].place(2.5, 0, 7.6, { pose: "idle", face: "deadpan", phase: frame * 0.12, facing: -1, seed: 41, frame }, camPos, sunDir);
        break;
      }

      case "S15_pants_snipped_shorts": {
        placeStadiumCrowd(frame, camPos, sunDir, false);
        const snipped = frame >= 994; // Exact frame of "snipped"!
        const fallT = snipped ? Math.min(1, (frame - 994) / 22) : 0;
        felixCarvajal.place(
          -0.45, 0, 8.2,
          {
            pose: snipped ? "pants_snipped" : "idle",
            face: snipped ? "proud" : "shocked",
            phase: frame * 0.35,
            facing: 1,
            seed: 4,
            frame,
            snippedOverride: snipped,
            cuffsFalling: fallT,
          },
          camPos, sunDir
        );
        // Martin Sheridan bending over operating GIANT ANIMATED STEEL SCISSORS!
        sheridan.place(
          0.95, 0, 8.25,
          { pose: "snip_scissors", face: "determined", phase: frame * 0.42, facing: -1, seed: 6, frame, propR: "scissors" },
          camPos, sunDir
        );
        if (frame >= 993 && frame < 1004) {
          fxBang.place(0.05, 0.72, 8.45, 1.15, "bang", frame * 0.5, camPos);
        }
        break;
      }

      case "S16_rotten_apples": {
        const sick = t > 0.68;
        felixCarvajal.place(
          601.5, 0, -1.2,
          {
            pose: sick ? "stomach_ache" : "eat_apple",
            face: sick ? "green_sick" : "proud",
            phase: frame * 0.42,
            facing: 1,
            seed: 4,
            frame,
            snippedOverride: true,
            propR: sick ? "none" : "apple",
          },
          camPos, sunDir
        );
        break;
      }

      case "S17_roadside_nap": {
        // Félix curled up peacefully sleeping under the apple tree!
        felixCarvajal.place(
          601.5, 0, -1.2,
          { pose: "nap", face: "sleeping", phase: frame * 0.16, facing: 1, seed: 4, frame, snippedOverride: true },
          camPos, sunDir
        );
        // Distant runner jogging past on the dirt road looking baffled!
        extras[2].place(
          594.5, 0, lerp(6, -6, t),
          { pose: "run", face: "shocked", phase: frame * 0.38, facing: 1, seed: 44, frame },
          camPos, sunDir
        );
        break;
      }

      case "S18_still_placed_fourth": {
        const fz = lerp(24, 12, t);
        felixCarvajal.place(
          200, computeGroundY(200, fz), fz,
          { pose: "sprint", face: "proud", phase: frame * 0.58, facing: 1, seed: 4, frame, snippedOverride: true },
          camPos, sunDir
        );
        // Exhausted rivals left behind!
        for (let i = 0; i < 3; i++) {
          const rz = 21 - i * 3.5;
          const rx = i % 2 === 0 ? 197.6 : 202.3;
          extras[i].place(
            rx, computeGroundY(rx, rz), rz,
            { pose: "wobble_dizzy", face: "exhausted", phase: frame * 0.25 + i, facing: 1, seed: 46 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 5: WILD DOGS & FRED LORZ CAR CHEAT
      // ---------------------------------------------------------------------
      case "S19_barefoot_runner": {
        const lz = lerp(12, 5, t);
        lenTaunyane.place(
          800, 0, lz,
          { pose: "sprint", face: "determined", phase: frame * 0.56, facing: 1, seed: 7, frame },
          camPos, sunDir
        );
        break;
      }

      case "S20_chased_off_course": {
        const lx = lerp(801, 809, t);
        const lz = lerp(3, -1, t);
        lenTaunyane.place(
          lx, 0, lz,
          { pose: "panic_run", face: "panic", phase: frame * 0.72, facing: 1, seed: 7, frame, jitter: 0.4 },
          camPos, sunDir
        );
        // 4 wild dogs bursting in behind him!
        for (let i = 0; i < 4; i++) {
          dogs[i].place(
            lx - 2.6 - i * 1.15, 0, lz + 0.8 + (i % 2 === 0 ? -0.65 : 0.75),
            frame * 0.75 + i * 1.3, 1, camPos
          );
        }
        break;
      }

      case "S21_wild_dogs_pack": {
        const lx = lerp(809, 816, t);
        const lz = lerp(-1, -4, t);
        lenTaunyane.place(
          lx + 0.6, 0, lz - 0.5,
          { pose: "panic_run", face: "panic", phase: frame * 0.78, facing: 1, seed: 7, frame, jitter: 0.5 },
          camPos, sunDir
        );
        for (let i = 0; i < 4; i++) {
          dogs[i].place(
            lx - 2.2 - i * 0.95, 0, lz + (i - 1.5) * 0.55,
            frame * 0.82 + i * 1.4, 1, camPos
          );
        }
        break;
      }

      case "S22_lorz_intro_hop": {
        const gy = computeGroundY(200, 24);
        animateCar(world.lorzCar, 199.4, 23.6, Math.PI, frame * 0.1, frame * 0.3, 0.05);
        fredLorz.place(
          lerp(201.8, 199.9, t), gy + Math.sin(t * Math.PI) * 0.8, 24.1,
          { pose: t < 0.4 ? "stomach_ache" : "victory_arms", face: t < 0.4 ? "exhausted" : "smug", phase: frame * 0.35, facing: -1, seed: 3, frame },
          camPos, sunDir
        );
        break;
      }

      case "S23_lorz_11_miles_car": {
        const cz = lerp(22, 4, t);
        animateCar(world.lorzCar, 200, cz, Math.PI, frame * 0.68, frame * 0.65, 0.16);
        const gy = computeGroundY(200, cz);
        trainerB.place(199.65, gy + 0.82, cz + 0.25, { pose: "car_wave", face: "determined", phase: frame * 0.18, facing: -1, seed: 19, frame }, camPos, sunDir, false);
        fredLorz.place(
          200.2, gy + 0.92, cz + 1.15,
          { pose: "car_wave", face: "smug", phase: frame * 0.36, facing: 1, seed: 3, frame },
          camPos, sunDir, false
        );
        for (let i = 0; i < 4; i++) {
          const dz = cz + 2.4 + i * 1.3;
          fxDust[i].place(200, computeGroundY(200, dz) + 0.8, dz, 1.5 + i * 0.3, "dust", frame * 0.3 + i, camPos, 0.82);
        }
        break;
      }

      case "S24_lorz_waving_runners": {
        const cz = lerp(4, -8, t);
        animateCar(world.lorzCar, 200.4, cz, Math.PI, frame * 0.65, frame * 0.6, 0.15);
        const gy = computeGroundY(200.4, cz);
        trainerB.place(200.05, gy + 0.82, cz + 0.25, { pose: "car_wave", face: "determined", phase: frame * 0.18, facing: -1, seed: 19, frame }, camPos, sunDir, false);
        fredLorz.place(
          200.55, gy + 0.92, cz + 1.15,
          { pose: "car_wave", face: "smug", phase: frame * 0.4, facing: -1, seed: 3, frame },
          camPos, sunDir, false
        );
        // Exhausted runners coughing as Lorz cruises smugly past!
        for (let i = 0; i < 4; i++) {
          const rz = 2 - i * 3.5;
          extras[i].place(
            197.4, computeGroundY(197.4, rz), rz,
            { pose: "cough_wave", face: "exhausted", phase: frame * 0.35 + i, facing: 1, seed: 52 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      case "S25_lorz_finish_jog": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        world.finishTapeL.visible = true;
        world.finishTapeR.visible = true;
        const lz = lerp(2.8, -1.5, t);
        fredLorz.place(
          0, 0, lz,
          { pose: lz < 0.2 ? "victory_arms" : "run", face: "smug", phase: frame * 0.4, facing: 1, seed: 3, frame },
          camPos, sunDir
        );
        if (lz < 0.2) {
          const snap = Math.min(1, (0.2 - lz) * 0.85);
          world.finishTapeL.rotation.y = snap * 0.95;
          world.finishTapeR.rotation.y = -snap * 0.95;
        }
        break;
      }

      case "S26_officials_caught_him": {
        placeStadiumCrowd(frame, camPos, sunDir, false);
        const busted = frame >= 1599;
        fredLorz.place(
          -0.6, 0, -1.6,
          { pose: "idle", face: busted ? "guilty" : "smug", phase: frame * 0.3, facing: 1, seed: 3, frame, jitter: busted ? 0.5 : 0 },
          camPos, sunDir
        );
        official.place(
          lerp(1.9, 0.85, Math.min(1, t * 2.2)), 0, -1.55,
          { pose: "whistle_bust", face: "angry", phase: frame * 0.48, facing: -1, seed: 9, frame, propL: "whistle" },
          camPos, sunDir
        );
        if (frame >= 1599 && frame < 1614) {
          fxBang.place(0.15, 1.55, -1.3, 1.05, "bang", frame * 0.55, camPos);
        }
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 6: THOMAS HICKS + RAT POISON + CARRIED FINISH (GOLDEN HOUR!)
      // ---------------------------------------------------------------------
      case "S27_hicks_in_first": {
        const hz = lerp(-14, -22, t);
        thomasHicks.place(
          200, computeGroundY(200, hz), hz,
          { pose: "run", face: "panting", phase: frame * 0.34, facing: 1, seed: 2, frame },
          camPos, sunDir
        );
        break;
      }

      case "S28_hicks_hallucinating": {
        const gy = computeGroundY(200, -28);
        thomasHicks.place(
          200, gy, -28,
          { pose: "wobble_dizzy", face: "dizzy", phase: frame * 0.38, facing: 1, seed: 2, frame, jitter: 0.45 },
          camPos, sunDir
        );
        fxDizzy.place(200, gy + 2.15, -27.7, 1.4, "dizzy_stars", frame * 0.25, camPos);
        break;
      }

      case "S29_refused_water": {
        const gy = computeGroundY(200, -28);
        thomasHicks.place(
          199.5, gy, -28,
          { pose: "wobble_dizzy", face: "panting", phase: frame * 0.3, facing: 1, seed: 2, frame },
          camPos, sunDir
        );
        trainerA.place(
          200.65, gy, -28,
          { pose: "arms_crossed", face: "angry", phase: frame * 0.25, facing: -1, seed: 8, frame },
          camPos, sunDir
        );
        break;
      }

      case "S30_egg_whites_mix": {
        const gy = computeGroundY(200, -28);
        trainerA.place(
          200.65, gy, -28.1,
          { pose: "mix_cocktail", face: "determined", phase: frame * 0.5, facing: -1, seed: 8, frame, propL: "egg", propR: "brandy" },
          camPos, sunDir
        );
        thomasHicks.place(
          199.6, gy, -28,
          { pose: "wobble_dizzy", face: "dizzy", phase: frame * 0.32, facing: 1, seed: 2, frame },
          camPos, sunDir
        );
        break;
      }

      case "S31_brandy_rat_poison": {
        const gy = computeGroundY(200, -28);
        const hitPoison = frame >= 1904;
        trainerB.place(
          200.58, gy, -28.1,
          { pose: "mix_cocktail", face: "determined", phase: frame * 0.5, facing: -1, seed: 9, frame, propL: "brandy", propR: "poison_vial" },
          camPos, sunDir
        );
        thomasHicks.place(
          199.58, gy, -28.0,
          {
            pose: hitPoison ? "wild_gulp" : "wobble_dizzy",
            face: hitPoison ? "wild_eyed" : "shocked",
            phase: frame * 0.52,
            facing: 1,
            seed: 2,
            frame,
            jitter: hitPoison ? 1.0 : 0.3,
          },
          camPos, sunDir
        );
        if (hitPoison) {
          fxDizzy.place(199.58, gy + 2.22, -27.7, 1.35, "dizzy_stars", frame * 0.32, camPos);
        }
        break;
      }

      case "S32_carried_over_finish": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        world.finishTapeL.visible = true;
        world.finishTapeR.visible = true;
        const hz = lerp(7.5, -1.8, t);
        carriedHicks.place(0, 0, hz, frame * 0.52, frame, camPos);
        if (hz < 0.25) {
          const snap = Math.min(1, (0.25 - hz) * 0.75);
          world.finishTapeL.rotation.y = snap * 0.95;
          world.finishTapeR.rotation.y = -snap * 0.95;
        }
        break;
      }

      case "S33_legs_pumping_midair": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        world.finishTapeL.visible = true;
        world.finishTapeR.visible = true;
        const hz = lerp(-1.8, -6.5, t);
        world.finishTapeL.rotation.y = 0.95;
        world.finishTapeR.rotation.y = -0.95;
        carriedHicks.place(0, 0, hz, frame * 0.62, frame, camPos);
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 7: DEADPAN DOUBLE LINE + SLOWEST CLOCK
      // ---------------------------------------------------------------------
      case "S34_luckily_nobody_died": {
        placeStadiumCrowd(frame, camPos, sunDir, false);
        for (let i = 0; i < 6; i++) {
          const rx = -3.8 + i * 1.55;
          const rz = 3.5 + (i % 2) * 1.4;
          extras[i].place(
            rx, 0, rz,
            { pose: "idle", face: "deadpan", phase: frame * 0.1, facing: 1, seed: 60 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      case "S35_half_runners_quit": {
        placeStadiumCrowd(frame, camPos, sunDir, false);
        // 7 exhausted runners dramatically sprawled flat on the grass!
        for (let i = 0; i < 7; i++) {
          const rx = -4.5 + i * 1.55;
          const rz = 4.6 + (i % 3) * 1.7;
          extras[i].place(
            rx, 0, rz,
            { pose: "sprawl_grass", face: "exhausted", phase: frame * 0.14 + i, facing: 1, seed: 66 + i, frame },
            camPos, sunDir
          );
        }
        break;
      }

      case "S36_slowest_clock_tower": {
        // Giant stadium clock hands spinning crazily past 3:28:53!
        world.clockHandMin.rotation.z = -t * Math.PI * 6.95;
        world.clockHandHour.rotation.z = -t * (Math.PI * 0.58);
        extras[0].place(0.4, 0, -29.0, { pose: "sprawl_grass", face: "exhausted", phase: frame * 0.14, facing: 1, seed: 70, frame }, camPos, sunDir);
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 8: EMPTY RADIATOR ANALOGY
      // ---------------------------------------------------------------------
      case "S37_empty_radiator_car": {
        const cz = lerp(12, -4, t);
        animateCar(world.jalopyCar, 1000, cz, Math.PI, frame * 0.65, frame * 0.95, 0.2, 0.14 * t, 0);
        const gy = computeGroundY(1000, cz);
        extras[0].place(
          999.7, gy + 0.92, cz + 0.35,
          { pose: "car_wave", face: "panic", phase: frame * 0.5, facing: 1, seed: 75, frame, jitter: 0.45 },
          camPos, sunDir, false
        );
        // First wispy steam puffs rising from brass radiator
        if (t > 0.45) {
          for (let i = 0; i < 3; i++) {
            const lift = ((frame * 0.14 + i * 0.8) % 2.4);
            fxSteam[i].place(1000, gy + 1.85 + lift, cz - 1.85, 0.9 + lift * 0.4, "steam", frame * 0.3 + i, camPos, 0.82);
          }
        }
        break;
      }

      case "S38_overheats_seizes": {
        const popped = frame >= 2536; // "overheats" -> POP!
        const seized = frame >= 2578; // "seizes" -> DEAD LOCK!
        const cz = seized ? -5.4 : lerp(-4.0, -5.4, Math.min(1, lf / 95));
        const gy = computeGroundY(1000, cz);
        const capLift = popped ? Math.min(5.2, (frame - 2536) * 0.22) : 0;
        const rattle = seized ? 0.03 : 0.28;
        animateCar(
          world.jalopyCar,
          1000,
          cz,
          Math.PI,
          seized ? 0 : frame * 0.72,
          frame * (seized ? 0.3 : 1.35),
          seized ? 0.04 : 0.25,
          rattle,
          capLift
        );
        extras[0].place(
          999.7, gy + 0.92, cz + 0.35,
          { pose: "car_wave", face: seized ? "deadpan" : "shocked", phase: frame * 0.4, facing: 1, seed: 75, frame, jitter: seized ? 0.1 : 0.85 },
          camPos, sunDir, false
        );
        // Huge erupting cartoon white steam geyser blasting from radiator!
        const steamCount = popped ? 6 : 3;
        for (let i = 0; i < steamCount; i++) {
          const lift = ((frame * 0.22 + i * 0.75) % 4.2);
          fxSteam[i].place(
            1000 + Math.sin(frame * 0.2 + i) * 0.45,
            gy + 1.85 + lift,
            cz - 1.85,
            1.15 + lift * 0.48,
            "steam",
            frame * 0.35 + i,
            camPos,
            0.92
          );
        }
        if (frame >= 2536 && frame < 2548) {
          fxBang.place(1000, gy + 1.9, cz - 1.85, 1.5, "bang", frame * 0.5, camPos);
        }
        break;
      }

      // ---------------------------------------------------------------------
      // BEAT 9: CONSEQUENCE + GOLDEN TWIST
      // ---------------------------------------------------------------------
      case "S39_committee_banned_gavel": {
        sullivan.place(
          34.0, 0.28, -1.0,
          { pose: "gavel_slam", face: "angry", phase: frame * 0.45, facing: 1, seed: 5, frame, propR: "gavel" },
          camPos, sunDir, false
        );
        official.place(
          32.92, 0.24, -1.1,
          { pose: "arms_crossed", face: "angry", phase: frame * 0.2, facing: 1, seed: 9, frame },
          camPos, sunDir, false
        );
        trainerA.place(
          35.08, 0.24, -1.1,
          { pose: "arms_crossed", face: "shocked", phase: frame * 0.2, facing: -1, seed: 8, frame },
          camPos, sunDir, false
        );
        if (frame >= 2639 && frame < 2651) {
          fxBang.place(34.4, 1.05, -0.25, 1.1, "bang", frame * 0.55, camPos);
        }
        break;
      }

      case "S40_modern_water_stations": {
        const mz = lerp(8, -6, t);
        // Smiling volunteers along tables handing splashing blue water cups!
        for (let i = 0; i < 3; i++) {
          const vz = 4 - i * 4.5;
          spectators[i].place(
            1196.7, 0, vz,
            { pose: "hand_water", face: "proud", phase: frame * 0.32 + i, facing: 1, seed: 80 + i, frame, propR: "water_cup" },
            camPos, sunDir
          );
          fxSplash[i].place(1197.8, 1.35, vz, 0.95, "water_splash", frame * 0.35 + i, camPos, 0.88);
        }
        // Happy smiling runners sprinting cleanly past grabbing water!
        for (let i = 0; i < 5; i++) {
          const rz = mz + 3.5 - i * 2.8;
          extras[i].place(
            1199.2 + (i % 2) * 1.4, 0, rz,
            { pose: "sprint", face: "proud", phase: frame * 0.48 + i * 0.8, facing: 1, seed: 85 + i, frame, propL: i % 2 === 0 ? "water_cup" : "none" },
            camPos, sunDir
          );
        }
        break;
      }

      case "S41_hicks_gold_medal": {
        placeStadiumCrowd(frame, camPos, sunDir, true);
        const gotMedal = frame >= 2838;
        thomasHicks.place(
          -0.35, 0, 0,
          {
            pose: gotMedal ? "wobble_dizzy" : "idle",
            face: gotMedal ? "proud" : "exhausted",
            phase: frame * 0.22,
            facing: 1,
            seed: 2,
            frame,
            hasMedal: gotMedal,
          },
          camPos, sunDir
        );
        official.place(
          1.1, 0, 0.1,
          { pose: "hand_water", face: "proud", phase: frame * 0.2, facing: -1, seed: 9, frame, propR: gotMedal ? "none" : "gold_medal" },
          camPos, sunDir
        );
        break;
      }

      case "S42_collapsed_retired_end": {
        placeStadiumCrowd(frame, camPos, sunDir, false);
        // ICONIC DEADPAN BUTTON ENDING: flat on back on golden grass, ONE stiff arm sticking straight up holding gold medal!
        thomasHicks.place(
          0, 0, 0,
          { pose: "collapse_flat", face: "exhausted", phase: frame * 0.14, facing: 1, seed: 2, frame, hasMedal: false },
          camPos, sunDir
        );
        // Official standing quietly beside him blinking deadpan
        official.place(
          2.1, 0, -0.6,
          { pose: "idle", face: "deadpan", phase: frame * 0.1, facing: -1, seed: 9, frame },
          camPos, sunDir
        );
        break;
      }
    }

    // 4. Sight-line culler (SKILL.md): hide any background prop intersecting camera-to-look ray!
    for (const obj of world.cullables) obj.visible = true;
    tmpDir.subVectors(tmpLook, tmpCamPos);
    const lookDist = tmpDir.length();
    if (lookDist > 0.5) {
      tmpDir.divideScalar(lookDist);
      raycaster.set(tmpCamPos, tmpDir);
      raycaster.far = Math.max(0.5, lookDist - 1.2);
      const hits = raycaster.intersectObjects(world.cullables, true);
      for (const h of hits) {
        let top: THREE.Object3D = h.object;
        while (top.parent && !world.cullables.includes(top)) {
          top = top.parent;
        }
        if (world.cullables.includes(top)) {
          top.visible = false;
        }
      }
    }

    return {
      shot,
      focusDist: shot.focusDist ?? lookDist,
      focusRange: shot.focusRange ?? 2.3,
      cInf: shot.cInf,
      sat: preset.sat,
      goldenTint: shot.light === "golden" ? 1.0 : shot.light === "heat" ? 0.35 : 0.0,
    };
  }

  return { scene, camera, lightU, update };
}
