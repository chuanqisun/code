const DEFAULT_SCRUB_WINDOW_MS = 90;
const DEFAULT_FADE_WINDOW_MS = 12;
const DEFAULT_TRIM_MARGIN_MS = 120;
const DEFAULT_PREVIEW_GAIN = 0.8;
const WORKLET_MODULE_URL = new URL("./audio-recorder-worklet.js", import.meta.url);

export class AudioHistoryController {
  constructor({
    frameRate,
    getFrameLimit,
    scrubWindowMs = DEFAULT_SCRUB_WINDOW_MS,
    fadeWindowMs = DEFAULT_FADE_WINDOW_MS,
    trimMarginMs = DEFAULT_TRIM_MARGIN_MS,
    previewGain = DEFAULT_PREVIEW_GAIN,
  }) {
    this.frameRate = frameRate;
    this.getFrameLimit = getFrameLimit;
    this.scrubWindowMs = scrubWindowMs;
    this.fadeWindowMs = fadeWindowMs;
    this.trimMarginMs = trimMarginMs;
    this.previewGain = previewGain;
    this.audioContext = null;
    this.captureSourceNode = null;
    this.captureNode = null;
    this.workletLoaded = false;
    this.buffers = [];
    this.totalSamplesCaptured = 0;
    this.lastScrubSampleIndex = null;
    this.activePreviewNodes = new Set();
  }

  async attachStream(stream) {
    await this.ensureAudioContext();
    this.disconnectCaptureNodes();
    this.reset();

    const audioTracks = stream?.getAudioTracks?.() ?? [];

    if (audioTracks.length === 0) {
      return false;
    }

    const audioStream = new MediaStream(audioTracks);
    this.captureSourceNode = this.audioContext.createMediaStreamSource(audioStream);

    if (this.audioContext.audioWorklet) {
      await this.ensureWorklet();
      this.captureNode = new AudioWorkletNode(this.audioContext, "audio-history-recorder", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      this.captureNode.port.onmessage = ({ data }) => {
        this.captureSamples(data);
      };
      this.captureSourceNode.connect(this.captureNode);
      return true;
    }

    const legacyCaptureNode = this.audioContext.createScriptProcessor(1024, 1, 1);
    legacyCaptureNode.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      this.captureSamples(channelData);
    };
    this.captureSourceNode.connect(legacyCaptureNode);
    legacyCaptureNode.connect(this.audioContext.destination);
    this.captureNode = legacyCaptureNode;
    return true;
  }

  async ensureAudioContext() {
    if (!this.audioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextConstructor({ latencyHint: "interactive" });
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async ensureWorklet() {
    if (this.workletLoaded) {
      return;
    }

    await this.audioContext.audioWorklet.addModule(WORKLET_MODULE_URL);
    this.workletLoaded = true;
  }

  disconnectCaptureNodes() {
    if (this.captureNode) {
      if ("port" in this.captureNode && this.captureNode.port) {
        this.captureNode.port.onmessage = null;
      }

      if ("onaudioprocess" in this.captureNode) {
        this.captureNode.onaudioprocess = null;
      }

      this.captureNode.disconnect();
      this.captureNode = null;
    }

    if (this.captureSourceNode) {
      this.captureSourceNode.disconnect();
      this.captureSourceNode = null;
    }
  }

  reset() {
    this.stopPreview();
    this.buffers = [];
    this.totalSamplesCaptured = 0;
    this.lastScrubSampleIndex = null;
  }

  stopPreview() {
    this.stopActivePreviewNodes();
    this.lastScrubSampleIndex = null;
  }

  stopActivePreviewNodes() {
    for (const previewNode of this.activePreviewNodes) {
      try {
        previewNode.stop();
      } catch (error) {
        if (error?.name !== "InvalidStateError") {
          throw error;
        }
      }
    }

    this.activePreviewNodes.clear();
  }

  captureSamples(sampleChunk) {
    if (!sampleChunk?.length) {
      return;
    }

    const samples = sampleChunk instanceof Float32Array ? sampleChunk.slice() : Float32Array.from(sampleChunk);
    const startSampleIndex = this.totalSamplesCaptured;
    this.buffers.push({ startSampleIndex, samples });
    this.totalSamplesCaptured += samples.length;
  }

  captureFrameReference() {
    return {
      audioSampleIndex: this.totalSamplesCaptured,
    };
  }

  trimToFrames(frames) {
    if (this.buffers.length === 0) {
      return;
    }

    const earliestFrameSampleIndex = frames.reduce((earliestSampleIndex, frameSet) => {
      if (typeof frameSet?.audioSampleIndex !== "number") {
        return earliestSampleIndex;
      }

      return Math.min(earliestSampleIndex, frameSet.audioSampleIndex);
    }, Number.POSITIVE_INFINITY);

    const trimFloor = Number.isFinite(earliestFrameSampleIndex)
      ? Math.max(0, earliestFrameSampleIndex - this.getTrimMarginSamples())
      : Math.max(0, this.totalSamplesCaptured - this.getMaxHistorySamples());

    while (this.buffers.length > 0) {
      const firstBuffer = this.buffers[0];
      const firstBufferEnd = firstBuffer.startSampleIndex + firstBuffer.samples.length;

      if (firstBufferEnd >= trimFloor) {
        break;
      }

      this.buffers.shift();
    }
  }

  syncToFrame(frameSet, { shouldScrub = false } = {}) {
    if (!shouldScrub || typeof frameSet?.audioSampleIndex !== "number") {
      this.stopPreview();
      return;
    }

    if (frameSet.audioSampleIndex === this.lastScrubSampleIndex) {
      return;
    }

    const sampleRate = this.audioContext?.sampleRate;

    if (!sampleRate) {
      return;
    }

    const previewSamples = this.readPreviewSegment(frameSet.audioSampleIndex, this.getScrubWindowSamples());

    if (!previewSamples) {
      return;
    }

    this.stopActivePreviewNodes();
    this.playPreviewBuffer(previewSamples);
    this.lastScrubSampleIndex = frameSet.audioSampleIndex;
  }

  getMaxHistorySamples() {
    const frameLimit = this.getFrameLimit();
    const sampleRate = this.audioContext?.sampleRate ?? 0;

    if (!(frameLimit > 0) || !(sampleRate > 0) || !(this.frameRate > 0)) {
      return 0;
    }

    const historyDurationSeconds = frameLimit / this.frameRate;
    return Math.ceil(historyDurationSeconds * sampleRate + this.getTrimMarginSamples());
  }

  getTrimMarginSamples() {
    const sampleRate = this.audioContext?.sampleRate ?? 0;
    return Math.ceil((sampleRate * this.trimMarginMs) / 1000);
  }

  getScrubWindowSamples() {
    const sampleRate = this.audioContext?.sampleRate ?? 0;
    return Math.max(1, Math.ceil((sampleRate * this.scrubWindowMs) / 1000));
  }

  readPreviewSegment(centerSampleIndex, sampleCount) {
    if (!(sampleCount > 0)) {
      return null;
    }

    const halfWindow = Math.floor(sampleCount / 2);
    const segmentStart = Math.max(0, centerSampleIndex - halfWindow);
    const previewSegment = new Float32Array(sampleCount);
    let copiedSampleCount = 0;

    for (const bufferChunk of this.buffers) {
      const chunkStart = bufferChunk.startSampleIndex;
      const chunkEnd = chunkStart + bufferChunk.samples.length;
      const copyStart = Math.max(segmentStart, chunkStart);
      const copyEnd = Math.min(segmentStart + sampleCount, chunkEnd);

      if (copyEnd <= copyStart) {
        continue;
      }

      const sourceOffset = copyStart - chunkStart;
      const targetOffset = copyStart - segmentStart;
      const copyLength = copyEnd - copyStart;
      previewSegment.set(bufferChunk.samples.subarray(sourceOffset, sourceOffset + copyLength), targetOffset);
      copiedSampleCount += copyLength;
    }

    return copiedSampleCount > 0 ? previewSegment : null;
  }

  playPreviewBuffer(samples) {
    if (!this.audioContext) {
      return;
    }

    const sampleRate = this.audioContext.sampleRate;
    const audioBuffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
    audioBuffer.getChannelData(0).set(samples);

    const sourceNode = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const now = this.audioContext.currentTime;
    const durationSeconds = samples.length / sampleRate;
    const fadeSeconds = Math.min(durationSeconds / 2, this.fadeWindowMs / 1000);

    sourceNode.buffer = audioBuffer;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(this.previewGain, now + fadeSeconds);
    gainNode.gain.setValueAtTime(this.previewGain, Math.max(now + fadeSeconds, now + durationSeconds - fadeSeconds));
    gainNode.gain.linearRampToValueAtTime(0, now + durationSeconds);

    sourceNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    sourceNode.onended = () => {
      this.activePreviewNodes.delete(sourceNode);
      gainNode.disconnect();
      sourceNode.disconnect();
    };

    this.activePreviewNodes.add(sourceNode);
    sourceNode.start(now);
    sourceNode.stop(now + durationSeconds);
  }
}
