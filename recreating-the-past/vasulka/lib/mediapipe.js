const DEFAULT_MEDIAPIPE_TASKS_VISION_VERSION = "0.10.34";
const DEFAULT_IMAGE_SEGMENTER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const DEFAULT_HAND_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class MediaPipeVisionManager {
  constructor({
    tasksVisionVersion = DEFAULT_MEDIAPIPE_TASKS_VISION_VERSION,
    imageSegmenterModelUrl = DEFAULT_IMAGE_SEGMENTER_MODEL_URL,
    handLandmarkerModelUrl = DEFAULT_HAND_LANDMARKER_MODEL_URL,
    fingertipIndices = [4, 8, 12, 16, 20],
    palmLandmarkIndices = { wrist: 0, indexMcp: 5, pinkyMcp: 17 },
    opennessMeasurementPairs = [
      [5, 8],
      [9, 12],
      [13, 16],
      [17, 20],
      [4, 11],
    ],
    handInitialPresenceFrameCount = 10,
    depthSmoothingFactor = 0.5,
    palmOrientationSmoothingFactor = 0.5,
    opennessSmoothingFactor = 0.35,
    openThreshold = 50,
    closeThreshold = 30,
    bodyAlphaScale = 255,
  } = {}) {
    this.tasksVisionVersion = tasksVisionVersion;
    this.tasksVisionUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${tasksVisionVersion}`;
    this.tasksWasmUrl = `${this.tasksVisionUrl}/wasm`;
    this.imageSegmenterModelUrl = imageSegmenterModelUrl;
    this.handLandmarkerModelUrl = handLandmarkerModelUrl;
    this.fingertipIndices = fingertipIndices;
    this.palmLandmarkIndices = palmLandmarkIndices;
    this.opennessMeasurementPairs = opennessMeasurementPairs;
    this.handInitialPresenceFrameCount = handInitialPresenceFrameCount;
    this.depthSmoothingFactor = depthSmoothingFactor;
    this.palmOrientationSmoothingFactor = palmOrientationSmoothingFactor;
    this.opennessSmoothingFactor = opennessSmoothingFactor;
    this.openThreshold = openThreshold;
    this.closeThreshold = closeThreshold;
    this.bodyAlphaScale = bodyAlphaScale;
    this.smoothedHandDepths = [];
    this.smoothedHandPalmOrientations = [];
    this.smoothedHandOpenness = [];
    this.handOpenStates = [];
    this.handPresenceFrameCounts = [];
    this.initializationPromise = null;
    this.tasks = null;
    this.lastProcessedTimestamp = -1;
  }

  async initialize() {
    if (this.tasks !== null) {
      return this.tasks;
    }

    if (this.initializationPromise === null) {
      this.initializationPromise = this.initializeInternal();
    }

    try {
      this.tasks = await this.initializationPromise;
      return this.tasks;
    } finally {
      this.initializationPromise = null;
    }
  }

  async initializeInternal() {
    const vision = await import(this.tasksVisionUrl);
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(this.tasksWasmUrl);

    const imageSegmenter = await vision.ImageSegmenter.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: this.imageSegmenterModelUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });

    const handLandmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: this.handLandmarkerModelUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    return { handLandmarker, imageSegmenter };
  }

  async waitForVideoFrame(videoFrame, maxFramesToWait = 120) {
    for (let attempt = 0; attempt < maxFramesToWait; attempt += 1) {
      if (this.isVideoFrameReady(videoFrame)) {
        return;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    throw new Error("Video frame did not become ready in time.");
  }

  isVideoFrameReady(videoFrame) {
    return Boolean(videoFrame && videoFrame.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && videoFrame.videoWidth > 0 && videoFrame.videoHeight > 0);
  }

  async processFrame({ videoFrame, sourceCanvas, timestamp, bodySegmentThreshold }) {
    const normalizedTimestamp = this.getMonotonicTimestamp(timestamp);
    const backgroundConfidenceMask = await this.getBodySegmentationConfidenceMask(videoFrame, normalizedTimestamp);
    const handTracking = this.getHandTrackingForVideoFrame(videoFrame, normalizedTimestamp);
    const handLandmarks = handTracking.landmarks;
    const handMetrics = this.calculateHandMetrics(handLandmarks, handTracking.handednesses);
    const hasOpenHand = this.hasOpenHand(handMetrics);
    const bodyFrame = this.createBodyForegroundFrame(sourceCanvas, backgroundConfidenceMask, bodySegmentThreshold);

    return {
      backgroundConfidenceMask,
      handLandmarks,
      handMetrics,
      hasOpenHand,
      bodyFrame,
    };
  }

  getMonotonicTimestamp(timestamp) {
    const numericTimestamp = typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : performance.now();
    const nextTimestamp = Math.max(numericTimestamp, this.lastProcessedTimestamp + 1);
    this.lastProcessedTimestamp = nextTimestamp;
    return nextTimestamp;
  }

  async getBodySegmentationConfidenceMask(videoFrame, timestamp) {
    const { imageSegmenter } = await this.initialize();

    if (!imageSegmenter) {
      return null;
    }

    const result = await new Promise((resolve) => imageSegmenter.segmentForVideo(videoFrame, timestamp, resolve));
    return result?.confidenceMasks?.[0] ?? null;
  }

  getHandTrackingForVideoFrame(videoFrame, timestamp) {
    const handLandmarker = this.tasks?.handLandmarker;

    if (!handLandmarker) {
      return { landmarks: [], handednesses: [] };
    }

    const result = handLandmarker.detectForVideo(videoFrame, timestamp);
    return {
      landmarks: result.landmarks ?? [],
      handednesses: (result.handednesses ?? []).map((entries) => entries?.[0]?.categoryName ?? "Unknown"),
    };
  }

  calculateHandMetrics(handLandmarks, handednesses) {
    const metrics = [];

    for (const [handIndex, hand] of (handLandmarks ?? []).entries()) {
      if (Array.isArray(hand) && hand.length > 0) {
        this.handPresenceFrameCounts[handIndex] = (this.handPresenceFrameCounts[handIndex] ?? 0) + 1;
      } else {
        this.handPresenceFrameCounts[handIndex] = 0;
        this.smoothedHandPalmOrientations[handIndex] = undefined;
        this.smoothedHandOpenness[handIndex] = undefined;
        this.handOpenStates[handIndex] = false;
      }

      const handedness = handednesses?.[handIndex] ?? "Unknown";
      let zTotal = 0;
      let zCount = 0;

      for (const landmarkIndex of this.fingertipIndices) {
        const landmark = hand?.[landmarkIndex];

        if (!landmark) {
          continue;
        }

        if (typeof landmark.z === "number" && !Number.isNaN(landmark.z)) {
          zTotal += landmark.z;
          zCount += 1;
        }
      }

      const rawPalmOrientation = this.calculatePalmOrientation(hand, handedness);
      const previousPalmOrientation = this.smoothedHandPalmOrientations[handIndex];
      const smoothedPalmOrientation = this.smoothWithExponentialDecay(previousPalmOrientation, rawPalmOrientation, this.palmOrientationSmoothingFactor);
      this.smoothedHandPalmOrientations[handIndex] = smoothedPalmOrientation;

      if (zCount === 0) {
        this.handOpenStates[handIndex] = false;
        metrics.push({
          handedness,
          averageZ: undefined,
          palmOrientation: smoothedPalmOrientation,
          openness: undefined,
          isOpen: false,
        });
        continue;
      }

      const averageZ = zTotal / zCount;
      const previousZ = this.smoothedHandDepths[handIndex];
      const smoothedZ = this.smoothWithExponentialDecay(previousZ, averageZ, this.depthSmoothingFactor);
      let smoothedOpenness;

      if (this.handPresenceFrameCounts[handIndex] >= this.handInitialPresenceFrameCount) {
        const rawOpenness = this.calculateAverageFingerExtension(hand);
        const openness = this.normalizeHandOpenness(rawOpenness, smoothedZ);
        const previousOpenness = this.smoothedHandOpenness[handIndex];
        smoothedOpenness = this.smoothWithExponentialDecay(previousOpenness, openness, this.opennessSmoothingFactor);
      }

      this.smoothedHandDepths[handIndex] = smoothedZ;
      this.smoothedHandOpenness[handIndex] = smoothedOpenness;
      const isOpen = this.getNextHandOpenState(this.handOpenStates[handIndex], smoothedOpenness);
      this.handOpenStates[handIndex] = isOpen;
      metrics.push({
        handedness,
        averageZ: smoothedZ,
        palmOrientation: smoothedPalmOrientation,
        openness: smoothedOpenness,
        isOpen,
      });
    }

    this.smoothedHandDepths.length = metrics.length;
    this.smoothedHandPalmOrientations.length = metrics.length;
    this.smoothedHandOpenness.length = metrics.length;
    this.handOpenStates.length = metrics.length;
    this.handPresenceFrameCounts.length = metrics.length;

    return metrics;
  }

  calculatePalmOrientation(hand, handedness) {
    const wrist = hand?.[this.palmLandmarkIndices.wrist];
    const indexMcp = hand?.[this.palmLandmarkIndices.indexMcp];
    const pinkyMcp = hand?.[this.palmLandmarkIndices.pinkyMcp];

    if (!wrist || !indexMcp || !pinkyMcp) {
      return undefined;
    }

    const wristToIndex = this.subtractLandmarks(indexMcp, wrist);
    const wristToPinky = this.subtractLandmarks(pinkyMcp, wrist);
    const palmNormal = this.crossProduct(wristToIndex, wristToPinky);
    const normalLength = this.vectorLength(palmNormal);

    if (normalLength === 0) {
      return undefined;
    }

    const handednessSign = handedness === "Left" ? -1 : 1;
    const normalizedZ = this.clamp((palmNormal.z / normalLength) * handednessSign, -1, 1);
    return Math.asin(normalizedZ) * (180 / Math.PI);
  }

  calculateAverageFingerExtension(hand) {
    if (!Array.isArray(hand) || hand.length === 0) {
      return undefined;
    }

    let distanceTotal = 0;
    let distanceCount = 0;

    for (const [startIndex, endIndex] of this.opennessMeasurementPairs) {
      const start = hand[startIndex];
      const end = hand[endIndex];

      if (!start || !end) {
        continue;
      }

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dz = end.z - start.z;
      distanceTotal += Math.hypot(dx, dy, dz);
      distanceCount += 1;
    }

    if (distanceCount === 0) {
      return undefined;
    }

    return distanceTotal / distanceCount;
  }

  normalizeHandOpenness(rawOpenness, z) {
    if (typeof rawOpenness !== "number" || Number.isNaN(rawOpenness)) {
      return undefined;
    }

    if (typeof z !== "number" || Number.isNaN(z)) {
      return undefined;
    }

    const denominator = Math.sqrt(Math.max(Math.abs(z) * 100, Number.EPSILON));
    return (rawOpenness * 1000) / denominator;
  }

  smoothWithExponentialDecay(previousValue, nextValue, smoothingFactor) {
    if (typeof nextValue !== "number" || Number.isNaN(nextValue)) {
      return undefined;
    }

    if (typeof previousValue !== "number" || Number.isNaN(previousValue)) {
      return nextValue;
    }

    return previousValue + (nextValue - previousValue) * smoothingFactor;
  }

  getNextHandOpenState(previousState, openness) {
    if (typeof openness !== "number" || Number.isNaN(openness)) {
      return Boolean(previousState);
    }

    if (previousState) {
      return openness >= this.closeThreshold;
    }

    return openness > this.openThreshold;
  }

  hasOpenHand(handMetrics) {
    return handMetrics.some((metric) => metric?.isOpen === true);
  }

  createBodyForegroundFrame(sourceCanvas, backgroundConfidenceMask, bodySegmentThreshold) {
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;

    const outputContext = outputCanvas.getContext("2d");
    const sourceContext = sourceCanvas.getContext("2d");
    const sourceImageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const outputImageData = new ImageData(sourceCanvas.width, sourceCanvas.height);
    const sourcePixels = sourceImageData.data;
    const outputPixels = outputImageData.data;

    if (!backgroundConfidenceMask) {
      outputContext.putImageData(outputImageData, 0, 0);
      return outputCanvas;
    }

    const mask = backgroundConfidenceMask.getAsFloat32Array();

    for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
      const sourceIndex = pixelIndex * 4;
      const backgroundAlpha = Math.max(0, Math.min(1, mask[pixelIndex]));
      const bodyAlpha = 1 - backgroundAlpha;
      const bodyAlphaValue = Math.round(bodyAlpha * this.bodyAlphaScale);

      outputPixels[sourceIndex] = sourcePixels[sourceIndex];
      outputPixels[sourceIndex + 1] = sourcePixels[sourceIndex + 1];
      outputPixels[sourceIndex + 2] = sourcePixels[sourceIndex + 2];
      outputPixels[sourceIndex + 3] = bodyAlphaValue >= bodySegmentThreshold ? bodyAlphaValue : 0;
    }

    outputContext.putImageData(outputImageData, 0, 0);
    return outputCanvas;
  }

  renderHandMarkers({ context, handLandmarks, width, height }) {
    for (const [handIndex, hand] of (handLandmarks ?? []).entries()) {
      context.fillStyle = this.handOpenStates[handIndex] ? "#00ffff" : "#ff0000";

      for (const landmarkIndex of this.fingertipIndices) {
        const landmark = hand?.[landmarkIndex];

        if (!landmark) {
          continue;
        }

        this.drawMarkerDot(context, landmark.x * width, landmark.y * height);
      }
    }
  }

  drawMarkerDot(context, x, y) {
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
  }

  formatHandStats(handLandmarks, handMetrics) {
    const fingertipStats = [];

    for (const [handIndex, hand] of (handLandmarks ?? []).entries()) {
      fingertipStats.push(`hand=${handIndex} label=${handMetrics?.[handIndex]?.handedness ?? "Unknown"}`);

      for (const landmarkIndex of this.fingertipIndices) {
        const landmark = hand?.[landmarkIndex];

        if (!landmark) {
          continue;
        }

        fingertipStats.push(
          [
            `hand=${handIndex}`,
            `finger=${landmarkIndex}`,
            `x=${this.formatCoordinate(landmark.x)}`,
            `y=${this.formatCoordinate(landmark.y)}`,
            `z=${this.formatCoordinate(landmark.z)}`,
          ].join(" ")
        );
      }

      const smoothedZ = handMetrics?.[handIndex]?.averageZ;
      const smoothedPalmOrientation = handMetrics?.[handIndex]?.palmOrientation;
      const smoothedOpenness = handMetrics?.[handIndex]?.openness;

      if (typeof smoothedZ === "number") {
        fingertipStats.push(`hand=${handIndex} z=${this.formatCoordinate(smoothedZ)}`);
      }

      if (typeof smoothedPalmOrientation === "number") {
        fingertipStats.push(`hand=${handIndex} orientationDeg=${this.formatCoordinate(smoothedPalmOrientation)}`);
      }

      if (typeof smoothedOpenness === "number") {
        fingertipStats.push(`hand=${handIndex} openness=${this.formatCoordinate(smoothedOpenness)}`);
      }
    }

    return fingertipStats.join("\n") || "No fingertips detected";
  }

  formatCoordinate(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "n/a";
    }

    return value.toFixed(4);
  }

  subtractLandmarks(pointA, pointB) {
    return {
      x: pointA.x - pointB.x,
      y: pointA.y - pointB.y,
      z: pointA.z - pointB.z,
    };
  }

  crossProduct(vectorA, vectorB) {
    return {
      x: vectorA.y * vectorB.z - vectorA.z * vectorB.y,
      y: vectorA.z * vectorB.x - vectorA.x * vectorB.z,
      z: vectorA.x * vectorB.y - vectorA.y * vectorB.x,
    };
  }

  vectorLength(vector) {
    return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}
