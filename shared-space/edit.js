// ─── edit.js ─── Text editing and DOM binding ───────────────────
// Handles box creation, text manipulation, caret/selection visuals.
// Functions receive DOM elements as parameters — no module-level globals.

import { Doc } from "./document.js";

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
  return box.doc.text;
}

export function setText(box, text) {
  box.doc.text = normalizeText(text);
  box.textEl.textContent = box.doc.text;
}

/** Apply an edit through the Doc (OT-aware). Returns new cursor position. */
export function applyEdit(box, start, end, insertText) {
  const newPos = box.doc.apply(start, end, insertText);
  box.textEl.textContent = box.doc.text;
  return newPos;
}

// ─── Caret / index positioning ─────────────────────────────────
export function pagePointForIndex(box, index, charW) {
  const rect = box.textEl.getBoundingClientRect();
  const len = getText(box).length;
  index = clamp(index, 0, len);
  return { x: rect.left + PAD_X + charW * index + 1, y: rect.top + PAD_Y + LINE_H * 0.55 };
}

// ─── Box access ─────────────────────────────────────────────────
export function isHumanFocusedBox(box) {
  const ae = document.activeElement;
  return !!(ae && ae.closest && ae.closest(".box") === box.el);
}

/** Check if a bot can interact with a box (connected and not human-focused). */
export function canBotUseBox(box) {
  return box && box.el.isConnected && !isHumanFocusedBox(box);
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

// ─── Human input helpers ────────────────────────────────────────
// Resolve the current caret/selection offset within a contentEditable element.
function getSelectionOffsets(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  // Walk text nodes to compute character offsets
  function offsetIn(container, node, off) {
    let count = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode === node) return count + off;
      count += walker.currentNode.length;
    }
    return count;
  }
  const start = offsetIn(el, range.startContainer, range.startOffset);
  const end = offsetIn(el, range.endContainer, range.endOffset);
  return { start, end };
}

function setCaretOffset(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let pos = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (pos + node.length >= offset) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(node, offset - pos);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    pos += node.length;
  }
  // Fallback: place at end
  placeCaretEnd(el);
}

// ─── Box creation ───────────────────────────────────────────────
// Returns a box object. Caller is responsible for tracking it (e.g. pushing to an array).
// eventBus is optional — when provided, human edits emit the same "edit" events as bot edits.
export function createBox(id, left, top, text, workspace, eventBus) {
  const r = workspace.getBoundingClientRect();
  left = clamp(left, 6, Math.max(6, r.width - 40));
  top = clamp(top, 6, Math.max(6, r.height - 36));
  const box = {
    id,
    doc: new Doc(normalizeText(text || "")),
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

  // ─── Unified input interceptor ──────────────────────────────
  box.textEl.addEventListener("beforeinput", (e) => {
    // Block newlines
    if (e.inputType === "insertParagraph") {
      e.preventDefault();
      return;
    }

    const offsets = getSelectionOffsets(box.textEl);
    if (!offsets) return;

    // Handle the input types we care about
    if (e.inputType === "insertText" || e.inputType === "insertCompositionText") {
      const insertText = normalizeText(e.data || "");
      if (!insertText) return;
      e.preventDefault();
      const newPos = applyEdit(box, offsets.start, offsets.end, insertText);
      setCaretOffset(box.textEl, newPos);
      eventBus?.emit("edit", { boxId: box.id, start: offsets.start, end: offsets.end, text: insertText, newPos });
      return;
    }

    if (e.inputType === "deleteContentBackward") {
      e.preventDefault();
      const start = offsets.start === offsets.end ? Math.max(0, offsets.start - 1) : Math.min(offsets.start, offsets.end);
      const end = Math.max(offsets.start, offsets.end);
      if (start === end) return;
      const newPos = applyEdit(box, start, end, "");
      setCaretOffset(box.textEl, newPos);
      eventBus?.emit("edit", { boxId: box.id, start, end, text: "", newPos });
      return;
    }

    if (e.inputType === "deleteContentForward") {
      e.preventDefault();
      const start = Math.min(offsets.start, offsets.end);
      const end = offsets.start === offsets.end ? Math.min(box.doc.text.length, offsets.end + 1) : Math.max(offsets.start, offsets.end);
      if (start === end) return;
      const newPos = applyEdit(box, start, end, "");
      setCaretOffset(box.textEl, newPos);
      eventBus?.emit("edit", { boxId: box.id, start, end, text: "", newPos });
      return;
    }

    if (
      e.inputType === "deleteByCut" ||
      e.inputType === "deleteWordBackward" ||
      e.inputType === "deleteWordForward" ||
      e.inputType === "deleteSoftLineBackward" ||
      e.inputType === "deleteSoftLineForward"
    ) {
      e.preventDefault();
      const start = Math.min(offsets.start, offsets.end);
      const end = Math.max(offsets.start, offsets.end);
      if (start === end) return;
      const newPos = applyEdit(box, start, end, "");
      setCaretOffset(box.textEl, newPos);
      eventBus?.emit("edit", { boxId: box.id, start, end, text: "", newPos });
      return;
    }

    if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") {
      e.preventDefault();
      const raw = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
      const insertText = normalizeText(raw);
      if (!insertText) return;
      const newPos = applyEdit(box, offsets.start, offsets.end, insertText);
      setCaretOffset(box.textEl, newPos);
      eventBus?.emit("edit", { boxId: box.id, start: offsets.start, end: offsets.end, text: insertText, newPos });
      return;
    }
  });

  // Fallback scrub: catch anything the interceptor missed (e.g. composition edge cases)
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
