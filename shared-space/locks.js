// ─── locks.js ─── DOM span-based range locking ──────────────────
// Uses <span class="bot-lock" data-bot-id="N"> elements inside a
// contentEditable text area to mark locked regions.
//
// The DOM naturally tracks positions: when text is inserted or
// removed before a span, the span shifts.  No manual position
// transforms are needed.
//
// Rules enforced:
//   - Insertion cannot happen inside another bot's span
//   - Deletion cannot enter another bot's span
//   - Selection cannot overlap with another bot's span

// ─── Text-node walking ──────────────────────────────────────────

/**
 * Walk the text content of `el` and return the text node + offset
 * that corresponds to `charIndex` characters from the start.
 * Returns null when past the end.
 */
function findTextPosition(el, charIndex) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let pos = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (pos + node.length >= charIndex) {
      return { node, offset: charIndex - pos };
    }
    pos += node.length;
  }
  return null;
}

/**
 * Get the character index where a lock span starts inside `textEl`.
 */
export function getSpanCharIndex(textEl, span) {
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  let pos = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (span.contains(node)) return pos;
    pos += node.length;
  }
  // Span is empty — walk element order instead
  const iter = document.createNodeIterator(textEl, NodeFilter.SHOW_ALL);
  pos = 0;
  let n;
  while ((n = iter.nextNode())) {
    if (n === span) return pos;
    if (n.nodeType === Node.TEXT_NODE && !span.contains(n)) {
      pos += n.length;
    }
  }
  return pos;
}

// ─── Acquire / release ──────────────────────────────────────────

/**
 * Acquire a caret lock: insert a zero-width `<span>` at the given
 * character index.  Returns the span element, or null if the
 * position overlaps another bot's lock.
 */
export function acquireCaretLock(textEl, index, botId) {
  releaseLock(textEl, botId);

  if (!isRangeFree(textEl, index, index, botId)) return null;

  const span = document.createElement("span");
  span.className = "bot-lock";
  span.dataset.botId = String(botId);
  span.dataset.lockType = "caret";

  const tp = findTextPosition(textEl, index);
  if (tp) {
    if (tp.offset === 0) {
      tp.node.parentNode.insertBefore(span, tp.node);
    } else if (tp.offset >= tp.node.length) {
      tp.node.parentNode.insertBefore(span, tp.node.nextSibling);
    } else {
      const after = tp.node.splitText(tp.offset);
      tp.node.parentNode.insertBefore(span, after);
    }
  } else {
    textEl.appendChild(span);
  }
  return span;
}

/**
 * Acquire a selection lock: wrap the text in [start, end) in a
 * `<span>`.  Returns the span element, or null on overlap.
 */
export function acquireSelectionLock(textEl, start, end, botId) {
  releaseLock(textEl, botId);

  if (start > end) [start, end] = [end, start];
  if (start === end) return acquireCaretLock(textEl, start, botId);

  if (!isRangeFree(textEl, start, end, botId)) return null;

  const startPos = findTextPosition(textEl, start);
  const endPos = findTextPosition(textEl, end);
  if (!startPos || !endPos) return acquireCaretLock(textEl, start, botId);

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const span = document.createElement("span");
  span.className = "bot-lock";
  span.dataset.botId = String(botId);
  span.dataset.lockType = "selection";

  try {
    range.surroundContents(span);
  } catch (_) {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }
  textEl.normalize();
  return span;
}

/**
 * Release (unwrap) a bot's lock span.  Content stays in place.
 */
export function releaseLock(textEl, botId) {
  const span = textEl.querySelector(`.bot-lock[data-bot-id="${botId}"]`);
  if (!span) return;
  while (span.firstChild) {
    span.parentNode.insertBefore(span.firstChild, span);
  }
  span.remove();
  textEl.normalize();
}

/**
 * Release all lock spans (used when a human focuses the box).
 */
export function releaseAllLocks(textEl) {
  const spans = [...textEl.querySelectorAll(".bot-lock")];
  for (const span of spans) {
    while (span.firstChild) {
      span.parentNode.insertBefore(span.firstChild, span);
    }
    span.remove();
  }
  textEl.normalize();
}

/**
 * Get a bot's lock span (or null).
 */
export function getLockSpan(textEl, botId) {
  return textEl.querySelector(`.bot-lock[data-bot-id="${botId}"]`);
}

// ─── Conflict queries ───────────────────────────────────────────

/**
 * Check whether a character range is free of other bots' locks.
 * A zero-width range (start === end) checks the single index.
 */
export function isRangeFree(textEl, start, end, excludeBotId) {
  const spans = textEl.querySelectorAll(".bot-lock");
  for (const span of spans) {
    if (span.dataset.botId === String(excludeBotId)) continue;
    const sStart = getSpanCharIndex(textEl, span);
    const sEnd = sStart + (span.textContent?.length || 0);
    // For zero-width queries treat the point as an open interval
    if (start === end) {
      if (start > sStart && start < sEnd) return false;
    } else {
      if (start < sEnd && end > sStart) return false;
    }
  }
  return true;
}
