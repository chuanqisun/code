// ─── document.js ─── Version-stamped document with OT rebasing ──
// Minimum data structure for eventual consistency in a single-thread
// environment with async read-think-write gaps.
//
// Problem: Bot A reads "hello world" (version 3), plans to replace
// indices 6–11. While it thinks, Bot B inserts "dear " at index 0.
// By the time A writes, the text is "dear hello world" and indices
// 6–11 hit the wrong characters.
//
// Solution: Every edit is logged with its version. When a bot writes,
// it transforms its indices through all edits that happened since its
// read. Because the JS event loop serializes actual mutations, this
// is OT with a single server — no vector clocks, no tombstones.
//
// Upgrade path to true CRDT: replace the string + log with an RGA
// (Replicated Growable Array) where each character has a unique ID
// and positions are references to IDs, not integer indices.

// ─── Doc ────────────────────────────────────────────────────────
export class Doc {
  /**
   * @param {string} text  Initial text content
   */
  constructor(text = "") {
    /** @type {string} Current document text */
    this.text = text;

    /** @type {number} Monotonically increasing version */
    this.version = 0;

    /**
     * Edit log for position transformation.
     * Each entry: { ver, start, delLen, insLen }
     * @type {Array<{ver: number, start: number, delLen: number, insLen: number}>}
     */
    this.log = [];
  }

  // ─── Read ───────────────────────────────────────────────────
  /** Return an immutable snapshot: { text, version } */
  read() {
    return { text: this.text, version: this.version };
  }

  // ─── Write ──────────────────────────────────────────────────
  /**
   * Apply an edit. All text mutations go through here.
   * @param {number} start  Start index in current text
   * @param {number} end    End index in current text
   * @param {string} insert Replacement string ('' for pure delete)
   * @returns {number} New cursor position (start + insert.length)
   */
  apply(start, end, insert) {
    start = Math.max(0, Math.min(start, this.text.length));
    end = Math.max(start, Math.min(end, this.text.length));
    const delLen = end - start;
    const insLen = insert.length;

    this.text = this.text.slice(0, start) + insert + this.text.slice(end);
    this.log.push({ ver: this.version, start, delLen, insLen });
    this.version++;

    // Prune old log entries — keep enough history for any in-flight read
    if (this.log.length > 500) this.log = this.log.slice(-250);

    return start + insLen;
  }

  // ─── Transform ─────────────────────────────────────────────
  /**
   * Transform a single position from `sinceVersion` to the current version.
   *
   * @param {number} pos   Position at the time of `sinceVersion`
   * @param {number} since Version number from a prior read()
   * @param {'left'|'right'} bias
   *   - 'right' (default): if pos is at an insertion point, move after it.
   *     Use for cursor positions and range ends.
   *   - 'left': stay before the insertion.
   *     Use for range starts (so the range doesn't expand leftward).
   * @returns {number} Transformed position in the current document
   */
  xfPos(pos, since, bias = "right") {
    for (const e of this.log) {
      if (e.ver < since) continue;

      if (pos < e.start || (pos === e.start && bias === "left")) {
        // Position is before the edit — unaffected
        continue;
      }

      if (pos >= e.start + e.delLen) {
        // Position is after the deleted range — shift by net delta
        pos += e.insLen - e.delLen;
      } else {
        // Position is inside the deleted range — collapse
        pos = e.start + (bias === "right" ? e.insLen : 0);
      }
    }

    return Math.max(0, pos);
  }

  /**
   * Transform a [start, end) range from `sinceVersion` to current.
   * Uses left-bias for start, right-bias for end, so the range
   * tracks "what was between these two points" correctly even if
   * text was inserted at the boundaries.
   *
   * @param {number} start
   * @param {number} end
   * @param {number} since
   * @returns {[number, number]}
   */
  xfRange(start, end, since) {
    return [this.xfPos(start, since, "left"), this.xfPos(end, since, "right")];
  }

  /**
   * Transform a full edit command from `sinceVersion` to current.
   * Handles all command types from commands.js.
   *
   * @param {object} cmd  An edit command ({ type, boxId, ... })
   * @param {number} since Version the command was planned against
   * @returns {object} Transformed command (new object, original untouched)
   */
  xfCommand(cmd, since) {
    if (since === this.version) return cmd; // no edits since read

    switch (cmd.type) {
      case "append": {
        // Append always goes to end — no transform needed
        return cmd;
      }
      case "insert": {
        return { ...cmd, index: this.xfPos(cmd.index, since) };
      }
      case "replace": {
        const [s, e] = this.xfRange(cmd.start, cmd.end, since);
        return { ...cmd, start: s, end: e };
      }
      case "delete": {
        const [s, e] = this.xfRange(cmd.start, cmd.end, since);
        return { ...cmd, start: s, end: e };
      }
      case "backspace": {
        return { ...cmd, index: this.xfPos(cmd.index, since) };
      }
      default:
        return cmd;
    }
  }
}
