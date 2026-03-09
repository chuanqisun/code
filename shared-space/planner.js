// ─── planner.js ─── Action planning for bots ────────────────────
// Decides WHAT to do. Returns EditCommands. Knows nothing about animation.
// RandomPlanner uses weighted random selection; future LLMPlanner will
// implement the same plan() interface.

import { appendCmd, backspaceCmd, createCmd, deleteCmd, insertCmd, moveCmd, replaceCmd } from "./commands.js";
import { canBotUseBox, findOpenSpot, getText } from "./edit.js";
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

// ─── RandomPlanner ──────────────────────────────────────────────
// plan(state) → EditCommand
// state: { boxes, botId, wsRect }
export class RandomPlanner {
  plan({ boxes, botId, wsRect }) {
    const usable = boxes.filter((b) => canBotUseBox(b, botId));
    const filled = usable.filter((b) => getText(b).length > 0);

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
      return createCmd(spot.x, spot.y, text);
    }

    if (action === "append") {
      const box = choice(usable.length ? usable : boxes);
      const t = getText(box);
      return appendCmd(box.id, appendChunk(t));
    }

    if (action === "insert") {
      const box = choice(usable);
      const t = getText(box);
      const index = t.length ? Math.floor(rand(0, t.length + 1)) : 0;
      return insertCmd(box.id, index, insertChunk());
    }

    if (action === "replace") {
      const pool = filled.length > 0 ? filled.filter((b) => getText(b).length > 2) : [];
      if (!pool.length) {
        const box = choice(usable.length ? usable : boxes);
        return appendCmd(box.id, appendChunk(getText(box)));
      }
      const box = choice(pool);
      const [a, b] = pickRange(getText(box));
      const text = randomWords(1, chance(0.5) ? 1 : 2);
      return replaceCmd(box.id, a, b, text);
    }

    if (action === "delete") {
      const pool = filled.filter((b) => getText(b).length > 1);
      if (!pool.length) {
        const box = choice(usable.length ? usable : boxes);
        return appendCmd(box.id, appendChunk(getText(box)));
      }
      const box = choice(pool);
      const [a, b] = pickRange(getText(box));
      return deleteCmd(box.id, a, b);
    }

    if (action === "backspace") {
      const pool = filled.filter((b) => getText(b).length > 0);
      if (!pool.length) {
        const box = choice(usable.length ? usable : boxes);
        return appendCmd(box.id, appendChunk(getText(box)));
      }
      const box = choice(pool);
      const t = getText(box);
      const index = chance(0.6) ? t.length : Math.floor(rand(1, t.length + 1));
      const count = Math.max(1, Math.floor(rand(1, Math.min(4, index) + 1)));
      return backspaceCmd(box.id, index, count);
    }

    // default: move
    const rect = wsRect();
    return moveCmd(rand(rect.left + 10, rect.right - 20), rand(rect.top + 10, rect.bottom - 20));
  }
}
