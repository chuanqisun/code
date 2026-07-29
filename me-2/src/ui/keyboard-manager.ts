export interface KeyboardManagerCallbacks {
  onInterrupt?: (reason?: string) => void;
  onBracketStart?: (bracketKeys: Set<number>) => void;
  onBracketUpdate?: (bracketKeys: Set<number>, activeKeys: Set<number>) => void;
  onBracketEnd?: (bracketKeys: Set<number>) => void;
}

export interface KeyboardManagerOptions {
  keyCaptureInput?: HTMLInputElement | null;
  keypadContainer?: HTMLElement | null;
  callbacks?: KeyboardManagerCallbacks;
}

export class KeyboardManager {
  private keyCaptureInput: HTMLInputElement | null = null;
  private callbacks: KeyboardManagerCallbacks;

  private activeKeys = new Set<number>();
  private bracketKeys = new Set<number>();

  private boundKeydown: (e: KeyboardEvent) => void;
  private boundKeyup: (e: KeyboardEvent) => void;
  private boundBeforeInput: (e: InputEvent) => void;
  private boundInput: (e: Event) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(options: KeyboardManagerOptions = {}) {
    this.keyCaptureInput = options.keyCaptureInput ?? (document.getElementById("keyCaptureInput") as HTMLInputElement | null);
    this.callbacks = options.callbacks || {};

    this.boundKeydown = this.handleKeydown.bind(this);
    this.boundKeyup = this.handleKeyup.bind(this);
    this.boundBeforeInput = this.handleBeforeInput.bind(this);
    this.boundInput = this.handleInput.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);

    this.bindEvents();
  }

  setCallbacks(callbacks: KeyboardManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.boundKeydown);
    window.addEventListener("keyup", this.boundKeyup);

    if (this.keyCaptureInput) {
      this.keyCaptureInput.addEventListener("keydown", this.boundKeydown);
      this.keyCaptureInput.addEventListener("keyup", this.boundKeyup);
      this.keyCaptureInput.addEventListener("beforeinput", this.boundBeforeInput as EventListener);
      this.keyCaptureInput.addEventListener("input", this.boundInput);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("pointerdown", this.boundPointerDown);
      document.addEventListener("pointerup", this.boundPointerUp);
      document.addEventListener("pointercancel", this.boundPointerUp);
      document.addEventListener("pointerleave", this.boundPointerUp);
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.boundKeydown);
    window.removeEventListener("keyup", this.boundKeyup);

    if (this.keyCaptureInput) {
      this.keyCaptureInput.removeEventListener("keydown", this.boundKeydown);
      this.keyCaptureInput.removeEventListener("keyup", this.boundKeyup);
      this.keyCaptureInput.removeEventListener("beforeinput", this.boundBeforeInput as EventListener);
      this.keyCaptureInput.removeEventListener("input", this.boundInput);
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("pointerdown", this.boundPointerDown);
      document.removeEventListener("pointerup", this.boundPointerUp);
      document.removeEventListener("pointercancel", this.boundPointerUp);
      document.removeEventListener("pointerleave", this.boundPointerUp);
    }
  }

  private isConfigInput(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    if (this.keyCaptureInput && target === this.keyCaptureInput) return false;

    const tagName = target.tagName.toUpperCase();
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }
    return target.isContentEditable;
  }

  private getSlotIndexFromKey(e: KeyboardEvent): number | null {
    if (e.code && /^Digit[0-9]$/.test(e.code)) {
      return parseInt(e.code.replace("Digit", ""), 10);
    }
    if (e.code && /^Numpad[0-9]$/.test(e.code)) {
      return parseInt(e.code.replace("Numpad", ""), 10);
    }
    if (/^[0-9]$/.test(e.key)) {
      return parseInt(e.key, 10);
    }
    return null;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (this.isConfigInput(e.target)) return;

    const slotIndex = this.getSlotIndexFromKey(e);
    if (slotIndex !== null) {
      if (this.activeKeys.size === 0) {
        this.callbacks.onInterrupt?.();
      }
      this.processSlotPress(slotIndex);
    } else {
      this.callbacks.onInterrupt?.();
      if (this.activeKeys.size > 0 || this.bracketKeys.size > 0) {
        this.activeKeys.clear();
        this.bracketKeys.clear();
        this.callbacks.onBracketUpdate?.(new Set(), new Set());
      }
    }
  }

  private handleKeyup(e: KeyboardEvent): void {
    if (this.isConfigInput(e.target)) return;

    const slotIndex = this.getSlotIndexFromKey(e);
    if (slotIndex !== null) {
      this.processSlotRelease(slotIndex);
    }
  }

  private handleBeforeInput(e: InputEvent): void {
    if (this.isConfigInput(e.target)) return;
    if (e.data && /^[0-9]$/.test(e.data)) {
      const slotIndex = parseInt(e.data, 10);
      if (this.activeKeys.size === 0) {
        this.callbacks.onInterrupt?.();
      }
      this.processSlotPress(slotIndex);
    } else if (e.data) {
      this.callbacks.onInterrupt?.();
      if (this.activeKeys.size > 0 || this.bracketKeys.size > 0) {
        this.activeKeys.clear();
        this.bracketKeys.clear();
        this.callbacks.onBracketUpdate?.(new Set(), new Set());
      }
    }
  }

  private handleInput(_e: Event): void {
    if (this.keyCaptureInput) {
      this.keyCaptureInput.value = "";
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;
    const button = target?.closest("[data-slot]") as HTMLElement | null;
    if (!button || !button.dataset.slot) return;

    const slotIndex = parseInt(button.dataset.slot, 10);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 9) return;

    if (this.activeKeys.size === 0) {
      this.callbacks.onInterrupt?.();
    }
    this.processSlotPress(slotIndex);
  }

  private handlePointerUp(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;
    const button = target?.closest("[data-slot]") as HTMLElement | null;
    if (!button || !button.dataset.slot) return;

    const slotIndex = parseInt(button.dataset.slot, 10);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 9) return;

    this.processSlotRelease(slotIndex);
  }

  private processSlotPress(slotIndex: number): void {
    if (this.activeKeys.has(slotIndex)) return;

    if (this.activeKeys.size === 0) {
      this.bracketKeys = new Set([slotIndex]);
      this.activeKeys = new Set([slotIndex]);
      this.callbacks.onBracketStart?.(new Set(this.bracketKeys));
    } else {
      this.bracketKeys.add(slotIndex);
      this.activeKeys.add(slotIndex);
      this.callbacks.onBracketUpdate?.(new Set(this.bracketKeys), new Set(this.activeKeys));
    }
  }

  private processSlotRelease(slotIndex: number): void {
    if (!this.activeKeys.has(slotIndex)) return;

    this.activeKeys.delete(slotIndex);
    this.callbacks.onBracketUpdate?.(new Set(this.bracketKeys), new Set(this.activeKeys));

    if (this.activeKeys.size === 0 && this.bracketKeys.size > 0) {
      const finishedBracket = new Set(this.bracketKeys);
      this.bracketKeys.clear();
      this.callbacks.onBracketEnd?.(finishedBracket);
    }
  }
}
