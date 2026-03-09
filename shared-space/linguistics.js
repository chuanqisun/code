// ─── linguistics.js ─── Word choice and procedural content ─────
// Pure content generation — no DOM dependencies.

// ─── Local helpers ──────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function chance(p) {
  return Math.random() < p;
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Word bank ──────────────────────────────────────────────────
export const WORDS = [
  "human",
  "bot",
  "shared",
  "space",
  "cursor",
  "draft",
  "edit",
  "text",
  "hello",
  "note",
  "tiny",
  "blue",
  "random",
  "growing",
  "canvas",
  "alive",
  "typing",
  "select",
  "delete",
  "replace",
  "move",
  "click",
  "future",
  "signal",
  "paper",
  "soft",
  "prompt",
  "idea",
  "loop",
  "trace",
  "shape",
  "pixel",
  "small",
  "story",
  "marker",
  "world",
  "flow",
  "plain",
  "quick",
  "slow",
  "thought",
  "field",
  "line",
  "window",
];

// ─── Generators ─────────────────────────────────────────────────
export function randomWords(min, max) {
  const n = Math.floor(rand(min || 1, (max || 3) + 1));
  const out = [];
  for (let i = 0; i < n; i++) out.push(choice(WORDS));
  return out.join(" ");
}

export function randomPhrase(min, max) {
  let s = randomWords(min, max);
  if (chance(0.22)) s += choice([".", "?", "!", "..."]);
  return s;
}

export function appendChunk(current) {
  let s = randomPhrase(1, chance(0.5) ? 2 : 4);
  if (current && !/\s$/.test(current) && /^[a-z]/i.test(s)) s = " " + s;
  return s;
}

export function insertChunk() {
  return choice([randomWords(1, 2), " " + randomWords(1, 2), ", ", " and ", " the ", ". ", "..."]);
}

// ─── Word boundary utilities ────────────────────────────────
/** Returns sorted array of word-boundary indices in text. */
export function wordBoundaries(text) {
  const bounds = new Set([0, text.length]);
  for (let i = 1; i < text.length; i++) {
    const prev = /\w/.test(text[i - 1]);
    const curr = /\w/.test(text[i]);
    if (prev !== curr) bounds.add(i);
  }
  return [...bounds].sort((a, b) => a - b);
}

/** Snap an index to the nearest word boundary. */
export function snapToWordBoundary(text, index) {
  const bounds = wordBoundaries(text);
  let best = bounds[0];
  for (const b of bounds) {
    if (Math.abs(b - index) < Math.abs(best - index)) best = b;
  }
  return best;
}

// ─── Range selection (chooses what to edit) ─────────────────
export function pickRange(text) {
  if (!text.length) return [0, 0];
  const matches = [...text.matchAll(/[A-Za-z0-9']+/g)];
  if (matches.length && chance(0.75)) {
    // Select one or more consecutive words
    const i0 = Math.floor(rand(0, matches.length));
    const span = Math.floor(rand(1, Math.min(3, matches.length - i0) + 1));
    const startM = matches[i0];
    const endM = matches[i0 + span - 1];
    return [startM.index, endM.index + endM[0].length];
  }
  // Fallback: snap to word boundaries
  const bounds = wordBoundaries(text);
  if (bounds.length >= 2) {
    const i = Math.floor(rand(0, bounds.length - 1));
    const j = Math.floor(rand(i + 1, Math.min(bounds.length, i + 4)));
    return [bounds[i], bounds[j]];
  }
  return [0, text.length];
}
