import * as THREE from "three";

/** Deterministic PRNG for procedural painted textures */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

function finalizeTex(
  c: HTMLCanvasElement,
  repX = 1,
  repY = 1,
  clamp = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repX, repY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Add subtle hand-painted brush dabs across a canvas */
function brushPass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  count: number,
  palette: string[],
  alpha = 0.14,
  minW = 14,
  maxW = 48
) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
    ctx.globalAlpha = alpha * (0.5 + rng() * 0.9);
    const x = rng() * w;
    const y = rng() * h;
    const bw = minW + rng() * (maxW - minW);
    const bh = 5 + rng() * 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rng() - 0.5) * 0.3);
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export interface PaintedTextures {
  dirtRoad: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  cinderTrack: THREE.CanvasTexture;
  woodDeck: THREE.CanvasTexture;
  brickWall: THREE.CanvasTexture;
  creamPlaster: THREE.CanvasTexture;
  ochrePlaster: THREE.CanvasTexture;
  terracottaRoof: THREE.CanvasTexture;
  stoneWell: THREE.CanvasTexture;
  foliage: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  bunting: THREE.CanvasTexture;
  stadiumClock: THREE.CanvasTexture;
  grandstandFront: THREE.CanvasTexture;
  usFlag1904: THREE.CanvasTexture;
  windowFacadeBrick: THREE.CanvasTexture;
  windowFacadeCream: THREE.CanvasTexture;
  windowFacadeOchre: THREE.CanvasTexture;
  asphaltRoad: THREE.CanvasTexture;
}

let cachedTextures: PaintedTextures | null = null;

export function getPaintedTextures(): PaintedTextures {
  if (cachedTextures) return cachedTextures;

  // 1. Missouri red-ochre dusty clay road with wheel ruts & pebbles
  const dirtRoad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(101);
    ctx.fillStyle = "#b87a4e";
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 280, ["#c98b5b", "#a6683f", "#d29a6b", "#965d38"], 0.28, 22, 70);
    // Wagon ruts running vertically along UV.y
    for (const rx of [135, 375]) {
      const grad = ctx.createLinearGradient(rx - 44, 0, rx + 44, 0);
      grad.addColorStop(0, "rgba(85,48,26,0)");
      grad.addColorStop(0.5, "rgba(85,48,26,0.42)");
      grad.addColorStop(1, "rgba(85,48,26,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(rx - 44, 0, 88, 512);
    }
    // Painted pebbles & cracks
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = rng() > 0.5 ? "#7a4a2b" : "#dfb184";
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(rng() * 512, rng() * 512, 2 + rng() * 6, 1.5 + rng() * 3.5, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return finalizeTex(c, 1, 8);
  })();

  // 2. Warm painterly grass (natural sunlit olive-meadow, never neon!)
  const grass = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(202);
    ctx.fillStyle = "#6c8f46";
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 340, ["#7ea252", "#5d7e3c", "#89ab5c", "#547234"], 0.25, 18, 60);
    // Subtle grass blade tufts
    ctx.strokeStyle = "#48632d";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 160; i++) {
      const x = rng() * 512;
      const y = rng() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 10, y - 10 - rng() * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return finalizeTex(c, 14, 14);
  })();

  // 3. Cinder stadium track with crisp white chalk lane lines
  const cinderTrack = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(303);
    ctx.fillStyle = "#a35b43";
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 300, ["#b3694e", "#914d38", "#bf785c", "#7e402d"], 0.25, 16, 48);
    // White chalk lanes
    ctx.fillStyle = "rgba(248, 244, 232, 0.85)";
    for (const lx of [16, 134, 256, 378, 496]) {
      ctx.fillRect(lx - 4, 0, 8, 512);
    }
    return finalizeTex(c, 1, 6);
  })();

  // 4. Ochre wood deck with near-black painted plank seams (SKILL.md exact!)
  const woodDeck = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(404);
    ctx.fillStyle = "#b9874c";
    ctx.fillRect(0, 0, 512, 512);
    const rows = 8;
    const rh = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const shade = ["#c39053", "#b27f45", "#c89659", "#a9773f"][r % 4];
      ctx.fillStyle = shade;
      ctx.fillRect(0, r * rh, 512, rh);
      // Grain lines
      ctx.strokeStyle = "rgba(72,44,18,0.22)";
      ctx.lineWidth = 2;
      for (let g = 0; g < 4; g++) {
        const gy = r * rh + 8 + rng() * (rh - 16);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(170, gy + (rng() - 0.5) * 6, 340, gy + (rng() - 0.5) * 6, 512, gy);
        ctx.stroke();
      }
      // Dark seam between planks
      ctx.fillStyle = "#2b1d12";
      ctx.fillRect(0, r * rh, 512, 4);
      // Cross joint
      const jx = ((r * 197 + 90) % 440) + 36;
      ctx.fillRect(jx, r * rh, 4, rh);
    }
    return finalizeTex(c, 2, 2);
  })();

  // 5. Muted brick wall with dark mortar seams
  const brickWall = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(505);
    ctx.fillStyle = "#4d3830";
    ctx.fillRect(0, 0, 512, 512);
    const rows = 12;
    const cols = 6;
    const rh = 512 / rows;
    const cw = 512 / cols;
    const tones = ["#b25e4b", "#a45342", "#bd6a55", "#994b3b", "#ad614e"];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
        ctx.fillRect(col * cw + off + 3, r * rh + 3, cw - 6, rh - 6);
      }
    }
    brushPass(ctx, 512, 512, rng, 120, ["#6d392d", "#cf856f"], 0.1, 18, 44);
    return finalizeTex(c, 2, 2);
  })();

  // 6. Cream & Ochre painted house plaster
  const makePlaster = (base: string, pal: string[], seed: number) => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 260, pal, 0.22, 24, 72);
    // Horizontal clapboard subtle seams
    ctx.fillStyle = "rgba(42,32,26,0.22)";
    for (let y = 32; y < 512; y += 32) {
      ctx.fillRect(0, y, 512, 2);
    }
    return finalizeTex(c, 1, 1);
  };
  const creamPlaster = makePlaster("#dfd2bc", ["#e7dcc8", "#d2c3aa", "#c8b79d"], 606);
  const ochrePlaster = makePlaster("#c89859", ["#d5a769", "#ba894c", "#b07f43"], 707);

  // Helper to paint house wall with neat windows, shutters & dark frames
  const makeWindowFacade = (base: string, pal: string[], shutter: string, seed: number) => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 180, pal, 0.2, 20, 64);
    // Plinth at bottom
    ctx.fillStyle = "#7a7267";
    ctx.fillRect(0, 445, 512, 67);
    ctx.fillStyle = "#2b2420";
    ctx.fillRect(0, 443, 512, 5);
    // 2x2 windows
    const drawWin = (wx: number, wy: number) => {
      // Shutters
      ctx.fillStyle = shutter;
      ctx.fillRect(wx - 28, wy, 24, 112);
      ctx.fillRect(wx + 86, wy, 24, 112);
      ctx.strokeStyle = "#221a1d";
      ctx.lineWidth = 4;
      ctx.strokeRect(wx - 28, wy, 24, 112);
      ctx.strokeRect(wx + 86, wy, 24, 112);
      // Window frame & glass
      ctx.fillStyle = "#3c546e";
      ctx.fillRect(wx, wy, 82, 112);
      // Warm diagonal reflection
      ctx.fillStyle = "#6c8cae";
      ctx.beginPath();
      ctx.moveTo(wx + 6, wy + 8);
      ctx.lineTo(wx + 52, wy + 8);
      ctx.lineTo(wx + 18, wy + 70);
      ctx.lineTo(wx + 6, wy + 52);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#f2ebdd";
      ctx.lineWidth = 7;
      ctx.strokeRect(wx, wy, 82, 112);
      // Mullions
      ctx.beginPath();
      ctx.moveTo(wx + 41, wy);
      ctx.lineTo(wx + 41, wy + 112);
      ctx.moveTo(wx, wy + 56);
      ctx.lineTo(wx + 82, wy + 56);
      ctx.stroke();
      ctx.strokeStyle = "#221a1d";
      ctx.lineWidth = 3;
      ctx.strokeRect(wx - 4, wy - 4, 90, 120);
      // Sill & hood
      ctx.fillStyle = "#dfd5c5";
      ctx.fillRect(wx - 10, wy + 112, 102, 12);
      ctx.fillRect(wx - 8, wy - 14, 98, 12);
      ctx.strokeRect(wx - 10, wy + 112, 102, 12);
      ctx.strokeRect(wx - 8, wy - 14, 98, 12);
    };
    drawWin(90, 70);
    drawWin(330, 70);
    drawWin(90, 260);
    // Front door on bottom right
    ctx.fillStyle = "#6e4229";
    ctx.fillRect(326, 268, 92, 178);
    ctx.strokeStyle = "#221a1d";
    ctx.lineWidth = 5;
    ctx.strokeRect(326, 268, 92, 178);
    ctx.fillStyle = "#e6bf5a";
    ctx.beginPath();
    ctx.arc(402, 360, 6, 0, Math.PI * 2);
    ctx.fill();
    return finalizeTex(c, 1, 1, true);
  };

  const windowFacadeBrick = makeWindowFacade("#ad5a48", ["#bd6854", "#984b3a"], "#475f4d", 801);
  const windowFacadeCream = makeWindowFacade("#dfd2bc", ["#ebe0cd", "#ccbda4"], "#4e6478", 802);
  const windowFacadeOchre = makeWindowFacade("#c89859", ["#d6a96c", "#b58446"], "#6a4338", 803);

  // 7. Terracotta roof tiles with dark curved seams
  const terracottaRoof = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(909);
    ctx.fillStyle = "#9c4e39";
    ctx.fillRect(0, 0, 512, 512);
    const rows = 10;
    const cols = 10;
    const rh = 512 / rows;
    const cw = 512 / cols;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = ["#a75640", "#934733", "#b26049"][Math.floor(rng() * 3)];
        ctx.fillRect(col * cw, r * rh, cw, rh);
        ctx.strokeStyle = "#2f1915";
        ctx.lineWidth = 3;
        ctx.strokeRect(col * cw, r * rh, cw, rh);
      }
    }
    return finalizeTex(c, 2, 2);
  })();

  // 8. Warm grey/beige stone well blocks
  const stoneWell = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(1010);
    ctx.fillStyle = "#4d4640";
    ctx.fillRect(0, 0, 512, 512);
    const rows = 8;
    const rh = 512 / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 45) % 80);
      while (x < 512) {
        const bw = 72 + rng() * 58;
        ctx.fillStyle = ["#ada599", "#9e968b", "#bab2a5", "#8f887d"][Math.floor(rng() * 4)];
        ctx.beginPath();
        ctx.roundRect(x + 3, r * rh + 3, bw - 6, rh - 6, 8);
        ctx.fill();
        x += bw;
      }
    }
    return finalizeTex(c, 2, 1);
  })();

  // 9. Painterly tree foliage
  const foliage = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(1111);
    ctx.fillStyle = "#4f7c3c";
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 340, ["#639249", "#426c31", "#74a356", "#395d2a"], 0.35, 22, 62);
    return finalizeTex(c, 2, 2);
  })();

  // 10. Bark
  const bark = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    const rng = mulberry32(1212);
    ctx.fillStyle = "#6b4d38";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng() > 0.5 ? "#523927" : "#7c5b43";
      ctx.fillRect(rng() * 256, 0, 4 + rng() * 8, 256);
    }
    return finalizeTex(c, 1, 2);
  })();

  // 11. Patriotic 1904 red-white-blue bunting banner (unlit!)
  const bunting = (() => {
    const [c, ctx] = makeCanvas(512, 128);
    ctx.clearRect(0, 0, 512, 128);
    const cols = ["#c63d3d", "#f4eedc", "#2f5792"];
    const n = 8;
    const sw = 512 / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cols[i % 3];
      ctx.beginPath();
      ctx.moveTo(i * sw, 0);
      ctx.lineTo((i + 1) * sw, 0);
      ctx.lineTo((i + 0.5) * sw, 118);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#221722";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    return finalizeTex(c, 3, 1);
  })();

  // 12. Stadium vintage clock face (no text/numbers, crisp tick marks!)
  const stadiumClock = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = "#f4ebd7";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#221822";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(256, 256, 232, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 === 0 ? 175 : 192;
      const r2 = 216;
      ctx.lineWidth = i % 3 === 0 ? 14 : 7;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1);
      ctx.lineTo(256 + Math.cos(a) * r2, 256 + Math.sin(a) * r2);
      ctx.stroke();
    }
    return finalizeTex(c, 1, 1, true);
  })();

  // 13. Grandstand wooden fascia with painted stripes
  const grandstandFront = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = "#d9cdb8";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#b8433b";
    ctx.fillRect(0, 0, 512, 46);
    ctx.fillStyle = "#315387";
    ctx.fillRect(0, 210, 512, 46);
    // Vertical timber ribs
    ctx.fillStyle = "#332622";
    for (let x = 0; x < 512; x += 64) {
      ctx.fillRect(x, 0, 5, 256);
    }
    ctx.fillRect(0, 44, 512, 5);
    ctx.fillRect(0, 208, 512, 5);
    return finalizeTex(c, 3, 1);
  })();

  // 14. Period-correct 1904 US Flag (stars & stripes, zero accidental lookalikes!)
  const usFlag1904 = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    const sh = 256 / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#b83a36" : "#f2ead8";
      ctx.fillRect(0, i * sh, 512, sh + 1);
    }
    ctx.fillStyle = "#29467a";
    ctx.fillRect(0, 0, 205, sh * 7);
    ctx.fillStyle = "#f2ead8";
    for (let r = 0; r < 5; r++) {
      for (let col = 0; col < 7; col++) {
        ctx.beginPath();
        ctx.arc(18 + col * 28, 16 + r * 26, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "#221822";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 250);
    return finalizeTex(c, 1, 1, true);
  })();

  // 15. Clean modern boulevard asphalt for the Consequence water-station scene
  const asphaltRoad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = mulberry32(1515);
    ctx.fillStyle = "#62666e";
    ctx.fillRect(0, 0, 512, 512);
    brushPass(ctx, 512, 512, rng, 220, ["#6d727a", "#565a62", "#757982"], 0.25, 16, 48);
    // Dashed center stripe
    ctx.fillStyle = "#f2ead5";
    for (let y = 20; y < 512; y += 110) {
      ctx.fillRect(248, y, 16, 62);
    }
    return finalizeTex(c, 1, 6);
  })();

  cachedTextures = {
    dirtRoad,
    grass,
    cinderTrack,
    woodDeck,
    brickWall,
    creamPlaster,
    ochrePlaster,
    terracottaRoof,
    stoneWell,
    foliage,
    bark,
    bunting,
    stadiumClock,
    grandstandFront,
    usFlag1904,
    windowFacadeBrick,
    windowFacadeCream,
    windowFacadeOchre,
    asphaltRoad,
  };
  return cachedTextures;
}
