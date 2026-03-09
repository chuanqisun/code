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

// ─── Range selection (chooses what to edit) ─────────────────────
export function pickRange(text) {
  if (!text.length) return [0, 0];
  const matches = [...text.matchAll(/[A-Za-z0-9']+/g)];
  if (matches.length && chance(0.75)) {
    const m = choice(matches);
    return [m.index, m.index + m[0].length];
  }
  const a = Math.floor(rand(0, Math.max(1, text.length - 1)));
  const b = Math.floor(rand(a + 1, Math.min(text.length, a + 1 + Math.min(8, text.length - a)) + 1));
  return [a, b];
}
