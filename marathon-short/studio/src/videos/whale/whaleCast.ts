import * as THREE from "three";
import { SharedLightUniforms } from "../marathon/lights";
import { makeCardMaterial } from "../marathon/cardshade";
import { NOINK } from "../marathon/ink";
import {
  CANVAS_W,
  CANVAS_H,
  WhaleCharDesign,
  WhalePoseState,
  drawWhaleCharacter,
  drawSeagull,
  drawWhaleFx,
} from "./whaleToon";

export const WHALE_CAST: Record<string, WhaleCharDesign> = {
  thornton: {
    id: "thornton",
    skin: "#f3ceb2",
    shirt: "#f4efe4",
    vest: "#e87e2b",
    pants: "#695d4c",
    shoes: "#36281e",
    hat: "hard_hat",
    hatColor: "#f2c230",
    hairColor: "#5c432c",
    mustache: true,
    scale: 1.04,
  },
  veteran: {
    id: "veteran",
    skin: "#eec5a7",
    shirt: "#4c6352",
    pants: "#3e424c",
    shoes: "#2b221e",
    hat: "silver_hair",
    hairColor: "#b8bdc4",
    mustache: true,
    glasses: true,
    scale: 1.02,
  },
  cameraman: {
    id: "cameraman",
    skin: "#f0c8ab",
    shirt: "#49698c",
    pants: "#474a54",
    shoes: "#2e241f",
    hat: "cap",
    hatColor: "#b8443d",
    hairColor: "#4f3624",
    scale: 1.0,
  },
};

export function makeWorkerDesign(i: number): WhaleCharDesign {
  const shirts = ["#597aa1", "#c9b388", "#6d8560", "#b85c4b"];
  return {
    id: `worker_${i}`,
    skin: i % 2 === 0 ? "#f2ccb0" : "#e3b38d",
    shirt: shirts[i % shirts.length],
    vest: i % 2 === 0 ? "#e68330" : undefined,
    pants: "#3c4b63",
    shoes: "#38291f",
    hat: "hard_hat",
    hatColor: "#f2c230",
    hairColor: "#4a3322",
    mustache: i === 1,
    scale: 0.96 + (i % 3) * 0.03,
  };
}

export function makeTownsfolkDesign(i: number): WhaleCharDesign {
  const shirts = ["#c95749", "#4f7fa3", "#d9a648", "#5f8c5b", "#8a5c8a", "#d97a48", "#e8dfc8"];
  const hats: WhaleCharDesign["hat"][] = ["hair_70s", "beanie", "cap", "hair_70s"];
  const skins = ["#f3cfb3", "#ecc09d", "#e3b088", "#f5d7c0", "#b8825a"];
  return {
    id: `town_${i}`,
    skin: skins[i % skins.length],
    shirt: shirts[i % shirts.length],
    pants: i % 2 === 0 ? "#3c4b66" : "#5e4e3f",
    shoes: "#32251e",
    hat: hats[i % hats.length],
    hatColor: shirts[(i + 2) % shirts.length],
    hairColor: ["#47301f", "#7a5330", "#29201c", "#a37b46"][i % 4],
    mustache: i % 4 === 0,
    glasses: i % 5 === 2,
    scale: 0.93 + ((i * 11) % 12) * 0.01,
  };
}

let cachedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (cachedShadowTex) return cachedShadowTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 58);
  g.addColorStop(0, "rgba(22, 18, 32, 0.62)");
  g.addColorStop(0.65, "rgba(22, 18, 32, 0.28)");
  g.addColorStop(1, "rgba(22, 18, 32, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  cachedShadowTex = new THREE.CanvasTexture(c);
  cachedShadowTex.needsUpdate = true;
  return cachedShadowTex;
}

export class WhaleCharActor {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly design: WhaleCharDesign;
  readonly texScale: number;
  private lastDrawFrame = -999;

  constructor(design: WhaleCharDesign, lightU: SharedLightUniforms, heightM = 1.96, texScale = 0.72) {
    this.design = design;
    this.texScale = texScale;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(CANVAS_W * texScale);
    this.canvas.height = Math.round(CANVAS_H * texScale);
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;

    const w = heightM * (CANVAS_W / CANVAS_H);
    const geo = new THREE.PlaneGeometry(w, heightM);
    geo.translate(0, heightM * 0.475, 0);
    this.mesh = new THREE.Mesh(geo, makeCardMaterial(this.tex, lightU));
    this.mesh.layers.set(NOINK);
    this.group.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.52),
      new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false, opacity: 0.82 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.shadow.layers.set(NOINK);
    this.group.add(this.shadow);
    this.group.visible = false;
  }

  place(
    x: number,
    y: number,
    z: number,
    st: WhalePoseState,
    camPos: THREE.Vector3,
    showShadow = true,
    redrawStep = 1
  ) {
    this.group.visible = true;
    this.group.position.set(x, y, z);
    this.mesh.rotation.y = Math.atan2(camPos.x - x, camPos.z - z);
    this.shadow.visible = showShadow;

    if (redrawStep <= 1 || Math.abs(st.frame - this.lastDrawFrame) >= redrawStep) {
      this.lastDrawFrame = st.frame;
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(this.texScale, 0, 0, this.texScale, 0, 0);
      drawWhaleCharacter(this.ctx, this.design, st);
      this.ctx.restore();
      this.tex.needsUpdate = true;
    }
  }

  hide() {
    this.group.visible = false;
  }
}

export class SeagullActor {
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;

  constructor(lightU: SharedLightUniforms) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 400;
    this.canvas.height = 288;
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.04), makeCardMaterial(this.tex, lightU));
    this.mesh.layers.set(NOINK);
    this.mesh.visible = false;
  }

  place(x: number, y: number, z: number, phase: number, facing: 1 | -1, camPos: THREE.Vector3, scale = 1.0) {
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(scale);
    this.mesh.lookAt(camPos);
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(0.8, 0, 0, 0.8, 0, 0);
    drawSeagull(this.ctx, phase, facing);
    this.ctx.restore();
    this.tex.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}

export class WhaleFxActor {
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
    kind: "stink" | "fireball" | "smoke" | "bang" | "blubber_splat",
    phase: number,
    camPos: THREE.Vector3,
    opacity = 0.92
  ) {
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.set(size, size, 1);
    this.mesh.lookAt(camPos);
    this.mat.uniforms.uOpacity.value = opacity;
    drawWhaleFx(this.ctx, kind, phase);
    this.tex.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}
