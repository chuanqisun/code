import { beforeEach, describe, expect, it } from "vitest";
import { ThreadManager } from "./thread-manager";

describe("ThreadManager", () => {
  let tm: ThreadManager;

  beforeEach(() => {
    tm = new ThreadManager();
  });

  it("starts with empty history", () => {
    expect(tm.getTurns()).toEqual([]);
  });

  it("adds turns and retrieves history", () => {
    tm.addTurn("Hello, I am Alex and I live in", "San Francisco.");
    expect(tm.getTurns()).toEqual([{ user: "Hello, I am Alex and I live in", assistant: "San Francisco." }]);
  });

  it("clears history", () => {
    tm.addTurn("Hello", "World");
    tm.clear();
    expect(tm.getTurns()).toEqual([]);
  });

  it("builds chat messages array with system prompt, history, and current user message with __ suffix", () => {
    const systemPrompt = "Dynamic system prompt";

    // First turn build
    const messages1 = tm.buildMessages(systemPrompt, "Today I want to eat");
    expect(messages1).toEqual([
      { role: "system", content: "Dynamic system prompt" },
      { role: "user", content: "Today I want to eat __" },
    ]);

    // Add first turn to history
    tm.addTurn("Today I want to eat", "Italian pasta.");

    // Second turn build
    const messages2 = tm.buildMessages(systemPrompt, "And for dessert I would like");
    expect(messages2).toEqual([
      { role: "system", content: "Dynamic system prompt" },
      { role: "user", content: "Today I want to eat" },
      { role: "assistant", content: "Italian pasta." },
      { role: "user", content: "And for dessert I would like __" },
    ]);
  });

  it("avoids duplicate __ suffix if user text already ends with __", () => {
    const messages = tm.buildMessages("sys", "Hello __");
    expect(messages[1].content).toBe("Hello __");
  });
});
