// ─── document.js ─── Simple document text container ─────────────
// Stores the canonical text for a box.
//
// With span-based locking the DOM is the conflict-free data structure.
// OT (version tracking, position transforms) is no longer needed —
// lock <span> elements in the DOM shift naturally when other content
// is added or removed around them.

// ─── Doc ────────────────────────────────────────────────────────
export class Doc {
  /**
   * @param {string} text  Initial text content
   */
  constructor(text = "") {
    /** @type {string} Current document text */
    this.text = text;
  }

  // ─── Read ───────────────────────────────────────────────────
  /** Return a snapshot: { text } */
  read() {
    return { text: this.text };
  }

  // ─── Write ──────────────────────────────────────────────────
  /**
   * Apply an edit to the canonical text.
   * Used for human edits (no lock spans present) and to keep
   * doc.text in sync with DOM after span operations.
   *
   * @param {number} start  Start index in current text
   * @param {number} end    End index in current text
   * @param {string} insert Replacement string ('' for pure delete)
   * @returns {number} New cursor position (start + insert.length)
   */
  apply(start, end, insert) {
    start = Math.max(0, Math.min(start, this.text.length));
    end = Math.max(start, Math.min(end, this.text.length));
    this.text = this.text.slice(0, start) + insert + this.text.slice(end);
    return start + insert.length;
  }
}
