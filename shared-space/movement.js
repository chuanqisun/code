// ─── movement.js ─── How the cursor moves ──────────────────────
// Pure cursor movement engine. Operates on a bot object with {x, y, updateCursor()}.
// No direct DOM globals — only uses requestAnimationFrame and performance.now.

// ─── Local helpers ──────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function chance(p) {
  return Math.random() < p;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function distPt(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ─── Constants ──────────────────────────────────────────────────
export const BALLISTIC_MIN = 60;
export const BALLISTIC_MAX = 420;
export const BALLISTIC_PER_PX = 0.25;
export const BALLISTIC_PER_ID = 55;
export const CORRECTION_MIN = 30;
export const CORRECTION_MAX = 120;
export const CORRECTION_PER_PX = 0.9;

// ─── Easing ─────────────────────────────────────────────────────
export function humanEase(t) {
  if (t < 0.08) return t * 4.5;
  if (t < 0.7) return 0.36 + ((t - 0.08) / 0.62) * 0.54;
  return 0.9 + (1 - Math.pow(1 - (t - 0.7) / 0.3, 2.6)) * 0.1;
}

// ─── Segment animation (cubic Bézier with jitter) ───────────────
export async function animateSegment(bot, from, to, duration, bendScale, jitter) {
  bendScale = bendScale ?? 1;
  jitter = jitter ?? 0.08;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  const bend = Math.min(120, d * rand(0.06, 0.18)) * (chance(0.5) ? -1 : 1) * bendScale;

  const p1 = {
    x: from.x + dx * rand(0.18, 0.3) + nx * bend * rand(0.3, 0.9),
    y: from.y + dy * rand(0.18, 0.3) + ny * bend * rand(0.3, 0.9),
  };
  const p2 = {
    x: from.x + dx * rand(0.68, 0.86) - nx * bend * rand(0.1, 0.5),
    y: from.y + dy * rand(0.68, 0.86) - ny * bend * rand(0.1, 0.5),
  };

  const start = performance.now();
  await new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = humanEase(t);
      const omt = 1 - e;
      const px = omt * omt * omt * from.x + 3 * omt * omt * e * p1.x + 3 * omt * e * e * p2.x + e * e * e * to.x;
      const py = omt * omt * omt * from.y + 3 * omt * omt * e * p1.y + 3 * omt * e * e * p2.y + e * e * e * to.y;
      const settle = 1 - e;
      bot.x = px + rand(-jitter, jitter) * settle * d * 0.015;
      bot.y = py + rand(-jitter, jitter) * settle * d * 0.015;
      bot.updateCursor();
      if (t < 1) requestAnimationFrame(frame);
      else {
        bot.x = to.x;
        bot.y = to.y;
        bot.updateCursor();
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

// ─── Fitts-law human-like cursor movement ───────────────────────
export async function moveHumanLike(bot, x, y, precision) {
  precision = precision || "normal";
  const from = { x: bot.x, y: bot.y };
  const target = { x, y };
  const D = distPt(from, target);
  if (D < 1) return;

  const width = precision === "text" ? 7 : precision === "click" ? 10 : 22;
  const ID = Math.log2(D / width + 1);
  const ballisticTime = clamp(BALLISTIC_MIN + ID * BALLISTIC_PER_ID + D * BALLISTIC_PER_PX, BALLISTIC_MIN, BALLISTIC_MAX);

  let corrections;
  if (precision === "travel") corrections = D < 180 ? 0 : chance(0.6) ? 1 : 0;
  else if (precision === "text") corrections = D < 80 ? 1 : D < 250 ? (chance(0.65) ? 1 : 2) : chance(0.35) ? 2 : 3;
  else corrections = D < 80 ? 1 : D < 250 ? (chance(0.7) ? 1 : 2) : chance(0.45) ? 2 : 3;

  const nearRadiusBase = precision === "text" ? 0.065 : 0.05;
  const nearRadius = corrections ? clamp(D * nearRadiusBase, 2.5, precision === "text" ? 20 : 16) : 0;
  const angle = rand(0, Math.PI * 2);
  const near = corrections ? { x: x + Math.cos(angle) * nearRadius, y: y + Math.sin(angle) * nearRadius } : target;

  await animateSegment(bot, from, near, ballisticTime, 1, 0.12);
  let current = { x: bot.x, y: bot.y };

  for (let i = 0; i < corrections; i++) {
    const remain = distPt(current, target);
    const finalStep = i === corrections - 1;
    const r = finalStep ? 0 : Math.max(0.7, remain * rand(0.18, 0.45));
    const a = rand(0, Math.PI * 2);
    const subTarget = finalStep ? target : { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    if (chance(0.25)) await sleep(rand(5, 20));
    await animateSegment(bot, current, subTarget, clamp(CORRECTION_MIN + remain * CORRECTION_PER_PX, CORRECTION_MIN, CORRECTION_MAX), 0.32, 0.03);
    current = { x: bot.x, y: bot.y };
  }
}

// ─── Edge point generation (for bot entry / exit) ───────────────
export function randomEdgePoint(rect) {
  const side = Math.floor(rand(0, 4));
  if (side === 0) return { x: rand(rect.left, rect.right), y: rect.top - rand(24, 80) };
  if (side === 1) return { x: rect.right + rand(24, 80), y: rand(rect.top, rect.bottom) };
  if (side === 2) return { x: rand(rect.left, rect.right), y: rect.bottom + rand(24, 80) };
  return { x: rect.left - rand(24, 80), y: rand(rect.top, rect.bottom) };
}
