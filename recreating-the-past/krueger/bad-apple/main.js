import { animationFrames, concatMap, fromEvent, merge, tap, throttleTime } from "rxjs";
import { createApplePhysicsScene } from "./lib/apple-physics-scene.js";
import { applyHeartBurstInversion, prewarmHeartBurstInversionCache } from "./lib/apply-heart-burst-inversion.js";
import { createCameraManager } from "./lib/camera.js";
import { CanvasSurface } from "./lib/canvas.js";
import { createCenteredParityMask } from "./lib/create-centered-parity-mask.js";
import { createInvertedThresholdMask } from "./lib/create-inverted-threshold-mask.js";
import { createLeftHalfInvertedParityMask } from "./lib/create-left-lalf-inverted-parity-mask.js";
import { createMirrorShadowMergeMask } from "./lib/create-mirror-shadow-merge-mask.js";
import { createMirroredFrameSource } from "./lib/create-mirrored-frame-source.js";
import { createRightEdgeFillMask } from "./lib/create-right-edge-fill-mask.js";
import { createSegmentationMask } from "./lib/create-segmentation-mask.js";
import { triggerCanvas4Explosion, updateExplosionFrame } from "./lib/explosion.js";
import { invertImageData } from "./lib/invert-image-data.js";
import { initializeMediaPipeVision } from "./lib/mediapipe.js";
import { createPlayer } from "./lib/player.js";

const urlSearchParams = new URLSearchParams(window.location.search);
const DEBUG_ENABLED = urlSearchParams.get("debug") === "true";
const HIDE_HINT_IN_PRESENTATION = urlSearchParams.get("hideHint") === "true" || urlSearchParams.get("noHint") === "true";
const PRESENTATION_VIDEO_CONSTRAINTS = { width: 800, height: 600 };
const DEBUG_VIDEO_CONSTRAINTS = { width: 320, height: 240 };

function parseThresholdParam(input, searchParams) {
  const thresholdParam = searchParams.get("threshold");

  if (thresholdParam === null) {
    return input.value;
  }

  const parsedThreshold = Number.parseInt(thresholdParam, 10);

  if (Number.isNaN(parsedThreshold)) {
    return input.value;
  }

  const min = Number.parseInt(input.min, 10);
  const max = Number.parseInt(input.max, 10);
  const clampedThreshold = Math.min(Math.max(parsedThreshold, min), max);

  return String(clampedThreshold);
}

function syncThresholdQueryParam(threshold) {
  const url = new URL(window.location.href);

  url.searchParams.set("threshold", threshold);
  window.history.replaceState({}, "", url);
}

const SCRIPT_STEPS = [
  {
    state: "apple-intro",
    activeCanvasId: "canvas8",
    hint: "stay centered",
    transitions: {
      "face-centered": { target: "walk-away-first" },
    },
  },
  {
    state: "walk-away-first",
    activeCanvasId: "canvas7",
    hint: "walk to one side",
    transitions: {
      "wall-hit": { target: "walk-away-second" },
    },
  },
  {
    state: "walk-away-second",
    activeCanvasId: "canvas5",
    hint: "walk to another side",
    transitions: {
      "wall-hit": { target: "touch-first" },
    },
  },
  {
    state: "touch-first",
    activeCanvasId: "canvas5",
    hint: "touch their finger",
    transitions: {
      "low-touch": { target: "touch-second" },
      "high-touch": { target: "touch-second" },
    },
  },
  {
    state: "touch-second",
    activeCanvasId: "canvas6",
    hint: "touch their finger again",
    transitions: {
      "low-touch": { target: "touch-third", actions: ["toggle-canvas6-invert"] },
      "high-touch": { target: "touch-third", actions: ["toggle-canvas6-invert"] },
    },
  },
  {
    state: "touch-third",
    activeCanvasId: "canvas6",
    hint: "touch their finger one last time",
    transitions: {
      "low-touch": { target: "make-heart", actions: ["toggle-canvas6-invert"] },
      "high-touch": { target: "make-heart", actions: ["toggle-canvas6-invert"] },
    },
  },
  {
    state: "make-heart",
    activeCanvasId: "canvas4",
    hint: "make heart with arms",
    transitions: {
      "high-touch": { target: "make-heart", actions: ["trigger-heart-burst"] },
      kiss: { target: "make-heart", actions: ["trigger-dissolve", "schedule-reset"] },
    },
  },
];

const STEP_BY_STATE = new Map(SCRIPT_STEPS.map((step) => [step.state, step]));

const elements = {
  body: document.body,
  controls: document.getElementById("controls"),
  video: document.getElementById("video"),
  canvas8: document.getElementById("canvas8"),
  canvas8Apples: document.getElementById("canvas8Apples"),
  startBtn: document.getElementById("startBtn"),
  debugBtn: document.getElementById("debugBtn"),
  explodeBtn: document.getElementById("explodeBtn"),
  maskThresholdInput: document.getElementById("maskThreshold"),
  maskThresholdValue: document.getElementById("maskThresholdValue"),
  invertCanvas6Input: document.getElementById("invertCanvas6"),
  scriptHint: document.getElementById("scriptHint"),
  mirroringCanvas: document.createElement("canvas"),
};

const surfaces = {
  videoSurface: new CanvasSurface(document.getElementById("canvas1")),
  segmentationSurface: new CanvasSurface(document.getElementById("canvas2")),
  thresholdSurface: new CanvasSurface(document.getElementById("canvas3")),
  mirrorTrimSurface: new CanvasSurface(document.getElementById("canvas4")),
  centeredParitySurface: new CanvasSurface(document.getElementById("canvas5")),
  invertedParitySurface: new CanvasSurface(document.getElementById("canvas6")),
  mirrorShadowMergeSurface: new CanvasSurface(document.getElementById("canvas7")),
  appleBaseSurface: new CanvasSurface(document.getElementById("canvas8")),
};

const effectState = {
  canvas6HeartBursts: [],
  canvas4Explode: null,
  canvas8BaseMode: "video",
  lastMirrorTrimFrame: null,
  lastMirrorTrimForegroundMask: null,
  lastFrameTimestamp: 0,
};

const applePhysicsScene = createApplePhysicsScene({
  canvas: elements.canvas8Apples,
  onAppleHit: () => {
    effectState.canvas8BaseMode = "threshold";
  },
});

const player = createPlayer({
  steps: SCRIPT_STEPS,
  elements,
  effectState,
  onTriggerDissolve: (timestamp) => {
    triggerCanvas4Explosion(effectState, timestamp);
  },
});

const cameraManager = createCameraManager({
  videoElement: elements.video,
  startButton: elements.startBtn,
  controlsElement: elements.controls,
  debugEnabled: DEBUG_ENABLED,
  debugVideoConstraints: DEBUG_VIDEO_CONSTRAINTS,
  presentationVideoConstraints: PRESENTATION_VIDEO_CONSTRAINTS,
  onFirstStream: () => {
    effectState.canvas8BaseMode = "video";
    applePhysicsScene.startEmission({ delayMs: 3000, maxCount: 1 });
    player.startVideo();
  },
});

async function main() {
  elements.body.classList.add(DEBUG_ENABLED ? "debug-mode" : "presentation-mode");
  elements.body.dataset.hideHint = HIDE_HINT_IN_PRESENTATION ? "true" : "false";
  elements.invertCanvas6Input.checked = false;
  elements.maskThresholdInput.value = parseThresholdParam(elements.maskThresholdInput, urlSearchParams);
  elements.maskThresholdValue.textContent = elements.maskThresholdInput.value;
  elements.debugBtn.textContent = DEBUG_ENABLED ? "Present" : "Debug";
  cameraManager.updateStartButtonLabel();
  syncThresholdQueryParam(elements.maskThresholdInput.value);

  elements.debugBtn.addEventListener("click", () => {
    const url = new URL(window.location.href);

    url.searchParams.set("threshold", elements.maskThresholdInput.value);

    if (DEBUG_ENABLED) {
      url.searchParams.delete("debug");
      url.searchParams.set("noHint", "true");
    } else {
      url.searchParams.set("debug", "true");
    }

    window.location.href = url.toString();
  });

  elements.maskThresholdInput.addEventListener("input", () => {
    elements.maskThresholdValue.textContent = elements.maskThresholdInput.value;
    syncThresholdQueryParam(elements.maskThresholdInput.value);
  });

  elements.explodeBtn.addEventListener("click", () => {
    triggerCanvas4Explosion(effectState);
  });

  player.applyPresentation();

  const { imageSegmenter, landmarks } = await initializeMediaPipeVision();

  const start$ = fromEvent(elements.startBtn, "click").pipe(concatMap(() => cameraManager.startNextCamera()));

  const frame$ = animationFrames().pipe(
    concatMap(({ timestamp }) =>
      processFrame(
        timestamp,
        elements.video,
        elements.maskThresholdInput,
        elements.invertCanvas6Input,
        surfaces,
        effectState,
        imageSegmenter,
        landmarks,
        elements.mirroringCanvas
      )
    )
  );

  const lowTouch$ = fromEvent(landmarks, "low-touch").pipe(
    throttleTime(1000, { leading: true, trailing: false }),
    tap((event) => {
      player.advance(event.detail.name);
      console.log("Low touch event:", event);
    })
  );

  const highTouch$ = fromEvent(landmarks, "high-touch").pipe(
    throttleTime(200, { leading: true, trailing: true }),
    tap((event) => {
      player.advance(event.detail.name, event.detail.timestamp);
      console.log("High touch event:", event);
    })
  );

  const kiss$ = fromEvent(landmarks, "kiss").pipe(
    throttleTime(3000, { leading: true, trailing: false }),
    tap((event) => {
      player.advance(event.detail.name, event.detail.timestamp);
      console.log("Kiss event:", event);
    })
  );

  const wallHit$ = fromEvent(landmarks, "wall-hit").pipe(
    throttleTime(3000, { leading: true, trailing: false }),
    tap((event) => {
      player.advance(event.detail.name, event.detail.timestamp);
      console.log("Wall hit event:", event);
    })
  );

  const faceCentered$ = fromEvent(landmarks, "face-centered").pipe(
    throttleTime(1000, { leading: true, trailing: false }),
    tap((event) => {
      if (effectState.scriptState === "apple-intro" && !applePhysicsScene.hasHitAppleClearedScreen()) {
        return;
      }

      player.advance(event.detail.name, event.detail.timestamp);
      console.log("Face centered event:", event);
    })
  );

  merge(start$, frame$, lowTouch$, highTouch$, kiss$, wallHit$, faceCentered$).subscribe();
}

async function processFrame(timestamp, video, maskThresholdInput, invertCanvasInput, surfaces, effectState, imageSegmenter, landmarks, mirroredFrameCanvas) {
  try {
    effectState.lastFrameTimestamp = timestamp;
    const sourceFrame = createMirroredFrameSource(video, mirroredFrameCanvas);

    if (!sourceFrame) {
      return;
    }

    const activeCanvasId = getActiveCanvasId(effectState.scriptState);
    const isPresentationMode = !DEBUG_ENABLED;
    const needsVideoSurface = !isPresentationMode || activeCanvasId === "canvas1";
    const needsSegmentationSurface = !isPresentationMode || activeCanvasId === "canvas2";
    const needsThresholdSurface = !isPresentationMode || activeCanvasId === "canvas3";
    const needsMirrorTrimSurface = !isPresentationMode || activeCanvasId === "canvas4";
    const needsCenteredParitySurface = !isPresentationMode || activeCanvasId === "canvas5";
    const needsInvertedParitySurface = !isPresentationMode || activeCanvasId === "canvas6";
    const needsMirrorShadowMergeSurface = !isPresentationMode || activeCanvasId === "canvas7";
    const needsBasicThresholdSurface = !isPresentationMode || activeCanvasId === "canvas8";
    const needsSegmentationInference =
      needsSegmentationSurface ||
      needsThresholdSurface ||
      needsMirrorTrimSurface ||
      needsCenteredParitySurface ||
      needsInvertedParitySurface ||
      needsMirrorShadowMergeSurface ||
      needsBasicThresholdSurface;
    const needsLandmarkDetection = !isPresentationMode || Boolean(activeCanvasId);

    if (needsVideoSurface) {
      surfaces.videoSurface.paintFrame(sourceFrame);
    }

    const result = needsSegmentationInference ? await new Promise((resolve) => imageSegmenter.segmentForVideo(sourceFrame, timestamp, resolve)) : null;
    const backgroundConfidenceMask = result?.confidenceMasks?.[0] ?? null;
    const detection = needsLandmarkDetection ? landmarks.detect(sourceFrame, timestamp) ?? { points: [], events: [] } : { points: [], events: [] };
    const width = sourceFrame.width;
    const height = sourceFrame.height;

    if (effectState.scriptState === "make-heart") {
      prewarmHeartBurstInversionCache(width, height);
    }

    const needsThresholdMask =
      needsThresholdSurface ||
      needsMirrorTrimSurface ||
      needsCenteredParitySurface ||
      needsInvertedParitySurface ||
      needsMirrorShadowMergeSurface ||
      needsBasicThresholdSurface;
    const threshold = Number.parseInt(maskThresholdInput.value, 10);

    if (needsSegmentationSurface) {
      surfaces.segmentationSurface.paintGeneratedImage(createSegmentationMask, backgroundConfidenceMask, width, height);
    }

    const thresholdMask = needsThresholdMask ? createInvertedThresholdMask(backgroundConfidenceMask, width, height, threshold) : null;

    if (needsThresholdSurface && thresholdMask) {
      surfaces.thresholdSurface.paintImageData(thresholdMask, width, height);
      surfaces.thresholdSurface.paintPoints(detection.points, width, height);
    }

    if (needsBasicThresholdSurface) {
      applePhysicsScene.updateMask(backgroundConfidenceMask, width, height, threshold);
      renderAppleBaseLayer(surfaces.appleBaseSurface, effectState.canvas8BaseMode, sourceFrame, thresholdMask, width, height);
    }

    const mirrorTrimMask = needsMirrorTrimSurface ? createRightEdgeFillMask(thresholdMask, width, height, detection.orientation) : null;

    if (needsMirrorTrimSurface) {
      landmarks.maybeDispatchHighTouch(detection.handPoints ?? [], detection.mouthPoints, mirrorTrimMask?.meta, width, timestamp);
      landmarks.maybeDispatchKiss(detection.nosePoint, detection.mouthPoints, mirrorTrimMask?.meta, width, timestamp);
    }

    if (needsMirrorTrimSurface) {
      const mirrorTrimOutput = applyHeartBurstInversion(mirrorTrimMask, timestamp, effectState.canvas6HeartBursts);

      updateExplosionFrame({
        timestamp,
        mirrorTrimSurface: surfaces.mirrorTrimSurface,
        effectState,
        mirrorTrimOutput,
        thresholdMask,
        mirrorTrimMask,
        width,
        height,
      });
    }

    effectState.canvas6HeartBursts = effectState.canvas6HeartBursts.filter(
      (burstState) => burstState?.completedAt == null || burstState.completedAt > timestamp
    );

    if (needsCenteredParitySurface) {
      surfaces.centeredParitySurface.paintGeneratedImage(createCenteredParityMask, thresholdMask, width, height);
    }

    if (needsInvertedParitySurface) {
      const invertedParityMask = createLeftHalfInvertedParityMask(thresholdMask, width, height);
      const canvas6BaseImage = invertCanvasInput.checked ? invertImageData(invertedParityMask) : invertedParityMask;
      surfaces.invertedParitySurface.paintImageData(canvas6BaseImage, width, height);
    }

    if (needsMirrorShadowMergeSurface) {
      surfaces.mirrorShadowMergeSurface.paintGeneratedImage(createMirrorShadowMergeMask, thresholdMask, width, height);
    }
  } catch (error) {
    console.log("Error processing frame:", error);
  }
}

function renderAppleBaseLayer(surface, mode, sourceFrame, thresholdMask, width, height) {
  if (mode === "threshold" && thresholdMask) {
    surface.paintImageData(thresholdMask, width, height);
    return;
  }

  surface.paintFrame(sourceFrame);
}

function getActiveCanvasId(scriptState) {
  return STEP_BY_STATE.get(scriptState)?.activeCanvasId ?? null;
}
main();
