import * as THREE from "three";
import {
  LIGHTS,
  SharedLightUniforms,
  applyLightPreset,
  computeSunDir,
  createLightUniforms,
} from "../marathon/lights";
import { NOINK } from "../marathon/ink";
import { buildWhaleWorld, WhaleWorldRefs } from "./whaleBuild";
import {
  WHALE_CAST,
  WhaleCharActor,
  SeagullActor,
  WhaleFxActor,
  makeWorkerDesign,
  makeTownsfolkDesign,
} from "./whaleCast";
import { WHALE_SHOTS, WhaleShotDef, whaleShotAt, whaleKickAt } from "./whaleStory";
import { lerp } from "../marathon/story";

export interface WhaleSceneController {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lightU: SharedLightUniforms;
  update: (frame: number) => {
    shot: WhaleShotDef;
    focusDist: number;
    focusRange: number;
    cInf: number;
    sat: number;
    goldenTint: number;
  };
}

function createCoastalSky() {
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

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) { return 0.52*noise(p) + 0.28*noise(p*2.1+3.7) + 0.14*noise(p*4.3+9.1); }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.58));
        if (d.y > 0.04) {
          vec2 cuv = d.xz / (d.y + 0.34) * 1.45 + vec2(uTime * 0.015, 0.0);
          float cl = fbm(cuv);
          float cm = smoothstep(0.55, 0.67, cl) * smoothstep(0.04, 0.22, d.y) * (1.0 - smoothstep(0.68, 0.95, d.y));
          col = mix(col, uCloudColor, cm * 0.74);
        }
        if (uShowSun > 0.5) {
          float sd = dot(d, normalize(uSunDir));
          float halo = pow(max(sd, 0.0), 18.0) * 0.42;
          float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.65), sd);
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

export function createWhaleScene(): WhaleSceneController {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.3, 450);
  const lightU = createLightUniforms();

  const sky = createCoastalSky();
  scene.add(sky.mesh);

  const world: WhaleWorldRefs = buildWhaleWorld(lightU);
  scene.add(world.root);

  const thornton = new WhaleCharActor(WHALE_CAST.thornton, lightU, 2.0, 0.78);
  const veteran = new WhaleCharActor(WHALE_CAST.veteran, lightU, 1.98, 0.78);
  const cameraman = new WhaleCharActor(WHALE_CAST.cameraman, lightU, 1.95, 0.72);
  const workers: WhaleCharActor[] = [0, 1, 2, 3].map((i) => new WhaleCharActor(makeWorkerDesign(i), lightU, 1.94, 0.66));
  const townsfolk: WhaleCharActor[] = Array.from({ length: 10 }, (_, i) => new WhaleCharActor(makeTownsfolkDesign(i), lightU, 1.92, 0.62));
  const seagulls: SeagullActor[] = [0, 1, 2, 3].map(() => new SeagullActor(lightU));
  const fxList: WhaleFxActor[] = Array.from({ length: 10 }, () => new WhaleFxActor(lightU));

  for (const a of [thornton, veteran, cameraman, ...workers, ...townsfolk]) scene.add(a.group);
  for (const g of seagulls) scene.add(g.mesh);
  for (const fx of fxList) scene.add(fx.mesh);

  const shotSunDirs = new Map<string, THREE.Vector3>();
  for (const s of WHALE_SHOTS) {
    const mid = s.cam(0.5, Math.floor((s.b - s.a) * 0.5));
    const fwd = new THREE.Vector3(mid.look[0] - mid.pos[0], 0, mid.look[2] - mid.pos[2]);
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    else fwd.normalize();
    shotSunDirs.set(s.id, computeSunDir(s.light, fwd));
  }

  const raycaster = new THREE.Raycaster();
  const tmpCamPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function resetFrame() {
    for (const a of [thornton, veteran, cameraman, ...workers, ...townsfolk]) a.hide();
    for (const g of seagulls) g.hide();
    for (const fx of fxList) fx.hide();
    for (const ch of world.fallingChunks) ch.visible = false;

    world.whaleWhole.visible = true;
    world.whaleHalfRemaining.visible = false;
    world.blastCrater.visible = false;
    world.tntStack.visible = false;
    world.plungerBox.visible = false;
    world.plungerHandle.position.y = 0.85;

    // Reset Oldsmobile to gleaming uncrushed state
    world.oldsmobile.cabin.scale.set(1, 1, 1);
    world.oldsmobile.body.position.y = 0;
    for (let i = 0; i < world.oldsmobile.wheels.length; i++) {
      world.oldsmobile.wheels[i].rotation.z = Math.PI / 2;
    }
    world.oldsmobile.heroBlubberSlab.visible = false;
  }

  function applyCarCrush(crushT: number, slabY: number) {
    const c = Math.max(0, Math.min(1, crushT));
    world.oldsmobile.cabin.scale.set(1 + c * 0.14, 1 - c * 0.84, 1 + c * 0.08);
    world.oldsmobile.body.position.y = -c * 0.18;
    // Splay tires outward comedically on pancake impact!
    world.oldsmobile.wheels[0].rotation.z = Math.PI / 2 - c * 0.36;
    world.oldsmobile.wheels[1].rotation.z = Math.PI / 2 + c * 0.36;
    world.oldsmobile.wheels[2].rotation.z = Math.PI / 2 - c * 0.36;
    world.oldsmobile.wheels[3].rotation.z = Math.PI / 2 + c * 0.36;
    world.oldsmobile.heroBlubberSlab.visible = true;
    world.oldsmobile.heroBlubberSlab.position.set(0, slabY, -0.2);
    world.oldsmobile.heroBlubberSlab.rotation.set(c * 0.3, 0.4, c * 0.2);
  }

  function update(frame: number) {
    const shot = whaleShotAt(frame);
    const lf = frame - shot.a;
    const dur = Math.max(1, shot.b - shot.a);
    const t = Math.max(0, Math.min(1, lf / dur));
    const sec = frame / 30;

    const c = shot.cam(t, lf);
    const kick = whaleKickAt(frame);
    tmpCamPos.set(c.pos[0] + kick.dx, c.pos[1] + kick.dy, c.pos[2]);
    tmpLook.set(c.look[0], c.look[1], c.look[2]);
    camera.position.copy(tmpCamPos);
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(tmpLook);
    const rollDeg = (c.roll ?? 0) + kick.droll;
    if (Math.abs(rollDeg) > 0.01) camera.rotateZ(THREE.MathUtils.degToRad(rollDeg));

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

    // Gentle Pacific surf motion
    world.oceanSurf.position.x = -12.5 + Math.sin(sec * 2.1) * 0.9;

    resetFrame();
    const camPos = camera.position;

    switch (shot.id) {
      case "W01_quiet_beach_town": {
        for (let i = 0; i < 4; i++) {
          townsfolk[i].place(14 + i * 2.2, 0, -6 + i * 5, { pose: "walk", face: "neutral", phase: frame * 0.25 + i, facing: -1, seed: 10 + i, frame }, camPos);
        }
        seagulls[0].place(-4 + t * 8, 6.2, -10, frame * 0.22, 1, camPos, 0.9);
        break;
      }

      case "W02_eight_ton_problem": {
        // Stunned locals staring at the giant dead whale + first green stink wisps!
        townsfolk[0].place(4.6, 0, 4.2, { pose: "idle", face: "lookup_shock", phase: frame * 0.15, facing: -1, seed: 11, frame }, camPos);
        townsfolk[1].place(5.4, 0, 2.0, { pose: "gag_nose", face: "gagging", phase: frame * 0.25, facing: -1, seed: 12, frame }, camPos);
        fxList[0].place(0.5, 3.2, 2.4, 2.4, "stink", frame * 0.18, camPos, 0.85);
        break;
      }

      case "W03_tnt_reveal_flash": {
        world.tntStack.visible = true;
        fxList[0].place(2.35, 1.8, 2.6, 1.8, "bang", frame * 0.45, camPos, 0.85);
        break;
      }

      case "W04_florence_establishing":
      case "W05_45ft_whale_track": {
        for (let i = 0; i < 5; i++) {
          townsfolk[i].place(5.8 + (i % 2) * 1.6, 0, -4.5 + i * 2.4, { pose: "idle", face: "gagging", phase: frame * 0.2 + i, facing: -1, seed: 15 + i, frame }, camPos);
        }
        fxList[0].place(0.2, 3.4, 3.2, 2.6, "stink", frame * 0.2, camPos, 0.8);
        fxList[1].place(0.0, 3.1, -1.8, 2.4, "stink", frame * 0.2 + 2, camPos, 0.78);
        break;
      }

      case "W06_cooked_stink_fumes": {
        for (let i = 0; i < 4; i++) {
          fxList[i].place((i - 1.5) * 1.4, 2.8 + (i % 2) * 0.9 + Math.sin(sec * 2 + i) * 0.3, 1.5 + (i - 1.5) * 1.2, 2.8, "stink", frame * 0.28 + i, camPos, 0.92);
        }
        break;
      }

      case "W07_town_gagging": {
        for (let i = 0; i < 5; i++) {
          const tx = 10.6 + i * 0.95;
          const tz = 6.0 + (i % 2) * 0.7;
          townsfolk[i].place(tx, 0, tz, { pose: "gag_nose", face: "gagging", phase: frame * 0.44 + i * 0.9, facing: -1, seed: 20 + i, frame, jitter: 0.4 }, camPos);
        }
        fxList[0].place(11.6, 2.1, 7.2, 2.6, "stink", frame * 0.3, camPos, 0.65);
        fxList[1].place(13.6, 2.2, 7.0, 2.6, "stink", frame * 0.3 + 2, camPos, 0.65);
        break;
      }

      case "W08_nobody_bury_chop": {
        for (let i = 0; i < 4; i++) {
          workers[i].place(6.4 + i * 1.15 + t * 1.6, 0, 4.4 + (i % 2) * 1.2, { pose: "walk", face: "grumpy", phase: frame * 0.38 + i, facing: 1, seed: 30 + i, frame }, camPos);
        }
        fxList[0].place(1.0, 3.0, 2.4, 2.5, "stink", frame * 0.22, camPos, 0.85);
        break;
      }

      case "W09_thornton_pulls_up": {
        thornton.place(lerp(8.2, 6.0, t), 0, 5.8, { pose: "walk", face: "smug", phase: frame * 0.38, facing: -1, seed: 1, frame }, camPos);
        workers[0].place(4.4, 0, 4.6, { pose: "gag_nose", face: "gagging", phase: frame * 0.3, facing: -1, seed: 31, frame }, camPos);
        break;
      }

      case "W10_pure_delulu_shrug": {
        thornton.place(6.0, 0, 5.8, { pose: "delulu_shrug", face: "delulu", phase: frame * 0.34, facing: -1, seed: 1, frame }, camPos);
        break;
      }

      case "W11_hauling_20_crates": {
        world.tntStack.visible = true;
        for (let i = 0; i < 4; i++) {
          const wx = lerp(7.8, 3.8, t) + i * 1.3;
          const wz = 4.6 + (i % 2) * 1.3;
          workers[i].place(wx, 0, wz, { pose: "carry_tnt", face: "neutral", phase: frame * 0.42 + i, facing: -1, seed: 32 + i, frame }, camPos);
        }
        break;
      }

      case "W12_stacked_under_whale": {
        world.tntStack.visible = true;
        thornton.place(4.0, 0, 3.6, { pose: "delulu_shrug", face: "smug", phase: frame * 0.28, facing: -1, seed: 1, frame }, camPos);
        break;
      }

      case "W13_veteran_warns":
      case "W14_way_too_much_cu": {
        world.tntStack.visible = true;
        thornton.place(5.85, 0, 5.6, { pose: "idle", face: "smug", phase: frame * 0.18, facing: 1, seed: 1, frame }, camPos);
        veteran.place(7.05, 0, 5.6, { pose: "warn_wave", face: "warn_shout", phase: frame * 0.5, facing: -1, seed: 2, frame, jitter: 0.45 }, camPos);
        break;
      }

      case "W15_thornton_brushes_off": {
        world.tntStack.visible = true;
        thornton.place(5.95, 0, 5.6, { pose: "brush_off", face: "smug", phase: frame * 0.36, facing: 1, seed: 1, frame }, camPos);
        veteran.place(7.1, 0, 5.6, { pose: "idle", face: "angry", phase: frame * 0.2, facing: -1, seed: 2, frame }, camPos);
        break;
      }

      case "W16_backed_crowd_up": {
        world.tntStack.visible = true;
        world.plungerBox.visible = true;
        thornton.place(11.3, 0, 14.0, { pose: "idle", face: "smug", phase: frame * 0.2, facing: -1, seed: 1, frame }, camPos);
        cameraman.place(13.2, 0, 14.6, { pose: "camera_film", face: "neutral", phase: frame * 0.2, facing: -1, seed: 3, frame }, camPos);
        for (let i = 0; i < 6; i++) {
          townsfolk[i].place(10.2 + i * 1.1, 0, 15.6 + (i % 2) * 1.1, { pose: "walk", face: "cheer", phase: frame * 0.38 + i, facing: -1, seed: 40 + i, frame }, camPos);
        }
        break;
      }

      case "W17_slammed_plunger": {
        world.plungerBox.visible = true;
        const slamT = Math.min(1, Math.max(0, (frame - 1284) / 7));
        world.plungerHandle.position.y = lerp(0.85, 0.22, slamT);
        thornton.place(11.35, 0, 14.0, { pose: "slam_plunger", face: "delulu", phase: frame * 0.35, facing: 1, seed: 1, frame, slamT }, camPos);
        if (slamT > 0.75) {
          fxList[0].place(12.25, 0.75, 14.0, 0.92, "bang", frame * 0.5, camPos);
        }
        break;
      }

      case "W18_massive_explosion": {
        world.whaleWhole.visible = false;
        world.whaleHalfRemaining.visible = true;
        world.blastCrater.visible = true;
        // MASSIVE 100-FOOT EXPLOSION PLUME + BILLOWING SMOKE + LAUNCHING BLUBBER CHUNKS!
        for (let i = 0; i < 5; i++) {
          const rise = t * (4.5 + i * 2.2);
          fxList[i].place(
            Math.sin(i * 2.1) * (1.2 + t * 1.8),
            1.6 + rise,
            2.4 + Math.cos(i * 1.9) * 1.4,
            3.2 + t * 3.8 + (i % 2) * 1.2,
            i < 3 ? "fireball" : "smoke",
            frame * 0.4 + i,
            camPos,
            0.94
          );
        }
        for (let i = 0; i < world.fallingChunks.length; i++) {
          const ch = world.fallingChunks[i];
          ch.visible = true;
          const a = (i / world.fallingChunks.length) * Math.PI * 2;
          const spd = 6.5 + (i % 4) * 2.6;
          ch.position.set(
            Math.cos(a) * t * spd,
            1.4 + t * (10.5 + (i % 3) * 3.5),
            2.4 + Math.sin(a) * t * spd
          );
          ch.rotation.set(frame * 0.2 + i, frame * 0.25, i);
        }
        break;
      }

      case "W19_everyone_cheered": {
        world.whaleWhole.visible = false;
        world.whaleHalfRemaining.visible = true;
        world.blastCrater.visible = true;
        thornton.place(11.4, 0, 14.0, { pose: "cheer", face: "cheer", phase: frame * 0.45, facing: -1, seed: 1, frame }, camPos);
        cameraman.place(13.1, 0, 14.4, { pose: "camera_film", face: "cheer", phase: frame * 0.3, facing: -1, seed: 3, frame }, camPos);
        for (let i = 0; i < 6; i++) {
          townsfolk[i].place(9.6 + i * 1.1, 0, 15.2 + (i % 2) * 0.9, { pose: "cheer", face: "cheer", phase: frame * 0.44 + i, facing: -1, seed: 44 + i, frame }, camPos);
        }
        break;
      }

      case "W20_looked_up_sky_rain": {
        // Crowd frozen staring STRAIGHT UP as giant chunks plummet down from the top of the frame!
        thornton.place(11.5, 0, 13.8, { pose: "lookup", face: "lookup_shock", phase: frame * 0.2, facing: 1, seed: 1, frame }, camPos);
        for (let i = 0; i < 5; i++) {
          townsfolk[i].place(10.0 + i * 1.15, 0, 14.4 + (i % 2) * 0.8, { pose: "lookup", face: "lookup_shock", phase: frame * 0.2 + i, facing: i % 2 === 0 ? 1 : -1, seed: 50 + i, frame }, camPos);
        }
        for (let i = 0; i < 10; i++) {
          const ch = world.fallingChunks[i];
          ch.visible = true;
          const cyc = ((t * 1.6 + i * 0.14) % 1.0);
          ch.position.set(10.2 + (i % 5) * 1.1, lerp(11.5, 0.4, cyc), 12.2 + (i % 3) * 1.6);
          ch.rotation.set(frame * 0.25 + i, frame * 0.18, i);
        }
        break;
      }

      case "W21_blubber_raining_wide":
      case "W22_people_sprinting_cover": {
        world.whaleWhole.visible = false;
        world.whaleHalfRemaining.visible = true;
        world.blastCrater.visible = true;
        const runShift = shot.id === "W22_people_sprinting_cover" ? lerp(0, 6.0, t) : lerp(0, 3.0, t);
        for (let i = 0; i < 8; i++) {
          const px = 8.2 + (i % 4) * 1.7 + runShift;
          const pz = 12.5 + Math.floor(i / 4) * 2.2;
          townsfolk[i].place(px, 0, pz, { pose: "panic_cover_run", face: "panic", phase: frame * 0.72 + i * 0.9, facing: 1, seed: 60 + i, frame, jitter: 0.45 }, camPos);
        }
        thornton.place(10.8 + runShift, 0, 13.6, { pose: "panic_cover_run", face: "panic", phase: frame * 0.75, facing: 1, seed: 1, frame, jitter: 0.5 }, camPos);
        // Raining 3D chunks + wet splat bursts on sand!
        for (let i = 0; i < world.fallingChunks.length; i++) {
          const ch = world.fallingChunks[i];
          ch.visible = true;
          const cyc = ((frame * 0.036 + i * 0.19) % 1.0);
          ch.position.set(8.0 + (i % 6) * 2.2 + runShift * 0.4, lerp(13.0, 0.25, cyc * cyc), 11.5 + (i % 4) * 1.8);
          ch.rotation.set(frame * 0.28 + i, frame * 0.2, i);
        }
        for (let i = 0; i < 3; i++) {
          fxList[i].place(10.5 + i * 2.4 + runShift * 0.5, 0.55, 13.2 + (i % 2) * 1.6, 1.45, "blubber_splat", frame * 0.3 + i, camPos, 0.88);
        }
        break;
      }

      case "W23_nobody_got_hit": {
        townsfolk[0].place(14.0, 0, 14.0, { pose: "idle", face: "deadpan", phase: frame * 0.14, facing: 1, seed: 61, frame }, camPos);
        fxList[0].place(13.1, 0.55, 13.6, 1.4, "blubber_splat", frame * 0.2, camPos, 0.92);
        world.fallingChunks[0].visible = true;
        world.fallingChunks[0].position.set(13.1, 0.35, 13.6);
        break;
      }

      case "W24_shiny_brand_new_car": {
        // Gleaming untouched brand-new 1970 turquoise Oldsmobile!
        break;
      }

      case "W25_chunk_from_orbit": {
        // Giant 3-foot whale slab plummeting straight from orbit toward the roof!
        const sy = lerp(16.0, 3.8, t * t);
        world.oldsmobile.heroBlubberSlab.visible = true;
        world.oldsmobile.heroBlubberSlab.position.set(0, sy, -0.2);
        world.oldsmobile.heroBlubberSlab.rotation.set(frame * 0.22, frame * 0.18, 0.4);
        break;
      }

      case "W26_pancaked_oldsmobile": {
        // IMPACT AT f1841 ("pancaked")!
        const impactAge = frame - 1841;
        if (impactAge < 0) {
          const preT = (frame - 1835) / 6;
          world.oldsmobile.heroBlubberSlab.visible = true;
          world.oldsmobile.heroBlubberSlab.position.set(0, lerp(5.2, 1.9, Math.max(0, preT)), -0.2);
        } else {
          const crush = Math.min(1, impactAge / 4);
          applyCarCrush(crush, 1.45 - crush * 0.15);
          if (impactAge < 14) {
            fxList[0].place(200.0, 1.75, 0.2, 2.8, "bang", frame * 0.5, camPos, 0.95);
          }
          fxList[1].place(199.4, 1.15, 1.0, 2.2, "smoke", frame * 0.25, camPos, Math.max(0, 0.78 - impactAge * 0.015));
          fxList[2].place(200.8, 1.25, -0.4, 2.0, "smoke", frame * 0.25 + 1, camPos, Math.max(0, 0.75 - impactAge * 0.015));
        }
        break;
      }

      case "W27_veteran_car_keys":
      case "W28_whale_of_a_deal_cu": {
        applyCarCrush(1.0, 1.32);
        // ICONIC DEADPAN STARE: Walter Umenhofer holding his shiny car keys right next to his pancaked Oldsmobile!
        veteran.place(201.6, 0, 2.4, { pose: "hold_keys_deadpan", face: "deadpan", phase: frame * 0.15, facing: 1, seed: 2, frame }, camPos);
        break;
      }

      case "W29_seagulls_rage_quit": {
        world.whaleWhole.visible = false;
        world.whaleHalfRemaining.visible = true;
        world.blastCrater.visible = true;
        fxList[0].place(0.0, 2.4, 1.0, 2.6, "stink", frame * 0.25, camPos, 0.88);
        // 4 grumpy cartoon seagulls literally turning around & flapping furiously away!
        for (let i = 0; i < 4; i++) {
          const gx = lerp(-0.5 + i * 0.9, 6.5 + i * 1.4, t);
          const gy = 3.0 + (i % 2) * 1.0 + t * 2.2;
          const gz = 0.8 - i * 1.1 - t * 2.5;
          seagulls[i].place(gx, gy, gz, frame * 0.38 + i * 1.2, 1, camPos, 1.05);
        }
        break;
      }

      case "W30_half_whale_unmoved": {
        world.whaleWhole.visible = false;
        world.whaleHalfRemaining.visible = true;
        world.blastCrater.visible = true;
        fxList[0].place(0.0, 1.4, 2.4, 2.6, "smoke", frame * 0.18, camPos, 0.75);
        thornton.place(4.4, 0, 2.2, { pose: "idle", face: "deadpan", phase: frame * 0.14, facing: -1, seed: 1, frame }, camPos);
        break;
      }

      case "W31_bury_with_shovels": {
        world.whaleWhole.visible = false;
        world.whaleHalfRemaining.visible = true;
        world.blastCrater.visible = true;
        thornton.place(2.2, 0, 1.8, { pose: "shovel_dig", face: "grumpy", phase: frame * 0.42, facing: -1, seed: 1, frame }, camPos);
        workers[0].place(3.5, 0, 1.2, { pose: "shovel_dig", face: "grumpy", phase: frame * 0.4 + 1.5, facing: -1, seed: 31, frame }, camPos);
        workers[1].place(2.8, 0, -0.4, { pose: "shovel_dig", face: "grumpy", phase: frame * 0.44 + 3.0, facing: -1, seed: 32, frame }, camPos);
        break;
      }

      case "W32_memorial_park_sunset":
      case "W33_park_sign_finale": {
        // Golden sunset at Exploding Whale Memorial Park — peaceful smiling locals!
        townsfolk[0].place(397.6, 0, 1.8, { pose: "sit_bench", face: "cheer", phase: frame * 0.16, facing: 1, seed: 70, frame }, camPos);
        townsfolk[1].place(402.4, 0, 0.6, { pose: "cheer", face: "cheer", phase: frame * 0.25, facing: -1, seed: 71, frame }, camPos);
        seagulls[0].place(396 + t * 9, 6.8, -8.0, frame * 0.2, 1, camPos, 0.9);
        break;
      }
    }

    // Sight-line culler
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
        while (top.parent && !world.cullables.includes(top)) top = top.parent;
        if (world.cullables.includes(top)) top.visible = false;
      }
    }

    return {
      shot,
      focusDist: shot.focusDist ?? lookDist,
      focusRange: shot.focusRange ?? 3.4,
      cInf: shot.cInf,
      sat: preset.sat,
      goldenTint: shot.light === "golden" ? 1.0 : shot.light === "heat" ? 0.35 : 0.0,
    };
  }

  return { scene, camera, lightU, update };
}
