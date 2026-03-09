import { ARROW_SVG, IBEAM_SVG } from "./cursors.js";
import { PAD_X, acquireBox, canBotUseBox, findOpenSpot, getText, isHumanFocusedBox, pagePointForIndex, releaseBox, replaceRange, showClick } from "./edit.js";
import { appendChunk, insertChunk, pickRange, randomPhrase, randomWords } from "./linguistics.js";
import { moveHumanLike, randomEdgePoint } from "./movement.js";
import { BOT_LIFETIME_MAX, BOT_LIFETIME_MIN, BOT_RETIRE_CHECK_CHANCE } from "./pool.js";
import {
  ACTION_PAUSE_MAX,
  ACTION_PAUSE_MIN,
  BS_HESITATE_CHANCE,
  BS_HESITATE_MAX,
  BS_HESITATE_MIN,
  BS_MAX,
  BS_MIN,
  CARET_SETTLE_MAX,
  CARET_SETTLE_MIN,
  DRAG_PAUSE_CHANCE,
  DRAG_PAUSE_MAX,
  DRAG_PAUSE_MIN,
  DRAG_STEP_MAX,
  DRAG_STEP_MIN,
  SETTLE_AFTER_CLICK_MAX,
  SETTLE_AFTER_CLICK_MIN,
  SETTLE_BEFORE_CLICK_MAX,
  SETTLE_BEFORE_CLICK_MIN,
  humanKeyDelay,
  sleep,
} from "./scheduler.js";

// ─── LOCAL HELPERS ────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p) {
  return Math.random() < p;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ─── BOT CLASS ────────────────────────────────────────────────
export class Bot {
  /**
   * @param {number} id
   * @param {{ boxes: Array, cursorLayer: HTMLElement, charW: number, wsRect: () => DOMRect, createBox: (x:number,y:number,text:string) => object }} ctx
   */
  constructor(id, ctx) {
    this.id = id;
    this.ctx = ctx;
    this.retiring = false;
    this.mode = "arrow";
    this.birth = performance.now();
    this.maxLifetime = rand(BOT_LIFETIME_MIN, BOT_LIFETIME_MAX);

    const p = randomEdgePoint(ctx.wsRect());
    this.x = p.x;
    this.y = p.y;

    this.cursor = document.createElement("div");
    this.cursor.className = "bot-cursor";
    this.cursor.innerHTML = ARROW_SVG;
    ctx.cursorLayer.appendChild(this.cursor);

    this.selEl = document.createElement("div");
    this.selEl.className = "bot-sel";
    this.caretEl = document.createElement("div");
    this.caretEl.className = "bot-caret";
    this.overlayBox = null;
    this.updateCursor();
  }

  updateCursor() {
    this.cursor.style.transform = `translate(${this.x}px,${this.y}px)`;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.cursor.innerHTML = mode === "ibeam" ? IBEAM_SVG : ARROW_SVG;
    this.cursor.style.width = mode === "ibeam" ? "20px" : "24px";
  }

  attachOverlay(box) {
    if (this.overlayBox !== box) {
      this.hideOverlay();
      if (box && box.overlayEl && box.el.isConnected) {
        box.overlayEl.appendChild(this.selEl);
        box.overlayEl.appendChild(this.caretEl);
        this.overlayBox = box;
      }
    }
  }

  hideOverlay() {
    this.selEl.style.display = "none";
    this.caretEl.style.display = "none";
  }

  showCaret(box, index) {
    if (!box || !box.el.isConnected) return;
    this.attachOverlay(box);
    this.selEl.style.display = "none";
    this.caretEl.style.display = "block";
    this.caretEl.style.left = PAD_X + this.ctx.charW * index + "px";
  }

  showSelection(box, start, end) {
    if (!box || !box.el.isConnected) return;
    this.attachOverlay(box);
    if (end < start) [start, end] = [end, start];
    if (start === end) {
      this.showCaret(box, start);
      return;
    }
    this.caretEl.style.display = "none";
    this.selEl.style.display = "block";
    this.selEl.style.left = PAD_X + this.ctx.charW * start + "px";
    this.selEl.style.width = Math.max(1, this.ctx.charW * (end - start)) + "px";
  }

  async moveTo(x, y, precision) {
    await moveHumanLike(this, x, y, precision);
  }

  async clickAt(x, y) {
    this.setMode("arrow");
    await this.moveTo(x, y, "click");
    await sleep(rand(SETTLE_BEFORE_CLICK_MIN, SETTLE_BEFORE_CLICK_MAX));
    showClick(x, y, this.ctx.cursorLayer);
    await sleep(rand(SETTLE_AFTER_CLICK_MIN, SETTLE_AFTER_CLICK_MAX));
  }

  async placeCaret(box, index) {
    if (!box.el.isConnected) return;
    const p = pagePointForIndex(box, index, this.ctx.charW);
    this.setMode("arrow");
    await this.moveTo(p.x, p.y, "text");
    await sleep(rand(SETTLE_BEFORE_CLICK_MIN, SETTLE_BEFORE_CLICK_MAX));
    this.setMode("ibeam");
    showClick(p.x, p.y, this.ctx.cursorLayer);
    this.showCaret(box, index);
    await sleep(rand(CARET_SETTLE_MIN, CARET_SETTLE_MAX));
  }

  async dragSelect(box, start, end) {
    if (!box.el.isConnected) return;
    if (end < start) [start, end] = [end, start];
    const p0 = pagePointForIndex(box, start, this.ctx.charW);
    this.setMode("ibeam");
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
      this.x = lerp(this.x, p.x, rand(0.6, 1));
      this.y = lerp(this.y, p.y, rand(0.6, 1));
      this.updateCursor();
      this.showSelection(box, start, idx);
      if (chance(DRAG_PAUSE_CHANCE)) await sleep(rand(DRAG_PAUSE_MIN, DRAG_PAUSE_MAX));
      await sleep(rand(DRAG_STEP_MIN, DRAG_STEP_MAX));
    }
    this.showSelection(box, start, end);
    await sleep(rand(30, 70));
  }

  async typeInto(box, index, text) {
    let pos = index;
    let prev = "";
    this.setMode("ibeam");
    this.showCaret(box, pos);
    for (const ch of text) {
      if (this.retiring || !box.el.isConnected || isHumanFocusedBox(box)) break;
      pos = replaceRange(box, pos, pos, ch);
      this.showCaret(box, pos);
      await sleep(humanKeyDelay(ch, prev));
      prev = ch;
    }
    return pos;
  }

  async backspace(box, index, count) {
    let pos = index;
    this.setMode("ibeam");
    this.showCaret(box, pos);
    for (let i = 0; i < count; i++) {
      if (this.retiring || !box.el.isConnected || isHumanFocusedBox(box) || pos <= 0) break;
      pos = replaceRange(box, pos - 1, pos, "");
      this.showCaret(box, pos);
      let ms = rand(BS_MIN, BS_MAX);
      if (chance(BS_HESITATE_CHANCE)) ms += rand(BS_HESITATE_MIN, BS_HESITATE_MAX);
      await sleep(ms);
    }
    return pos;
  }

  async taskMoveOnly() {
    const r = this.ctx.wsRect();
    this.setMode("arrow");
    await this.moveTo(rand(r.left + 10, r.right - 20), rand(r.top + 10, r.bottom - 20), "travel");
    await sleep(rand(40, 180));
  }

  async taskCreate() {
    const { boxes, wsRect, createBox } = this.ctx;
    const spot = findOpenSpot(boxes, wsRect());
    const r = wsRect();
    await this.clickAt(r.left + spot.x, r.top + spot.y);
    const box = createBox(spot.x, spot.y, "");
    if (!acquireBox(box, this.id)) return;
    try {
      await sleep(rand(20, 80));
      await this.placeCaret(box, 0);
      await this.typeInto(box, 0, randomPhrase(1, chance(0.5) ? 2 : 4));
      if (chance(0.25) && getText(box).length > 3) {
        const [a, b] = pickRange(getText(box));
        await this.dragSelect(box, a, b);
        replaceRange(box, a, b, "");
        this.showCaret(box, a);
        await sleep(rand(30, 70));
        if (chance(0.7)) await this.typeInto(box, a, randomWords(1, 2));
      }
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async taskAppend() {
    const { boxes } = this.ctx;
    const pool = boxes.filter((b) => canBotUseBox(b, this.id));
    if (!pool.length) return this.taskCreate();
    const box = choice(pool);
    if (!acquireBox(box, this.id)) return;
    try {
      const t = getText(box);
      await this.placeCaret(box, t.length);
      await this.typeInto(box, t.length, appendChunk(t));
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async taskInsert() {
    const { boxes } = this.ctx;
    const pool = boxes.filter((b) => canBotUseBox(b, this.id));
    if (!pool.length) return this.taskCreate();
    const box = choice(pool);
    if (!acquireBox(box, this.id)) return;
    try {
      const t = getText(box);
      const index = t.length ? Math.floor(rand(0, t.length + 1)) : 0;
      await this.placeCaret(box, index);
      await this.typeInto(box, index, insertChunk());
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async taskReplace() {
    const { boxes } = this.ctx;
    const pool = boxes.filter((b) => canBotUseBox(b, this.id) && getText(b).length > 2);
    if (!pool.length) return this.taskAppend();
    const box = choice(pool);
    if (!acquireBox(box, this.id)) return;
    try {
      const [a, b] = pickRange(getText(box));
      await this.dragSelect(box, a, b);
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      replaceRange(box, a, b, "");
      this.showCaret(box, a);
      await sleep(rand(30, 70));
      await this.typeInto(box, a, randomWords(1, chance(0.5) ? 1 : 2));
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async taskDeleteSelection() {
    const { boxes } = this.ctx;
    const pool = boxes.filter((b) => canBotUseBox(b, this.id) && getText(b).length > 1);
    if (!pool.length) return this.taskAppend();
    const box = choice(pool);
    if (!acquireBox(box, this.id)) return;
    try {
      const [a, b] = pickRange(getText(box));
      await this.dragSelect(box, a, b);
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      replaceRange(box, a, b, "");
      this.showCaret(box, a);
      await sleep(rand(40, 90));
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async taskBackspace() {
    const { boxes } = this.ctx;
    const pool = boxes.filter((b) => canBotUseBox(b, this.id) && getText(b).length > 0);
    if (!pool.length) return this.taskAppend();
    const box = choice(pool);
    if (!acquireBox(box, this.id)) return;
    try {
      const t = getText(box);
      const index = chance(0.6) ? t.length : Math.floor(rand(1, t.length + 1));
      await this.placeCaret(box, index);
      await this.backspace(box, index, Math.max(1, Math.floor(rand(1, Math.min(4, index) + 1))));
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async takeAction() {
    const { boxes } = this.ctx;
    const usable = boxes.filter((b) => canBotUseBox(b, this.id));
    const filled = usable.filter((b) => getText(b).length > 0);
    const actions = ["move"];
    if (boxes.length < 4 || chance(0.25)) actions.push("create");
    if (usable.length) actions.push("append", "insert");
    if (filled.length) actions.push("replace", "delete", "backspace", "append");
    const action = choice(actions);
    if (action === "create") return this.taskCreate();
    if (action === "append") return this.taskAppend();
    if (action === "insert") return this.taskInsert();
    if (action === "replace") return this.taskReplace();
    if (action === "delete") return this.taskDeleteSelection();
    if (action === "backspace") return this.taskBackspace();
    return this.taskMoveOnly();
  }

  async depart() {
    this.hideOverlay();
    this.setMode("arrow");
    const p = randomEdgePoint(this.ctx.wsRect());
    await this.moveTo(p.x, p.y, "travel");
    this.cursor.remove();
    this.selEl.remove();
    this.caretEl.remove();
  }

  async loop() {
    while (!this.retiring) {
      if (performance.now() - this.birth > this.maxLifetime && chance(BOT_RETIRE_CHECK_CHANCE)) {
        this.retiring = true;
        break;
      }
      await sleep(rand(ACTION_PAUSE_MIN, ACTION_PAUSE_MAX));
      try {
        await this.takeAction();
      } catch (_) {}
    }
    try {
      await this.depart();
    } catch (_) {}
  }
}
