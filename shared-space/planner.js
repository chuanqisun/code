// ─── planner.js ─── Action planning for bots ────────────────────
// Decides WHAT to do. Returns { cmd, boxId, version }.
// cmd:     The edit command planned against the snapshot.
// boxId:   The target box id (null for move/create).
// version: The doc version the cmd was planned against.
// RandomPlanner uses weighted random selection; future LLMPlanner will
// implement the same plan() interface.

import { appendCmd, backspaceCmd, createCmd, deleteCmd, insertCmd, moveCmd, replaceCmd } from "./commands.js";
import { canBotUseBox, findOpenSpot } from "./edit.js";
import { appendChunk, insertChunk, pickRange, randomPhrase, randomWords } from "./linguistics.js";

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
// state: { boxes, botId, wsRect }
export class RandomPlanner {
  plan({ boxes, botId, wsRect }) {
    const usable = boxes.filter((b) => canBotUseBox(b));
    const filled = usable.filter((b) => b.doc.text.length > 0);

    // Build weighted action list
    const actions = ["move"];
    if (boxes.length < 4 || chance(0.25)) actions.push("create");
    if (usable.length) actions.push("append", "insert");
    if (filled.length) actions.push("replace", "delete", "backspace", "append");

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
      const index = text.length ? Math.floor(rand(0, text.length + 1)) : 0;
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
      const index = chance(0.6) ? text.length : Math.floor(rand(1, text.length + 1));
      const count = Math.max(1, Math.floor(rand(1, Math.min(4, index) + 1)));
      return { cmd: backspaceCmd(box.id, index, count), boxId: box.id, version };
    }

    // default: move
    const rect = wsRect();
    return { cmd: moveCmd(rand(rect.left + 10, rect.right - 20), rand(rect.top + 10, rect.bottom - 20)), boxId: null, version: null };
  }
}
