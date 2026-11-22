/**
 * toon.ts — Articulated 2D cutout bean-head character drawing engine (SKILL.md)
 *
 * Design canvas: 600 x 1000, soles strictly at y = 975.
 * - Adults ~3.5 head-heights tall, legs ~1.4 HH
 * - Bean head h/w ~0.94 (narrower chin, slightly pointier crown)
 * - Dark plum ink #241726, thicker on bottom/shadow side
 * - Eyes 0.26 W apart, NO blush, NO eye highlights, face brightness ~0.93
 * - Articulated elbows, knees, torso lean, bob, 16 faces, blinking, hand props
 */

export const INK = "#241726";
export const CANVAS_W = 600;
export const CANVAS_H = 1000;
export const SOLE_Y = 975;

export type FaceId =
  | "neutral"
  | "proud"
  | "smug"
  | "determined"
  | "panting"
  | "coughing"
  | "shocked"
  | "panic"
  | "green_sick"
  | "sleeping"
  | "dizzy"
  | "wild_eyed"
  | "guilty"
  | "angry"
  | "deadpan"
  | "exhausted";

export type PoseId =
  | "idle"
  | "walk"
  | "run"
  | "sprint"
  | "panic_run"
  | "cough_wave"
  | "arms_crossed"
  | "fire_pistol"
  | "snip_scissors"
  | "pants_snipped"
  | "eat_apple"
  | "stomach_ache"
  | "nap"
  | "car_wave"
  | "whistle_bust"
  | "mix_cocktail"
  | "wild_gulp"
  | "wobble_dizzy"
  | "victory_arms"
  | "collapse_flat"
  | "gavel_slam"
  | "hand_water"
  | "crowd_cheer"
  | "sprawl_grass";

export type HandProp =
  | "none"
  | "pistol"
  | "scissors"
  | "apple"
  | "clipboard"
  | "whistle"
  | "brandy"
  | "egg"
  | "poison_vial"
  | "gold_medal"
  | "water_cup"
  | "gavel"
  | "pennant";

export type HatStyle =
  | "none"
  | "beret"
  | "bowler"
  | "tweed_cap"
  | "official_cap"
  | "boater"
  | "headband"
  | "hair_messy"
  | "hair_slick"
  | "hair_short";

export interface CharDesign {
  id: string;
  skin: string;
  shirt: string;
  shirtStripe?: string;
  pants: string;
  /** True for shorts, false for long trousers */
  shorts: boolean;
  /** Jagged freshly-cut shorts look for Félix Carvajal */
  snippedShorts?: boolean;
  shoes: string;
  barefoot?: boolean;
  hat: HatStyle;
  hatColor?: string;
  hairColor: string;
  mustache?: boolean;
  walrusMustache?: boolean;
  coat?: string;
  suspenders?: boolean;
  goldMedalOnNeck?: boolean;
  /** Slight height scale variation (0.94..1.08) */
  scale?: number;
}

export interface PoseState {
  pose: PoseId;
  face: FaceId;
  /** Continuous animation phase in radians (drives walk/run/wave/snip) */
  phase: number;
  /** Facing direction: +1 faces right, -1 faces left */
  facing?: 1 | -1;
  /** Deterministic blink seed */
  seed?: number;
  /** Current global frame (for automatic 4f blinks every 0.5-2.3s) */
  frame: number;
  /** Optional hand prop in right hand */
  propR?: HandProp;
  /** Optional hand prop in left hand */
  propL?: HandProp;
  /** Override snipped state dynamically (Carvajal before/after scissors) */
  snippedOverride?: boolean;
  /** Extra panic jitter intensity 0..1 */
  jitter?: number;
  /** Medal visibly worn on neck */
  hasMedal?: boolean;
  /** Show falling trouser cuff pieces during snip */
  cuffsFalling?: number;
}

/** Deterministic blink helper: blinks every 0.5-2.3s (15-69f) lasting 4 frames */
function isBlinking(frame: number, seed: number): boolean {
  const period = 42 + ((seed * 19) % 44); // 1.4s..2.8s avg, varied
  const offset = (seed * 37) % period;
  const t = (frame + offset) % period;
  return t < 4;
}

/** Variable-width plum ink stroke helper (thicker on bottom/shadow side) */
function drawInkShape(
  ctx: CanvasRenderingContext2D,
  drawPath: () => void,
  fill: string | null,
  lineWidth = 10,
  shadowBottom = true
) {
  if (fill) {
    ctx.fillStyle = fill;
    drawPath();
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (shadowBottom) {
    ctx.save();
    ctx.translate(0, 2.5);
    ctx.lineWidth = lineWidth + 3.5;
    drawPath();
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineWidth = lineWidth;
  drawPath();
  ctx.stroke();
}

/** Draw articulated 2-segment stick limb (upper + lower + round ink-dot hand/shoe) */
function drawArm(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  hx: number,
  hy: number,
  sleeveColor: string | null,
  thickness = 14
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Dark plum stick arm
  ctx.strokeStyle = INK;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // Optional sleeve on upper arm
  if (sleeveColor) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = thickness + 18;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * 0.65, sy + (ey - sy) * 0.65);
    ctx.stroke();

    ctx.strokeStyle = sleeveColor;
    ctx.lineWidth = thickness + 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * 0.63, sy + (ey - sy) * 0.63);
    ctx.stroke();
  }

  // Round ink-dot hand
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx, hy, thickness * 0.72, 0, Math.PI * 2);
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
  shorts: boolean,
  snipped: boolean,
  shoeColor: string,
  barefoot: boolean,
  skinColor: string,
  facing: number
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Stick leg core (plum ink)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy - 10);
  ctx.stroke();

  if (!shorts) {
    // Full dress trouser leg
    ctx.strokeStyle = INK;
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy - 24);
    ctx.stroke();

    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy - 24);
    ctx.stroke();
  } else {
    // Upper thigh shorts
    const midX = hx + (kx - hx) * 0.72;
    const midY = hy + (ky - hy) * 0.72;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(midX, midY);
    ctx.stroke();

    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(midX, midY);
    ctx.stroke();

    if (snipped) {
      // Jagged scissor-cut fringe!
      ctx.fillStyle = pantsColor;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(midX - 15, midY - 4);
      ctx.lineTo(midX - 8, midY + 12);
      ctx.lineTo(midX, midY - 2);
      ctx.lineTo(midX + 8, midY + 14);
      ctx.lineTo(midX + 15, midY - 4);
      ctx.stroke();
    }
  }

  // Foot / shoe planted neatly at fy
  const dir = facing;
  if (barefoot) {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(fx + dir * 10, fy - 9, 22, 10, 0, 0, Math.PI * 2);
      },
      skinColor,
      6,
      false
    );
  } else {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(fx - dir * 12, fy - 2);
        ctx.lineTo(fx + dir * 28, fy - 2);
        ctx.quadraticCurveTo(fx + dir * 32, fy - 18, fx + dir * 14, fy - 21);
        ctx.lineTo(fx - dir * 12, fy - 19);
        ctx.closePath();
      },
      shoeColor,
      7,
      false
    );
  }
  ctx.restore();
}

/** Bean head path (h/w ~0.94, narrower chin, slightly pointier rounded crown — SKILL.md) */
function traceBeanHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh); // Slightly pointier rounded crown
  ctx.bezierCurveTo(cx + hw * 0.85, cy - hh, cx + hw * 1.06, cy - hh * 0.15, cx + hw * 0.84, cy + hh * 0.58);
  ctx.bezierCurveTo(cx + hw * 0.62, cy + hh * 1.02, cx + hw * 0.25, cy + hh, cx, cy + hh); // Narrower chin
  ctx.bezierCurveTo(cx - hw * 0.25, cy + hh, cx - hw * 0.62, cy + hh * 1.02, cx - hw * 0.84, cy + hh * 0.58);
  ctx.bezierCurveTo(cx - hw * 1.06, cy - hh * 0.15, cx - hw * 0.85, cy - hh, cx, cy - hh);
  ctx.closePath();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  headW: number,
  face: FaceId,
  blinking: boolean,
  phase: number,
  facing: number,
  design: CharDesign
) {
  ctx.save();
  // Eyes 0.26 W apart, shifted slightly toward facing side for 3/4 charm
  const eyeOffX = facing * headW * 0.08;
  const eyeSpread = headW * 0.145; // total ~0.29W, crisp readability
  const ex1 = cx + eyeOffX - eyeSpread;
  const ex2 = cx + eyeOffX + eyeSpread;
  const ey = cy - 6;

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawNormalEye = (x: number, y: number, r = 9.5) => {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.88, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  if (face === "sleeping") {
    ctx.lineWidth = 6.5;
    for (const x of [ex1, ex2]) {
      ctx.beginPath();
      ctx.arc(x, ey + 2, 13, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    // Little peaceful snoring 'o' mouth
    ctx.fillStyle = "#5c2a33";
    ctx.beginPath();
    ctx.ellipse(cx + eyeOffX, ey + 42, 10 + Math.sin(phase * 2) * 3, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
  } else if (face === "dizzy" || face === "wild_eyed") {
    // Wide white sclera with spinning/zigzag spiral pupils!
    for (const [idx, x] of [ex1, ex2].entries()) {
      const r = face === "wild_eyed" ? 21 : 19;
      ctx.fillStyle = "#fbf8f1";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, ey, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (face === "dizzy") {
        // Animated spinning spiral inside eye!
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const spin = phase * 3.5 + idx * Math.PI;
        for (let a = 0; a < Math.PI * 3.5; a += 0.35) {
          const rad = (a / (Math.PI * 3.5)) * (r - 5);
          const px = x + Math.cos(a + spin) * rad;
          const py = ey + Math.sin(a + spin) * rad;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        // Tiny frantic pinprick pupils darting rapidly!
        ctx.fillStyle = INK;
        const jx = Math.sin(phase * 9 + idx * 2) * 5;
        const jy = Math.cos(phase * 11 + idx) * 4;
        ctx.beginPath();
        ctx.arc(x + jx, ey + jy, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Wavy hallucinatory mouth
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    const my = ey + 42;
    ctx.moveTo(cx + eyeOffX - 24, my);
    ctx.quadraticCurveTo(cx + eyeOffX - 10, my - 12, cx + eyeOffX, my + 4);
    ctx.quadraticCurveTo(cx + eyeOffX + 12, my + 16, cx + eyeOffX + 24, my - 4);
    ctx.stroke();
  } else {
    // Eyes with auto-blink
    if (blinking) {
      ctx.lineWidth = 7;
      for (const x of [ex1, ex2]) {
        ctx.beginPath();
        ctx.moveTo(x - 12, ey);
        ctx.lineTo(x + 12, ey);
        ctx.stroke();
      }
    } else if (face === "shocked" || face === "panic") {
      for (const x of [ex1, ex2]) {
        ctx.fillStyle = "#fbf8f1";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, ey, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(x + facing * 3, ey, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (face === "coughing" || face === "exhausted") {
      // Squeezed shut > < eyes!
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(ex1 - 12, ey - 10);
      ctx.lineTo(ex1 + 8, ey);
      ctx.lineTo(ex1 - 12, ey + 10);
      ctx.moveTo(ex2 + 12, ey - 10);
      ctx.lineTo(ex2 - 8, ey);
      ctx.lineTo(ex2 + 12, ey + 10);
      ctx.stroke();
    } else if (face === "deadpan" || face === "smug") {
      drawNormalEye(ex1, ey + 2, 9);
      drawNormalEye(ex2, ey + 2, 9);
      // Heavy flat upper eyelids
      ctx.fillStyle = face === "smug" ? design.skin : design.skin;
      ctx.fillRect(ex1 - 14, ey - 16, 28, 12);
      ctx.fillRect(ex2 - 14, ey - 16, 28, 12);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ex1 - 13, ey - 4);
      ctx.lineTo(ex1 + 13, ey - 4);
      ctx.moveTo(ex2 - 13, ey - 4);
      ctx.lineTo(ex2 + 13, ey - 4);
      ctx.stroke();
    } else {
      drawNormalEye(ex1, ey, 9.5);
      drawNormalEye(ex2, ey, 9.5);
    }

    // Eyebrows
    ctx.lineWidth = 6.5;
    if (face === "angry" || face === "determined") {
      ctx.beginPath();
      ctx.moveTo(ex1 - 14, ey - 24);
      ctx.lineTo(ex1 + 12, ey - 14);
      ctx.moveTo(ex2 + 14, ey - 24);
      ctx.lineTo(ex2 - 12, ey - 14);
      ctx.stroke();
    } else if (face === "guilty" || face === "panting" || face === "green_sick") {
      ctx.beginPath();
      ctx.moveTo(ex1 - 12, ey - 16);
      ctx.lineTo(ex1 + 10, ey - 25);
      ctx.moveTo(ex2 + 12, ey - 16);
      ctx.lineTo(ex2 - 10, ey - 25);
      ctx.stroke();
    } else if (face === "shocked" || face === "panic") {
      ctx.beginPath();
      ctx.arc(ex1, ey - 22, 13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex2, ey - 22, 13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // Mouth
    const mx = cx + eyeOffX;
    const my = ey + 42;
    ctx.lineWidth = 6.5;
    if (face === "proud" || face === "smug") {
      ctx.beginPath();
      ctx.arc(mx, my - 10, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (face === "panic" || face === "shocked" || face === "coughing") {
      ctx.fillStyle = "#5c252f";
      ctx.beginPath();
      ctx.ellipse(mx, my + 2, 18, face === "panic" ? 24 : 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (face === "panting" || face === "exhausted") {
      ctx.fillStyle = "#5c252f";
      ctx.beginPath();
      ctx.ellipse(mx, my + 2, 17, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Drooping tongue
      ctx.fillStyle = "#d96c79";
      ctx.beginPath();
      ctx.ellipse(mx + facing * 6, my + 16, 10, 12, facing * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (face === "green_sick") {
      // Puffed cheeks about to barf!
      ctx.beginPath();
      ctx.moveTo(mx - 20, my + 4);
      ctx.quadraticCurveTo(mx, my - 10, mx + 20, my + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx - 24, my + 4, 8, Math.PI * 0.6, Math.PI * 1.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx + 24, my + 4, 8, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    } else if (face === "angry") {
      ctx.fillStyle = "#5c252f";
      ctx.beginPath();
      ctx.roundRect(mx - 20, my - 8, 40, 22, 8);
      ctx.fill();
      ctx.stroke();
      // Gritted teeth line
      ctx.fillStyle = "#fbf8f1";
      ctx.fillRect(mx - 15, my - 4, 30, 7);
    } else if (face === "deadpan" || face === "guilty") {
      ctx.beginPath();
      ctx.moveTo(mx - 18, my + 2);
      ctx.lineTo(mx + 18, my + (face === "guilty" ? -4 : 2));
      ctx.stroke();
    } else {
      // Friendly neutral / determined line
      ctx.beginPath();
      ctx.arc(mx, my - 6, 15, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }

  // Mustaches!
  if (design.walrusMustache) {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(cx + eyeOffX, ey + 24);
        ctx.bezierCurveTo(cx + eyeOffX + 32, ey + 18, cx + eyeOffX + 54, ey + 38, cx + eyeOffX + 42, ey + 52);
        ctx.bezierCurveTo(cx + eyeOffX + 22, ey + 48, cx + eyeOffX + 8, ey + 40, cx + eyeOffX, ey + 36);
        ctx.bezierCurveTo(cx + eyeOffX - 8, ey + 40, cx + eyeOffX - 22, ey + 48, cx + eyeOffX - 42, ey + 52);
        ctx.bezierCurveTo(cx + eyeOffX - 54, ey + 38, cx + eyeOffX - 32, ey + 18, cx + eyeOffX, ey + 24);
        ctx.closePath();
      },
      design.hairColor,
      6,
      false
    );
  } else if (design.mustache) {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx + eyeOffX - 14, ey + 26, 16, 7, -0.25, 0, Math.PI * 2);
        ctx.ellipse(cx + eyeOffX + 14, ey + 26, 16, 7, 0.25, 0, Math.PI * 2);
      },
      design.hairColor,
      5,
      false
    );
  }

  // Sweat drops for panting / guilty / panic / green_sick
  if (face === "panting" || face === "guilty" || face === "panic" || face === "exhausted") {
    const dropY = ey - 32 + ((phase * 18) % 26);
    const dropX = cx - facing * (headW * 0.36);
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(dropX, dropY - 14);
        ctx.quadraticCurveTo(dropX + 11, dropY + 4, dropX, dropY + 12);
        ctx.quadraticCurveTo(dropX - 11, dropY + 4, dropX, dropY - 14);
        ctx.closePath();
      },
      "#8fd1f4",
      4.5,
      false
    );
  }

  ctx.restore();
}

function drawHatOrHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  headW: number,
  headH: number,
  design: CharDesign,
  facing: number
) {
  const topY = cy - headH * 0.5;
  const col = design.hatColor ?? design.hairColor;
  ctx.save();
  if (design.hat === "beret") {
    // Classic tilted Cuban beret for Félix Carvajal
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx - facing * 12, topY + 10, headW * 0.58, 28, -facing * 0.22, 0, Math.PI * 2);
      },
      col,
      8
    );
    // Little stem on top
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - facing * 14, topY - 16);
    ctx.lineTo(cx - facing * 20, topY - 28);
    ctx.stroke();
  } else if (design.hat === "bowler") {
    // 1904 Organizer bowler hat (James Sullivan)
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 16, headW * 0.44, Math.PI, 0);
        ctx.closePath();
      },
      col,
      8
    );
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx, topY + 18, headW * 0.64, 13, 0, 0, Math.PI * 2);
      },
      col,
      8
    );
  } else if (design.hat === "tweed_cap") {
    // 1904 newsboy/flat trainer cap
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx + facing * 10, topY + 12, headW * 0.55, 24, facing * 0.08, 0, Math.PI * 2);
      },
      col,
      8
    );
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx + facing * 52, topY + 24, 34, 10, facing * 0.14, 0, Math.PI * 2);
      },
      "#3e332c",
      7,
      false
    );
  } else if (design.hat === "official_cap") {
    // Peaked blue race official cap with brass badge
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(cx - headW * 0.44, topY - 28, headW * 0.88, 46, 12);
      },
      col,
      8
    );
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx + facing * 34, topY + 18, 46, 11, facing * 0.06, 0, Math.PI * 2);
      },
      "#1d222c",
      7,
      false
    );
    ctx.fillStyle = "#e6bf52";
    ctx.beginPath();
    ctx.arc(cx + facing * 16, topY - 5, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (design.hat === "boater") {
    // 1904 straw boater hat with red ribbon (spectators)
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(cx - headW * 0.42, topY - 24, headW * 0.84, 38, 6);
      },
      "#e8d49c",
      7
    );
    ctx.fillStyle = col;
    ctx.fillRect(cx - headW * 0.41, topY - 2, headW * 0.82, 14);
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cx, topY + 14, headW * 0.68, 10, 0, 0, Math.PI * 2);
      },
      "#e8d49c",
      7
    );
  } else if (design.hat === "headband") {
    // Runner hair + sporty headband
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 32, headW * 0.46, Math.PI * 1.06, Math.PI * 1.94);
        ctx.closePath();
      },
      design.hairColor,
      7,
      false
    );
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(cx - headW * 0.48, topY + 20, headW * 0.96, 18, 8);
      },
      col,
      6,
      false
    );
  } else if (design.hat === "hair_messy") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(cx - headW * 0.44, topY + 36);
        ctx.quadraticCurveTo(cx - headW * 0.3, topY - 24, cx - 10, topY + 2);
        ctx.quadraticCurveTo(cx + 12, topY - 30, cx + 26, topY + 4);
        ctx.quadraticCurveTo(cx + headW * 0.48, topY - 12, cx + headW * 0.45, topY + 34);
        ctx.quadraticCurveTo(cx, topY + 18, cx - headW * 0.44, topY + 36);
        ctx.closePath();
      },
      design.hairColor,
      7,
      false
    );
  } else if (design.hat === "hair_slick") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(cx - headW * 0.46, topY + 32);
        ctx.bezierCurveTo(cx - headW * 0.38, topY - 16, cx + headW * 0.48, topY - 22, cx + headW * 0.48, topY + 26);
        ctx.quadraticCurveTo(cx + 10, topY + 14, cx - headW * 0.46, topY + 32);
        ctx.closePath();
      },
      design.hairColor,
      7,
      false
    );
  } else if (design.hat === "hair_short") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(cx, topY + 34, headW * 0.46, Math.PI * 1.05, Math.PI * 1.95);
        ctx.closePath();
      },
      design.hairColor,
      7,
      false
    );
  }
  ctx.restore();
}

function drawHandProp(
  ctx: CanvasRenderingContext2D,
  prop: HandProp,
  hx: number,
  hy: number,
  facing: number,
  phase: number
) {
  if (prop === "none") return;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(facing, 1);

  if (prop === "pistol") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-8, -14, 24, 34, 4);
        ctx.roundRect(-6, -24, 58, 18, 4);
      },
      "#484d56",
      6,
      false
    );
    // Bright puff spark on fire phase!
    if (Math.sin(phase) > 0.3) {
      ctx.fillStyle = "#ffe566";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? 34 : 15;
        const px = 66 + Math.cos(a) * r;
        const py = -16 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (prop === "scissors") {
    // Giant gleaming animated open/shut steel scissors!
    const snip = 0.08 + Math.abs(Math.sin(phase * 3.2)) * 0.55;
    for (const sign of [-1, 1]) {
      ctx.save();
      ctx.rotate(sign * snip);
      drawInkShape(
        ctx,
        () => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(95, sign * 8);
          ctx.lineTo(84, sign * 20);
          ctx.lineTo(0, sign * 12);
          ctx.closePath();
        },
        "#cfd7e0",
        6,
        false
      );
      ctx.strokeStyle = INK;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(-22, sign * 14, 18, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = "#d6a43e";
    ctx.beginPath();
    ctx.arc(8, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop === "apple") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(10, -8, 22, 0, Math.PI * 2);
      },
      "#7bb542",
      6,
      false
    );
    // Bite mark
    ctx.fillStyle = "#eee5b8";
    ctx.beginPath();
    ctx.arc(24, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(10, -28);
    ctx.lineTo(14, -40);
    ctx.stroke();
  } else if (prop === "clipboard") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-10, -45, 54, 68, 6);
      },
      "#9b6c3e",
      6,
      false
    );
    ctx.fillStyle = "#f7f1e1";
    ctx.fillRect(-2, -34, 38, 50);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    for (let y = -22; y <= 6; y += 11) {
      ctx.beginPath();
      ctx.moveTo(4, y);
      ctx.lineTo(30, y);
      ctx.stroke();
    }
  } else if (prop === "whistle") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(16, -2, 14, 0, Math.PI * 2);
        ctx.rect(-4, -10, 22, 12);
      },
      "#e2b94c",
      5,
      false
    );
  } else if (prop === "brandy") {
    // Tall dark green glass brandy bottle
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-16, -68, 36, 56, 8);
        ctx.roundRect(-7, -96, 18, 32, 4);
      },
      "#3c663d",
      6,
      false
    );
    ctx.fillStyle = "#efe3c2";
    ctx.fillRect(-10, -50, 24, 22);
  } else if (prop === "egg") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(4, -14, 15, 20, 0, 0, Math.PI * 2);
      },
      "#f7f2e4",
      5.5,
      false
    );
  } else if (prop === "poison_vial") {
    // Little dark bottle with glowing lime-green poison drop!
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-14, -44, 30, 38, 7);
        ctx.roundRect(-7, -58, 16, 16, 3);
      },
      "#362a42",
      6,
      false
    );
    // Lime green poison liquid level + bubbling drop
    ctx.fillStyle = "#7fe043";
    ctx.fillRect(-9, -28, 20, 17);
    const dropOff = (phase * 25) % 24;
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(2, -66 - dropOff * 0.4, 8, 0, Math.PI * 2);
      },
      "#7fe043",
      4,
      false
    );
  } else if (prop === "gold_medal") {
    ctx.strokeStyle = "#c83b3b";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 42);
    ctx.stroke();
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(0, 56, 22, 0, Math.PI * 2);
      },
      "#f2c641",
      6,
      false
    );
    ctx.strokeStyle = "#fff3b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 56, 12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (prop === "water_cup") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(-14, -26);
        ctx.lineTo(16, -26);
        ctx.lineTo(11, 10);
        ctx.lineTo(-9, 10);
        ctx.closePath();
      },
      "#6ab7e8",
      5.5,
      false
    );
    // Splashing blue droplets
    ctx.fillStyle = "#8fd7ff";
    ctx.beginPath();
    ctx.arc(-4, -36 - Math.abs(Math.sin(phase * 4)) * 10, 5, 0, Math.PI * 2);
    ctx.arc(10, -40 - Math.abs(Math.cos(phase * 4)) * 10, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop === "gavel") {
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-6, -68, 12, 72, 4);
        ctx.roundRect(-28, -82, 56, 26, 7);
      },
      "#8c542e",
      6,
      false
    );
  } else if (prop === "pennant") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -76);
    ctx.stroke();
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(0, -74);
        ctx.lineTo(68, -56 + Math.sin(phase * 4) * 8);
        ctx.lineTo(0, -38);
        ctx.closePath();
      },
      "#c93e3e",
      5.5,
      false
    );
  }
  ctx.restore();
}

/**
 * Draw a single articulated cartoon bean-head character onto a 600x1000 canvas.
 * Soles sit precisely at y = 975.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  design: CharDesign,
  st: PoseState
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();

  const facing = st.facing ?? 1;
  const p = st.phase;
  const seed = st.seed ?? 7;
  const blink = isBlinking(st.frame, seed);
  const scale = design.scale ?? 1.0;

  // Apply height scale anchored at SOLE_Y
  ctx.translate(CANVAS_W / 2, SOLE_Y);
  ctx.scale(scale, scale);

  // Subtle jitter when hallucinating / coughing / panicking
  if (st.jitter && st.jitter > 0) {
    const jx = Math.sin(st.frame * 2.9 + seed) * 10 * st.jitter;
    const jy = Math.cos(st.frame * 3.7 + seed) * 6 * st.jitter;
    ctx.translate(jx, jy);
  }

  // SPECIAL HORIZONTAL POSES: nap / collapse_flat / sprawl_grass
  if (st.pose === "nap" || st.pose === "collapse_flat" || st.pose === "sprawl_grass") {
    drawHorizontalCharacter(ctx, design, st, blink);
    ctx.restore();
    return;
  }

  // Proportions matching SKILL.md (3.5 HH total, head ~225px, legs ~315px)
  const headW = 216;
  const headH = Math.round(headW * 0.94); // 203
  const hipBaseY = -310;

  // Compute dynamic bob, torso lean, leg joints, arm joints per PoseId!
  let bobY = 0;
  let leanRad = 0;
  let lHipX = -24, rHipX = 24;
  let lKneeX = -28, lKneeY = -155, lFootX = -32, lFootY = 0;
  let rKneeX = 28, rKneeY = -155, rFootX = 32, rFootY = 0;

  let lShX = -46, lShY = -515;
  let rShX = 46, rShY = -515;
  let lElbX = -88, lElbY = -430, lHndX = -76, lHndY = -355;
  let rElbX = 88, rElbY = -430, rHndX = 76, rHndY = -355;

  const isRunning = st.pose === "run" || st.pose === "sprint" || st.pose === "panic_run";
  const isWalking = st.pose === "walk";

  if (isRunning || isWalking) {
    const amp = st.pose === "panic_run" ? 1.35 : st.pose === "sprint" ? 1.15 : isRunning ? 0.95 : 0.58;
    const s = Math.sin(p);
    const c = Math.cos(p);
    // Walk/run bob 5-7%
    bobY = -Math.abs(s) * (isRunning ? 38 : 20);
    leanRad = facing * (st.pose === "panic_run" ? 0.14 : isRunning ? 0.11 : 0.05);

    // Articulated leg stride with real knee lift & planted foot contact!
    const stride = 115 * amp;
    const lift = isRunning ? 82 * amp : 38 * amp;

    lFootX = s * stride * facing;
    lFootY = Math.min(0, -Math.max(0, c) * lift);
    lKneeX = (lHipX + lFootX) * 0.52 + facing * (28 + Math.max(0, c) * 34);
    lKneeY = (hipBaseY + bobY + lFootY) * 0.5 - 12;

    rFootX = -s * stride * facing;
    rFootY = Math.min(0, -Math.max(0, -c) * lift);
    rKneeX = (rHipX + rFootX) * 0.52 + facing * (28 + Math.max(0, -c) * 34);
    rKneeY = (hipBaseY + bobY + rFootY) * 0.5 - 12;

    if (st.pose === "panic_run") {
      // ARMS THROWN STRAIGHT UP FLAILING WILDLY!
      const flail = Math.sin(p * 1.7) * 55;
      lElbX = -105 + flail * 0.4;
      lElbY = -610;
      lHndX = -130 + flail;
      lHndY = -720 - Math.abs(Math.cos(p)) * 28;

      rElbX = 105 - flail * 0.4;
      rElbY = -615;
      rHndX = 130 - flail;
      rHndY = -725 - Math.abs(Math.sin(p)) * 28;
    } else {
      // Opposing athletic arm pump with bent elbows!
      const armSwing = 95 * amp;
      lElbX = lShX - s * armSwing * 0.65 * facing;
      lElbY = lShY + 75;
      lHndX = lElbX + facing * 58 - s * armSwing * 0.45 * facing;
      lHndY = lElbY - 32 - s * 22;

      rElbX = rShX + s * armSwing * 0.65 * facing;
      rElbY = rShY + 75;
      rHndX = rElbX + facing * 58 + s * armSwing * 0.45 * facing;
      rHndY = rElbY - 32 + s * 22;
    }
  } else if (st.pose === "cough_wave") {
    // Hunched forward waving arm frantically clearing red dust!
    bobY = Math.sin(p * 2.5) * 14;
    leanRad = facing * 0.24;
    lFootX = -44; rFootX = 48;
    lKneeX = -32 + facing * 22; rKneeX = 40 + facing * 24;
    // Left hand braced on knee
    lElbX = -70; lElbY = -380; lHndX = -30; lHndY = -225;
    // Right arm waving crazily back & forth across face!
    const wave = Math.sin(p * 3.8) * 75;
    rElbX = 95 * facing; rElbY = -505;
    rHndX = (120 + wave) * facing; rHndY = -635 + Math.cos(p * 3.8) * 28;
  } else if (st.pose === "arms_crossed") {
    bobY = Math.sin(p) * 5;
    lElbX = -92; lElbY = -445; lHndX = 28; lHndY = -450;
    rElbX = 92; rElbY = -440; rHndX = -28; rHndY = -445;
  } else if (st.pose === "fire_pistol") {
    const recoil = Math.max(0, Math.sin(p)) * 22;
    leanRad = -facing * 0.08;
    lElbX = -82 * facing; lElbY = -445; lHndX = -62 * facing; lHndY = -365;
    rElbX = 76 * facing; rElbY = -595 - recoil;
    rHndX = 110 * facing; rHndY = -705 - recoil * 1.3;
  } else if (st.pose === "snip_scissors") {
    // Bending over operating giant scissors near knees!
    leanRad = facing * 0.34;
    bobY = 26 + Math.sin(p * 2) * 8;
    rElbX = 92 * facing; rElbY = -385;
    rHndX = 158 * facing; rHndY = -275 + Math.sin(p * 3.2) * 18;
    lElbX = 34 * facing; lElbY = -390;
    lHndX = 78 * facing; lHndY = -280;
  } else if (st.pose === "pants_snipped") {
    // Looking down in delighted surprise as trouser cuffs fall!
    bobY = -Math.abs(Math.sin(p * 2)) * 18;
    lElbX = -98; lElbY = -465; lHndX = -115; lHndY = -540;
    rElbX = 98; rElbY = -465; rHndX = 115; rHndY = -540;
  } else if (st.pose === "eat_apple") {
    const chomp = Math.abs(Math.sin(p * 3.2));
    bobY = -chomp * 10;
    lElbX = -85; lElbY = -435; lHndX = -66; lHndY = -360;
    rElbX = 96 * facing; rElbY = -495;
    rHndX = (42 + chomp * 26) * facing; rHndY = -595 - chomp * 26;
  } else if (st.pose === "stomach_ache") {
    // Hunched green-faced holding belly, knees wobbling!
    const wob = Math.sin(p * 4) * 14;
    bobY = 28;
    leanRad = facing * 0.22;
    lKneeX = -16 + wob; rKneeX = 16 - wob;
    lElbX = -86; lElbY = -420; lHndX = -12; lHndY = -395;
    rElbX = 86; rElbY = -420; rHndX = 12; rHndY = -395;
  } else if (st.pose === "car_wave") {
    // Seated clearly visible in open 1904 car: chest, head & smug waving arm high above door!
    bobY = 55 + Math.sin(p * 4.5) * 11;
    leanRad = -facing * 0.08;
    lElbX = -102; lElbY = -465; lHndX = -132; lHndY = -450;
    const wave = Math.sin(p * 3.0) * 58;
    rElbX = 96; rElbY = -575;
    rHndX = 128 + wave; rHndY = -700;
  } else if (st.pose === "whistle_bust") {
    // Furious official leaning forward, accusing finger stabbing out + whistle at mouth!
    leanRad = facing * 0.18;
    bobY = Math.sin(p * 6) * 6;
    lElbX = 42 * facing; lElbY = -545; lHndX = 24 * facing; lHndY = -610; // whistle near mouth
    rElbX = 110 * facing; rElbY = -515;
    rHndX = (195 + Math.sin(p * 5) * 14) * facing; rHndY = -525; // accusing arm straight out!
  } else if (st.pose === "mix_cocktail") {
    // Frantic trainer shaking brandy bottle up & down and pouring poison drop!
    const shake = Math.sin(p * 5.5) * 32;
    leanRad = facing * 0.1;
    lElbX = -88; lElbY = -485 + shake; lHndX = -110; lHndY = -585 + shake * 1.2;
    rElbX = 92; rElbY = -495 - shake; rHndX = 115; rHndY = -605 - shake * 1.2;
  } else if (st.pose === "wild_gulp") {
    // Gulping cocktail then springing electric crazy!
    const zing = Math.sin(p * 7) * 28;
    bobY = -22 - Math.abs(zing) * 0.6;
    leanRad = -facing * 0.14 + Math.sin(p * 6) * 0.08;
    lKneeX = -52 + zing * 0.5; rKneeX = 52 - zing * 0.5;
    lElbX = -115; lElbY = -565 + zing; lHndX = -155; lHndY = -665 - zing;
    rElbX = 115; rElbY = -565 - zing; rHndX = 155; rHndY = -665 + zing;
  } else if (st.pose === "wobble_dizzy") {
    // Stumbling side-to-side like a noodle!
    const sway = Math.sin(p * 2.2) * 0.24;
    leanRad = sway;
    bobY = Math.abs(Math.sin(p * 2.2)) * 22;
    lKneeX = -40 + Math.sin(p * 3) * 26;
    rKneeX = 40 - Math.sin(p * 3) * 26;
    lElbX = -110; lElbY = -480 + Math.sin(p * 3) * 40; lHndX = -148; lHndY = -530 - Math.cos(p * 3) * 35;
    rElbX = 110; rElbY = -480 - Math.sin(p * 3) * 40; rHndX = 148; rHndY = -530 + Math.cos(p * 3) * 35;
  } else if (st.pose === "victory_arms" || st.pose === "crowd_cheer") {
    const cheer = Math.sin(p * 3.4);
    bobY = -Math.abs(cheer) * (st.pose === "crowd_cheer" ? 28 : 22);
    lElbX = -96; lElbY = -595; lHndX = -126 + cheer * 22; lHndY = -715;
    rElbX = 96; rElbY = -595; rHndX = 126 - cheer * 22; rHndY = -715;
  } else if (st.pose === "gavel_slam") {
    const slam = Math.pow(Math.max(0, Math.sin(p * 2.6)), 3);
    leanRad = facing * (0.05 + slam * 0.16);
    lElbX = -82; lElbY = -450; lHndX = -65; lHndY = -375;
    rElbX = 88 * facing; rElbY = -565 + slam * 140;
    rHndX = 125 * facing; rHndY = -695 + slam * 260;
  } else if (st.pose === "hand_water") {
    leanRad = facing * 0.12;
    bobY = Math.sin(p * 2) * 8;
    lElbX = -75 * facing; lElbY = -450; lHndX = -58 * facing; lHndY = -370;
    rElbX = 95 * facing; rElbY = -495;
    rHndX = (165 + Math.sin(p * 2.5) * 14) * facing; rHndY = -505;
  } else {
    // Idle breathing
    bobY = Math.sin(p * 1.4) * 5;
  }

  const isSnipped = st.snippedOverride !== undefined ? st.snippedOverride : Boolean(design.snippedShorts);
  const useShorts = design.shorts || isSnipped;

  // Draw legs first (unless seated deep inside car)
  if (st.pose !== "car_wave") {
    drawLeg(
      ctx, lHipX, hipBaseY + bobY, lKneeX, lKneeY, lFootX, lFootY,
      design.pants, useShorts, isSnipped, design.shoes, Boolean(design.barefoot), design.skin, facing
    );
    drawLeg(
      ctx, rHipX, hipBaseY + bobY, rKneeX, rKneeY, rFootX, rFootY,
      design.pants, useShorts, isSnipped, design.shoes, Boolean(design.barefoot), design.skin, facing
    );
  }

  // Falling trouser cuffs gag during snip!
  if (st.cuffsFalling && st.cuffsFalling > 0) {
    const fy = -165 + st.cuffsFalling * 145;
    const rot = st.cuffsFalling * 0.7;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * (38 + st.cuffsFalling * 24), fy);
      ctx.rotate(side * rot);
      drawInkShape(
        ctx,
        () => {
          ctx.beginPath();
          ctx.roundRect(-18, -32, 36, 64, 4);
        },
        design.pants,
        6,
        false
      );
      ctx.restore();
    }
  }

  // Upper body group pivots gently from hips with torso lean!
  ctx.save();
  ctx.translate(0, hipBaseY + bobY);
  ctx.rotate(leanRad);
  ctx.translate(0, -(hipBaseY + bobY));

  const torsoTopY = -555 + bobY;
  const torsoBotY = -305 + bobY;
  const torsoW = design.coat ? 124 : 108;

  // Back arm behind torso
  const sleeveCol = design.coat ? design.coat : design.hat === "beret" ? design.shirt : null;
  drawArm(ctx, lShX, lShY + bobY, lElbX, lElbY + bobY, lHndX, lHndY + bobY, sleeveCol);
  if (st.propL && st.propL !== "none") {
    drawHandProp(ctx, st.propL, lHndX, lHndY + bobY, facing, p);
  }

  // Rounded capsule torso (painted shirt or 1904 coat)
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(-torsoW / 2, torsoTopY, torsoW, torsoBotY - torsoTopY + 14, 42);
    },
    design.coat ?? design.shirt,
    10
  );

  // Athletic singlet chest stripe or suspenders or frock coat lapels
  if (design.coat) {
    // White collared shirt triangle + tie
    ctx.fillStyle = "#f4efe4";
    ctx.beginPath();
    ctx.moveTo(-24, torsoTopY + 6);
    ctx.lineTo(24, torsoTopY + 6);
    ctx.lineTo(0, torsoTopY + 84);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#b83c3c";
    ctx.beginPath();
    ctx.moveTo(-8, torsoTopY + 18);
    ctx.lineTo(8, torsoTopY + 18);
    ctx.lineTo(0, torsoTopY + 78);
    ctx.closePath();
    ctx.fill();
  } else if (design.shirtStripe) {
    ctx.fillStyle = design.shirtStripe;
    ctx.fillRect(-torsoW / 2 + 6, torsoTopY + 66, torsoW - 12, 34);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-torsoW / 2 + 6, torsoTopY + 66);
    ctx.lineTo(torsoW / 2 - 6, torsoTopY + 66);
    ctx.moveTo(-torsoW / 2 + 6, torsoTopY + 100);
    ctx.lineTo(torsoW / 2 - 6, torsoTopY + 100);
    ctx.stroke();
  }
  if (design.suspenders) {
    ctx.strokeStyle = "#6c4830";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-26, torsoTopY + 14);
    ctx.lineTo(-26, torsoBotY + 4);
    ctx.moveTo(26, torsoTopY + 14);
    ctx.lineTo(26, torsoBotY + 4);
    ctx.stroke();
  }

  // Gold medal draped on neck!
  if (st.hasMedal || design.goldMedalOnNeck) {
    ctx.strokeStyle = "#c83b3b";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-28, torsoTopY + 4);
    ctx.lineTo(0, torsoTopY + 86);
    ctx.lineTo(28, torsoTopY + 4);
    ctx.stroke();
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(0, torsoTopY + 104, 24, 0, Math.PI * 2);
      },
      "#f2c641",
      6,
      false
    );
  }

  // Bean Head!
  const headCY = torsoTopY - headH * 0.44;
  const faceTint = st.face === "green_sick" ? "#b7d98b" : design.skin;
  drawInkShape(
    ctx,
    () => {
      traceBeanHead(ctx, 0, headCY, headW, headH);
    },
    faceTint,
    10.5
  );

  // Face + Hat/Hair
  drawFace(ctx, 0, headCY, headW, st.face, blink, p, facing, design);
  drawHatOrHair(ctx, 0, headCY, headW, headH, design, facing);

  // Front arm in front of torso
  drawArm(ctx, rShX, rShY + bobY, rElbX, rElbY + bobY, rHndX, rHndY + bobY, sleeveCol);
  if (st.propR && st.propR !== "none") {
    drawHandProp(ctx, st.propR, rHndX, rHndY + bobY, facing, p);
  }

  ctx.restore();
  ctx.restore();
}

/** Special horizontal sleeping / collapsed / sprawled character pose */
function drawHorizontalCharacter(
  ctx: CanvasRenderingContext2D,
  design: CharDesign,
  st: PoseState,
  blink: boolean
) {
  const p = st.phase;
  const breath = Math.sin(p * 1.8) * 6;
  const isSnipped = st.snippedOverride !== undefined ? st.snippedOverride : Boolean(design.snippedShorts);

  if (st.pose === "collapse_flat") {
    // Lying flat on back on grass, ONE stiff straight arm sticking vertically up holding gold medal!
    const gy = -42;
    // Legs lying right
    drawLeg(ctx, 40, gy, 130, gy - 8, 225, gy + 12, design.pants, true, false, design.shoes, false, design.skin, 1);
    drawLeg(ctx, 40, gy + 10, 125, gy + 16, 215, gy + 24, design.pants, true, false, design.shoes, false, design.skin, 1);
    // Horizontal torso
    drawInkShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.roundRect(-105, gy - 44, 155, 86, 36);
      },
      design.shirt,
      10
    );
    // Stiff arm straight UP holding the gleaming gold medal!
    drawArm(ctx, -20, gy - 32, -20, gy - 145, -20, gy - 255 + breath, null, 14);
    drawHandProp(ctx, "gold_medal", -20, gy - 255 + breath, 1, p);
    // Head resting on ground left
    ctx.save();
    ctx.translate(-175, gy - 35);
    ctx.rotate(-0.12);
    drawInkShape(ctx, () => traceBeanHead(ctx, 0, 0, 188, 178), design.skin, 10);
    drawFace(ctx, 0, 0, 188, "exhausted", true, p, 1, design);
    drawHatOrHair(ctx, 0, 0, 188, 178, design, 1);
    ctx.restore();
    return;
  }

  // Nap or sprawl on grass (curled sideways sleeping!)
  const gy = -52;
  drawLeg(
    ctx, 50, gy, 125, gy - 55, 195, gy + 8,
    design.pants, design.shorts || isSnipped, isSnipped, design.shoes, Boolean(design.barefoot), design.skin, 1
  );
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(-95, gy - 58 - breath * 0.6, 155, 92 + breath * 0.6, 40);
    },
    design.shirt,
    10
  );
  // Arm curled gently as pillow under bean head
  drawArm(ctx, -65, gy - 24, -125, gy - 10, -165, gy - 22, design.hat === "beret" ? design.shirt : null, 13);
  ctx.save();
  ctx.translate(-155, gy - 46);
  ctx.rotate(-0.22);
  drawInkShape(ctx, () => traceBeanHead(ctx, 0, 0, 192, 182), design.skin, 10);
  drawFace(ctx, 0, 0, 192, st.pose === "nap" ? "sleeping" : "exhausted", blink, p, 1, design);
  drawHatOrHair(ctx, 0, 0, 192, 182, design, 1);
  ctx.restore();
}

/**
 * ICONIC CLIMAX COMPOSITE CARD (900 x 1000 canvas):
 * Two sprinting trainers gripping Thomas Hicks under both armpits,
 * carrying him forward while HIS LEGS KEEP BICYCLING FURIOUSLY IN MID-AIR!
 */
export function drawCarriedHicksComposite(
  ctx: CanvasRenderingContext2D,
  hicks: CharDesign,
  trainerA: CharDesign,
  trainerB: CharDesign,
  phase: number,
  frame: number
): void {
  const W = ctx.canvas.width; // 900
  const H = ctx.canvas.height; // 1000
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, SOLE_Y);

  // Back trainer (left-rear supporting Hicks' left arm)
  ctx.save();
  ctx.translate(-175, -18);
  drawSingleSupportingTrainer(ctx, trainerA, phase, frame, 1, 175);
  ctx.restore();

  // THOMAS HICKS SUSPENDED MID-AIR IN CENTER!
  ctx.save();
  const hoverY = -125 + Math.sin(phase * 2) * 20;
  ctx.translate(0, hoverY);

  // HIS LEGS BICYCLING FURIOUSLY IN MID-AIR (2.4x faster than trainers' stride!)
  const bp = phase * 2.4;
  const r1 = 68;
  const lFootX = Math.cos(bp) * r1 + 15;
  const lFootY = -155 + Math.sin(bp) * r1;
  const lKneeX = -15 + Math.cos(bp - 0.8) * 44;
  const lKneeY = -245 + Math.sin(bp - 0.8) * 34;

  const rFootX = Math.cos(bp + Math.PI) * r1 + 15;
  const rFootY = -155 + Math.sin(bp + Math.PI) * r1;
  const rKneeX = 25 + Math.cos(bp + Math.PI - 0.8) * 44;
  const rKneeY = -245 + Math.sin(bp + Math.PI - 0.8) * 34;

  drawLeg(ctx, -22, -315, lKneeX, lKneeY, lFootX, lFootY, hicks.pants, true, false, hicks.shoes, false, hicks.skin, 1);
  drawLeg(ctx, 22, -315, rKneeX, rKneeY, rFootX, rFootY, hicks.pants, true, false, hicks.shoes, false, hicks.skin, 1);

  // Motion blur arcs under bicycling feet!
  ctx.strokeStyle = "rgba(36, 23, 38, 0.45)";
  ctx.lineWidth = 6;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.arc(15, -155, 86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Hicks' torso draped outward across trainers' shoulders
  drawArm(ctx, -45, -515, -108, -505, -165, -490, null, 14);
  drawArm(ctx, 45, -515, 108, -505, 165, -490, null, 14);

  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(-54, -555, 108, 252, 42);
    },
    hicks.shirt,
    10
  );
  if (hicks.shirtStripe) {
    ctx.fillStyle = hicks.shirtStripe;
    ctx.fillRect(-48, -488, 96, 32);
  }

  // Hicks' woozy head lolling back with spinning dizzy eyes!
  ctx.save();
  ctx.translate(0, -640);
  ctx.rotate(-0.22 + Math.sin(phase * 1.5) * 0.12);
  drawInkShape(ctx, () => traceBeanHead(ctx, 0, 0, 210, 198), hicks.skin, 10.5);
  drawFace(ctx, 0, 0, 210, "dizzy", false, phase, 1, hicks);
  drawHatOrHair(ctx, 0, 0, 210, 198, hicks, 1);
  ctx.restore();
  ctx.restore();

  // Front trainer (right-front gripping Hicks' right arm)
  ctx.save();
  ctx.translate(185, 8);
  drawSingleSupportingTrainer(ctx, trainerB, phase + Math.PI, frame, 1, -185);
  ctx.restore();

  ctx.restore();
}

function drawSingleSupportingTrainer(
  ctx: CanvasRenderingContext2D,
  design: CharDesign,
  phase: number,
  frame: number,
  facing: 1 | -1,
  reachToCenterX: number
) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const bobY = -Math.abs(s) * 28;
  const stride = 105;
  const lift = 68;
  const hipY = -310 + bobY;

  const lFootX = s * stride;
  const lFootY = Math.min(0, -Math.max(0, c) * lift);
  const rFootX = -s * stride;
  const rFootY = Math.min(0, -Math.max(0, -c) * lift);

  drawLeg(ctx, -22, hipY, (-22 + lFootX) * 0.5 + 26, (hipY + lFootY) * 0.5, lFootX, lFootY, design.pants, false, false, design.shoes, false, design.skin, 1);
  drawLeg(ctx, 22, hipY, (22 + rFootX) * 0.5 + 26, (hipY + rFootY) * 0.5, rFootX, rFootY, design.pants, false, false, design.shoes, false, design.skin, 1);

  ctx.save();
  ctx.rotate(0.08);
  // Arm reaching inward to hoist Hicks!
  const reachX = Math.sign(reachToCenterX) * 125;
  drawArm(ctx, Math.sign(reachToCenterX) * 42, -505 + bobY, reachX * 0.6, -545 + bobY, reachX, -595 + bobY, null, 14);
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(-54, -555 + bobY, 108, 255, 42);
    },
    design.shirt,
    10
  );
  if (design.suspenders) {
    ctx.strokeStyle = "#6c4830";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-24, -540 + bobY);
    ctx.lineTo(-24, -308 + bobY);
    ctx.moveTo(24, -540 + bobY);
    ctx.lineTo(24, -308 + bobY);
    ctx.stroke();
  }
  const headY = -645 + bobY;
  drawInkShape(ctx, () => traceBeanHead(ctx, 0, headY, 200, 188), design.skin, 10);
  drawFace(ctx, 0, headY, 200, "determined", isBlinking(frame, 31), phase, facing, design);
  drawHatOrHair(ctx, 0, headY, 200, 188, design, facing);
  // Outer pumping arm
  const outSign = -Math.sign(reachToCenterX);
  drawArm(ctx, outSign * 44, -505 + bobY, outSign * 92, -430 + bobY, outSign * 78 + s * 45, -365 + bobY, null, 14);
  ctx.restore();
}

/**
 * Animated 2D cutout wild scruffy feral dog chasing Len Taunyane! (500 x 400 canvas)
 */
export function drawWildDog(
  ctx: CanvasRenderingContext2D,
  coatColor: string,
  phase: number,
  facing: 1 | -1
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H - 24);
  ctx.scale(facing, 1);

  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const bounce = -Math.abs(s) * 24;

  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = 14;

  // 4 galloping legs
  const drawDogLeg = (bx: number, by: number, swing: number) => {
    const fx = bx + swing * 62;
    const fy = Math.min(0, -Math.max(0, swing) * 42);
    ctx.beginPath();
    ctx.moveTo(bx, by + bounce);
    ctx.lineTo((bx + fx) * 0.5 + 14, (by + bounce + fy) * 0.5);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  };
  drawDogLeg(-72, -105, s);
  drawDogLeg(-46, -105, c);
  drawDogLeg(52, -105, -s);
  drawDogLeg(76, -105, -c);

  // Bristling wagging tail
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(-98, -142 + bounce);
  ctx.quadraticCurveTo(-155, -185 + bounce + Math.sin(phase * 3) * 24, -142, -225 + bounce);
  ctx.stroke();

  // Bean-shaped scruffy body
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(-8, -135 + bounce, 105, 52, -0.08 + s * 0.08, 0, Math.PI * 2);
    },
    coatColor,
    9
  );

  // Snapping dog head
  ctx.save();
  ctx.translate(98, -172 + bounce);
  ctx.rotate(s * 0.12);
  // Flapping ear
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(-28, -32, 18, 34, -0.5 + Math.sin(phase * 2) * 0.35, 0, Math.PI * 2);
    },
    "#5c3d28",
    7,
    false
  );
  // Skull + snout
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 56, 44, 0, 0, Math.PI * 2);
      ctx.roundRect(22, -22, 62, 28, 12);
    },
    coatColor,
    8
  );
  // Snapping open jaw with pointy cartoon teeth!
  const jawOpen = 0.25 + Math.abs(Math.sin(phase * 2.2)) * 0.45;
  ctx.save();
  ctx.translate(30, 8);
  ctx.rotate(jawOpen);
  drawInkShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.roundRect(0, -6, 52, 18, 8);
    },
    coatColor,
    7,
    false
  );
  ctx.restore();
  // Teeth
  ctx.fillStyle = "#fbf8f1";
  ctx.beginPath();
  ctx.moveTo(42, 6); ctx.lineTo(50, 20); ctx.lineTo(58, 6);
  ctx.moveTo(62, 6); ctx.lineTo(70, 20); ctx.lineTo(78, 6);
  ctx.fill();
  // Angry eye + black nose
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(16, -12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -28); ctx.lineTo(30, -18);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(84, -14, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

/**
 * Animated 2D effect cards on NOINK layer: red dust puffs, radiator steam, bang starbursts!
 */
export function drawEffectCard(
  ctx: CanvasRenderingContext2D,
  kind: "dust" | "steam" | "bang" | "dizzy_stars" | "water_splash",
  phase: number
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);

  if (kind === "dust" || kind === "steam") {
    const col = kind === "dust" ? "#c98556" : "#f2f6fa";
    const edge = kind === "dust" ? "#7a4425" : "#7c8fa3";
    const blobs = [
      [-65, 22, 62],
      [0, -18, 78],
      [70, 18, 58],
      [-24, 42, 54],
      [34, 46, 50],
    ];
    for (let i = 0; i < blobs.length; i++) {
      const [bx, by, br] = blobs[i];
      const pulse = 1 + Math.sin(phase * 2.5 + i * 1.3) * 0.12;
      ctx.fillStyle = col;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(bx + Math.sin(phase + i) * 10, by + Math.cos(phase + i) * 8, br * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Inner soft fill to hide internal circles
    ctx.fillStyle = col;
    for (let i = 0; i < blobs.length; i++) {
      const [bx, by, br] = blobs[i];
      ctx.beginPath();
      ctx.arc(bx + Math.sin(phase + i) * 10, by + Math.cos(phase + i) * 8, br * 0.88, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "bang") {
    const sc = 0.85 + Math.sin(phase * 6) * 0.15;
    ctx.scale(sc, sc);
    ctx.fillStyle = "#ffe55c";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + phase * 0.6;
      const r = i % 2 === 0 ? 145 : 72;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === "dizzy_stars") {
    for (let i = 0; i < 4; i++) {
      const a = phase * 2.6 + (i * Math.PI) / 2;
      const sx = Math.cos(a) * 110;
      const sy = Math.sin(a) * 38;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(phase * 3 + i);
      ctx.fillStyle = i % 2 === 0 ? "#ffd84d" : "#8ee86b";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const ka = (k / 10) * Math.PI * 2;
        const kr = k % 2 === 0 ? 28 : 12;
        if (k === 0) ctx.moveTo(Math.cos(ka) * kr, Math.sin(ka) * kr);
        else ctx.lineTo(Math.cos(ka) * kr, Math.sin(ka) * kr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (kind === "water_splash") {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.9 + (i / 6) * Math.PI * 0.8;
      const dist = 45 + ((phase * 95 + i * 27) % 105);
      ctx.fillStyle = "#7dd0ff";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}
