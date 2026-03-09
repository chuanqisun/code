// ─── commands.js ─── Edit command vocabulary ────────────────────
// Plain data objects describing edit operations.
// The shared language between planners, executors, and event subscribers.

export function createCmd(x, y, text) {
  return { type: "create", x, y, text };
}

export function appendCmd(boxId, text) {
  return { type: "append", boxId, text };
}

export function insertCmd(boxId, index, text) {
  return { type: "insert", boxId, index, text };
}

export function replaceCmd(boxId, start, end, text) {
  return { type: "replace", boxId, start, end, text };
}

export function deleteCmd(boxId, start, end) {
  return { type: "delete", boxId, start, end };
}

export function backspaceCmd(boxId, index, count) {
  return { type: "backspace", boxId, index, count };
}

export function moveCmd(x, y) {
  return { type: "move", x, y };
}

export function moveBoxCmd(boxId, toX, toY) {
  return { type: "moveBox", boxId, toX, toY };
}
