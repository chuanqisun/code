// ─── events.js ─── Minimal pub/sub event bus ────────────────────
// Decouples producers (executor) from consumers (sound, analytics).

export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, data) {
      if (listeners.has(event)) {
        for (const fn of listeners.get(event)) fn(data);
      }
    },
  };
}
