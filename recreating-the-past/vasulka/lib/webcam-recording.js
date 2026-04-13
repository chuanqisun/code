const DEFAULT_RECORDING_MIME_TYPE = "video/webm";
const DEFAULT_FILENAME_PREFIX = "glitch-raw-webcam";

export function createWebcamRecordingController({ window, audioConstraints, filenamePrefix = DEFAULT_FILENAME_PREFIX } = {}) {
  return new WebcamRecordingController({ window, audioConstraints, filenamePrefix });
}

class WebcamRecordingController {
  constructor({ window, audioConstraints, filenamePrefix }) {
    this.window = window;
    this.audioConstraints = audioConstraints;
    this.filenamePrefix = filenamePrefix;
    this.isSupported = typeof window?.MediaRecorder === "function";
    this.mediaRecorder = null;
    this.microphoneStream = null;
    this.recordedChunks = [];
    this.mimeType = "";
    this.flushResolvers = [];

    this.handleRecordingData = this.handleRecordingData.bind(this);
    this.handleRecordingStop = this.handleRecordingStop.bind(this);
  }

  canDownload() {
    if (!this.isSupported) {
      return false;
    }

    return this.recordedChunks.length > 0 || this.mediaRecorder?.state === "recording";
  }

  async start(stream) {
    if (!this.isSupported) {
      return false;
    }

    await this.stop({ keepRecording: false });

    const recordingStream = await this.createRecordingStream(stream);

    if (!(recordingStream instanceof MediaStream) || recordingStream.getVideoTracks().length === 0) {
      return false;
    }

    const mimeType = this.getSupportedRecordingMimeType();
    const recorderOptions = mimeType ? { mimeType } : undefined;
    const mediaRecorder = recorderOptions ? new MediaRecorder(recordingStream, recorderOptions) : new MediaRecorder(recordingStream);

    this.recordedChunks = [];
    this.mimeType = mediaRecorder.mimeType || mimeType || DEFAULT_RECORDING_MIME_TYPE;
    this.mediaRecorder = mediaRecorder;

    mediaRecorder.addEventListener("dataavailable", this.handleRecordingData);
    mediaRecorder.addEventListener("stop", this.handleRecordingStop);
    mediaRecorder.start(1000);
    return true;
  }

  async stop({ keepRecording = true } = {}) {
    const { mediaRecorder } = this;

    if (!mediaRecorder) {
      this.stopTemporaryStreams();

      if (!keepRecording) {
        this.recordedChunks = [];
        this.mimeType = "";
      }

      return;
    }

    this.mediaRecorder = null;

    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      await this.waitForRecordingFlush();
    }

    mediaRecorder.removeEventListener("dataavailable", this.handleRecordingData);
    mediaRecorder.removeEventListener("stop", this.handleRecordingStop);
    this.stopTemporaryStreams();

    if (!keepRecording) {
      this.recordedChunks = [];
      this.mimeType = "";
    }
  }

  async download() {
    if (!this.canDownload()) {
      return false;
    }

    await this.flush();

    if (this.recordedChunks.length === 0) {
      return false;
    }

    const recordingBlob = new Blob(this.recordedChunks, {
      type: this.mimeType || DEFAULT_RECORDING_MIME_TYPE,
    });
    const recordingUrl = URL.createObjectURL(recordingBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = recordingUrl;
    downloadLink.download = this.createFilename(recordingBlob.type);
    downloadLink.click();

    this.window.setTimeout(() => {
      URL.revokeObjectURL(recordingUrl);
    }, 0);

    return true;
  }

  async flush() {
    const { mediaRecorder } = this;

    if (!mediaRecorder || mediaRecorder.state !== "recording") {
      return;
    }

    const flushPromise = this.waitForRecordingFlush();
    mediaRecorder.requestData();
    await flushPromise;
  }

  handleRecordingData(event) {
    if (event.data?.size > 0) {
      this.recordedChunks.push(event.data);
    }

    this.resolveRecordingFlush();
  }

  handleRecordingStop() {
    this.resolveRecordingFlush();
  }

  waitForRecordingFlush() {
    return new Promise((resolve) => {
      this.flushResolvers.push(resolve);
    });
  }

  resolveRecordingFlush() {
    while (this.flushResolvers.length > 0) {
      const resolve = this.flushResolvers.shift();
      resolve();
    }
  }

  async createRecordingStream(stream) {
    if (!(stream instanceof MediaStream)) {
      return null;
    }

    const videoTracks = stream.getVideoTracks().filter((track) => track.readyState === "live");

    if (videoTracks.length === 0) {
      return null;
    }

    const audioTracks = stream.getAudioTracks().filter((track) => track.readyState === "live");
    const recordingTracks = [...videoTracks];

    if (audioTracks.length > 0) {
      recordingTracks.push(...audioTracks);
      return new MediaStream(recordingTracks);
    }

    const microphoneStream = await this.requestMicrophoneStream();
    const microphoneTracks = microphoneStream?.getAudioTracks?.().filter((track) => track.readyState === "live") ?? [];

    if (microphoneTracks.length === 0) {
      return new MediaStream(recordingTracks);
    }

    this.microphoneStream = microphoneStream;
    recordingTracks.push(...microphoneTracks);
    return new MediaStream(recordingTracks);
  }

  async requestMicrophoneStream() {
    if (!this.window?.navigator?.mediaDevices?.getUserMedia) {
      return null;
    }

    try {
      return await this.window.navigator.mediaDevices.getUserMedia({
        video: false,
        audio: this.audioConstraints,
      });
    } catch (error) {
      console.warn("Unable to capture microphone audio for webcam recording.", error);
      return null;
    }
  }

  stopTemporaryStreams() {
    if (this.microphoneStream) {
      for (const track of this.microphoneStream.getTracks()) {
        track.stop();
      }
    }

    this.microphoneStream = null;
  }

  getSupportedRecordingMimeType() {
    if (!this.isSupported || typeof MediaRecorder.isTypeSupported !== "function") {
      return "";
    }

    const supportedMimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", DEFAULT_RECORDING_MIME_TYPE, "video/mp4"].find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType)
    );

    return supportedMimeType || "";
  }

  createFilename(mimeType) {
    const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = this.getFileExtension(mimeType);

    return `${this.filenamePrefix}-${isoTimestamp}.${extension}`;
  }

  getFileExtension(mimeType) {
    if (typeof mimeType !== "string") {
      return "webm";
    }

    if (mimeType.includes("mp4")) {
      return "mp4";
    }

    return "webm";
  }
}
