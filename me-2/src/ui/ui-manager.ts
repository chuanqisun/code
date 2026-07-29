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
  readonly recBadge = document.getElementById("rec") as HTMLElement;
  readonly statusText = document.getElementById("status") as HTMLElement;
  readonly resultsContainer = document.getElementById("results") as HTMLElement;

  constructor() {
    this.loadSettings();
    this.bindSettingsEvents();
  }

  private loadSettings(): void {
    this.groqKeyInput.value = localStorage.getItem("groq_api_key") || "";
    this.elevenKeyInput.value = localStorage.getItem("elevenlabs_api_key") || "";
    this.voiceIdInput.value = localStorage.getItem("elevenlabs_voice_id") || this.voiceIdInput.value;
  }

  private bindSettingsEvents(): void {
    this.groqKeyInput.oninput = () => localStorage.setItem("groq_api_key", this.groqKeyInput.value);
    this.elevenKeyInput.oninput = () => localStorage.setItem("elevenlabs_api_key", this.elevenKeyInput.value);
    this.voiceIdInput.oninput = () => localStorage.setItem("elevenlabs_voice_id", this.voiceIdInput.value);
  }

  getSettings(): AppSettings {
    return {
      groqKey: this.groqKeyInput.value.trim(),
      elevenKey: this.elevenKeyInput.value.trim(),
      voiceId: this.voiceIdInput.value.trim(),
    };
  }

  setStatus(message: string): void {
    this.statusText.textContent = message;
  }

  setRecordingUI(): void {
    this.talkButton.textContent = "Stop Recording";
    this.recBadge.style.display = "inline";
    this.setStatus("Recording...");
  }

  setProcessingUI(): void {
    this.talkButton.disabled = true;
    this.talkButton.textContent = "Processing...";
    this.recBadge.style.display = "none";
    this.setStatus("Transcribing...");
  }

  resetTalkButton(): void {
    this.talkButton.disabled = false;
    this.talkButton.textContent = "Press to talk";
  }

  appendLog(label: string, text: string, latencyMs?: number): void {
    const item = document.createElement("div");
    const name = document.createElement("span");
    name.className = "label";
    name.textContent = `${label}: `;

    item.append(name, document.createTextNode(text));

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
