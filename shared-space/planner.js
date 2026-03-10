// ─── planner.js ─── Action planning for bots ────────────────────
// Decides WHAT to do. Returns { cmd, boxId, version }.
// cmd:     The edit command planned against the snapshot.
// boxId:   The target box id (null for move/create).
// version: The doc version the cmd was planned against.
// RandomPlanner uses weighted random selection; future LLMPlanner will
// implement the same plan() interface.

import { appendCmd, backspaceCmd, createCmd, deleteCmd, insertCmd, moveBoxCmd, moveCmd, replaceCmd } from "./commands.js";
import { canBotUseBox, findOpenSpot } from "./edit.js";
import { appendChunk, insertChunk, pickRange, randomPhrase, randomWords, wordBoundaries } from "./linguistics.js";

// ─── Local helpers ──────────────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p) {
  return Math.random() < p;
}

/** Read a box's doc snapshot: { text, version } */
function snap(box) {
  return box.doc.read();
}

// ─── RandomPlanner ──────────────────────────────────────────────
// plan(state) → { cmd, boxId, version }
// state: { boxes, botId, wsRect, isRangeFree? }
export class RandomPlanner {
  plan({ boxes, botId, wsRect }) {
    const usable = boxes.filter((b) => canBotUseBox(b));
    const filled = usable.filter((b) => b.doc.text.length > 0);

    // Build weighted action list
    const actions = ["move"];
    if (boxes.length < 4 || chance(0.25)) actions.push("create");
    if (usable.length) actions.push("append", "insert");
    if (filled.length) actions.push("replace", "delete", "backspace", "append");
    if (usable.length && chance(0.12)) actions.push("moveBox");

    const action = choice(actions);

    if (action === "create") {
      const rect = wsRect();
      const spot = findOpenSpot(boxes, rect);
      const text = randomPhrase(1, chance(0.5) ? 2 : 4);
      return { cmd: createCmd(spot.x, spot.y, text), boxId: null, version: null };
    }

    if (action === "append") {
      const box = choice(usable.length ? usable : boxes);
      const { text, version } = snap(box);
      return { cmd: appendCmd(box.id, appendChunk(text)), boxId: box.id, version };
    }

    if (action === "insert") {
      const box = choice(usable);
      const { text, version } = snap(box);
      const bounds = wordBoundaries(text);
      const index = choice(bounds);
      return { cmd: insertCmd(box.id, index, insertChunk()), boxId: box.id, version };
    }

    if (action === "replace") {
      const pool = filled.length > 0 ? filled.filter((b) => b.doc.text.length > 2) : [];
      if (!pool.length) {
        const box = choice(usable.length ? usable : boxes);
        const { text, version } = snap(box);
        return { cmd: appendCmd(box.id, appendChunk(text)), boxId: box.id, version };
      }
      const box = choice(pool);
      const { text, version } = snap(box);
      const [a, b] = pickRange(text);
      const newText = randomWords(1, chance(0.5) ? 1 : 2);
      return { cmd: replaceCmd(box.id, a, b, newText), boxId: box.id, version };
    }

    if (action === "delete") {
      const pool = filled.filter((b) => b.doc.text.length > 1);
      if (!pool.length) {
        const box = choice(usable.length ? usable : boxes);
        const { text, version } = snap(box);
        return { cmd: appendCmd(box.id, appendChunk(text)), boxId: box.id, version };
      }
      const box = choice(pool);
      const { text, version } = snap(box);
      const [a, b] = pickRange(text);
      return { cmd: deleteCmd(box.id, a, b), boxId: box.id, version };
    }

    if (action === "backspace") {
      const pool = filled.filter((b) => b.doc.text.length > 0);
      if (!pool.length) {
        const box = choice(usable.length ? usable : boxes);
        const { text, version } = snap(box);
        return { cmd: appendCmd(box.id, appendChunk(text)), boxId: box.id, version };
      }
      const box = choice(pool);
      const { text, version } = snap(box);
      const bounds = wordBoundaries(text);
      const nonZero = bounds.filter((b) => b > 0);
      if (!nonZero.length) {
        return { cmd: appendCmd(box.id, appendChunk(text)), boxId: box.id, version };
      }
      let index = chance(0.6) ? text.length : choice(nonZero);
      let prevBound = 0;
      for (const bnd of bounds) {
        if (bnd < index) prevBound = bnd;
        else break;
      }
      const count = Math.max(1, index - prevBound);
      return { cmd: backspaceCmd(box.id, index, count), boxId: box.id, version };
    }

    // default: move
    const rect = wsRect();
    if (action === "moveBox") {
      const box = choice(usable);
      const toX = rand(10, Math.max(10, rect.width - 150));
      const toY = rand(10, Math.max(10, rect.height - 40));
      return { cmd: moveBoxCmd(box.id, toX, toY), boxId: null, version: null };
    }
    return { cmd: moveCmd(rand(rect.left + 10, rect.right - 20), rand(rect.top + 10, rect.bottom - 20)), boxId: null, version: null };
  }
}
