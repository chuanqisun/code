// ─── human-typing.js ─── Human-like keystroke timing ────────────
// Computes realistic per-character delays for typing simulation.

import { chance, clamp, rand } from "./timing.js";

// ─── Typing speed constants ────────────────────────────────────
const TYPE_BASE_MIN = 30;
const TYPE_BASE_MAX = 80;
const TYPE_SPACE_EXTRA_MIN = 10;
const TYPE_SPACE_EXTRA_MAX = 40;
const TYPE_PUNCT_EXTRA_MIN = 50;
const TYPE_PUNCT_EXTRA_MAX = 120;
const TYPE_HESITATE_CHANCE = 0.1;
const TYPE_HESITATE_MIN = 40;
const TYPE_HESITATE_MAX = 100;
const TYPE_LONG_PAUSE_CHANCE = 0.03;
const TYPE_LONG_PAUSE_MIN = 90;
const TYPE_LONG_PAUSE_MAX = 220;

// ─── Computed delay ─────────────────────────────────────────────
export function humanKeyDelay(ch, prev) {
  let ms = rand(TYPE_BASE_MIN, TYPE_BASE_MAX);
  if (ch === " ") ms += rand(TYPE_SPACE_EXTRA_MIN, TYPE_SPACE_EXTRA_MAX);
  if (".,!?".includes(ch)) ms += rand(TYPE_PUNCT_EXTRA_MIN, TYPE_PUNCT_EXTRA_MAX);
  if (prev && ".,!?".includes(prev)) ms += rand(25, 60);
  if (chance(TYPE_HESITATE_CHANCE)) ms += rand(TYPE_HESITATE_MIN, TYPE_HESITATE_MAX);
  if (chance(TYPE_LONG_PAUSE_CHANCE)) ms += rand(TYPE_LONG_PAUSE_MIN, TYPE_LONG_PAUSE_MAX);
  return clamp(ms, 20, 500);
}
