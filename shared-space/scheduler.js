// ─── scheduler.js ─── Timing and loop control ──────────────────
// All timing constants and delay computations. No DOM dependencies.

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

// ─── Core timing primitive ─────────────────────────────────────
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Action timing ─────────────────────────────────────────────
export const ACTION_PAUSE_MIN = 30;
export const ACTION_PAUSE_MAX = 280;
export const SETTLE_BEFORE_CLICK_MIN = 8;
export const SETTLE_BEFORE_CLICK_MAX = 35;
export const SETTLE_AFTER_CLICK_MIN = 15;
export const SETTLE_AFTER_CLICK_MAX = 50;
export const CARET_SETTLE_MIN = 20;
export const CARET_SETTLE_MAX = 60;

// ─── Typing speed ──────────────────────────────────────────────
export const TYPE_BASE_MIN = 30;
export const TYPE_BASE_MAX = 80;
export const TYPE_SPACE_EXTRA_MIN = 10;
export const TYPE_SPACE_EXTRA_MAX = 40;
export const TYPE_PUNCT_EXTRA_MIN = 50;
export const TYPE_PUNCT_EXTRA_MAX = 120;
export const TYPE_HESITATE_CHANCE = 0.1;
export const TYPE_HESITATE_MIN = 40;
export const TYPE_HESITATE_MAX = 100;
export const TYPE_LONG_PAUSE_CHANCE = 0.03;
export const TYPE_LONG_PAUSE_MIN = 90;
export const TYPE_LONG_PAUSE_MAX = 220;

// ─── Backspace speed ───────────────────────────────────────────
export const BS_MIN = 25;
export const BS_MAX = 65;
export const BS_HESITATE_CHANCE = 0.12;
export const BS_HESITATE_MIN = 25;
export const BS_HESITATE_MAX = 60;

// ─── Drag select speed ─────────────────────────────────────────
export const DRAG_STEP_MIN = 5;
export const DRAG_STEP_MAX = 14;
export const DRAG_PAUSE_CHANCE = 0.1;
export const DRAG_PAUSE_MIN = 8;
export const DRAG_PAUSE_MAX = 30;

// ─── Computed timing ────────────────────────────────────────────
export function humanKeyDelay(ch, prev) {
  let ms = rand(TYPE_BASE_MIN, TYPE_BASE_MAX);
  if (ch === " ") ms += rand(TYPE_SPACE_EXTRA_MIN, TYPE_SPACE_EXTRA_MAX);
  if (".,!?".includes(ch)) ms += rand(TYPE_PUNCT_EXTRA_MIN, TYPE_PUNCT_EXTRA_MAX);
  if (prev && ".,!?".includes(prev)) ms += rand(25, 60);
  if (chance(TYPE_HESITATE_CHANCE)) ms += rand(TYPE_HESITATE_MIN, TYPE_HESITATE_MAX);
  if (chance(TYPE_LONG_PAUSE_CHANCE)) ms += rand(TYPE_LONG_PAUSE_MIN, TYPE_LONG_PAUSE_MAX);
  return clamp(ms, 20, 500);
}
