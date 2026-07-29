export const DEFAULT_CONTEXT_SLOTS = [
  "My name is Alex and I am 28 years old.",
  "I live in San Francisco, California.",
  "I work as a software engineer building voice applications.",
  "My favorite hobby is playing acoustic guitar.",
  "I have a golden retriever named Buster.",
  "I am fluent in English and Spanish.",
  "My favorite food is authentic Italian pasta.",
  "I am building a web-based speech synthesis interface.",
  "I prefer working in the morning when my mind is sharpest.",
  "I am planning a vacation trip to Japan next spring.",
];

const LOCAL_STORAGE_KEY = "context_slots";

export class ContextManager {
  private slots: string[];

  constructor() {
    this.slots = [...DEFAULT_CONTEXT_SLOTS];
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          for (let i = 0; i < 10; i++) {
            if (typeof parsed[i] === "string") {
              this.slots[i] = parsed[i];
            }
          }
        }
      }
    } catch {
      // Fall back to defaults on parse error
    }
  }

  private save(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.slots));
    } catch {
      // Ignore localStorage write errors
    }
  }

  getSlots(): string[] {
    return [...this.slots];
  }

  getSlot(index: number): string {
    return this.slots[index] ?? "";
  }

  setSlot(index: number, text: string): void {
    if (index >= 0 && index < 10) {
      this.slots[index] = text;
      this.save();
    }
  }

  buildSystemPrompt(selectedIndices: Iterable<number>): string {
    const baseHeader = [
      "Complete user's sentence in the most sensible way in first-person voice ('I ...').",
      "Respond only with a few words to fill the __ as if uttered by the user themselves.",
    ].join("\n");

    const validIndices = Array.from(new Set(selectedIndices))
      .filter((idx) => typeof idx === "number" && idx >= 0 && idx < 10)
      .sort((a, b) => a - b);

    if (validIndices.length === 0) {
      return baseHeader;
    }

    const contextLines = validIndices.map((idx) => `<context index="${idx}">${this.getSlot(idx)}</context>`);

    return `${baseHeader}\n\n${contextLines.join("\n")}`;
  }
}
