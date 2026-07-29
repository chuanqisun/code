// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextManager } from "./context-manager";

const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe("ContextManager", () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal("localStorage", mockStorage);
  });

  it("initializes with 10 default slots", () => {
    const cm = new ContextManager();
    const slots = cm.getSlots();

    expect(slots).toHaveLength(10);
    expect(slots[0]).toBe("My name is Alex and I am 28 years old.");
    expect(slots[1]).toBe("I live in San Francisco, California.");
    expect(slots[2]).toBe("I work as a software engineer building voice applications.");
    expect(slots[3]).toBe("My favorite hobby is playing acoustic guitar.");
    expect(slots[4]).toBe("I have a golden retriever named Buster.");
    expect(slots[5]).toBe("I am fluent in English and Spanish.");
    expect(slots[6]).toBe("My favorite food is authentic Italian pasta.");
    expect(slots[7]).toBe("I am building a web-based speech synthesis interface.");
    expect(slots[8]).toBe("I prefer working in the morning when my mind is sharpest.");
    expect(slots[9]).toBe("I am planning a vacation trip to Japan next spring.");
  });

  it("updates and retrieves slot values and persists to localStorage", () => {
    const cm = new ContextManager();
    cm.setSlot(0, "Custom slot 0 text");
    expect(cm.getSlot(0)).toBe("Custom slot 0 text");

    // Create a new instance and verify persistence from localStorage
    const cm2 = new ContextManager();
    expect(cm2.getSlot(0)).toBe("Custom slot 0 text");
  });

  it("builds dynamic system prompt with selected context slots sorted numerically", () => {
    const cm = new ContextManager();

    // Test base prompt with no selected slots
    const basePrompt = cm.buildSystemPrompt([]);
    expect(basePrompt).toContain("Complete user's sentence in the most sensible way in first-person voice ('I ...').");
    expect(basePrompt).toContain("Respond only with a few words to fill the __ as if uttered by the user themselves.");
    expect(basePrompt).not.toContain("<context");

    // Test with selected slots 2 and 0 (unsorted input)
    const promptWithContext = cm.buildSystemPrompt([2, 0]);
    const expected = [
      "Complete user's sentence in the most sensible way in first-person voice ('I ...').",
      "Respond only with a few words to fill the __ as if uttered by the user themselves.",
      "",
      '<context index="0">My name is Alex and I am 28 years old.</context>',
      '<context index="2">I work as a software engineer building voice applications.</context>',
    ].join("\n");

    expect(promptWithContext).toBe(expected);
  });

  it("handles Set or iterable for selected indices and filters out of range indices", () => {
    const cm = new ContextManager();
    const prompt = cm.buildSystemPrompt(new Set([1, 99, -1, 5]));
    expect(prompt).toContain('<context index="1">I live in San Francisco, California.</context>');
    expect(prompt).toContain('<context index="5">I am fluent in English and Spanish.</context>');
    expect(prompt).not.toContain('index="99"');
    expect(prompt).not.toContain('index="-1"');
  });
});
