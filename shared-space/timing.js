// ─── timing.js ─── Shared timing utilities ─────────────────────
// Pure helpers with no DOM dependencies. Used across modules.

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function chance(p) {
  return Math.random() < p;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
