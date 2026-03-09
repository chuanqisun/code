// ─── sound.js ─── Sound effects via EventBus ────────────────────
// Subscribes to "edit" events and plays audio feedback.
// All sound functions are placeholders — replace with real audio later.

// ─── Placeholder sound functions ────────────────────────────────
function playKeystroke(ch) {
  // TODO: play a keystroke click sound
  // e.g. new Audio("click.mp3").play()
}

function playDeleteSound() {
  // TODO: play a soft delete/backspace sound
}

// ─── Wire to EventBus ───────────────────────────────────────────
export function initSound(eventBus) {
  eventBus.on("edit", ({ text, start, end }) => {
    if (text.length === 1) {
      // Single character typed
      playKeystroke(text);
    } else if (text.length > 1) {
      // Multi-char insert (paste or burst)
      playKeystroke(text[0]);
    } else if (text === "" && start !== end) {
      // Deletion
      playDeleteSound();
    }
  });
}
