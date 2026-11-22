import * as THREE from "three";
import { SharedLightUniforms } from "./lights";
import { makeCardMaterial } from "./cardshade";
import { NOINK } from "./ink";
import {
  CANVAS_W,
  CANVAS_H,
  CharDesign,
  PoseState,
  drawCharacter,
  drawCarriedHicksComposite,
  drawWildDog,
  drawEffectCard,
} from "./toon";

export const CAST_DESIGNS: Record<string, CharDesign> = {
  fredLorz: {
    id: "fredLorz",
    skin: "#f3cfb3",
    shirt: "#f4efe4",
    shirtStripe: "#2c508a",
    pants: "#2c508a",
    shorts: true,
    shoes: "#4c3627",
    hat: "hair_slick",
    hairColor: "#5c3b24",
    scale: 1.02,
  },
  thomasHicks: {
    id: "thomasHicks",
    skin: "#f4d2b8",
    shirt: "#d9eaf5",
    shirtStripe: "#c4443b",
    pants: "#3a4966",
    shorts: true,
    shoes: "#4d382a",
    hat: "hair_messy",
    hairColor: "#a67c4b",
    scale: 1.0,
  },
  felixCarvajal: {
    id: "felixCarvajal",
    skin: "#e3b088",
    shirt: "#f4efe4",
    pants: "#3e404a",
    shorts: false,
    snippedShorts: false,
    shoes: "#2f2622",
    hat: "beret",
    hatColor: "#2d303c",
    hairColor: "#2a201d",
    mustache: true,
    scale: 0.96,
  },
  lenTaunyane: {
    id: "lenTaunyane",
    skin: "#7a4d32",
    shirt: "#f0e6cc",
    shirtStripe: "#3d6e47",
    pants: "#465947",
    shorts: true,
    shoes: "#7a4d32",
    barefoot: true,
    hat: "hair_short",
    hairColor: "#231a18",
    scale: 1.02,
  },
  sullivan: {
    id: "sullivan",
    skin: "#f0c8ab",
    shirt: "#f4efe4",
    coat: "#2e313b",
    pants: "#2e313b",
    shorts: false,
    shoes: "#1e1a1c",
    hat: "bowler",
    hatColor: "#292c34",
    hairColor: "#635347",
    walrusMustache: true,
    scale: 1.06,
  },
  sheridan: {
    id: "sheridan",
    skin: "#f1ccb0",
    shirt: "#d45348",
    pants: "#f0e8d8",
    shorts: true,
    shoes: "#473428",
    hat: "headband",
    hatColor: "#2c508a",
    hairColor: "#5b3f29",
    scale: 1.05,
  },
  trainerA: {
    id: "trainerA",
    skin: "#eec6a8",
    shirt: "#f0e7d4",
    pants: "#645648",
    shorts: false,
    shoes: "#36281e",
    hat: "tweed_cap",
    hatColor: "#786653",
    hairColor: "#4f3927",
    mustache: true,
    suspenders: true,
    scale: 1.02,
  },
  trainerB: {
    id: "trainerB",
    skin: "#f3ceb2",
    shirt: "#e6dbc5",
    pants: "#565a66",
    shorts: false,
    shoes: "#36281e",
    hat: "tweed_cap",
    hatColor: "#585f6b",
    hairColor: "#6b482e",
    suspenders: true,
    scale: 1.01,
  },
  official: {
    id: "official",
    skin: "#f0c7a8",
    shirt: "#f4efe4",
    coat: "#2c466e",
    pants: "#2c466e",
    shorts: false,
    shoes: "#221b1a",
    hat: "official_cap",
    hatColor: "#2c466e",
    hairColor: "#54473f",
    walrusMustache: true,
    scale: 1.05,
  },
};

export function makeExtraRunnerDesign(i: number): CharDesign {
  const shirts = ["#f4efe4", "#e3d6be", "#c95348", "#4f729e", "#5a8255", "#d9a24e"];
  const stripes = ["#b83f38", "#2d4f80", "#f4efe4", "#d9a24e", "#36404d", "#4c7046"];
  const skins = ["#f3cfb3", "#ecc09d", "#dfb089", "#f5d6be", "#c9956b"];
  const hairs = ["#4b3322", "#755033", "#2b221e", "#a17946", "#5e4635"];
  const hats: CharDesign["hat"][] = ["hair_short", "hair_messy", "headband", "hair_slick"];
  return {
    id: `runner_${i}`,
    skin: skins[i % skins.length],
    shirt: shirts[i % shirts.length],
    shirtStripe: stripes[(i * 2) % stripes.length],
    pants: i % 2 === 0 ? "#384152" : "#5e5042",
    shorts: true,
    shoes: "#423125",
    hat: hats[i % hats.length],
    hatColor: stripes[i % stripes.length],
    hairColor: hairs[i % hairs.length],
    mustache: i % 4 === 1,
    scale: 0.94 + ((i * 17) % 12) * 0.01,
  };
}

export function makeSpectatorDesign(i: number): CharDesign {
  const coats = ["#5c493c", "#3b4c66", "#7a4440", "#4b614b", "#8a6d4b", "#574a66"];
  const hats: CharDesign["hat"][] = ["boater", "bowler", "tweed_cap", "boater"];
  const skins = ["#f3cfb3", "#ecc09d", "#e3b38d", "#f5d7c0"];
  return {
    id: `spec_${i}`,
    skin: skins[i % skins.length],
    shirt: "#f4efe4",
    coat: coats[i % coats.length],
    pants: "#3a3940",
    shorts: false,
    shoes: "#292220",
    hat: hats[i % hats.length],
    hatColor: i % 2 === 0 ? "#b83d39" : "#2f4e7e",
    hairColor: "#463529",
    mustache: i % 3 === 0,
    scale: 0.92 + ((i * 13) % 12) * 0.01,
  };
}

function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 58);
  grad.addColorStop(0, "rgba(22, 18, 32, 0.56)");
  grad.addColorStop(0.65, "rgba(22, 18, 32, 0.28)");
  grad.addColorStop(1, "rgba(22, 18, 32, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) sharedShadowTex = makeShadowTexture();
  return sharedShadowTex;
}

/** A single 2D cutout character billboard with tight contact shadow + sun tail */
export class CharActor {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly tailShadow: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly design: CharDesign;
  readonly heightM: number;
  readonly texScale: number;
  private lastDrawFrame = -999;

  constructor(
    design: CharDesign,
    lightU: SharedLightUniforms,
    heightM = 1.95,
    texScale = 0.75
  ) {
    this.design = design;
    this.heightM = heightM;
    this.texScale = texScale;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(CANVAS_W * texScale);
    this.canvas.height = Math.round(CANVAS_H * texScale);
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;

    const aspect = CANVAS_W / CANVAS_H;
    const widthM = heightM * aspect;
    // Shift geometry so y=0 is strictly at the character soles (SOLE_Y = 975/1000)
    const geo = new THREE.PlaneGeometry(widthM, heightM);
    geo.translate(0, heightM * (0.5 - 0.025), 0);

    const mat = makeCardMaterial(this.tex, lightU);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.layers.set(NOINK);
    this.group.add(this.mesh);

    // Tight contact shadow blob directly under soles (~0.5 m radius)
    const sMat = new THREE.MeshBasicMaterial({
      map: getShadowTex(),
      transparent: true,
      depthWrite: false,
      opacity: 0.86,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.52), sMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.shadow.layers.set(NOINK);
    this.group.add(this.shadow);

    // Sun-direction cast shadow tail
    const tGeo = new THREE.PlaneGeometry(0.75, 1.45);
    tGeo.translate(0, 0.6, 0);
    const tMat = new THREE.MeshBasicMaterial({
      map: getShadowTex(),
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    });
    this.tailShadow = new THREE.Mesh(tGeo, tMat);
    this.tailShadow.rotation.x = -Math.PI / 2;
    this.tailShadow.position.y = 0.022;
    this.tailShadow.layers.set(NOINK);
    this.group.add(this.tailShadow);
  }

  place(
    x: number,
    y: number,
    z: number,
    pose: PoseState,
    camPos: THREE.Vector3,
    sunDir: THREE.Vector3,
    showShadow = true,
    redrawStep = 1
  ) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    // Cylindrical billboard facing camera horizontally
    const dx = camPos.x - x;
    const dz = camPos.z - z;
    this.mesh.rotation.y = Math.atan2(dx, dz);

    this.shadow.visible = showShadow;
    this.tailShadow.visible = showShadow;
    if (showShadow) {
      // Point shadow tail away from sun
      const awayYaw = Math.atan2(-sunDir.x, -sunDir.z);
      this.tailShadow.rotation.z = -awayYaw;
    }

    if (redrawStep <= 1 || Math.abs(pose.frame - this.lastDrawFrame) >= redrawStep) {
      this.lastDrawFrame = pose.frame;
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(this.texScale, 0, 0, this.texScale, 0, 0);
      drawCharacter(this.ctx, this.design, pose);
      this.ctx.restore();
      this.tex.needsUpdate = true;
    }
  }

  hide() {
    this.group.visible = false;
  }
}

/** Wide 900x1000 composite card for the iconic Carried Thomas Hicks finish! */
export class CarriedHicksActor {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;

  constructor(lightU: SharedLightUniforms) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 900;
    this.canvas.height = 1000;
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const h = 2.05;
    const w = h * 0.9;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h * 0.475, 0);
    this.mesh = new THREE.Mesh(geo, makeCardMaterial(this.tex, lightU));
    this.mesh.layers.set(NOINK);
    this.group.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.8),
      new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false, opacity: 0.72 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.025;
    this.shadow.layers.set(NOINK);
    this.group.add(this.shadow);
    this.group.visible = false;
  }

  place(x: number, y: number, z: number, phase: number, frame: number, camPos: THREE.Vector3) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    this.mesh.rotation.y = Math.atan2(camPos.x - x, camPos.z - z);
    drawCarriedHicksComposite(
      this.ctx,
      CAST_DESIGNS.thomasHicks,
      CAST_DESIGNS.trainerA,
      CAST_DESIGNS.trainerB,
      phase,
      frame
    );
    this.tex.needsUpdate = true;
  }

  hide() {
    this.group.visible = false;
  }
}

/** Animated 2D cutout barking feral dog billboard */
export class DogActor {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly coat: string;

  constructor(coat: string, lightU: SharedLightUniforms) {
    this.coat = coat;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 500;
    this.canvas.height = 400;
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1.18, 0.94);
    geo.translate(0, 0.44, 0);
    this.mesh = new THREE.Mesh(geo, makeCardMaterial(this.tex, lightU));
    this.mesh.layers.set(NOINK);
    this.group.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.45),
      new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false, opacity: 0.65 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.025;
    this.shadow.layers.set(NOINK);
    this.group.add(this.shadow);
    this.group.visible = false;
  }

  place(x: number, y: number, z: number, phase: number, facing: 1 | -1, camPos: THREE.Vector3) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    this.mesh.rotation.y = Math.atan2(camPos.x - x, camPos.z - z);
    drawWildDog(this.ctx, this.coat, phase, facing);
    this.tex.needsUpdate = true;
  }

  hide() {
    this.group.visible = false;
  }
}

/** Animated 2D effect billboard (dust clouds, steam puffs, bang starbursts, dizzy stars) */
export class FxActor {
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly mat: THREE.ShaderMaterial;

  constructor(lightU: SharedLightUniforms) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 360;
    this.canvas.height = 360;
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = makeCardMaterial(this.tex, lightU, { isFx: true, opacity: 0.92 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.layers.set(NOINK);
    this.mesh.visible = false;
  }

  place(
    x: number,
    y: number,
    z: number,
    size: number,
    kind: "dust" | "steam" | "bang" | "dizzy_stars" | "water_splash",
    phase: number,
    camPos: THREE.Vector3,
    opacity = 0.92
  ) {
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.set(size, size, 1);
    this.mesh.lookAt(camPos);
    this.mat.uniforms.uOpacity.value = opacity;
    drawEffectCard(this.ctx, kind, phase);
    this.tex.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}
