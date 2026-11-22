/**
 * whaleToon.ts — Articulated 1970 Oregon Coast 2D cutout characters, flapping seagulls,
 * and animated FX cards (stink fumes, dynamite fireball, falling blubber, crash bursts).
 * Design canvas: 600 x 1000, soles strictly at y = 975, dark plum ink #241726.
 */

export const INK = "#241726";
export const CANVAS_W = 600;
export const CANVAS_H = 1000;
export const SOLE_Y = 975;

export type WhaleFace =
  | "neutral"
  | "smug"
  | "delulu"
  | "gagging"
  | "angry"
  | "warn_shout"
  | "cheer"
  | "lookup_shock"
  | "panic"
  | "deadpan"
  | "grumpy";

export type WhalePose =
  | "idle"
  | "walk"
  | "gag_nose"
  | "delulu_shrug"
  | "carry_tnt"
  | "warn_wave"
  | "brush_off"
  | "slam_plunger"
  | "cheer"
  | "lookup"
  | "panic_cover_run"
  | "hold_keys_deadpan"
  | "shovel_dig"
  | "camera_film"
  | "sit_bench";

export type WhaleHat = "none" | "hard_hat" | "silver_hair" | "hair_70s" | "cap" | "beanie";

export interface WhaleCharDesign {
  id: string;
  skin: string;
  shirt: string;
  vest?: string;
  pants: string;
  shoes: string;
  hat: WhaleHat;
  hatColor?: string;
  hairColor: string;
  mustache?: boolean;
  glasses?: boolean;
  scale?: number;
}

export interface WhalePoseState {
  pose: WhalePose;
  face: WhaleFace;
  phase: number;
  facing?: 1 | -1;
  seed?: number;
  frame: number;
  jitter?: number;
  /** 0..1 progress for plunger slam */
  slamT?: number;
}

function isBlinking(frame: number, seed: number): boolean {
  const period = 44 + ((seed * 19) % 42);
  const off = (seed * 37) % period;
  return (frame + off) % period < 4;
}

function drawInk(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  fill: string | null,
  lw = 10,
  shadowBottom = true
) {
  if (fill) {
    ctx.fillStyle = fill;
    path();
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (shadowBottom) {
    ctx.save();
    ctx.translate(0, 2.5);
    ctx.lineWidth = lw + 3.5;
    path();
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineWidth = lw;
  path();
  ctx.stroke();
}

function traceBeanHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.bezierCurveTo(cx + hw * 0.85, cy - hh, cx + hw * 1.06, cy - hh * 0.15, cx + hw * 0.84, cy + hh * 0.58);
  ctx.bezierCurveTo(cx + hw * 0.62, cy + hh * 1.02, cx + hw * 0.25, cy + hh, cx, cy + hh);
  ctx.bezierCurveTo(cx - hw * 0.25, cy + hh, cx - hw * 0.62, cy + hh * 1.02, cx - hw * 0.84, cy + hh * 0.58);
  ctx.bezierCurveTo(cx - hw * 1.06, cy - hh * 0.15, cx - hw * 0.85, cy - hh, cx, cy - hh);
  ctx.closePath();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  hx: number,
  hy: number,
  sleeve: string | null
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  if (sleeve) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * 0.65, sy + (ey - sy) * 0.65);
    ctx.stroke();
    ctx.strokeStyle = sleeve;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * 0.63, sy + (ey - sy) * 0.63);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx, hy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  kx: number,
  ky: number,
  fx: number,
  fy: number,
  pantsColor: string,
  shoeColor: string,
  facing: number
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy - 20);
  ctx.stroke();
  ctx.strokeStyle = pantsColor;
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy - 20);
  ctx.stroke();
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(fx - facing * 12, fy - 2);
      ctx.lineTo(fx + facing * 28, fy - 2);
      ctx.quadraticCurveTo(fx + facing * 32, fy - 18, fx + facing * 14, fy - 21);
      ctx.lineTo(fx - facing * 12, fy - 19);
      ctx.closePath();
    },
    shoeColor,
    7,
    false
  );
  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  headW: number,
  face: WhaleFace,
  blink: boolean,
  phase: number,
  facing: number,
  d: WhaleCharDesign
) {
  ctx.save();
  const ox = facing * headW * 0.08;
  const sp = headW * 0.145;
  const ex1 = cx + ox - sp;
  const ex2 = cx + ox + sp;
  const ey = face === "lookup_shock" ? cy - 26 : cy - 6;

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (blink && face !== "panic" && face !== "lookup_shock") {
    ctx.lineWidth = 7;
    for (const x of [ex1, ex2]) {
      ctx.beginPath();
      ctx.moveTo(x - 12, ey);
      ctx.lineTo(x + 12, ey);
      ctx.stroke();
    }
  } else if (face === "panic" || face === "lookup_shock") {
    for (const x of [ex1, ex2]) {
      ctx.fillStyle = "#fbf8f1";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, ey, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      const py = face === "lookup_shock" ? ey - 8 : ey;
      ctx.beginPath();
      ctx.arc(x + facing * 2, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (face === "gagging") {
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(ex1 - 12, ey - 10); ctx.lineTo(ex1 + 8, ey); ctx.lineTo(ex1 - 12, ey + 10);
    ctx.moveTo(ex2 + 12, ey - 10); ctx.lineTo(ex2 - 8, ey); ctx.lineTo(ex2 + 12, ey + 10);
    ctx.stroke();
  } else if (face === "smug" || face === "deadpan" || face === "grumpy") {
    for (const x of [ex1, ex2]) {
      ctx.beginPath();
      ctx.ellipse(x, ey + 2, 8.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = d.skin;
    ctx.fillRect(ex1 - 14, ey - 16, 28, 12);
    ctx.fillRect(ex2 - 14, ey - 16, 28, 12);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ex1 - 13, ey - 4); ctx.lineTo(ex1 + 13, ey - 4);
    ctx.moveTo(ex2 - 13, ey - 4); ctx.lineTo(ex2 + 13, ey - 4);
    ctx.stroke();
  } else if (face === "delulu") {
    // Goofy mismatched confident eyes!
    for (const [i, x] of [ex1, ex2].entries()) {
      ctx.fillStyle = "#fbf8f1";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, ey, i === 0 ? 18 : 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + (i === 0 ? 4 : -2), ey - 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const x of [ex1, ex2]) {
      ctx.beginPath();
      ctx.ellipse(x, ey, 8.5, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Eyebrows
  ctx.lineWidth = 6.5;
  if (face === "angry" || face === "warn_shout" || face === "grumpy") {
    ctx.beginPath();
    ctx.moveTo(ex1 - 14, ey - 24); ctx.lineTo(ex1 + 12, ey - 14);
    ctx.moveTo(ex2 + 14, ey - 24); ctx.lineTo(ex2 - 12, ey - 14);
    ctx.stroke();
  }

  // Mouth
  const mx = cx + ox;
  const my = face === "lookup_shock" ? ey + 48 : ey + 42;
  ctx.lineWidth = 6.5;
  if (face === "smug" || face === "delulu" || face === "cheer") {
    if (face === "cheer") {
      ctx.fillStyle = "#5c252f";
      ctx.beginPath();
      ctx.arc(mx, my - 8, 22, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(mx, my - 10, 24, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
    }
  } else if (face === "panic" || face === "lookup_shock" || face === "warn_shout") {
    ctx.fillStyle = "#5c252f";
    ctx.beginPath();
    ctx.ellipse(mx, my + 2, 18, 24 + Math.sin(phase * 6) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (face === "gagging") {
    ctx.beginPath();
    ctx.moveTo(mx - 22, my + 4);
    ctx.quadraticCurveTo(mx, my - 14, mx + 22, my + 4);
    ctx.stroke();
    // Puffed cheeks
    ctx.beginPath();
    ctx.arc(mx - 26, my + 4, 8, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx + 26, my + 4, 8, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  } else if (face === "deadpan" || face === "grumpy") {
    ctx.beginPath();
    ctx.moveTo(mx - 20, my + 2);
    ctx.lineTo(mx + 20, my + (face === "grumpy" ? 7 : 2));
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(mx, my - 6, 15, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  if (d.mustache) {
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(mx - 15, ey + 26, 17, 7, -0.22, 0, Math.PI * 2);
        ctx.ellipse(mx + 15, ey + 26, 17, 7, 0.22, 0, Math.PI * 2);
      },
      d.hairColor,
      5,
      false
    );
  }

  if (d.glasses) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.strokeRect(ex1 - 18, ey - 14, 36, 26);
    ctx.strokeRect(ex2 - 18, ey - 14, 36, 26);
    ctx.beginPath();
    ctx.moveTo(ex1 + 18, ey - 2);
    ctx.lineTo(ex2 - 18, ey - 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  headW: number,
  headH: number,
  d: WhaleCharDesign,
  facing: number
) {
  const topY = cy - headH * 0.5;
  if (d.hat === "hard_hat") {
    // Classic bright yellow 1970 highway engineer hard hat!
    const col = d.hatColor ?? "#f2c230";
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 26, headW * 0.52, Math.PI, 0);
        ctx.closePath();
      },
      col,
      8
    );
    // Ridge crest on top
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(cx - 18, topY - 38, 36, 36, 8);
      },
      col,
      7,
      false
    );
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx + facing * 10, topY + 26, headW * 0.64, 12, 0, 0, Math.PI * 2);
      },
      col,
      7
    );
  } else if (d.hat === "silver_hair") {
    // Veteran swept silver-grey hair
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(cx - headW * 0.48, topY + 40);
        ctx.bezierCurveTo(cx - headW * 0.44, topY - 22, cx + headW * 0.46, topY - 26, cx + headW * 0.48, topY + 32);
        ctx.quadraticCurveTo(cx + 8, topY + 12, cx - headW * 0.48, topY + 40);
        ctx.closePath();
      },
      d.hairColor,
      7,
      false
    );
  } else if (d.hat === "cap") {
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 26, headW * 0.48, Math.PI, 0);
        ctx.closePath();
      },
      d.hatColor ?? "#3c5e8a",
      7
    );
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx + facing * 42, topY + 28, 42, 10, facing * 0.08, 0, Math.PI * 2);
      },
      d.hatColor ?? "#3c5e8a",
      6,
      false
    );
  } else if (d.hat === "beanie") {
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 28, headW * 0.48, Math.PI, 0);
        ctx.closePath();
      },
      d.hatColor ?? "#b8443d",
      7
    );
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(cx - headW * 0.5, topY + 14, headW, 20, 8);
      },
      d.hatColor ?? "#b8443d",
      6,
      false
    );
  } else if (d.hat === "hair_70s") {
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 34, headW * 0.5, Math.PI * 0.96, Math.PI * 2.04);
        ctx.closePath();
      },
      d.hairColor,
      7,
      false
    );
  }
}

export function drawWhaleCharacter(
  ctx: CanvasRenderingContext2D,
  d: WhaleCharDesign,
  st: WhalePoseState
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();

  const facing = st.facing ?? 1;
  const p = st.phase;
  const blink = isBlinking(st.frame, st.seed ?? 7);
  const scale = d.scale ?? 1.0;

  ctx.translate(CANVAS_W / 2, SOLE_Y);
  ctx.scale(scale, scale);

  if (st.jitter && st.jitter > 0) {
    ctx.translate(
      Math.sin(st.frame * 3.1 + (st.seed ?? 1)) * 9 * st.jitter,
      Math.cos(st.frame * 3.9 + (st.seed ?? 1)) * 6 * st.jitter
    );
  }

  const headW = 216;
  const headH = Math.round(headW * 0.94);
  const hipBaseY = -310;

  let bobY = Math.sin(p * 1.5) * 5;
  let leanRad = 0;
  let headTilt = 0;

  let lHipX = -24, rHipX = 24;
  let lKneeX = -28, lKneeY = -155, lFootX = -32, lFootY = 0;
  let rKneeX = 28, rKneeY = -155, rFootX = 32, rFootY = 0;

  const lShX = -46, lShY = -515;
  const rShX = 46, rShY = -515;
  let lElbX = -88, lElbY = -430, lHndX = -76, lHndY = -355;
  let rElbX = 88, rElbY = -430, rHndX = 76, rHndY = -355;

  const walking = st.pose === "walk" || st.pose === "carry_tnt" || st.pose === "panic_cover_run";
  if (walking) {
    const fast = st.pose === "panic_cover_run";
    const amp = fast ? 1.32 : st.pose === "carry_tnt" ? 0.65 : 0.72;
    const s = Math.sin(p);
    const c = Math.cos(p);
    bobY = -Math.abs(s) * (fast ? 38 : 20);
    leanRad = facing * (fast ? 0.16 : 0.06);

    const stride = 112 * amp;
    const lift = fast ? 84 : 42;
    lFootX = s * stride * facing;
    lFootY = Math.min(0, -Math.max(0, c) * lift);
    lKneeX = (lHipX + lFootX) * 0.52 + facing * (28 + Math.max(0, c) * 32);
    lKneeY = (hipBaseY + bobY + lFootY) * 0.5 - 12;

    rFootX = -s * stride * facing;
    rFootY = Math.min(0, -Math.max(0, -c) * lift);
    rKneeX = (rHipX + rFootX) * 0.52 + facing * (28 + Math.max(0, -c) * 32);
    rKneeY = (hipBaseY + bobY + rFootY) * 0.5 - 12;

    if (st.pose === "panic_cover_run") {
      // BOTH ARMS FOLDED OVER HEAD DODGING FALLING WHALE CHUNKS!
      const w = Math.sin(p * 2.2) * 18;
      lElbX = -125; lElbY = -655; lHndX = -32 + w; lHndY = -775;
      rElbX = 125; rElbY = -655; rHndX = 32 - w; rHndY = -775;
    } else if (st.pose === "carry_tnt") {
      // Holding chunky red TNT crate out front!
      lElbX = 48 * facing; lElbY = -445; lHndX = 108 * facing; lHndY = -450;
      rElbX = 68 * facing; rElbY = -440; rHndX = 126 * facing; rHndY = -445;
    } else {
      const asw = 62 * amp;
      lElbX = lShX - s * asw * facing; lElbY = lShY + 75; lHndX = lElbX + facing * 30; lHndY = lElbY + 55;
      rElbX = rShX + s * asw * facing; rElbY = rShY + 75; rHndX = rElbX + facing * 30; rHndY = rElbY + 55;
    }
  } else if (st.pose === "gag_nose") {
    // Pinching nose with left hand, waving right hand frantically against green stink!
    bobY = Math.sin(p * 3) * 12;
    leanRad = -facing * 0.14;
    lElbX = -65 * facing; lElbY = -545; lHndX = 8 * facing; lHndY = -625;
    const wave = Math.sin(p * 4.2) * 72;
    rElbX = 96 * facing; rElbY = -515; rHndX = (128 + wave) * facing; rHndY = -630;
  } else if (st.pose === "delulu_shrug") {
    // Classic smug delulu shrug: elbows out, hands wide up!
    bobY = -Math.abs(Math.sin(p * 2)) * 14;
    headTilt = facing * 0.12;
    lElbX = -112; lElbY = -475; lHndX = -152; lHndY = -565 - Math.sin(p * 2.5) * 18;
    rElbX = 112; rElbY = -475; rHndX = 152; rHndY = -565 - Math.sin(p * 2.5) * 18;
  } else if (st.pose === "warn_wave") {
    // Explosives veteran waving BOTH arms wildly warning Thornton!
    const w = Math.sin(p * 4.5) * 65;
    leanRad = facing * 0.16;
    lElbX = -98; lElbY = -565; lHndX = -132 + w; lHndY = -695;
    rElbX = 115 * facing; rElbY = -545; rHndX = (182 + w * 0.4) * facing; rHndY = -610;
  } else if (st.pose === "brush_off") {
    // Thornton casually waving him off with zero care!
    const w = Math.sin(p * 3.2) * 40;
    lElbX = -82; lElbY = -445; lHndX = -46; lHndY = -395;
    rElbX = 95 * facing; rElbY = -495; rHndX = (152 + w) * facing; rHndY = -525;
  } else if (st.pose === "slam_plunger") {
    const sl = st.slamT ?? Math.min(1, Math.max(0, Math.sin(p)));
    bobY = -42 * (1 - sl) + 46 * sl;
    leanRad = facing * (0.08 + sl * 0.25);
    const hy = -540 + sl * 215;
    lElbX = 48 * facing; lElbY = hy - 55; lHndX = 95 * facing; lHndY = hy;
    rElbX = 72 * facing; rElbY = hy - 55; rHndX = 115 * facing; rHndY = hy;
  } else if (st.pose === "cheer") {
    const ch = Math.sin(p * 3.6);
    bobY = -Math.abs(ch) * 32;
    lElbX = -102; lElbY = -595; lHndX = -132 + ch * 24; lHndY = -720;
    rElbX = 102; rElbY = -595; rHndX = 132 - ch * 24; rHndY = -720;
  } else if (st.pose === "lookup") {
    // Frozen staring STRAIGHT UP into the sky!
    headTilt = -facing * 0.34;
    bobY = 6;
    lElbX = -88; lElbY = -445; lHndX = -104; lHndY = -385;
    rElbX = 88; rElbY = -445; rHndX = 104; rHndY = -385;
  } else if (st.pose === "hold_keys_deadpan") {
    // Deadpan stare holding shiny car keys limply out to side!
    bobY = Math.sin(p * 1.2) * 3;
    lElbX = -76; lElbY = -435; lHndX = -68; lHndY = -355;
    rElbX = 98 * facing; rElbY = -465; rHndX = 158 * facing; rHndY = -475;
  } else if (st.pose === "shovel_dig") {
    const dig = Math.sin(p * 2.8);
    leanRad = facing * (0.14 + Math.max(0, dig) * 0.18);
    bobY = 18 + dig * 12;
    lElbX = 45 * facing; lElbY = -435; lHndX = 92 * facing; lHndY = -365 + dig * 35;
    rElbX = 75 * facing; rElbY = -465; rHndX = 138 * facing; rHndY = -415 + dig * 45;
  } else if (st.pose === "camera_film") {
    // 1970 TV cameraman hoisting a retro shoulder news camera!
    lElbX = 42 * facing; lElbY = -530; lHndX = 96 * facing; lHndY = -595;
    rElbX = 68 * facing; rElbY = -525; rHndX = 122 * facing; rHndY = -590;
  } else if (st.pose === "sit_bench") {
    bobY = 85;
    lKneeX = 52 * facing; lKneeY = -200; lFootX = 65 * facing; lFootY = -55;
    rKneeX = 72 * facing; rKneeY = -200; rFootX = 85 * facing; rFootY = -55;
  }

  // Legs
  drawLeg(ctx, lHipX, hipBaseY + bobY, lKneeX, lKneeY, lFootX, lFootY, d.pants, d.shoes, facing);
  drawLeg(ctx, rHipX, hipBaseY + bobY, rKneeX, rKneeY, rFootX, rFootY, d.pants, d.shoes, facing);

  // Upper body pivot
  ctx.save();
  ctx.translate(0, hipBaseY + bobY);
  ctx.rotate(leanRad);
  ctx.translate(0, -(hipBaseY + bobY));

  const torsoTopY = -555 + bobY;
  const torsoBotY = -305 + bobY;
  const torsoW = 112;

  // Back arm
  drawArm(ctx, lShX, lShY + bobY, lElbX, lElbY + bobY, lHndX, lHndY + bobY, d.shirt);

  // Torso capsule
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(-torsoW / 2, torsoTopY, torsoW, torsoBotY - torsoTopY + 14, 42);
    },
    d.shirt,
    10
  );

  // Optional Highway Engineer safety vest!
  if (d.vest) {
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-torsoW / 2 + 4, torsoTopY + 12, torsoW - 8, torsoBotY - torsoTopY - 12, 26);
      },
      d.vest,
      7,
      false
    );
    // White shirt V-neck & tie
    ctx.fillStyle = d.shirt;
    ctx.beginPath();
    ctx.moveTo(-22, torsoTopY + 10);
    ctx.lineTo(22, torsoTopY + 10);
    ctx.lineTo(0, torsoTopY + 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // Head
  const headCY = torsoTopY - headH * 0.44;
  const skinTint = st.face === "gagging" ? "#b6d98a" : d.skin;
  ctx.save();
  ctx.translate(0, headCY);
  ctx.rotate(headTilt);
  drawInk(ctx, () => traceBeanHead(ctx, 0, 0, headW, headH), skinTint, 10.5);
  drawFace(ctx, 0, 0, headW, st.face, blink, p, facing, d);
  drawHat(ctx, 0, 0, headW, headH, d, facing);
  ctx.restore();

  // Front arm
  drawArm(ctx, rShX, rShY + bobY, rElbX, rElbY + bobY, rHndX, rHndY + bobY, d.shirt);

  // Pose-attached hand props!
  if (st.pose === "carry_tnt") {
    ctx.save();
    ctx.translate(rHndX, rHndY + bobY - 26);
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-56, -42, 112, 82, 8);
      },
      "#c93c34",
      8
    );
    // Wooden crate slats (no text!)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.strokeRect(-42, -28, 84, 54);
    ctx.fillStyle = "#f2c94c";
    ctx.fillRect(-34, -10, 68, 18);
    ctx.restore();
  } else if (st.pose === "hold_keys_deadpan") {
    ctx.save();
    ctx.translate(rHndX, rHndY + bobY + 10);
    ctx.strokeStyle = INK;
    ctx.fillStyle = "#dce3ec";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 14, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(-5, 26, 10, 38);
    ctx.strokeRect(-5, 26, 10, 38);
    ctx.fillRect(5, 44, 12, 7);
    ctx.fillRect(5, 55, 10, 7);
    ctx.restore();
  } else if (st.pose === "shovel_dig") {
    const dig = Math.sin(p * 2.8);
    ctx.save();
    ctx.translate(rHndX, rHndY + bobY);
    ctx.rotate(facing * (0.45 + dig * 0.25));
    ctx.strokeStyle = "#8a5a34";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.lineTo(0, 180);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.strokeRect(-7, -110, 14, 290);
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(-36, 172);
        ctx.lineTo(36, 172);
        ctx.lineTo(26, 252);
        ctx.lineTo(0, 272);
        ctx.lineTo(-26, 252);
        ctx.closePath();
      },
      "#9aa4b2",
      7,
      false
    );
    ctx.restore();
  } else if (st.pose === "camera_film") {
    ctx.save();
    ctx.translate(rHndX - 18 * facing, rHndY + bobY - 22);
    ctx.scale(facing, 1);
    drawInk(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-55, -36, 110, 68, 10);
        ctx.roundRect(50, -24, 34, 42, 6);
      },
      "#363942",
      7,
      false
    );
    // Film reels on top
    drawInk(ctx, () => { ctx.beginPath(); ctx.arc(-22, -56, 22, 0, Math.PI * 2); }, "#525763", 6, false);
    drawInk(ctx, () => { ctx.beginPath(); ctx.arc(24, -56, 22, 0, Math.PI * 2); }, "#525763", 6, false);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

/** Animated rage-quitting cartoon seagull (500 x 360 canvas) */
export function drawSeagull(
  ctx: CanvasRenderingContext2D,
  phase: number,
  facing: 1 | -1
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(facing, 1);

  const flap = Math.sin(phase * 4.5);
  const bob = -flap * 22;

  // Back wing
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-10, -18 + bob);
      ctx.quadraticCurveTo(-55, -105 + flap * 95 + bob, -135, -75 + flap * 125 + bob);
      ctx.quadraticCurveTo(-60, -20 + flap * 45 + bob, 18, -6 + bob);
      ctx.closePath();
    },
    "#dfe5ec",
    8,
    false
  );

  // Plump white body
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(0, 12 + bob, 86, 44, -0.1, 0, Math.PI * 2);
    },
    "#f7f9fc",
    9
  );

  // Grumpy seagull head + orange beak
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(76, -18 + bob, 38, 0, Math.PI * 2);
    },
    "#f7f9fc",
    8
  );
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(106, -24 + bob);
      ctx.lineTo(162, -10 + bob);
      ctx.lineTo(106, 2 + bob);
      ctx.closePath();
    },
    "#f09d38",
    7,
    false
  );
  // Angry/disgusted eyebrow & eye!
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(88, -22 + bob, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(72, -38 + bob);
  ctx.lineTo(102, -28 + bob);
  ctx.stroke();

  // Front wing
  drawInk(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-22, 4 + bob);
      ctx.quadraticCurveTo(-35, -110 + flap * 120 + bob, -125, -90 + flap * 155 + bob);
      ctx.quadraticCurveTo(-45, 22 + flap * 55 + bob, 18, 18 + bob);
      ctx.closePath();
    },
    "#eef2f7",
    8,
    false
  );
  ctx.restore();
}

/** Animated 2D cartoon FX cards for the Exploding Whale */
export function drawWhaleFx(
  ctx: CanvasRenderingContext2D,
  kind: "stink" | "fireball" | "smoke" | "bang" | "blubber_splat",
  phase: number
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);

  if (kind === "stink") {
    // Wavy cartoon lime-green stink ribbons!
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      const bx = i * 68;
      ctx.strokeStyle = "#4d7827";
      ctx.lineWidth = 22;
      ctx.beginPath();
      for (let y = 130; y >= -130; y -= 14) {
        const x = bx + Math.sin(y * 0.045 + phase * 3.2 + i * 1.4) * 26;
        if (y === 130) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = "#9ae34f";
      ctx.lineWidth = 12;
      ctx.stroke();
    }
  } else if (kind === "fireball") {
    const sc = 0.88 + Math.sin(phase * 7) * 0.14;
    ctx.scale(sc, sc);
    // Outer fiery orange puff
    const blobs = [[-55, 25, 76], [58, 22, 74], [0, -35, 92], [-25, 48, 66], [30, 48, 66]];
    for (const [bx, by, br] of blobs) {
      ctx.fillStyle = "#eb6328";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const [bx, by, br] of blobs) {
      ctx.fillStyle = "#f27a2c";
      ctx.beginPath();
      ctx.arc(bx, by, br * 0.88, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bright yellow hot core
    ctx.fillStyle = "#ffe55c";
    ctx.beginPath();
    ctx.arc(0, 10, 62, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "smoke") {
    const blobs = [[-64, 24, 62], [0, -20, 80], [66, 20, 58], [-22, 46, 54], [32, 46, 52]];
    for (let i = 0; i < blobs.length; i++) {
      const [bx, by, br] = blobs[i];
      ctx.fillStyle = "#c9bfa9";
      ctx.strokeStyle = "#4d453b";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(bx + Math.sin(phase + i) * 9, by + Math.cos(phase + i) * 7, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#d9d0bd";
    for (let i = 0; i < blobs.length; i++) {
      const [bx, by, br] = blobs[i];
      ctx.beginPath();
      ctx.arc(bx + Math.sin(phase + i) * 9, by + Math.cos(phase + i) * 7, br * 0.86, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "bang") {
    ctx.fillStyle = "#ffe55c";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + phase * 0.5;
      const r = i % 2 === 0 ? 150 : 74;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === "blubber_splat") {
    ctx.fillStyle = "#c78b8e";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 72 + Math.sin(i * 3.7) * 28;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}
