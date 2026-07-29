// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { KeyboardManager } from "./keyboard-manager";

describe("KeyboardManager", () => {
  let keyCaptureInput: HTMLInputElement;
  let configInput: HTMLInputElement;
  let km: KeyboardManager;

  let onInterrupt: Mock;
  let onBracketStart: Mock;
  let onBracketUpdate: Mock;
  let onBracketEnd: Mock;

  beforeEach(() => {
    keyCaptureInput = document.createElement("input");
    keyCaptureInput.id = "keyCaptureInput";
    keyCaptureInput.type = "text";
    document.body.appendChild(keyCaptureInput);

    configInput = document.createElement("input");
    configInput.id = "groqKey";
    document.body.appendChild(configInput);

    onInterrupt = vi.fn();
    onBracketStart = vi.fn();
    onBracketUpdate = vi.fn();
    onBracketEnd = vi.fn();

    km = new KeyboardManager({
      keyCaptureInput,
      callbacks: {
        onInterrupt: onInterrupt as unknown as (reason?: string) => void,
        onBracketStart: onBracketStart as unknown as (bracketKeys: Set<number>) => void,
        onBracketUpdate: onBracketUpdate as unknown as (bracketKeys: Set<number>, activeKeys: Set<number>) => void,
        onBracketEnd: onBracketEnd as unknown as (bracketKeys: Set<number>) => void,
      },
    });
  });

  afterEach(() => {
    km.destroy();
    document.body.innerHTML = "";
  });

  it("ignores key events originating from config inputs", () => {
    configInput.dispatchEvent(new KeyboardEvent("keydown", { key: "0", code: "Digit0", bubbles: true }));
    expect(onInterrupt).not.toHaveBeenCalled();
    expect(onBracketStart).not.toHaveBeenCalled();
  });

  it("triggers onInterrupt on non-config keydown", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true }));
    expect(onInterrupt).toHaveBeenCalledOnce();
    expect(onBracketStart).not.toHaveBeenCalled();
  });

  it("ignores repeated keydown events (event.repeat === true)", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", code: "Digit0", repeat: true, bubbles: true }));
    expect(onInterrupt).not.toHaveBeenCalled();
    expect(onBracketStart).not.toHaveBeenCalled();
  });

  it("handles single number key bracket lifecycle (Digit0)", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", code: "Digit0", bubbles: true }));

    expect(onInterrupt).toHaveBeenCalledOnce();
    expect(onBracketStart).toHaveBeenCalledOnce();
    expect(onBracketStart.mock.calls[0][0]).toEqual(new Set([0]));

    window.dispatchEvent(new KeyboardEvent("keyup", { key: "0", code: "Digit0", bubbles: true }));

    expect(onBracketEnd).toHaveBeenCalledOnce();
    expect(onBracketEnd.mock.calls[0][0]).toEqual(new Set([0]));
  });

  it("handles multi-key bracket hold (0 and 2) without interrupting ongoing bracket", () => {
    // Press key 0 (first number keydown starts bracket)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", code: "Digit0", bubbles: true }));
    expect(onInterrupt).toHaveBeenCalledOnce();
    expect(onBracketStart).toHaveBeenCalledWith(new Set([0]));

    // Press key 2 while holding 0 (subsequent number keydown accumulates key, does NOT interrupt)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "2", code: "Digit2", bubbles: true }));
    expect(onInterrupt).toHaveBeenCalledOnce(); // Still 1, NOT 2!
    expect(onBracketUpdate).toHaveBeenCalledWith(new Set([0, 2]), new Set([0, 2]));

    // Release key 0 (active keys becomes [2], bracket keys remains [0, 2])
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "0", code: "Digit0", bubbles: true }));
    expect(onBracketUpdate).toHaveBeenCalledWith(new Set([0, 2]), new Set([2]));
    expect(onBracketEnd).not.toHaveBeenCalled();

    // Release key 2 (last keyup triggers bracket end with complete bracket set [0, 2])
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "2", code: "Digit2", bubbles: true }));
    expect(onBracketEnd).toHaveBeenCalledWith(new Set([0, 2]));
  });

  it("handles touch/pointer press and release on keypad buttons", () => {
    const keypadBtn = document.createElement("button");
    keypadBtn.dataset.slot = "3";
    const span = document.createElement("span");
    const textNode = document.createTextNode("3");
    span.appendChild(textNode);
    keypadBtn.appendChild(span);
    document.body.appendChild(keypadBtn);

    // Test targeting text node child inside button
    textNode.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onInterrupt).toHaveBeenCalled();
    expect(onBracketStart).toHaveBeenCalledWith(new Set([3]));

    textNode.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(onBracketEnd).toHaveBeenCalledWith(new Set([3]));
  });

  it("clears capture input value on input event", () => {
    keyCaptureInput.value = "5";
    keyCaptureInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(keyCaptureInput.value).toBe("");
  });
});
