import * as THREE from "three";
import { SharedLightUniforms } from "../marathon/lights";
import { makeTwoToneMaterial, untone } from "../marathon/shade";
import { getPaintedTextures } from "../marathon/paint";
import { NOINK } from "../marathon/ink";

export interface OldsmobileRig {
  group: THREE.Group;
  cabin: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Mesh[];
  heroBlubberSlab: THREE.Mesh;
}

export interface WhaleWorldRefs {
  root: THREE.Group;
  cullables: THREE.Object3D[];
  whaleWhole: THREE.Group;
  whaleHalfRemaining: THREE.Group;
  blastCrater: THREE.Group;
  tntStack: THREE.Group;
  plungerHandle: THREE.Group;
  plungerBox: THREE.Group;
  fallingChunks: THREE.Mesh[];
  oceanSurf: THREE.Mesh;
  oldsmobile: OldsmobileRig;
}

function makePaintedSandTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#dec38f";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7070;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = ["#e6ce9c", "#cfb17c", "#d6ba84", "#c4a46d"][Math.floor(rng() * 4)];
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.roundRect(rng() * 512, rng() * 512, 24 + rng() * 64, 6 + rng() * 14, 5);
    ctx.fill();
  }
  // Soft wind-blown beach ripples
  ctx.strokeStyle = "rgba(130, 98, 56, 0.22)";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1;
  for (let y = 24; y < 512; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 10, 340, y - 10, 512, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.needsUpdate = true;
  return tex;
}

function makeOceanTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2d7ca3";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 16; y < 512; y += 36) {
    ctx.fillStyle = y % 72 === 0 ? "#4899bd" : "#246c91";
    ctx.fillRect(0, y, 512, 12);
  }
  // Crisp white wave crests
  ctx.fillStyle = "rgba(245, 250, 255, 0.52)";
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.roundRect((i * 113) % 440, (i * 67) % 480, 68, 7, 4);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 12);
  tex.needsUpdate = true;
  return tex;
}

function makeDeadEyeDecal(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "#1f1522";
  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(58, 58); ctx.lineTo(198, 198);
  ctx.moveTo(198, 58); ctx.lineTo(58, 198);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeParkCrestTex(): THREE.CanvasTexture {
  // Unlit painted wooden seaside sign with a happy little cartoon whale icon (no text!)
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#b8844c";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "#241726";
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 492, 236);
  // Comic explosion rays behind cute whale icon
  ctx.fillStyle = "#f2c84b";
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 105 : 68;
    const x = 256 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.stroke();
  // Cute whale silhouette icon
  ctx.fillStyle = "#4d6782";
  ctx.beginPath();
  ctx.ellipse(246, 138, 72, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(310, 136); ctx.lineTo(356, 102); ctx.lineTo(346, 146); ctx.lineTo(362, 168); ctx.lineTo(306, 152);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#241726";
  ctx.beginPath();
  ctx.arc(206, 128, 8, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makePineTree(lightU: SharedLightUniforms, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = makeTwoToneMaterial(lightU, { color: "#6e4b32" });
  const pineMat = makeTwoToneMaterial(lightU, { color: "#3d6e43", ambientBoost: 0.25 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 2.4, 7), trunkMat);
  trunk.position.y = 1.2;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0 - i * 0.42, 2.6 - i * 0.2, 8), pineMat);
    cone.position.y = 3.0 + i * 1.45;
    g.add(cone);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeCoastalHouse(lightU: SharedLightUniforms, color: string, h = 6.8): THREE.Group {
  const tex = getPaintedTextures();
  const g = new THREE.Group();
  const wallMat = makeTwoToneMaterial(lightU, { map: tex.creamPlaster, color });
  const roofMat = makeTwoToneMaterial(lightU, { map: tex.terracottaRoof, color: "#6a4c42" });
  const winMat = makeTwoToneMaterial(lightU, { map: tex.windowFacadeCream, color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.2, h, 5.2), [wallMat, wallMat, wallMat, wallMat, winMat, winMat]);
  body.position.y = h / 2;
  g.add(body);
  const rShape = new THREE.Shape();
  rShape.moveTo(-3.4, 0); rShape.lineTo(3.4, 0); rShape.lineTo(0, 2.0); rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: 5.8, bevelEnabled: false });
  rGeo.translate(0, 0, -2.9);
  const roof = new THREE.Mesh(rGeo, roofMat);
  roof.position.y = h;
  g.add(roof);
  return g;
}

/** Giant 45-foot 3D painted Sperm Whale beached on Florence sand! */
function makeSpermWhale(lightU: SharedLightUniforms, halfOnly = false): THREE.Group {
  const g = new THREE.Group();
  const whaleSkin = makeTwoToneMaterial(lightU, { color: "#68788a", softness: 0.24, ambientBoost: 0.14 });
  const bellyMat = makeTwoToneMaterial(lightU, { color: "#b5bcc2", softness: 0.24, ambientBoost: 0.14 });
  const pinkFlesh = makeTwoToneMaterial(lightU, { color: "#b86b72", ambientBoost: 0.16 });

  if (!halfOnly) {
    // Iconic massive boxy sperm whale head (z = +2.5 to +6.5)
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.75, 4.4), whaleSkin);
    head.position.set(0, 1.38, 3.6);
    g.add(head);
    const snoutRound = new THREE.Mesh(new THREE.SphereGeometry(1.85, 14, 12), whaleSkin);
    snoutRound.scale.set(0.95, 0.78, 1.15);
    snoutRound.position.set(0, 1.38, 5.2);
    g.add(snoutRound);
    // Lower jaw & pale belly
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 3.6), bellyMat);
    jaw.position.set(0, 0.42, 3.8);
    g.add(jaw);
    // Giant dead X-eye decals on both sides of head!
    const eyeMat = untone(lightU, { map: makeDeadEyeDecal(), transparent: true, alphaTest: 0.2 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), eyeMat);
      eye.position.set(sx * 1.74, 1.65, 3.4);
      eye.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      eye.layers.set(NOINK);
      g.add(eye);
    }
    // Mid torso
    const mid = new THREE.Mesh(new THREE.SphereGeometry(2.15, 14, 12), whaleSkin);
    mid.scale.set(0.92, 0.78, 1.85);
    mid.position.set(0, 1.32, 0.4);
    g.add(mid);
    // Side pectoral fins
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 1.1), whaleSkin);
      fin.position.set(sx * 2.1, 0.55, 1.2);
      fin.rotation.z = sx * -0.25;
      fin.rotation.y = sx * -0.35;
      g.add(fin);
    }
  } else {
    // Only the massive rear half that literally NEVER EVEN MOVED after the blast!
    const cutFace = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.35, 12), pinkFlesh);
    cutFace.rotation.x = Math.PI / 2;
    cutFace.position.set(0, 1.15, -1.6);
    g.add(cutFace);
  }

  // Rear tapering tail + wide iconic tail fluke (z = -2 to -6.8)
  const rear = new THREE.Mesh(new THREE.ConeGeometry(1.85, 5.2, 12), whaleSkin);
  rear.rotation.x = -Math.PI / 2;
  rear.scale.set(0.92, 1.0, 0.72);
  rear.position.set(0, 1.05, -4.0);
  g.add(rear);

  const fluke = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.32, 1.65), whaleSkin);
  fluke.position.set(0, 0.45, -6.5);
  fluke.rotation.x = 0.14;
  g.add(fluke);

  return g;
}

/** 1970 Turquoise Oldsmobile Hardtop Sedan with dynamic Roof-Pancake Crush Rig! */
function make1970Oldsmobile(lightU: SharedLightUniforms, bodyColor: string, includeHeroSlab = false): OldsmobileRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const cabin = new THREE.Group();
  group.add(body);
  body.add(cabin);

  const paint = makeTwoToneMaterial(lightU, { color: bodyColor });
  const roofMat = makeTwoToneMaterial(lightU, { color: "#f2ede2" });
  const glassMat = makeTwoToneMaterial(lightU, { color: "#3d5e7a" });
  const chromeMat = makeTwoToneMaterial(lightU, { color: "#dce4ed", ambientBoost: 0.25 });
  const tireMat = makeTwoToneMaterial(lightU, { color: "#26252b" });
  const whitewall = makeTwoToneMaterial(lightU, { color: "#f2efe6" });

  // Long sleek 1970 American land-yacht lower body
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 5.1), paint);
  lower.position.y = 0.78;
  body.add(lower);
  // Chrome bumpers & grille
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.24, 0.26), chromeMat);
  bumpF.position.set(0, 0.58, 2.62);
  const bumpR = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.24, 0.26), chromeMat);
  bumpR.position.set(0, 0.58, -2.62);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.34, 0.12), chromeMat);
  grille.position.set(0, 0.85, 2.54);
  body.add(bumpF, bumpR, grille);

  // Cabin (pivots at beltline y = 1.12 so scaling cabin.scale.y flattens the roof like a pancake!)
  cabin.position.set(0, 1.12, -0.22);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.62, 2.35), glassMat);
  glass.position.y = 0.31;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 2.25), roofMat);
  roof.position.y = 0.66;
  cabin.add(glass, roof);

  // 4 chunky whitewall wheels
  const wheels: THREE.Mesh[] = [];
  for (const [wx, wz] of [[-1.08, 1.55], [1.08, 1.55], [-1.08, -1.55], [1.08, -1.55]]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, 0.42, wz);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12), whitewall);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 10), chromeMat);
    tire.add(rim, hub);
    group.add(tire);
    wheels.push(tire);
  }

  // Hero 3-foot whale blubber slab that drops from orbit onto the Oldsmobile roof!
  const blubberMat = makeTwoToneMaterial(lightU, { color: "#b87a82", ambientBoost: 0.15 });
  const heroBlubberSlab = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), blubberMat);
  heroBlubberSlab.scale.set(1.35, 0.62, 1.15);
  heroBlubberSlab.visible = false;
  if (includeHeroSlab) group.add(heroBlubberSlab);

  return { group, cabin, body, wheels, heroBlubberSlab };
}

export function buildWhaleWorld(lightU: SharedLightUniforms): WhaleWorldRefs {
  const root = new THREE.Group();
  const cullables: THREE.Object3D[] = [];
  const tex = getPaintedTextures();
  const sandTex = makePaintedSandTex();
  const oceanTex = makeOceanTex();

  const sandMat = makeTwoToneMaterial(lightU, { map: sandTex, ambientBoost: 0.1 });
  const oceanMat = makeTwoToneMaterial(lightU, { map: oceanTex, ambientBoost: 0.15 });
  const foamMat = untone(lightU, { color: "#eef6fa" });
  const grassMat = makeTwoToneMaterial(lightU, { map: tex.grass, ambientBoost: 0.1 });
  const woodMat = makeTwoToneMaterial(lightU, { map: tex.woodDeck });
  const asphaltMat = makeTwoToneMaterial(lightU, { map: tex.asphaltRoad });
  const redTntMat = makeTwoToneMaterial(lightU, { color: "#c93b34" });
  const yellowTrimMat = makeTwoToneMaterial(lightU, { color: "#f0c23c" });
  const darkMetal = makeTwoToneMaterial(lightU, { color: "#32343c" });

  // =========================================================================
  // ZONE A (x = 0): FLORENCE BEACH + 45-FT SPERM WHALE + COASTAL TOWN
  // =========================================================================
  const zA = new THREE.Group();
  root.add(zA);

  // Golden beach sand (east) + Pacific ocean (west)
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(150, 170), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(28, 0, 0);
  zA.add(beach);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(140, 200), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-72, -0.05, 0);
  zA.add(ocean);

  const oceanSurf = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 180), foamMat);
  oceanSurf.rotation.x = -Math.PI / 2;
  oceanSurf.position.set(-12.5, 0.02, 0);
  oceanSurf.layers.set(NOINK);
  zA.add(oceanSurf);

  // Coastal grassy ridge & Florence seaside town houses + iconic Oregon lighthouse!
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(50, 3.2, 160), grassMat);
  ridge.position.set(42, 1.5, 0);
  zA.add(ridge);

  const townSpecs: [number, number, string, number][] = [
    [25, -24, "#e6d8be", 6.8],
    [26, -12, "#c98f63", 7.6],
    [25, 2, "#d4c8b2", 6.4],
    [27, 16, "#b86b58", 7.2],
    [25, 28, "#e3d6bf", 6.6],
  ];
  for (const [hx, hz, col, hh] of townSpecs) {
    const h = makeCoastalHouse(lightU, col, hh);
    h.position.set(hx, 3.0, hz);
    h.rotation.y = -Math.PI / 2;
    zA.add(h);
    cullables.push(h);
  }
  // Red-and-white Oregon Coastal Lighthouse on the northern bluff (-8, 0, -44)!
  const lh = new THREE.Group();
  lh.position.set(-6, 0, -44);
  const lhRock = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 9.0, 5.5, 10), makeTwoToneMaterial(lightU, { color: "#736e68" }));
  lhRock.position.y = 2.75;
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.0, 12.0, 12), makeTwoToneMaterial(lightU, { color: "#f2ece1" }));
  lhBase.position.y = 11.2;
  const lhStripe = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.78, 3.2, 12), redTntMat);
  lhStripe.position.y = 11.2;
  const lhLamp = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 10), untone(lightU, { color: "#fff0b0" }));
  lhLamp.position.y = 18.0;
  const lhCap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.0, 10), redTntMat);
  lhCap.position.y = 19.9;
  lh.add(lhRock, lhBase, lhStripe, lhLamp, lhCap);
  zA.add(lh);

  for (let i = 0; i < 12; i++) {
    const p = makePineTree(lightU, 1.1 + (i % 3) * 0.25);
    p.position.set(20 + (i % 2) * 5, 3.0, -34 + i * 6.5);
    zA.add(p);
    cullables.push(p);
  }

  // GIANT 45-FOOT SPERM WHALE (Whole & Half-Remaining rigs)
  const whaleWhole = makeSpermWhale(lightU, false);
  whaleWhole.position.set(0, 0, 0);
  zA.add(whaleWhole);

  const whaleHalfRemaining = makeSpermWhale(lightU, true);
  whaleHalfRemaining.position.set(0, 0, 0);
  whaleHalfRemaining.visible = false;
  zA.add(whaleHalfRemaining);

  // Smoking blast crater in sand (shown after explosion!)
  const blastCrater = new THREE.Group();
  const craterRim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.65, 8, 16), sandMat);
  craterRim.rotation.x = Math.PI / 2;
  craterRim.position.set(0, 0.22, 2.6);
  const craterDark = new THREE.Mesh(new THREE.CircleGeometry(2.8, 16), makeTwoToneMaterial(lightU, { color: "#4a3b2c" }));
  craterDark.rotation.x = -Math.PI / 2;
  craterDark.position.set(0, 0.05, 2.6);
  blastCrater.add(craterRim, craterDark);
  blastCrater.visible = false;
  zA.add(blastCrater);

  // 20 STACKED RED DYNAMITE CRATES tucked neatly right beside/under the whale!
  const tntStack = new THREE.Group();
  tntStack.position.set(2.35, 0, 2.6);
  let idx = 0;
  for (let layer = 0; layer < 3; layer++) {
    const cols = 4 - layer;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= 20) break;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.48, 0.54), redTntMat);
        crate.position.set((c - cols / 2 + 0.5) * 0.72, 0.24 + layer * 0.49, (r - 0.5) * 0.6);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.56), yellowTrimMat);
        crate.add(band);
        tntStack.add(crate);
        idx++;
      }
    }
  }
  tntStack.visible = false;
  zA.add(tntStack);

  // RED TNT PLUNGER BOX at (12, 0, 14) with animated slamming T-handle!
  const plungerBox = new THREE.Group();
  plungerBox.position.set(12, 0, 14);
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.65), redTntMat);
  pBody.position.y = 0.425;
  plungerBox.add(pBody);

  const plungerHandle = new THREE.Group();
  plungerHandle.position.set(0, 0.85, 0);
  const pRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), darkMetal);
  pRod.position.y = 0.38;
  const pTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.14), yellowTrimMat);
  pTop.position.y = 0.75;
  plungerHandle.add(pRod, pTop);
  plungerBox.add(plungerHandle);
  zA.add(plungerBox);

  // 14 Animated 3D Tumbling Whale Blubber Chunks for sky rain!
  const fallingChunks: THREE.Mesh[] = [];
  const chunkMat = makeTwoToneMaterial(lightU, { color: "#b87a82", ambientBoost: 0.14 });
  for (let i = 0; i < 14; i++) {
    const ch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + (i % 3) * 0.18, 0), chunkMat);
    ch.scale.set(1.2, 0.72, 1.0);
    ch.visible = false;
    root.add(ch);
    fallingChunks.push(ch);
  }

  // =========================================================================
  // ZONE B (x = 200): QUARTER-MILE PARKING LOT + BRAND-NEW 1970 OLDSMOBILE!
  // =========================================================================
  const zB = new THREE.Group();
  zB.position.set(200, 0, 0);
  root.add(zB);

  const lot = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), asphaltMat);
  lot.rotation.x = -Math.PI / 2;
  zB.add(lot);
  const lotOcean = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), oceanMat);
  lotOcean.rotation.x = -Math.PI / 2;
  lotOcean.position.set(-70, -0.1, 0);
  zB.add(lotOcean);
  const lotSand = new THREE.Mesh(new THREE.PlaneGeometry(30, 140), sandMat);
  lotSand.rotation.x = -Math.PI / 2;
  lotSand.position.set(-22, -0.04, 0);
  zB.add(lotSand);

  // Wooden coastal parking bollards separating lot from beach
  for (let bz = -18; bz <= 18; bz += 3.6) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.95, 8), woodMat);
    post.position.set(-8.5, 0.47, bz);
    zB.add(post);
  }
  // Background seaside shops & pine trees
  const diner = makeCoastalHouse(lightU, "#e6d8bd", 6.8);
  diner.position.set(16, 0, -10);
  diner.rotation.y = -Math.PI / 2;
  zB.add(diner);
  for (let i = 0; i < 5; i++) {
    const pt = makePineTree(lightU, 1.15);
    pt.position.set(14, 0, -24 + i * 12);
    zB.add(pt);
    cullables.push(pt);
  }

  // Two background parked 1970 cars
  const bgCar1 = make1970Oldsmobile(lightU, "#b84f44", false);
  bgCar1.group.position.set(4.5, 0, -8.5);
  bgCar1.group.rotation.y = Math.PI / 2;
  zB.add(bgCar1.group);
  const bgCar2 = make1970Oldsmobile(lightU, "#d9a94c", false);
  bgCar2.group.position.set(4.5, 0, 8.5);
  bgCar2.group.rotation.y = Math.PI / 2;
  zB.add(bgCar2.group);

  // HERO SHINY TURQUOISE-BLUE 1970 OLDSMOBILE at (200, 0, 0)!
  const oldsmobile = make1970Oldsmobile(lightU, "#3ba3b8", true);
  oldsmobile.group.position.set(200, 0, 0);
  oldsmobile.group.rotation.y = Math.PI * 0.28;
  root.add(oldsmobile.group);

  // =========================================================================
  // ZONE C (x = 400): GOLDEN-HOUR "EXPLODING WHALE MEMORIAL PARK"
  // =========================================================================
  const zC = new THREE.Group();
  zC.position.set(400, 0, 0);
  root.add(zC);

  const parkGrass = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), grassMat);
  parkGrass.rotation.x = -Math.PI / 2;
  zC.add(parkGrass);
  const parkOcean = new THREE.Mesh(new THREE.PlaneGeometry(140, 160), oceanMat);
  parkOcean.rotation.x = -Math.PI / 2;
  parkOcean.position.set(-20, -0.2, -62);
  zC.add(parkOcean);

  // Charming wooden park archway with cute unlit Exploding Whale icon crest!
  for (const sx of [-3.2, 3.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.6, 0.42), woodMat);
    post.position.set(sx, 2.3, -2.5);
    zC.add(post);
  }
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.55, 0.52), woodMat);
  archTop.position.set(0, 4.7, -2.5);
  zC.add(archTop);
  const crestSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.7),
    untone(lightU, { map: makeParkCrestTex() })
  );
  crestSign.position.set(0, 4.75, -2.18);
  crestSign.layers.set(NOINK);
  zC.add(crestSign);

  // Wooden park bench & coastal pines framing the sunset!
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.8), woodMat);
  benchSeat.position.set(-2.4, 0.55, 1.8);
  const benchBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 0.14), woodMat);
  benchBack.position.set(-2.4, 0.95, 1.45);
  zC.add(benchSeat, benchBack);

  for (const [px, pz] of [[-7.5, -6], [7.5, -6], [-11, -14], [11, -14], [-9, 4], [9, 4]]) {
    const pt = makePineTree(lightU, 1.25);
    pt.position.set(px, 0, pz);
    zC.add(pt);
    cullables.push(pt);
  }

  return {
    root,
    cullables,
    whaleWhole,
    whaleHalfRemaining,
    blastCrater,
    tntStack,
    plungerHandle,
    plungerBox,
    fallingChunks,
    oceanSurf,
    oldsmobile,
  };
}
