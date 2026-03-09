// ─── executor.js ─── Animated edit execution ────────────────────
// Performs cursor movement, text mutation, and visual feedback.
// Operates on a cursor agent: { x, y, retiring, updateCursor(), setMode(),
//   showCaret(), showSelection() }
// Emits "edit" events via the EventBus after every text mutation.

import { applyEdit, isHumanFocusedBox, pagePointForIndex, showClick } from "./edit.js";
import { humanKeyDelay } from "./keyboard.js";
import { moveHumanLike } from "./movement.js";
import { chance, clamp, rand, sleep } from "./timing.js";

// ─── Local helpers ──────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ─── Action timing ─────────────────────────────────────────────
const SETTLE_BEFORE_CLICK_MIN = 8;
const SETTLE_BEFORE_CLICK_MAX = 35;
const SETTLE_AFTER_CLICK_MIN = 15;
const SETTLE_AFTER_CLICK_MAX = 50;
const CARET_SETTLE_MIN = 20;
const CARET_SETTLE_MAX = 60;

// ─── Backspace speed ───────────────────────────────────────────
const BS_MIN = 25;
const BS_MAX = 65;
const BS_HESITATE_CHANCE = 0.12;
const BS_HESITATE_MIN = 25;
const BS_HESITATE_MAX = 60;

// ─── Drag select speed ─────────────────────────────────────────
const DRAG_STEP_MIN = 5;
const DRAG_STEP_MAX = 14;
const DRAG_PAUSE_CHANCE = 0.1;
const DRAG_PAUSE_MIN = 8;
const DRAG_PAUSE_MAX = 30;

// ─── Executor ───────────────────────────────────────────────────
export class Executor {
  /**
   * @param {object} agent  Cursor agent (Bot instance or any object satisfying the interface)
   * @param {object} ctx    Shared context { charW, cursorLayer, eventBus, ... }
   */
  constructor(agent, ctx) {
    this.agent = agent;
    this.ctx = ctx;
    this.bus = ctx.eventBus || null;
  }

  // ─── Single mutation point — all text changes go through here ──
  _applyEdit(box, start, end, text) {
    const newPos = applyEdit(box, start, end, text);
    this.bus?.emit("edit", { boxId: box.id, start, end, text, newPos });
    return newPos;
  }

  // ─── Cursor movement ─────────────────────────────────────────
  async moveTo(x, y, precision) {
    await moveHumanLike(this.agent, x, y, precision);
  }

  // ─── Click ────────────────────────────────────────────────────
  async clickAt(x, y) {
    this.agent.setMode("arrow");
    await this.moveTo(x, y, "click");
    await sleep(rand(SETTLE_BEFORE_CLICK_MIN, SETTLE_BEFORE_CLICK_MAX));
    showClick(x, y, this.ctx.cursorLayer);
    await sleep(rand(SETTLE_AFTER_CLICK_MIN, SETTLE_AFTER_CLICK_MAX));
  }

  // ─── Caret placement ─────────────────────────────────────────
  async placeCaret(box, index) {
    if (!box.el.isConnected) return;
    const p = pagePointForIndex(box, index, this.ctx.charW);
    this.agent.setMode("arrow");
    await this.moveTo(p.x, p.y, "text");
    await sleep(rand(SETTLE_BEFORE_CLICK_MIN, SETTLE_BEFORE_CLICK_MAX));
    this.agent.setMode("ibeam");
    showClick(p.x, p.y, this.ctx.cursorLayer);
    this.agent.showCaret(box, index);
    await sleep(rand(CARET_SETTLE_MIN, CARET_SETTLE_MAX));
  }

  // ─── Drag selection ───────────────────────────────────────────
  async dragSelect(box, start, end) {
    if (!box.el.isConnected) return;
    if (end < start) [start, end] = [end, start];
    const p0 = pagePointForIndex(box, start, this.ctx.charW);
    this.agent.setMode("ibeam");
    await this.moveTo(p0.x, p0.y, "text");
    await sleep(rand(10, 35));
    showClick(p0.x, p0.y, this.ctx.cursorLayer);
    await sleep(rand(15, 40));

    const steps = Math.max(8, (end - start) * 3);
    for (let i = 0; i <= steps; i++) {
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      const t = i / steps;
      const skew = t < 0.2 ? t * 1.8 : t < 0.75 ? 0.36 + (t - 0.2) * 0.9 : 0.86 + (t - 0.75) * 0.56;
      const idx = Math.round(start + (end - start) * clamp(skew, 0, 1));
      const p = pagePointForIndex(box, idx, this.ctx.charW);
      this.agent.x = lerp(this.agent.x, p.x, rand(0.6, 1));
      this.agent.y = lerp(this.agent.y, p.y, rand(0.6, 1));
      this.agent.updateCursor();
      this.agent.showSelection(box, start, idx);
      if (chance(DRAG_PAUSE_CHANCE)) await sleep(rand(DRAG_PAUSE_MIN, DRAG_PAUSE_MAX));
      await sleep(rand(DRAG_STEP_MIN, DRAG_STEP_MAX));
    }
    this.agent.showSelection(box, start, end);
    await sleep(rand(30, 70));
  }

  // ─── Typing ───────────────────────────────────────────────────
  async typeInto(box, index, text) {
    let pos = index;
    let prev = "";
    this.agent.setMode("ibeam");
    this.agent.showCaret(box, pos);
    for (const ch of text) {
      if (this.agent.retiring || !box.el.isConnected || isHumanFocusedBox(box)) break;
      pos = this._applyEdit(box, pos, pos, ch);
      this.agent.showCaret(box, pos);
      await sleep(humanKeyDelay(ch, prev));
      prev = ch;
    }
    return pos;
  }

  // ─── Backspace ────────────────────────────────────────────────
  async backspace(box, index, count) {
    let pos = index;
    this.agent.setMode("ibeam");
    this.agent.showCaret(box, pos);
    for (let i = 0; i < count; i++) {
      if (this.agent.retiring || !box.el.isConnected || isHumanFocusedBox(box) || pos <= 0) break;
      pos = this._applyEdit(box, pos - 1, pos, "");
      this.agent.showCaret(box, pos);
      let ms = rand(BS_MIN, BS_MAX);
      if (chance(BS_HESITATE_CHANCE)) ms += rand(BS_HESITATE_MIN, BS_HESITATE_MAX);
      await sleep(ms);
    }
    return pos;
  }

  // ─── Instant range delete (no animation, used after drag-select) ─
  deleteRange(box, start, end) {
    this._applyEdit(box, start, end, "");
  }
}
