export interface AppSettings {
  groqKey: string;
  elevenKey: string;
  voiceId: string;
}

export interface AppSettings {
  groqKey: string;
  elevenKey: string;
  voiceId: string;
}

export class UIManager {
  readonly groqKeyInput = document.getElementById("groqKey") as HTMLInputElement;
  readonly elevenKeyInput = document.getElementById("elevenKey") as HTMLInputElement;
  readonly voiceIdInput = document.getElementById("voiceId") as HTMLInputElement;
  readonly audioInputSelect = document.getElementById("audioInput") as HTMLSelectElement;
  readonly audioOutputSelect = document.getElementById("audioOutput") as HTMLSelectElement;
  readonly talkButton = document.getElementById("talk") as HTMLButtonElement;
  readonly cancelButton = document.getElementById("cancel") as HTMLButtonElement;
  readonly clearThreadButton = document.getElementById("clearThread") as HTMLButtonElement;
  readonly keyCaptureInput = document.getElementById("keyCaptureInput") as HTMLInputElement;
  readonly keypadContainer = document.getElementById("keypadContainer") as HTMLElement;
  readonly slotsGrid = document.getElementById("slotsGrid") as HTMLElement;
  readonly recBadge = document.getElementById("rec") as HTMLElement;
  readonly statusText = document.getElementById("status") as HTMLElement;
  readonly resultsContainer = document.getElementById("results") as HTMLElement;

  constructor() {
    this.loadSettings();
    this.bindSettingsEvents();
  }

  private loadSettings(): void {
    if (this.groqKeyInput) this.groqKeyInput.value = localStorage.getItem("groq_api_key") || "";
    if (this.elevenKeyInput) this.elevenKeyInput.value = localStorage.getItem("elevenlabs_api_key") || "";
    if (this.voiceIdInput) this.voiceIdInput.value = localStorage.getItem("elevenlabs_voice_id") || this.voiceIdInput.value;
  }

  private bindSettingsEvents(): void {
    if (this.groqKeyInput) this.groqKeyInput.oninput = () => localStorage.setItem("groq_api_key", this.groqKeyInput.value);
    if (this.elevenKeyInput) this.elevenKeyInput.oninput = () => localStorage.setItem("elevenlabs_api_key", this.elevenKeyInput.value);
    if (this.voiceIdInput) this.voiceIdInput.oninput = () => localStorage.setItem("elevenlabs_voice_id", this.voiceIdInput.value);
  }

  renderContextSlots(slots: string[], onSlotChange: (index: number, text: string) => void): void {
    if (!this.slotsGrid) return;
    this.slotsGrid.innerHTML = "";

    slots.forEach((text, index) => {
      const container = document.createElement("div");
      container.className = "slot-item";

      const label = document.createElement("span");
      label.textContent = `${index}:`;

      const input = document.createElement("input");
      input.type = "text";
      input.value = text;
      input.oninput = () => onSlotChange(index, input.value);

      container.append(label, input);
      this.slotsGrid.append(container);
    });
  }

  updateActiveKeys(activeKeys: Set<number>, bracketKeys: Set<number> = new Set()): void {
    if (!this.keypadContainer) return;
    const buttons = this.keypadContainer.querySelectorAll<HTMLElement>("[data-slot]");
    buttons.forEach((btn) => {
      const slotIndex = parseInt(btn.dataset.slot || "", 10);
      if (activeKeys.has(slotIndex) || bracketKeys.has(slotIndex)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  getSettings(): AppSettings {
    return {
      groqKey: this.groqKeyInput ? this.groqKeyInput.value.trim() : "",
      elevenKey: this.elevenKeyInput ? this.elevenKeyInput.value.trim() : "",
      voiceId: this.voiceIdInput ? this.voiceIdInput.value.trim() : "",
    };
  }

  setStatus(message: string): void {
    if (this.statusText) this.statusText.textContent = message;
  }

  setRecordingUI(): void {
    if (this.talkButton) this.talkButton.textContent = "Stop Recording";
    if (this.recBadge) this.recBadge.style.display = "inline";
    this.setStatus("Recording...");
  }

  setProcessingUI(): void {
    if (this.talkButton) {
      this.talkButton.disabled = true;
      this.talkButton.textContent = "Processing...";
    }
    if (this.recBadge) this.recBadge.style.display = "none";
    this.setStatus("Transcribing...");
  }

  resetTalkButton(): void {
    if (this.talkButton) {
      this.talkButton.disabled = false;
      this.talkButton.textContent = "Press to talk";
    }
  }

  appendLog(label: string, text: string, latencyMs?: number, bracketKeys?: Set<number> | number[]): void {
    if (!this.resultsContainer) return;
    const item = document.createElement("div");
    const name = document.createElement("span");
    name.className = "label";
    name.textContent = `${label}: `;

    item.append(name, document.createTextNode(text));

    if (bracketKeys) {
      const keysArray = Array.from(bracketKeys).sort((a, b) => a - b);
      if (keysArray.length > 0) {
        const tag = document.createElement("span");
        tag.className = "latency";
        tag.textContent = ` [Prompts: ${keysArray.join(", ")}]`;
        item.append(tag);
      }
    }

    if (typeof latencyMs === "number") {
      const latency = document.createElement("span");
      latency.className = "latency";
      latency.textContent = ` [${(latencyMs / 1000).toFixed(2)}s]`;
      item.append(latency);
    }

    this.resultsContainer.append(item);
    item.scrollIntoView({ block: "end" });
  }
}
