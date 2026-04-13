export class WebcamController {
  constructor(videoElement, { width = 320, height, frameRate = 30, audio = false } = {}) {
    this.video = videoElement;
    this.width = width;
    this.height = height;
    this.frameRate = frameRate;
    this.audio = audio;
    this.running = false;
    this.startPromise = null;
    this.currentStream = null;
    this.currentDeviceIndex = -1;
    this.videoInputDevices = [];
  }

  getCurrentStream() {
    return this.currentStream;
  }

  async start() {
    if (this.startPromise) {
      return this.startPromise;
    }

    if (this.running) {
      return undefined;
    }

    this.startPromise = this.startInternal();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }

    return undefined;
  }

  async refreshVideoInputDevices() {
    this.videoInputDevices = await this.getVideoInputDevices();

    if (this.videoInputDevices.length === 0) {
      this.currentDeviceIndex = -1;
      return this.videoInputDevices;
    }

    const activeDeviceId = this.currentStream?.getVideoTracks()?.[0]?.getSettings?.().deviceId;

    if (!activeDeviceId) {
      this.currentDeviceIndex = 0;
      return this.videoInputDevices;
    }

    const matchedIndex = this.videoInputDevices.findIndex((device) => device.deviceId === activeDeviceId);
    this.currentDeviceIndex = matchedIndex >= 0 ? matchedIndex : 0;
    return this.videoInputDevices;
  }

  createProcessingFrameSource(videoElement, canvas) {
    const sourceCanvas = this.syncCanvasToVideoDimensions(canvas, videoElement);
    const context = sourceCanvas.getContext("2d");
    if (!context) throw new Error("Unable to create processing frame source due to missing canvas context");
    context.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    context.drawImage(videoElement, 0, 0, sourceCanvas.width, sourceCanvas.height);
    return sourceCanvas;
  }

  getVideoConstraints(deviceId) {
    const videoConstraints = {
      frameRate: { ideal: this.frameRate, max: this.frameRate },
    };

    if (typeof deviceId === "string" && deviceId.length > 0) {
      videoConstraints.deviceId = { exact: deviceId };
    }

    if (typeof this.width === "number" && Number.isFinite(this.width) && this.width > 0) {
      videoConstraints.width = { ideal: this.width };
    }

    if (typeof this.height === "number" && Number.isFinite(this.height) && this.height > 0) {
      videoConstraints.height = { ideal: this.height };
    }

    return videoConstraints;
  }

  getVideoDimensions(videoElement = this.video) {
    const width = videoElement?.videoWidth;
    const height = videoElement?.videoHeight;

    if (!(width > 0) || !(height > 0)) {
      return null;
    }

    return { width, height };
  }

  getScaledVideoDimensions(targetWidth = this.width, videoElement = this.video) {
    const sourceDimensions = this.getVideoDimensions(videoElement);

    if (!sourceDimensions) {
      return null;
    }

    const width = Math.max(1, Math.round(targetWidth));
    const height = Math.max(1, Math.round((width * sourceDimensions.height) / sourceDimensions.width));
    return { width, height };
  }

  syncCanvasToVideoDimensions(canvas, videoElement = this.video) {
    const sourceDimensions = this.getVideoDimensions(videoElement);

    if (!sourceDimensions) {
      throw new Error("Unable to sync canvas dimensions due to missing video dimensions");
    }

    if (canvas.width !== sourceDimensions.width || canvas.height !== sourceDimensions.height) {
      canvas.width = sourceDimensions.width;
      canvas.height = sourceDimensions.height;
    }

    return canvas;
  }

  syncCanvasToScaledDimensions(canvas, targetWidth = this.width, videoElement = this.video) {
    const nextDimensions = this.getScaledVideoDimensions(targetWidth, videoElement);

    if (!nextDimensions) {
      return null;
    }

    if (canvas.width !== nextDimensions.width || canvas.height !== nextDimensions.height) {
      canvas.width = nextDimensions.width;
      canvas.height = nextDimensions.height;
    }

    return canvas;
  }

  syncCanvasesToScaledDimensions(canvases, targetWidth = this.width, videoElement = this.video) {
    const nextDimensions = this.getScaledVideoDimensions(targetWidth, videoElement);

    if (!nextDimensions) {
      return null;
    }

    for (const canvas of canvases) {
      if (canvas.width !== nextDimensions.width || canvas.height !== nextDimensions.height) {
        canvas.width = nextDimensions.width;
        canvas.height = nextDimensions.height;
      }
    }

    return nextDimensions;
  }

  async startInternal() {
    const stream = await this.requestUserMedia({
      video: this.getVideoConstraints(),
      audio: this.audio,
    });

    this.video.srcObject = stream;
    this.currentStream = stream;
    await this.video.play();
    this.running = true;
  }

  async cycle() {
    if (this.startPromise) {
      await this.startPromise;
    }

    await this.refreshVideoInputDevices();

    if (this.videoInputDevices.length === 0) {
      await this.stop();
      return null;
    }

    const nextDeviceIndex = this.videoInputDevices.length > 1 ? (this.currentDeviceIndex + 1) % this.videoInputDevices.length : this.currentDeviceIndex;

    const nextDevice = this.videoInputDevices[nextDeviceIndex];
    await this.startForDevice(nextDevice.deviceId);
    await this.refreshVideoInputDevices();
    return this.video;
  }

  async startForDevice(deviceId) {
    await this.stop();

    this.startPromise = this.startDeviceInternal(deviceId);

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async startDeviceInternal(deviceId) {
    const stream = await this.requestUserMedia({
      video: this.getVideoConstraints(deviceId),
      audio: this.audio,
    });

    this.video.srcObject = stream;
    this.currentStream = stream;
    await this.video.play();
    this.running = true;
  }

  async stop() {
    const stream = this.currentStream;

    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    this.video.pause();
    this.video.srcObject = null;
    this.currentStream = null;
    this.running = false;
    this.currentDeviceIndex = -1;
  }

  async getVideoInputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  }

  async requestUserMedia(constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      if (!constraints.audio) {
        throw error;
      }

      console.warn("Falling back to video-only capture because audio capture was unavailable.", error);
      return navigator.mediaDevices.getUserMedia({
        video: constraints.video,
        audio: false,
      });
    }
  }
}
