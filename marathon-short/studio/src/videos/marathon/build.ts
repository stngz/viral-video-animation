import * as THREE from "three";
import { SharedLightUniforms } from "./lights";
import { makeTwoToneMaterial, untone } from "./shade";
import { getPaintedTextures, PaintedTextures } from "./paint";
import { NOINK } from "./ink";

export interface TouringCarRig {
  group: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Mesh[];
  hood?: THREE.Mesh;
  radiatorCap?: THREE.Mesh;
}

export interface WorldRefs {
  root: THREE.Group;
  /** Objects that may be temporarily hidden if they intersect the camera sight-line */
  cullables: THREE.Object3D[];
  /** Animated 3D rigs */
  officialCar: TouringCarRig;
  lorzCar: TouringCarRig;
  jalopyCar: TouringCarRig;
  finishTapeL: THREE.Mesh;
  finishTapeR: THREE.Mesh;
  clockHandHour: THREE.Mesh;
  clockHandMin: THREE.Mesh;
  wellDrop: THREE.Mesh;
  wellBucket: THREE.Group;
  flags: THREE.Mesh[];
  /** Ground height lookup for any world (x, z) so feet stay strictly planted! */
  groundY: (x: number, z: number) => number;
}

/** Deterministic PRNG */
function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth hill elevation for the Missouri clay road zone (X near 200) and jalopy hill (X near 1000) */
export function computeGroundY(x: number, z: number): number {
  // Zone B: Missouri dusty hills (centered around x = 200)
  if (Math.abs(x - 200) < 95) {
    return Math.sin(z * 0.065) * 1.65 + Math.cos(z * 0.032) * 0.85;
  }
  // Zone F: Steep overheating hill (centered around x = 1000)
  if (Math.abs(x - 1000) < 70) {
    return Math.max(-2, -z * 0.16);
  }
  return 0;
}

/** Painted house with plinth, cornice, roof, chimney + pot (heights 7 / 8.4 / 9.8 m per SKILL.md) */
function makePaintedHouse(
  lightU: SharedLightUniforms,
  tex: PaintedTextures,
  style: "brick" | "cream" | "ochre",
  heightM: 7 | 8.4 | 9.8
): THREE.Group {
  const g = new THREE.Group();
  const w = 6.4;
  const d = 5.4;
  const facadeMap =
    style === "brick"
      ? tex.windowFacadeBrick
      : style === "cream"
        ? tex.windowFacadeCream
        : tex.windowFacadeOchre;
  const wallSideMap =
    style === "brick"
      ? tex.brickWall
      : style === "cream"
        ? tex.creamPlaster
        : tex.ochrePlaster;

  const frontMat = makeTwoToneMaterial(lightU, { map: facadeMap });
  const sideMat = makeTwoToneMaterial(lightU, { map: wallSideMap });
  const roofMat = makeTwoToneMaterial(lightU, { map: tex.terracottaRoof });
  const trimMat = makeTwoToneMaterial(lightU, { color: "#ded4c2" });
  const plinthMat = makeTwoToneMaterial(lightU, { color: "#80776b" });
  const ironMat = makeTwoToneMaterial(lightU, { color: "#38363a" });

  // Stone plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.9, d + 0.3), plinthMat);
  plinth.position.y = 0.45;
  g.add(plinth);

  // Main house body (front & back have painted windows/doors)
  const bodyH = heightM - 2.3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), [
    sideMat,
    sideMat,
    trimMat,
    trimMat,
    frontMat,
    frontMat,
  ]);
  body.position.y = 0.9 + bodyH / 2;
  g.add(body);

  // Cornice band
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, 0.35, d + 0.45), trimMat);
  cornice.position.y = 0.9 + bodyH + 0.14;
  g.add(cornice);

  // Pitched roof prism
  const roofH = 2.1;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-w * 0.56, 0);
  roofShape.lineTo(w * 0.56, 0);
  roofShape.lineTo(0, roofH);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: d + 0.65,
    bevelEnabled: false,
  });
  roofGeo.translate(0, 0, -(d + 0.65) / 2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.9 + bodyH + 0.25;
  g.add(roof);

  // Chimney + terracotta pot
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), sideMat);
  chim.position.set(w * 0.26, 0.9 + bodyH + 1.4, -d * 0.16);
  g.add(chim);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.55, 8), ironMat);
  pot.position.set(w * 0.26, 0.9 + bodyH + 2.75, -d * 0.16);
  g.add(pot);

  return g;
}

/** Painted storybook 3D tree (with optional red/green orchard apples!) */
function makeTree(
  lightU: SharedLightUniforms,
  tex: PaintedTextures,
  scale = 1.0,
  withApples = false,
  seed = 1
): THREE.Group {
  const g = new THREE.Group();
  const rng = rngFrom(seed);
  const barkMat = makeTwoToneMaterial(lightU, { map: tex.bark });
  const leafMat = makeTwoToneMaterial(lightU, {
    map: tex.foliage,
    color: withApples ? "#659c44" : "#70a24b",
    softness: 0.28,
    ambientBoost: 0.28,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 3.0, 7), barkMat);
  trunk.position.y = 1.5;
  g.add(trunk);

  const puffs = [
    [0, 3.8, 0, 1.85],
    [-1.1, 3.3, 0.5, 1.35],
    [1.15, 3.4, -0.4, 1.4],
    [0.2, 4.7, 0.3, 1.25],
    [-0.5, 3.5, -0.9, 1.2],
  ];
  for (const [px, py, pz, r] of puffs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
    m.position.set(px, py, pz);
    m.scale.set(1.05, 0.88, 1.02);
    g.add(m);
  }

  if (withApples) {
    const greenMat = makeTwoToneMaterial(lightU, { color: "#8cc441" });
    const redMat = makeTwoToneMaterial(lightU, { color: "#c9433b" });
    for (let i = 0; i < 11; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1.15 + rng() * 0.75;
      const ay = 2.75 + rng() * 1.45;
      const apple = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        i % 3 === 0 ? redMat : greenMat
      );
      apple.position.set(Math.cos(a) * r, ay, Math.sin(a) * r);
      g.add(apple);
    }
  }

  g.scale.setScalar(scale);
  return g;
}

/** Wooden split-rail fence segment (low 0.95m so it never cuts across chests!) */
function makeFenceSegment(lightU: SharedLightUniforms, tex: PaintedTextures, len = 4.2): THREE.Group {
  const g = new THREE.Group();
  const wood = makeTwoToneMaterial(lightU, { map: tex.woodDeck, color: "#b68854" });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), wood);
  p1.position.set(-len / 2, 0.52, 0);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), wood);
  p2.position.set(len / 2, 0.52, 0);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.11, 0.08), wood);
  r1.position.set(0, 0.84, 0);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.11, 0.08), wood);
  r2.position.set(0, 0.48, 0);
  g.add(p1, p2, r1, r2);
  return g;
}

/**
 * Animated 3D 1904 Open-Top Brass Touring Car!
 * Used for officials' dust cars, Fred Lorz's joyride car, AND the overheating red jalopy!
 */
function make1904TouringCar(
  lightU: SharedLightUniforms,
  bodyColor: string,
  includePopCap = false
): TouringCarRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paintMat = makeTwoToneMaterial(lightU, { color: bodyColor });
  const darkMat = makeTwoToneMaterial(lightU, { color: "#323036" });
  const leatherMat = makeTwoToneMaterial(lightU, { color: "#6e4028" });
  const brassMat = makeTwoToneMaterial(lightU, {
    color: "#e6be53",
    emissive: "#553b08",
    emissiveIntensity: 0.25,
  });
  const spokeMat = makeTwoToneMaterial(lightU, { color: "#c29354" });

  // Chassis frame & running boards
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.24, 3.8), darkMat);
  chassis.position.y = 0.62;
  body.add(chassis);

  // Engine hood front
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.82, 1.45), paintMat);
  hood.position.set(0, 1.12, 1.05);
  body.add(hood);

  // Brass radiator grille front
  const rad = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.86, 0.2), brassMat);
  rad.position.set(0, 1.12, 1.82);
  body.add(rad);

  // Brass radiator cap (animates popping skyward in the overheating analogy!)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.18, 10), brassMat);
  cap.position.set(0, 1.64, 1.82);
  body.add(cap);

  // Brass round headlights
  for (const sx of [-0.52, 0.52]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 10), brassMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(sx, 1.15, 1.98);
    body.add(lamp);
  }

  // Open cabin tub & leather bench seats
  const tubBack = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.92, 0.24), paintMat);
  tubBack.position.set(0, 1.18, -1.68);
  body.add(tubBack);
  for (const sx of [-0.78, 0.78]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 2.05), paintMat);
    side.position.set(sx, 1.08, -0.68);
    body.add(side);
  }
  const seatRear = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.45, 0.65), leatherMat);
  seatRear.position.set(0, 1.1, -1.25);
  body.add(seatRear);
  const seatFront = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.42, 0.55), leatherMat);
  seatFront.position.set(0, 1.04, -0.2);
  body.add(seatFront);

  // Steering column & brass wheel
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 6), darkMat);
  col.position.set(-0.38, 1.48, 0.16);
  col.rotation.x = -0.58;
  body.add(col);
  const swheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 14), brassMat);
  swheel.position.set(-0.38, 1.82, -0.06);
  swheel.rotation.x = 0.95;
  body.add(swheel);

  // Curved fenders over wheels
  for (const sx of [-0.94, 0.94]) {
    for (const sz of [-1.25, 1.25]) {
      const fend = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.96), darkMat);
      fend.position.set(sx, 1.14, sz);
      body.add(fend);
    }
  }

  // 4 chunky vintage spoked wheels
  const wheels: THREE.Mesh[] = [];
  const wheelCoords: [number, number, number][] = [
    [-0.96, 0.52, 1.25],
    [0.96, 0.52, 1.25],
    [-0.96, 0.52, -1.25],
    [0.96, 0.52, -1.25],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.24, 14), darkMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, wy, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.27, 10), spokeMat);
    tire.add(hub);
    const spokeA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.72), brassMat);
    const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.08), brassMat);
    tire.add(spokeA, spokeB);
    group.add(tire);
    wheels.push(tire);
  }

  return {
    group,
    body,
    wheels,
    hood: includePopCap ? hood : undefined,
    radiatorCap: includePopCap ? cap : undefined,
  };
}

/** Build all 6 richly painted 3D world zones! */
export function buildMarathonWorld(lightU: SharedLightUniforms): WorldRefs {
  const root = new THREE.Group();
  const tex = getPaintedTextures();
  const cullables: THREE.Object3D[] = [];
  const flags: THREE.Mesh[] = [];

  const grassMat = makeTwoToneMaterial(lightU, { map: tex.grass, ambientBoost: 0.08 });
  const cinderMat = makeTwoToneMaterial(lightU, { map: tex.cinderTrack, ambientBoost: 0.06 });
  const dirtMat = makeTwoToneMaterial(lightU, { map: tex.dirtRoad, ambientBoost: 0.06 });
  const woodMat = makeTwoToneMaterial(lightU, { map: tex.woodDeck });
  const creamMat = makeTwoToneMaterial(lightU, { map: tex.creamPlaster });
  const standFrontMat = makeTwoToneMaterial(lightU, { map: tex.grandstandFront });
  const roofMat = makeTwoToneMaterial(lightU, { map: tex.terracottaRoof });
  const buntingMat = untone(lightU, { map: tex.bunting, transparent: true, alphaTest: 0.3 });
  const flagMat = untone(lightU, { map: tex.usFlag1904 });
  const clockMat = untone(lightU, { map: tex.stadiumClock });
  const whiteTapeMat = untone(lightU, { color: "#faf6ec" });
  const stoneMat = makeTwoToneMaterial(lightU, { map: tex.stoneWell });
  const asphaltMat = makeTwoToneMaterial(lightU, { map: tex.asphaltRoad });

  // =========================================================================
  // ZONE A (x = 0): FRANCIS FIELD 1904 STADIUM (Start / Finish / Climax / Twist)
  // =========================================================================
  {
    const zA = new THREE.Group();
    root.add(zA);

    // Wide painted green meadow & stadium infield
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    zA.add(ground);

    // Straight cinder running track running along Z (-65 to +65)
    const track = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 130), cinderMat);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    zA.add(track);

    // Tiered Wooden Olympic Grandstands tucked cleanly along track edges (x = +/-9.6)
    for (const side of [-1, 1]) {
      const stand = new THREE.Group();
      stand.position.set(side * 9.6, 0, -4);
      // Lower painted fascia
      const base = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 46), standFrontMat);
      base.position.set(side * 2.2, 1.1, 0);
      stand.add(base);
      // 4 stepped wooden bleacher rows
      for (let r = 0; r < 4; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 45), woodMat);
        step.position.set(side * (0.4 + r * 1.25), 2.3 + r * 0.78, 0);
        stand.add(step);
      }
      // Tall roof canopy supported on timber columns
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.45, 47), roofMat);
      canopy.position.set(side * 2.6, 8.6, 0);
      canopy.rotation.z = side * -0.14;
      stand.add(canopy);

      // Patriotic red-white-blue bunting on NOINK layer so transparent quad edges never get outlined!
      const bunt = new THREE.Mesh(new THREE.PlaneGeometry(45, 1.35), buntingMat);
      bunt.position.set(side * -0.95, 7.65, 0);
      bunt.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      bunt.layers.set(NOINK);
      stand.add(bunt);

      for (let pz = -20; pz <= 20; pz += 10) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.4, 0.32), creamMat);
        col.position.set(side * -0.5, 5.2, pz);
        stand.add(col);
      }

      // 3 waving period 1904 US flags along roof ridge
      for (const fz of [-16, 0, 16]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), creamMat);
        pole.position.set(side * 1.2, 10.6, fz);
        stand.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.15), flagMat);
        flag.position.set(side * 1.2 + 1.05, 11.7, fz);
        flag.layers.set(NOINK);
        stand.add(flag);
        flags.push(flag);
      }
      zA.add(stand);
    }

    // Iconic Start / Finish Archway at z = 0
    for (const sx of [-6.2, 6.2]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 6.8, 0.85), creamMat);
      pillar.position.set(sx, 3.4, 0);
      zA.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 1.15), roofMat);
      cap.position.set(sx, 6.95, 0);
      zA.add(cap);
    }
    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(13.4, 1.25, 0.9), standFrontMat);
    archBeam.position.set(0, 6.2, 0);
    zA.add(archBeam);
    const archBunt = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 1.1), buntingMat);
    archBunt.position.set(0, 5.15, 0.5);
    archBunt.layers.set(NOINK);
    zA.add(archBunt);

    // Giant Vintage Wooden Stadium Clock Tower centered majestically at the north end (x = 0, z = -34) — ZERO grandstand overlap!
    const tower = new THREE.Group();
    tower.position.set(0, 0, -34);
    const tBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 12.5, 4.8),
      makeTwoToneMaterial(lightU, { map: tex.brickWall })
    );
    tBody.position.y = 6.25;
    tower.add(tBody);
    const tRoof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 4.2, 4), roofMat);
    tRoof.rotation.y = Math.PI / 4;
    tRoof.position.y = 14.6;
    tower.add(tRoof);

    // Unlit readable vintage clock face (NO numbers/text, crisp radial ticks!)
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(1.85, 24), clockMat);
    clockFace.position.set(0, 9.5, 2.45);
    tower.add(clockFace);
    zA.add(tower);

    // Background St. Louis 1904 brick & cream pavilions framing the stadium end & horizon (never on track!)
    const housePlacements: [number, number, "brick" | "cream" | "ochre", 7 | 8.4 | 9.8, number][] = [
      [0, -48, "cream", 9.8, 0.0],
      [-11, -46, "brick", 8.4, 0.12],
      [11, -46, "ochre", 8.4, -0.12],
      [-24, -36, "cream", 8.4, 0.25],
      [22, -36, "brick", 9.8, -0.2],
      [-26, 26, "ochre", 8.4, 0.5],
      [26, 28, "cream", 7, -0.4],
    ];
    for (const [hx, hz, st, hh, ry] of housePlacements) {
      const h = makePaintedHouse(lightU, tex, st, hh);
      h.position.set(hx, 0, hz);
      h.rotation.y = ry;
      zA.add(h);
      cullables.push(h);
    }
    // Perimeter lush oak trees strictly OUTSIDE the running track corridor (|x| > 15 or z < -42)
    const stadiumTrees: [number, number][] = [
      [-19, -36], [19, -36], [-22, -20], [22, -20],
      [-20, 12], [20, 12], [-18, -44], [18, -44],
      [-6.5, -52], [6.5, -52], [-28, -5], [28, -5],
    ];
    stadiumTrees.forEach(([tx, tz], i) => {
      const tr = makeTree(lightU, tex, 1.2 + (i % 3) * 0.2, false, 100 + i);
      tr.position.set(tx, 0, tz);
      zA.add(tr);
      cullables.push(tr);
    });

    // Wooden Committee Desk tucked cleanly on stadium east lawn (x = 34, z = 0) at waist height (0.86m)
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.86, 1.4), woodMat);
    desk.position.set(34, 0.43, 0);
    zA.add(desk);
    const deskBackdrop = makePaintedHouse(lightU, tex, "brick", 9.8);
    deskBackdrop.position.set(34, 0, -10);
    zA.add(deskBackdrop);
  }

  // Finish tape ribbon halves at z = 0 (attached to arch pillars; snaps open dynamically!)
  const tapeGeoL = new THREE.PlaneGeometry(6.1, 0.24);
  tapeGeoL.translate(3.05, 0, 0);
  const finishTapeL = new THREE.Mesh(tapeGeoL, whiteTapeMat);
  finishTapeL.position.set(-6.1, 1.15, 0.05);
  root.add(finishTapeL);

  const tapeGeoR = new THREE.PlaneGeometry(6.1, 0.24);
  tapeGeoR.translate(-3.05, 0, 0);
  const finishTapeR = new THREE.Mesh(tapeGeoR, whiteTapeMat);
  finishTapeR.position.set(6.1, 1.15, 0.05);
  root.add(finishTapeR);

  // Clock hands anchored at (0, 9.5, -31.45) matching moved clock tower!
  const handMat = untone(lightU, { color: "#1c1520" });
  const hGeo = new THREE.BoxGeometry(0.16, 1.05, 0.06);
  hGeo.translate(0, 0.45, 0);
  const clockHandHour = new THREE.Mesh(hGeo, handMat);
  clockHandHour.position.set(0, 9.5, -31.46);
  root.add(clockHandHour);

  const mGeo = new THREE.BoxGeometry(0.11, 1.48, 0.06);
  mGeo.translate(0, 0.65, 0);
  const clockHandMin = new THREE.Mesh(mGeo, handMat);
  clockHandMin.position.set(0, 9.5, -31.42);
  root.add(clockHandMin);

  // =========================================================================
  // ZONE B (x = 200): STEEP HILLY MISSOURI RED-CLAY ROAD (Dust, Cars, Lorz, Hicks)
  // =========================================================================
  {
    const zB = new THREE.Group();
    root.add(zB);

    // Rolling 3D hilly terrain mesh matching computeGroundY(x, z)!
    const terrainGeo = new THREE.PlaneGeometry(150, 180, 48, 72);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + 200;
      const vz = posAttr.getZ(i);
      const roadH = computeGroundY(vx, vz);
      // Gentle rolling pasture hills rising on the sides of the road
      const distRoad = Math.max(0, Math.abs(vx - 200) - 5.5);
      const sideHill = Math.min(7.5, distRoad * 0.14) * (0.65 + 0.35 * Math.sin(vz * 0.08 + vx * 0.05));
      posAttr.setY(i, roadH + sideHill - 0.05);
    }
    terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeo, grassMat);
    terrain.position.set(200, 0, 0);
    zB.add(terrain);

    // Rolling red-ochre dusty clay road ribbon hugging computeGroundY(200, z)
    const roadGeo = new THREE.PlaneGeometry(9.6, 175, 8, 84);
    roadGeo.rotateX(-Math.PI / 2);
    const rPos = roadGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rz = rPos.getZ(i);
      rPos.setY(i, computeGroundY(200, rz) + 0.04);
    }
    roadGeo.computeVertexNormals();
    const road = new THREE.Mesh(roadGeo, dirtMat);
    road.position.set(200, 0, 0);
    zB.add(road);

    // Split-rail wooden fences & telegraph poles along both sides of the hilly road
    for (let fz = -72; fz <= 72; fz += 4.6) {
      const gy = computeGroundY(200, fz);
      for (const side of [-1, 1]) {
        const seg = makeFenceSegment(lightU, tex, 4.6);
        seg.position.set(200 + side * 5.6, gy, fz);
        seg.rotation.y = Math.PI / 2;
        zB.add(seg);
      }
      if (Math.abs(fz) % 18 < 4.6) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 6.8, 6), woodMat);
        pole.position.set(200 - 7.4, gy + 3.4, fz);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), woodMat);
        cross.position.y = 2.7;
        pole.add(cross);
        zB.add(pole);
        cullables.push(pole);
      }
    }

    // Classic painted Missouri farmhouses & oak trees dotting the hillside
    const bHouses: [number, number, "brick" | "cream" | "ochre", 7 | 8.4 | 9.8, number][] = [
      [182, -32, "cream", 7, 1.35],
      [218, -14, "brick", 8.4, -1.4],
      [183, 18, "ochre", 7, 1.2],
      [219, 34, "cream", 8.4, -1.2],
    ];
    for (const [hx, hz, st, hh, ry] of bHouses) {
      const h = makePaintedHouse(lightU, tex, st, hh);
      h.position.set(hx, computeGroundY(hx, hz) + 1.2, hz);
      h.rotation.y = ry;
      zB.add(h);
      cullables.push(h);
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tx = 200 + side * (11 + (i % 4) * 5);
      const tz = -65 + i * 9;
      const tr = makeTree(lightU, tex, 1.1 + (i % 3) * 0.22, false, 200 + i);
      tr.position.set(tx, computeGroundY(tx, tz) + 0.6, tz);
      zB.add(tr);
      cullables.push(tr);
    }
  }

  // Animated 1904 cars placed in Zone B
  const officialCar = make1904TouringCar(lightU, "#2f4763");
  officialCar.group.position.set(200, 0, -10);
  root.add(officialCar.group);

  const lorzCar = make1904TouringCar(lightU, "#56704b");
  lorzCar.group.position.set(200, 0, 22);
  root.add(lorzCar.group);

  // =========================================================================
  // ZONE C (x = 400): THE LONE ROADSIDE WATER WELL (Dehydration Experiment)
  // =========================================================================
  let wellDrop: THREE.Mesh;
  let wellBucket: THREE.Group;
  {
    const zC = new THREE.Group();
    zC.position.set(400, 0, 0);
    root.add(zC);

    const dryGround = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      makeTwoToneMaterial(lightU, { map: tex.dirtRoad, color: "#cfa376" })
    );
    dryGround.rotation.x = -Math.PI / 2;
    zC.add(dryGround);

    // Stone wishing well at (400, 0, 0)
    const wellRing = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.22, 1.15, 14), stoneMat);
    wellRing.position.y = 0.58;
    zC.add(wellRing);
    const wellDark = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.92, 0.2, 12),
      makeTwoToneMaterial(lightU, { color: "#282220" })
    );
    wellDark.position.y = 1.08;
    zC.add(wellDark);
    for (const sx of [-1.05, 1.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), woodMat);
      post.position.set(sx, 2.1, 0);
      zC.add(post);
    }
    const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.25, 4), roofMat);
    wellRoof.rotation.y = Math.PI / 4;
    wellRoof.position.y = 3.55;
    zC.add(wellRoof);

    // Dangling wooden bucket & ONE sad solitary animated blue droplet!
    wellBucket = new THREE.Group();
    wellBucket.position.set(0, 2.15, 0);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), woodMat);
    rope.position.y = 0.5;
    const buck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.45, 10), woodMat);
    wellBucket.add(rope, buck);
    zC.add(wellBucket);

    wellDrop = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      untone(lightU, { color: "#6ec9ff" })
    );
    wellDrop.scale.set(0.85, 1.45, 0.85);
    wellDrop.position.set(400, 1.8, 0);
    root.add(wellDrop);

    // Sparse dry wooden fence & distant sun-baked barn
    for (let fx = -16; fx <= 16; fx += 4.5) {
      const seg = makeFenceSegment(lightU, tex, 4.5);
      seg.position.set(fx, 0, -6.5);
      zC.add(seg);
    }
    const barn = makePaintedHouse(lightU, tex, "brick", 8.4);
    barn.position.set(-14, 0, -18);
    barn.rotation.y = 0.35;
    zC.add(barn);
  }

  // =========================================================================
  // ZONE D (x = 600): THE APPLE ORCHARD (Félix Carvajal apples & roadside nap)
  // =========================================================================
  {
    const zD = new THREE.Group();
    zD.position.set(600, 0, 0);
    root.add(zD);

    const gD = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), grassMat);
    gD.rotation.x = -Math.PI / 2;
    zD.add(gD);

    const roadD = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 120), dirtMat);
    roadD.rotation.x = -Math.PI / 2;
    roadD.position.set(-6.5, 0.03, 0);
    zD.add(roadD);

    // Picket / wooden fence separating road from lush orchard
    for (let fz = -24; fz <= 24; fz += 4.2) {
      const seg = makeFenceSegment(lightU, tex, 4.2);
      seg.position.set(-2.2, 0, fz);
      seg.rotation.y = Math.PI / 2;
      zD.add(seg);
    }

    // Lush rows of apple-laden trees!
    const appleCoords: [number, number][] = [
      [2.8, -1.8],
      [7.2, -6.5],
      [3.5, -11.5],
      [9.5, 3.2],
      [4.0, 9.0],
      [11.0, -13.0],
      [-12.5, -8.0],
    ];
    appleCoords.forEach(([tx, tz], idx) => {
      const tr = makeTree(lightU, tex, 1.15 + (idx % 2) * 0.18, true, 400 + idx);
      tr.position.set(tx, 0, tz);
      zD.add(tr);
      if (idx > 0) cullables.push(tr);
    });

    // Small natural fallen green apples scattered outside Félix's nap spot (never blocking his face!)
    const greenAppMat = makeTwoToneMaterial(lightU, { color: "#88c23c" });
    const fallenSpots: [number, number][] = [
      [3.2, -0.3], [3.8, -1.8], [2.9, -2.7], [0.4, -2.5], [1.6, -2.9], [4.1, 0.2], [0.1, -0.4], [3.5, -2.4],
    ];
    for (const [ax, az] of fallenSpots) {
      const app = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), greenAppMat);
      app.position.set(ax, 0.09, az);
      zD.add(app);
    }
  }

  // =========================================================================
  // ZONE E (x = 800): WILD DOG COUNTRY TURNOUT (Len Taunyane chase!)
  // =========================================================================
  {
    const zE = new THREE.Group();
    zE.position.set(800, 0, 0);
    root.add(zE);

    const gE = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), grassMat);
    gE.rotation.x = -Math.PI / 2;
    zE.add(gE);

    const roadE = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 120), dirtMat);
    roadE.rotation.x = -Math.PI / 2;
    roadE.position.y = 0.03;
    zE.add(roadE);

    // Side pasture fork off to the right where dogs chase Len off course!
    const forkE = new THREE.Mesh(new THREE.PlaneGeometry(40, 6.5), dirtMat);
    forkE.rotation.x = -Math.PI / 2;
    forkE.rotation.z = -0.32;
    forkE.position.set(14, 0.025, -4);
    zE.add(forkE);

    const barnE = makePaintedHouse(lightU, tex, "ochre", 7);
    barnE.position.set(-14, 0, -14);
    barnE.rotation.y = 0.85;
    zE.add(barnE);

    for (let i = 0; i < 8; i++) {
      const tr = makeTree(lightU, tex, 1.15, false, 500 + i);
      tr.position.set((i % 2 === 0 ? -12 : 16) + (i - 4) * 2.2, 0, -24 + i * 7.5);
      zE.add(tr);
      cullables.push(tr);
    }
  }

  // =========================================================================
  // ZONE F (x = 1000): OVERHEATING JALOPY HILL (Empty Radiator Analogy!)
  // =========================================================================
  const jalopyCar = make1904TouringCar(lightU, "#c43f37", true);
  {
    const zF = new THREE.Group();
    root.add(zF);

    const hillGeo = new THREE.PlaneGeometry(120, 130, 16, 40);
    hillGeo.rotateX(-Math.PI / 2);
    const hPos = hillGeo.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      const hz = hPos.getZ(i);
      hPos.setY(i, computeGroundY(1000, hz) - 0.04);
    }
    hillGeo.computeVertexNormals();
    const hillMesh = new THREE.Mesh(hillGeo, grassMat);
    hillMesh.position.set(1000, 0, 0);
    zF.add(hillMesh);

    const hillRoadGeo = new THREE.PlaneGeometry(9.0, 125, 4, 40);
    hillRoadGeo.rotateX(-Math.PI / 2);
    const hrPos = hillRoadGeo.attributes.position;
    for (let i = 0; i < hrPos.count; i++) {
      const hz = hrPos.getZ(i);
      hrPos.setY(i, computeGroundY(1000, hz) + 0.04);
    }
    hillRoadGeo.computeVertexNormals();
    const hillRoad = new THREE.Mesh(hillRoadGeo, dirtMat);
    hillRoad.position.set(1000, 0, 0);
    zF.add(hillRoad);

    for (let fz = -35; fz <= 35; fz += 5) {
      const gy = computeGroundY(1000, fz);
      for (const side of [-1, 1]) {
        const seg = makeFenceSegment(lightU, tex, 5.0);
        seg.position.set(1000 + side * 5.2, gy, fz);
        seg.rotation.y = Math.PI / 2;
        zF.add(seg);
      }
    }

    jalopyCar.group.position.set(1000, 0, 0);
    root.add(jalopyCar.group);
  }

  // =========================================================================
  // ZONE G (x = 1200): MODERN WATER-STATION BOULEVARD (Consequence Rule!)
  // =========================================================================
  {
    const zG = new THREE.Group();
    zG.position.set(1200, 0, 0);
    root.add(zG);

    const gG = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), grassMat);
    gG.rotation.x = -Math.PI / 2;
    zG.add(gG);

    const blvd = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 130), asphaltMat);
    blvd.rotation.x = -Math.PI / 2;
    blvd.position.y = 0.03;
    zG.add(blvd);

    // Long cheerful row of draped blue-and-white water-station tables stocked with cups!
    const clothMat = makeTwoToneMaterial(lightU, { color: "#e8f2fa" });
    const trimBlueMat = makeTwoToneMaterial(lightU, { color: "#3d7ec7" });
    const cupMat = untone(lightU, { color: "#6ec3f5" });

    for (let tz = -12; tz <= 12; tz += 4.2) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 3.6), clothMat);
      table.position.set(-4.3, 0.48, tz);
      zG.add(table);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.24, 3.64), trimBlueMat);
      stripe.position.set(-4.3, 0.85, tz);
      zG.add(stripe);
      // Rows of bright blue paper water cups
      for (let cz = -1.2; cz <= 1.2; cz += 0.48) {
        for (const cx of [-0.3, 0.25]) {
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.22, 8), cupMat);
          cup.position.set(-4.3 + cx, 1.07, tz + cz);
          zG.add(cup);
        }
      }
    }

    // Crisp city park trees & colorful background buildings
    const gHouses: [number, number, "brick" | "cream" | "ochre", 7 | 8.4 | 9.8][] = [
      [-14, -14, "cream", 8.4],
      [-14, 4, "ochre", 7],
      [14, -10, "brick", 9.8],
      [14, 12, "cream", 8.4],
    ];
    for (const [hx, hz, st, hh] of gHouses) {
      const h = makePaintedHouse(lightU, tex, st, hh);
      h.position.set(hx, 0, hz);
      h.rotation.y = hx < 0 ? Math.PI / 2 : -Math.PI / 2;
      zG.add(h);
    }
    for (let i = 0; i < 8; i++) {
      const tr = makeTree(lightU, tex, 1.1, false, 700 + i);
      tr.position.set(i % 2 === 0 ? -9.5 : 9.5, 0, -24 + i * 7);
      zG.add(tr);
      cullables.push(tr);
    }
  }

  return {
    root,
    cullables,
    officialCar,
    lorzCar,
    jalopyCar,
    finishTapeL,
    finishTapeR,
    clockHandHour,
    clockHandMin,
    wellDrop,
    wellBucket,
    flags,
    groundY: computeGroundY,
  };
}
