import { AudioDevices } from "./audio/audio-devices";
import { AudioPlayer } from "./audio/audio-player";
import { AudioRecorder } from "./audio/audio-recorder";
import { ContextManager } from "./chat/context-manager";
import { ElevenLabsTTS } from "./chat/elevent-labs-tts";
import { GroqService } from "./chat/groq-service";
import { ThreadManager } from "./chat/thread-manager";
import "./style.css";
import { KeyboardManager } from "./ui/keyboard-manager";
import { UIManager } from "./ui/ui-manager";

export class VoiceAssistantApp {
  private ui = new UIManager();
  private audioDevices = new AudioDevices();
  private audioRecorder = new AudioRecorder();
  private audioPlayer = new AudioPlayer();
  private groqService = new GroqService();
  private elevenLabsTTS = new ElevenLabsTTS();
  private contextManager = new ContextManager();
  private threadManager = new ThreadManager();
  private keyboardManager!: KeyboardManager;

  private turnId = 0;
  private recording = false;
  private releasedAt = 0;
  private ttsSentAt = 0;
  private firstAudioReceived = false;
  private currentBracketKeys = new Set<number>();

  private requestController: AbortController | null = null;
  private socketReady: Promise<WebSocket> | null = null;

  constructor() {
    this.initContextAndKeyboard();
    this.bindEvents();
    this.populateAudioDevices();
  }

  getKeyboardManager(): KeyboardManager {
    return this.keyboardManager;
  }

  private initContextAndKeyboard(): void {
    this.ui.renderContextSlots(this.contextManager.getSlots(), (index, text) => this.contextManager.setSlot(index, text));

    this.keyboardManager = new KeyboardManager({
      keyCaptureInput: this.ui.keyCaptureInput,
      keypadContainer: this.ui.keypadContainer,
      callbacks: {
        onInterrupt: () => {
          this.cancelAll("Cancelled");
        },
        onBracketStart: (bracketKeys) => {
          this.ui.updateActiveKeys(bracketKeys, bracketKeys);
          this.startTurn(undefined, bracketKeys);
        },
        onBracketUpdate: (bracketKeys, activeKeys) => {
          this.ui.updateActiveKeys(activeKeys, bracketKeys);
        },
        onBracketEnd: () => {
          this.ui.updateActiveKeys(new Set(), new Set());
          this.stopRecording();
        },
      },
    });
  }

  private bindEvents(): void {
    this.ui.talkButton.addEventListener("click", (e) => this.toggleRecording(e));
    this.ui.cancelButton.addEventListener("click", () => this.cancelAll("Cancelled"));
    if (this.ui.clearThreadButton) {
      this.ui.clearThreadButton.addEventListener("click", () => {
        this.threadManager.clear();
        this.ui.appendLog("THREAD", "Conversation history cleared");
      });
    }
    this.ui.audioOutputSelect.addEventListener("change", () => this.selectAudioOutput());

    navigator.mediaDevices?.addEventListener("devicechange", () => this.populateAudioDevices());
  }

  private async populateAudioDevices(): Promise<void> {
    await this.audioDevices.populate(this.ui.audioInputSelect, this.ui.audioOutputSelect);
  }

  private async selectAudioOutput(): Promise<void> {
    try {
      const ctx = await this.audioPlayer.getContext();
      await this.audioDevices.setOutputSink(ctx, this.ui.audioOutputSelect.value);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ui.appendLog("ERROR", "Output device: " + msg);
    }
  }

  private toggleRecording(event: Event): void {
    if (this.recording) {
      this.stopRecording(event);
    } else {
      this.startTurn(event);
    }
  }

  private async startTurn(event?: Event, bracketKeys?: Set<number>): Promise<void> {
    event?.preventDefault();
    if (this.recording) return;

    const { groqKey, elevenKey, voiceId } = this.ui.getSettings();
    if (!groqKey || !elevenKey || !voiceId) {
      this.ui.setStatus("Enter Groq key, ElevenLabs key, and voice ID");
      return;
    }

    this.cancelAll(null);
    const currentTurn = ++this.turnId;
    this.requestController = new AbortController();
    this.currentBracketKeys = bracketKeys ? new Set(bracketKeys) : new Set();

    try {
      this.socketReady = this.connectTTS(currentTurn, elevenKey, voiceId);
      this.socketReady.catch((error) => {
        if (currentTurn === this.turnId) {
          const msg = error instanceof Error ? error.message : String(error);
          this.ui.setStatus("TTS connection error: " + msg);
        }
      });

      const selectedInput = this.ui.audioInputSelect.value;
      await this.audioRecorder.start(selectedInput, () => this.finishTurn(currentTurn));

      if (currentTurn !== this.turnId) {
        this.audioRecorder.stopMicrophone();
        return;
      }

      this.populateAudioDevices();

      this.recording = true;
      this.ui.setRecordingUI();
    } catch (error) {
      if (currentTurn === this.turnId) {
        const msg = error instanceof Error ? error.message : String(error);
        this.ui.appendLog("ERROR", msg);
        this.cancelAll("Failed");
      }
    }
  }

  private stopRecording(event?: Event): void {
    event?.preventDefault();
    if (!this.recording) return;

    this.releasedAt = performance.now();
    this.recording = false;
    this.ui.setProcessingUI();

    this.audioRecorder.stop();
  }

  private async finishTurn(currentTurn: number): Promise<void> {
    const audio = this.audioRecorder.getAudioBlob();
    this.audioRecorder.stopMicrophone();

    const bracketKeys = new Set(this.currentBracketKeys);
    const { groqKey } = this.ui.getSettings();

    try {
      const text = await this.groqService.transcribe(groqKey, audio, this.requestController?.signal);
      if (currentTurn !== this.turnId) return;

      this.ui.appendLog("STT", text || "(empty transcription)", performance.now() - this.releasedAt);

      if (!text.trim()) throw new Error("No speech detected");

      this.ui.setStatus("Generating...");
      const llmSentAt = performance.now();

      const dynamicSystemPrompt = this.contextManager.buildSystemPrompt(bracketKeys);
      const messages = this.threadManager.buildMessages(dynamicSystemPrompt, text);

      const completion = await this.groqService.complete(groqKey, messages, this.requestController?.signal);
      if (currentTurn !== this.turnId) return;

      this.threadManager.addTurn(text, completion);

      this.ui.appendLog("LLM", completion || "(empty response)", performance.now() - llmSentAt, bracketKeys);

      if (!completion.trim()) throw new Error("Empty LLM response");

      this.ui.setStatus("Preparing speech...");
      await this.sendTTS(completion, currentTurn);

      if (currentTurn === this.turnId) this.ui.setStatus("Speaking...");
    } catch (error) {
      if (currentTurn !== this.turnId || (error instanceof Error && error.name === "AbortError")) return;
      const msg = error instanceof Error ? error.message : String(error);
      this.ui.appendLog("ERROR", msg);
      this.ui.setStatus("Failed");
      this.ui.resetTalkButton();
    }
  }

  private async connectTTS(currentTurn: number, elevenKey: string, voiceId: string): Promise<WebSocket> {
    await this.audioPlayer.getContext();
    await this.selectAudioOutput();

    return this.elevenLabsTTS.connect(
      elevenKey,
      voiceId,
      currentTurn,
      (turn, connId) => turn === this.turnId && connId === this.elevenLabsTTS.getConnectionId(),
      {
        onAudio: (base64Audio) => {
          if (!this.firstAudioReceived) {
            this.firstAudioReceived = true;
            this.ui.appendLog("TTS", "(audio)", performance.now() - this.ttsSentAt);
          }
          this.audioPlayer.playPCM(base64Audio);
          this.ui.setStatus("Speaking...");
        },
        onFinal: () => {
          this.ui.setStatus("Ready");
          this.ui.resetTalkButton();
        },
        onError: (error) => {
          this.ui.appendLog("ERROR", "TTS: " + error.message);
          this.ui.setStatus("TTS failed");
          this.ui.resetTalkButton();
        },
      },
    );
  }

  private async sendTTS(text: string, currentTurn: number): Promise<void> {
    if (!this.socketReady) {
      throw new Error("TTS connection is unavailable");
    }

    const currentSocket = await this.socketReady;

    if (currentTurn !== this.turnId || currentSocket !== this.elevenLabsTTS.getSocket() || currentSocket.readyState !== WebSocket.OPEN) {
      throw new Error("TTS connection is unavailable");
    }

    const ctx = await this.audioPlayer.getContext();
    await ctx.resume();
    this.audioPlayer.stop();
    this.audioPlayer.prepareNextStart();
    this.firstAudioReceived = false;
    this.ttsSentAt = performance.now();

    this.elevenLabsTTS.sendText(currentSocket, text);
  }

  private cancelAll(message: string | null): void {
    this.turnId++;
    this.requestController?.abort();
    this.requestController = null;

    this.audioRecorder.cleanup();
    this.audioPlayer.stop();
    this.elevenLabsTTS.close();
    this.recording = false;
    this.ui.resetTalkButton();

    if (message) this.ui.setStatus(message);
  }
}

new VoiceAssistantApp();
