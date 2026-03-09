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

export function insertChunk(text, index) {
  const before = index > 0 ? text[index - 1] : "";
  const after = index < text.length ? text[index] : "";
  const hasSpaceBefore = !before || /\s/.test(before);
  const hasSpaceAfter = !after || /\s/.test(after);

  let chunk = randomWords(1, 2);
  if (chance(0.12)) chunk = "and " + chunk;
  else if (chance(0.12)) chunk = "the " + chunk;

  // Ensure proper spacing around the inserted chunk
  if (!hasSpaceBefore) chunk = " " + chunk;
  if (!hasSpaceAfter) chunk += " ";
  return chunk;
}

// ─── Word boundary snapping ─────────────────────────────────────
// Ensures an index lands at a word boundary (between words / at whitespace)
// rather than inside a word.
export function snapToWordBoundary(text, index) {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  // Already at a word boundary (whitespace on either side)
  if (/\s/.test(text[index - 1]) || /\s/.test(text[index])) return index;
  // Scan left and right for nearest whitespace boundary
  let left = index;
  while (left > 0 && !/\s/.test(text[left - 1])) left--;
  let right = index;
  while (right < text.length && !/\s/.test(text[right])) right++;
  return index - left <= right - index ? left : right;
}

// ─── Range selection (chooses what to edit) ─────────────────────
// Always selects complete words — never cuts into the middle of a word.
export function pickRange(text) {
  if (!text.length) return [0, 0];
  const matches = [...text.matchAll(/[A-Za-z0-9']+/g)];
  if (matches.length) {
    // Pick 1–3 consecutive words
    const startIdx = Math.floor(rand(0, matches.length));
    const maxSpan = Math.min(matches.length - startIdx, 3);
    const span = Math.floor(rand(1, maxSpan + 1));
    const a = matches[startIdx].index;
    const endMatch = matches[startIdx + span - 1];
    const b = endMatch.index + endMatch[0].length;
    return [a, b];
  }
  // No word characters — take a small chunk
  const a = Math.floor(rand(0, Math.max(1, text.length - 1)));
  const b = Math.min(text.length, a + Math.floor(rand(1, 4)));
  return [a, b];
}
