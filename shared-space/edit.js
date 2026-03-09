// ─── edit.js ─── Text editing and DOM binding ───────────────────
// Handles box creation, text manipulation, locking, caret/selection visuals.
// Functions receive DOM elements as parameters — no module-level globals.

// ─── Local helpers ──────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function normalizeText(s) {
  return (s || "").replace(/\r?\n/g, " ");
}

// ─── Layout constants ──────────────────────────────────────────
export const PAD_X = 6;
export const PAD_Y = 5;
export const LINE_H = 28;
export const FONT = "22px monospace";

// ─── Character measurement ─────────────────────────────────────
export function measureCharWidth(font) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font || FONT;
  return ctx.measureText("M").width;
}

// ─── Text access ────────────────────────────────────────────────
export function getText(box) {
  return box.textEl.textContent || "";
}

export function setText(box, text) {
  box.textEl.textContent = normalizeText(text);
}

export function replaceRange(box, start, end, insertText) {
  const t = getText(box);
  start = clamp(start, 0, t.length);
  end = clamp(end, 0, t.length);
  if (end < start) [start, end] = [end, start];
  setText(box, t.slice(0, start) + insertText + t.slice(end));
  return start + insertText.length;
}

// ─── Caret / index positioning ─────────────────────────────────
export function pagePointForIndex(box, index, charW) {
  const rect = box.textEl.getBoundingClientRect();
  const len = getText(box).length;
  index = clamp(index, 0, len);
  return { x: rect.left + PAD_X + charW * index + 1, y: rect.top + PAD_Y + LINE_H * 0.55 };
}

// ─── Box locking ────────────────────────────────────────────────
export function isHumanFocusedBox(box) {
  const ae = document.activeElement;
  return !!(ae && ae.closest && ae.closest(".box") === box.el);
}

export function canBotUseBox(box, botId) {
  return box && box.el.isConnected && !isHumanFocusedBox(box) && (!box.lock || box.lock === botId);
}

export function acquireBox(box, botId) {
  if (!canBotUseBox(box, botId)) return false;
  box.lock = botId;
  return true;
}

export function releaseBox(box, botId) {
  if (box && box.lock === botId) box.lock = null;
}

// ─── Visual feedback ────────────────────────────────────────────
export function showClick(x, y, cursorLayer) {
  const d = document.createElement("div");
  d.className = "click";
  d.style.left = x + "px";
  d.style.top = y + "px";
  cursorLayer.appendChild(d);
  setTimeout(() => d.remove(), 260);
}

// ─── Selection / caret helpers ─────────────────────────────────
export function insertTextAtSelection(text) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function placeCaretEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function scrubEditable(el) {
  const txt = normalizeText(el.textContent);
  if (txt !== el.textContent) {
    el.textContent = txt;
    placeCaretEnd(el);
  }
}

// ─── Box creation ───────────────────────────────────────────────
// Returns a box object. Caller is responsible for tracking it (e.g. pushing to an array).
export function createBox(id, left, top, text, workspace) {
  const r = workspace.getBoundingClientRect();
  left = clamp(left, 6, Math.max(6, r.width - 40));
  top = clamp(top, 6, Math.max(6, r.height - 36));
  const box = {
    id,
    lock: null,
    el: document.createElement("div"),
    textEl: document.createElement("div"),
    overlayEl: document.createElement("div"),
  };
  box.el.className = "box";
  box.el._box = box;
  box.el.style.left = left + "px";
  box.el.style.top = top + "px";
  box.textEl.className = "text";
  box.textEl.contentEditable = "true";
  box.textEl.spellcheck = false;
  box.textEl.textContent = text || "";
  box.overlayEl.className = "overlay";
  box.textEl.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertParagraph") e.preventDefault();
  });
  box.textEl.addEventListener("paste", (e) => {
    e.preventDefault();
    insertTextAtSelection(normalizeText((e.clipboardData || window.clipboardData).getData("text")));
  });
  box.textEl.addEventListener("input", () => scrubEditable(box.textEl));
  box.el.appendChild(box.textEl);
  box.el.appendChild(box.overlayEl);
  workspace.appendChild(box.el);
  return box;
}

// ─── Layout ─────────────────────────────────────────────────────
export function findOpenSpot(boxes, rect) {
  let best = null;
  for (let i = 0; i < 40; i++) {
    const x = rand(10, Math.max(10, rect.width - 150));
    const y = rand(10, Math.max(10, rect.height - 40));
    let score = rand(0, 30);
    for (const box of boxes) {
      if (!box.el.isConnected) continue;
      const bx = box.el.offsetLeft,
        by = box.el.offsetTop;
      const bw = Math.max(90, box.el.offsetWidth),
        bh = Math.max(30, box.el.offsetHeight);
      const ox = Math.max(0, Math.min(x + 140, bx + bw) - Math.max(x, bx));
      const oy = Math.max(0, Math.min(y + 34, by + bh) - Math.max(y, by));
      score -= ox * oy * 3;
      score += Math.min(200, Math.hypot(x + 70 - (bx + bw / 2), y + 17 - (by + bh / 2)));
    }
    if (!best || score > best.score) best = { x, y, score };
  }
  return best || { x: 20, y: 20 };
}
