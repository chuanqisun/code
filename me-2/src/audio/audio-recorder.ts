export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private micStream: MediaStream | null = null;
  private chunks: Blob[] = [];

  async start(deviceId: string, onStop: () => void): Promise<MediaStream> {
    const audioConstraints = deviceId ? { deviceId: { exact: deviceId } } : true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    this.micStream = stream;

    const preferred = "audio/webm;codecs=opus";
    const mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";

    this.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.chunks = [];

    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.onstop = onStop;
    this.recorder.start();

    return stream;
  }

  stop(): void {
    if (this.recorder?.state === "recording") {
      this.recorder.stop();
    }
  }

  getAudioBlob(): Blob {
    const type = this.recorder?.mimeType || "audio/webm";
    return new Blob(this.chunks, { type });
  }

  stopMicrophone(): void {
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.recorder = null;
    this.chunks = [];
  }

  cleanup(): void {
    if (this.recorder?.state === "recording") {
      this.recorder.onstop = null;
      try {
        this.recorder.stop();
      } catch {}
    }
    this.stopMicrophone();
  }

  isRecording(): boolean {
    return this.recorder?.state === "recording";
  }
}
