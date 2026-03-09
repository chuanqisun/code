import { ARROW_SVG, IBEAM_SVG } from "./cursors.js";
import { PAD_X, acquireBox, getText, isHumanFocusedBox, releaseBox } from "./edit.js";
import { Executor } from "./executor.js";
import { pickRange, randomWords } from "./linguistics.js";
import { randomEdgePoint } from "./movement.js";
import { RandomPlanner } from "./planner.js";
import { BOT_LIFETIME_MAX, BOT_LIFETIME_MIN, BOT_RETIRE_CHECK_CHANCE } from "./pool.js";
import { chance, rand, sleep } from "./timing.js";

// ─── Action timing ────────────────────────────────────────────
const ACTION_PAUSE_MIN = 30;
const ACTION_PAUSE_MAX = 280;

// ─── BOT CLASS ────────────────────────────────────────────────
// The bot is a cursor agent + lifecycle shell.
// Planning is delegated to the Planner; execution to the Executor.
export class Bot {
  /**
   * @param {number} id
   * @param {{ boxes: Array, cursorLayer: HTMLElement, charW: number, wsRect: () => DOMRect, createBox: (x:number,y:number,text:string) => object, eventBus: object }} ctx
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

    this.exec = new Executor(this, ctx);
    this.planner = new RandomPlanner();
    this.updateCursor();
  }

  // ─── Cursor agent interface ─────────────────────────────────
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

  // ─── Box lookup ─────────────────────────────────────────────
  _findBox(boxId) {
    return this.ctx.boxes.find((b) => b.id === boxId);
  }

  // ─── Command execution ─────────────────────────────────────
  async executeCommand(cmd) {
    switch (cmd.type) {
      case "move":
        return this._execMove(cmd);
      case "create":
        return this._execCreate(cmd);
      case "append":
        return this._execAppend(cmd);
      case "insert":
        return this._execInsert(cmd);
      case "replace":
        return this._execReplace(cmd);
      case "delete":
        return this._execDelete(cmd);
      case "backspace":
        return this._execBackspace(cmd);
    }
  }

  async _execMove(cmd) {
    this.setMode("arrow");
    await this.exec.moveTo(cmd.x, cmd.y, "travel");
    await sleep(rand(40, 180));
  }

  async _execCreate(cmd) {
    const { wsRect, createBox } = this.ctx;
    const r = wsRect();
    await this.exec.clickAt(r.left + cmd.x, r.top + cmd.y);
    const box = createBox(cmd.x, cmd.y, "");
    if (!acquireBox(box, this.id)) return;
    try {
      await sleep(rand(20, 80));
      await this.exec.placeCaret(box, 0);
      await this.exec.typeInto(box, 0, cmd.text);
      if (chance(0.25) && getText(box).length > 3) {
        const [a, b] = pickRange(getText(box));
        await this.exec.dragSelect(box, a, b);
        this.exec.deleteRange(box, a, b);
        this.showCaret(box, a);
        await sleep(rand(30, 70));
        if (chance(0.7)) await this.exec.typeInto(box, a, randomWords(1, 2));
      }
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execAppend(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !acquireBox(box, this.id)) return;
    try {
      const t = getText(box);
      await this.exec.placeCaret(box, t.length);
      await this.exec.typeInto(box, t.length, cmd.text);
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execInsert(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !acquireBox(box, this.id)) return;
    try {
      await this.exec.placeCaret(box, cmd.index);
      await this.exec.typeInto(box, cmd.index, cmd.text);
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execReplace(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !acquireBox(box, this.id)) return;
    try {
      await this.exec.dragSelect(box, cmd.start, cmd.end);
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      this.exec.deleteRange(box, cmd.start, cmd.end);
      this.showCaret(box, cmd.start);
      await sleep(rand(30, 70));
      await this.exec.typeInto(box, cmd.start, cmd.text);
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execDelete(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !acquireBox(box, this.id)) return;
    try {
      await this.exec.dragSelect(box, cmd.start, cmd.end);
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      this.exec.deleteRange(box, cmd.start, cmd.end);
      this.showCaret(box, cmd.start);
      await sleep(rand(40, 90));
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execBackspace(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !acquireBox(box, this.id)) return;
    try {
      await this.exec.placeCaret(box, cmd.index);
      await this.exec.backspace(box, cmd.index, cmd.count);
    } finally {
      releaseBox(box, this.id);
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  async depart() {
    this.hideOverlay();
    this.setMode("arrow");
    const p = randomEdgePoint(this.ctx.wsRect());
    await this.exec.moveTo(p.x, p.y, "travel");
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
        const cmd = this.planner.plan({
          boxes: this.ctx.boxes,
          botId: this.id,
          wsRect: this.ctx.wsRect,
        });
        await this.executeCommand(cmd);
      } catch (_) {}
    }
    try {
      await this.depart();
    } catch (_) {}
  }
}
