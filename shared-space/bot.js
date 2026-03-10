import { ARROW_SVG, IBEAM_SVG } from "./cursors.js";
import { PAD_X, canBotUseBox, getText, isHumanFocusedBox, moveBox, safeSyncTextEl, syncDocText } from "./edit.js";
import { Executor } from "./executor.js";
import { pickRange, randomWords } from "./linguistics.js";
import { acquireCaretLock, acquireSelectionLock, getSpanCharIndex, isRangeFree, LOCK_CARET, releaseLock } from "./locks.js";
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
//
// Lock spans in the DOM replace OT for conflict resolution.
// When a bot places its cursor it acquires a <span> lock; other
// bots see the span and avoid that region.
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

    /** @type {HTMLSpanElement|null} Current lock span inside a textEl */
    this.lockSpan = null;

    // Re-render overlay when another agent edits the same box.
    // With span locking the DOM handles position shifts — we just
    // need to re-read the span's character index.
    this._onEdit = ({ boxId }) => {
      if (!this.lockSpan || !this.overlayBox || this.overlayBox.id !== boxId) return;
      if (!this.overlayBox.textEl.contains(this.lockSpan)) return;

      const spanIdx = getSpanCharIndex(this.overlayBox.textEl, this.lockSpan);
      const spanLen = this.lockSpan.textContent?.length || 0;

      if (this.lockSpan.dataset.lockType === LOCK_CARET) {
        // Caret locks render at the end of typed content
        this._renderCaret(this.overlayBox, spanIdx + spanLen);
      } else {
        // Selection locks render over their content
        this._renderSel(this.overlayBox, spanIdx, spanIdx + spanLen);
      }
    };
    ctx.eventBus.on("edit", this._onEdit);

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
    // Release lock span if we have one
    if (this.lockSpan && this.overlayBox) {
      releaseLock(this.overlayBox.textEl, this.id);
      syncDocText(this.overlayBox);
      safeSyncTextEl(this.overlayBox);
      this.lockSpan = null;
    }
    this.selEl.style.display = "none";
    this.caretEl.style.display = "none";
  }

  // ─── Low-level renderers (no state update) ──────────────────
  _renderCaret(box, index) {
    this.selEl.style.display = "none";
    this.caretEl.style.display = "block";
    this.caretEl.style.left = PAD_X + this.ctx.charW * index + "px";
  }

  _renderSel(box, start, end) {
    if (end < start) [start, end] = [end, start];
    if (start === end) {
      this._renderCaret(box, start);
      return;
    }
    this.caretEl.style.display = "none";
    this.selEl.style.display = "block";
    this.selEl.style.left = PAD_X + this.ctx.charW * start + "px";
    this.selEl.style.width = Math.max(1, this.ctx.charW * (end - start)) + "px";
  }

  // ─── State-tracked overlay methods ──────────────────────────
  /** Place a caret lock and render the overlay. */
  showCaret(box, index) {
    if (!box || !box.el.isConnected) return;
    this.attachOverlay(box);

    // Acquire lock only if we don't already have one for this box
    if (!this.lockSpan || !box.textEl.contains(this.lockSpan)) {
      this.lockSpan = acquireCaretLock(box.textEl, index, this.id);
    }
    this._renderCaret(box, index);
  }

  /** Acquire a selection lock and render the overlay. */
  showSelection(box, start, end) {
    if (!box || !box.el.isConnected) return;
    this.attachOverlay(box);
    if (end < start) [start, end] = [end, start];

    // Release existing lock and acquire selection lock
    if (this.lockSpan) {
      releaseLock(box.textEl, this.id);
      syncDocText(box);
      this.lockSpan = null;
    }
    this.lockSpan = acquireSelectionLock(box.textEl, start, end, this.id);
    this._renderSel(box, start, end);
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
      case "moveBox":
        return this._execMoveBox(cmd);
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
    if (!canBotUseBox(box)) return;
    try {
      await sleep(rand(20, 80));
      await this.exec.placeCaret(box, 0);
      await this.exec.typeInto(box, cmd.text);
      if (chance(0.25) && getText(box).length > 3) {
        const text = getText(box);
        const [a, b] = pickRange(text);
        if (!isRangeFree(box.textEl, a, b, this.id)) return;
        await this.exec.dragSelect(box, a, b);
        this.exec.deleteRange(box);
        const spanIdx = this.lockSpan ? getSpanCharIndex(box.textEl, this.lockSpan) : a;
        this._renderCaret(box, spanIdx);
        await sleep(rand(30, 70));
        if (chance(0.7)) await this.exec.typeInto(box, randomWords(1, 2));
      }
    } finally {
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execAppend(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !canBotUseBox(box)) return;
    try {
      const t = getText(box);
      await this.exec.placeCaret(box, t.length);
      await this.exec.typeInto(box, cmd.text);
    } finally {
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execInsert(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !canBotUseBox(box)) return;
    // Early conflict check — avoids expensive cursor animation.
    // The actual lock acquisition in placeCaret also checks internally.
    if (!isRangeFree(box.textEl, cmd.index, cmd.index, this.id)) return;
    try {
      await this.exec.placeCaret(box, cmd.index);
      await this.exec.typeInto(box, cmd.text);
    } finally {
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execReplace(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !canBotUseBox(box)) return;
    if (!isRangeFree(box.textEl, cmd.start, cmd.end, this.id)) return;
    try {
      await this.exec.dragSelect(box, cmd.start, cmd.end);
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      this.exec.deleteRange(box);
      const spanIdx = this.lockSpan ? getSpanCharIndex(box.textEl, this.lockSpan) : cmd.start;
      this._renderCaret(box, spanIdx);
      await sleep(rand(30, 70));
      await this.exec.typeInto(box, cmd.text);
    } finally {
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execDelete(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !canBotUseBox(box)) return;
    if (!isRangeFree(box.textEl, cmd.start, cmd.end, this.id)) return;
    try {
      await this.exec.dragSelect(box, cmd.start, cmd.end);
      if (!box.el.isConnected || isHumanFocusedBox(box)) return;
      this.exec.deleteRange(box);
      const spanIdx = this.lockSpan ? getSpanCharIndex(box.textEl, this.lockSpan) : cmd.start;
      this._renderCaret(box, spanIdx);
      await sleep(rand(40, 90));
    } finally {
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execBackspace(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !canBotUseBox(box)) return;
    if (!isRangeFree(box.textEl, Math.max(0, cmd.index - cmd.count), cmd.index, this.id)) return;
    try {
      await this.exec.placeCaret(box, cmd.index);
      await this.exec.backspace(box, cmd.count);
    } finally {
      this.hideOverlay();
      this.setMode("arrow");
    }
  }

  async _execMoveBox(cmd) {
    const box = this._findBox(cmd.boxId);
    if (!box || !canBotUseBox(box)) return;
    // Click on the box first
    const boxRect = box.el.getBoundingClientRect();
    const cx = boxRect.left + boxRect.width / 2;
    const cy = boxRect.top + boxRect.height / 2;
    await this.exec.clickAt(cx, cy);
    box.el.classList.add("selected");
    await sleep(rand(60, 150));
    // Animate the box sliding to the new position
    const r = this.ctx.wsRect();
    const startLeft = box.el.offsetLeft;
    const startTop = box.el.offsetTop;
    const steps = Math.max(10, Math.floor(rand(15, 30)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const curLeft = startLeft + (cmd.toX - startLeft) * ease;
      const curTop = startTop + (cmd.toY - startTop) * ease;
      box.el.style.left = curLeft + "px";
      box.el.style.top = curTop + "px";
      // Move cursor along with the box
      this.x = r.left + curLeft + boxRect.width / 2;
      this.y = r.top + curTop + boxRect.height / 2;
      this.updateCursor();
      await sleep(rand(8, 18));
    }
    moveBox(box, cmd.toX, cmd.toY);
    box.el.classList.remove("selected");
    await sleep(rand(30, 80));
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  async depart() {
    this.hideOverlay();
    this.setMode("arrow");
    this.ctx.eventBus.off("edit", this._onEdit);
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
        const { cmd } = this.planner.plan({
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
