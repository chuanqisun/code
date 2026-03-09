// ─── locks.js ─── Range-based lock registry ────────────────────
// Prevents multiple bots from editing/selecting overlapping character
// ranges in the same box simultaneously.
//
// Each bot acquires a lock on a [start, end] range before executing
// an edit command. The planner also checks for free ranges so it
// avoids planning actions that will collide.

/** @type {Map<number, Array<{start: number, end: number, botId: number}>>} */
const _locks = new Map();

/**
 * Acquire a range lock on a box.
 * Any previous lock this bot held on the same box is released first.
 * @param {number} boxId
 * @param {number} start  Start of affected range (inclusive)
 * @param {number} end    End of affected range (inclusive)
 * @param {number} botId
 */
export function acquireLock(boxId, start, end, botId) {
  releaseLock(boxId, botId);
  if (!_locks.has(boxId)) _locks.set(boxId, []);
  _locks.get(boxId).push({ start, end, botId });
}

/**
 * Release all locks a bot holds on a specific box.
 * @param {number} boxId
 * @param {number} botId
 */
export function releaseLock(boxId, botId) {
  if (!_locks.has(boxId)) return;
  const arr = _locks.get(boxId).filter((l) => l.botId !== botId);
  if (arr.length === 0) _locks.delete(boxId);
  else _locks.set(boxId, arr);
}

/**
 * Release all locks a bot holds on any box (used during departure).
 * @param {number} botId
 */
export function releaseAllLocks(botId) {
  for (const [boxId, arr] of _locks) {
    const filtered = arr.filter((l) => l.botId !== botId);
    if (filtered.length === 0) _locks.delete(boxId);
    else _locks.set(boxId, filtered);
  }
}

/**
 * Check whether a range overlaps with any existing lock on a box.
 * @param {number} boxId
 * @param {number} start  Start of range to check (inclusive)
 * @param {number} end    End of range to check (inclusive)
 * @param {number} [excludeBotId]  Ignore locks held by this bot
 * @returns {boolean} true if an overlap exists
 */
export function hasOverlap(boxId, start, end, excludeBotId) {
  const arr = _locks.get(boxId);
  if (!arr) return false;
  return arr.some((l) => (excludeBotId == null || l.botId !== excludeBotId) && l.start <= end && l.end >= start);
}

/**
 * Convenience: returns true when the range is free of other bots' locks.
 * @param {number} boxId
 * @param {number} start
 * @param {number} end
 * @param {number} botId  The requesting bot
 * @returns {boolean}
 */
export function isRangeFree(boxId, start, end, botId) {
  return !hasOverlap(boxId, start, end, botId);
}
