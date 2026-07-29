export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioSources = new Set<AudioBufferSourceNode>();
  private nextAudioStart = 0;

  async getContext(): Promise<AudioContext> {
    this.audioContext ??= new AudioContext({ sampleRate: 24000 });
    await this.audioContext.resume();
    return this.audioContext;
  }

  async setSinkId(deviceId: string): Promise<void> {
    if (!this.audioContext || typeof this.audioContext.setSinkId !== "function") return;
    await this.audioContext.setSinkId(deviceId);
  }

  prepareNextStart(): void {
    if (this.audioContext) {
      this.nextAudioStart = this.audioContext.currentTime + 0.03;
    }
  }

  playPCM(base64: string): void {
    if (!this.audioContext) return;

    const binary = atob(base64);
    const length = binary.length - (binary.length % 2);
    if (!length) return;

    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const view = new DataView(bytes.buffer);
    const samples = new Float32Array(length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = view.getInt16(i * 2, true) / 32768;
    }

    const buffer = this.audioContext.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    this.audioSources.add(source);

    source.onended = () => {
      this.audioSources.delete(source);
      try {
        source.disconnect();
      } catch {}
    };

    this.nextAudioStart = Math.max(this.nextAudioStart, this.audioContext.currentTime + 0.03);
    source.start(this.nextAudioStart);
    this.nextAudioStart += buffer.duration;
  }

  stop(): void {
    for (const source of this.audioSources) {
      try {
        source.stop();
      } catch {}
      try {
        source.disconnect();
      } catch {}
    }
    this.audioSources.clear();
    if (this.audioContext) {
      this.nextAudioStart = this.audioContext.currentTime;
    }
  }
}
