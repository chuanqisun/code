import { EMPTY, Subject, animationFrames, concatMap, fromEvent, switchMap, takeUntil, throttleTime } from "https://esm.sh/rxjs@7.8.2";
import { AudioHistoryController } from "./lib/audio-history.js";
import { createGlitchFormController } from "./lib/form.js";
import { BodyHistoryController, HistoryFrameManager, cloneCanvasFrame } from "./lib/history.js";
import { createHudState, createHudTickController, drawBodyHistoryHud, playHudTick, shouldRenderHud, updateHudState } from "./lib/hud.js";
import { MediaPipeVisionManager } from "./lib/mediapipe.js";
import { createWebcamRecordingController } from "./lib/webcam-recording.js";
import { WebcamController } from "./lib/webcam.js";

const PRESENT_MODE_QUERY_PARAM = "present";
const video = document.getElementById("video");
const presentStage = document.getElementById("presentStage");
const presentBtn = document.getElementById("presentBtn");
const downloadBtn = document.getElementById("downloadBtn");
const debugBtn = document.getElementById("debugBtn");
const isPresentMode = isPresentModeEnabled(window);
const liveCanvasElement = document.getElementById("liveCanvas");
const bodyCanvasElement = document.getElementById("bodyCanvas");
const historyCanvasElement = document.getElementById("historyCanvas");
const bodyHistoryCanvas = document.getElementById("bodyHistoryCanvas");
const liveCanvas = createRenderCanvas(liveCanvasElement, isPresentMode);
const bodyCanvas = createRenderCanvas(bodyCanvasElement, isPresentMode);
const historyCanvas = createRenderCanvas(historyCanvasElement, isPresentMode);
const liveCtx = liveCanvas.getContext("2d");
const bodyCtx = bodyCanvas.getContext("2d");
const historyCtx = historyCanvas.getContext("2d");
const bodyHistoryCtx = bodyHistoryCanvas.getContext("2d");
const processingCanvas = document.createElement("canvas");
const stopCamera$ = new Subject();
const historyFrameTick$ = new Subject();

const TARGET_CANVAS_WIDTH = 320;
const PRESENT_MODE_TARGET_CANVAS_WIDTH = 960;
const DEFAULT_BODY_THRESHOLD = 128;
const IDEAL_FRAME_RATE = 30;
const PALM_CONTROL_ANGLE_LIMIT = 75;
const AUDIO_INPUT_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
};
const targetCanvasWidth = isPresentMode ? PRESENT_MODE_TARGET_CANVAS_WIDTH : TARGET_CANVAS_WIDTH;
let bodySegmentThreshold = DEFAULT_BODY_THRESHOLD;
const hudState = createHudState();
const hudTickController = createHudTickController(window);
const webcamRecordingController = createWebcamRecordingController({
  window,
  audioConstraints: AUDIO_INPUT_CONSTRAINTS,
});
let lastObservedHistoryFrameIndex = null;

historyFrameTick$.pipe(throttleTime(50)).subscribe(() => {
  playHudTick(hudTickController);
});

if (isPresentMode) {
  document.body.classList.add("present-mode");
  configureDebugButton();
  configureDownloadButton();
  syncPresentCanvasLayout();
  window.addEventListener("resize", syncPresentCanvasLayout);
} else {
  configurePresentButton();
}

const webcam = new WebcamController(video, {
  width: targetCanvasWidth,
  frameRate: IDEAL_FRAME_RATE,
  audio: AUDIO_INPUT_CONSTRAINTS,
});
const visionManager = new MediaPipeVisionManager();
const audioHistoryController = new AudioHistoryController({
  frameRate: IDEAL_FRAME_RATE,
  getFrameLimit: getHistoryFrameLimit,
});
const formController = createGlitchFormController({
  document,
  window,
  defaultBodyThreshold: DEFAULT_BODY_THRESHOLD,
  defaultHandOpenThreshold: visionManager.openThreshold,
  defaultHandCloseThreshold: visionManager.closeThreshold,
});
const { startBtn, historySlider, historyDepthSlider, stats } = formController.elements;

formController.onThresholdStateChange(({ bodyThreshold, handOpenThreshold, handCloseThreshold }) => {
  bodySegmentThreshold = bodyThreshold;
  visionManager.openThreshold = handOpenThreshold;
  visionManager.closeThreshold = handCloseThreshold;
});

formController.hydrateThresholdStateFromUrl({ notify: true });
formController.updateHandOpennessMeter(undefined);

formController.syncStartButtonLabel({
  currentCameraIndex: webcam.currentDeviceIndex,
  totalCameraCount: webcam.videoInputDevices.length,
});
const bodyHistoryController = new BodyHistoryController({
  slider: historyDepthSlider,
  onRender: () => historyFrameManager.render(),
});

const historyFrameManager = new HistoryFrameManager({
  renderTargets: [
    { key: "full", canvas: historyCanvas, context: historyCtx },
    {
      canvas: bodyHistoryCanvas,
      context: bodyHistoryCtx,
      render: ({ context, canvas, frameSet, frames, selectedFrameIndex }) => {
        const currentFullFrame = frames[selectedFrameIndex]?.full;

        if (currentFullFrame) {
          context.drawImage(currentFullFrame, 0, 0, canvas.width, canvas.height);
        }

        const startIndex = Math.max(0, selectedFrameIndex - bodyHistoryController.getDepth() + 1);

        for (let frameIndex = startIndex; frameIndex <= selectedFrameIndex; frameIndex += 1) {
          const bodyFrame = frames[frameIndex]?.body;
          if (!bodyFrame) continue;

          context.drawImage(bodyFrame, 0, 0, canvas.width, canvas.height);
        }

        if (shouldRenderHud(hudState)) {
          drawBodyHistoryHud({
            context,
            canvas,
            slider: historySlider,
            hudState,
          });
        }
      },
    },
  ],
  slider: historySlider,
  getFrameLimit: getHistoryFrameLimit,
});

historyDepthSlider.addEventListener("input", () => {
  bodyHistoryController.handleSliderInput();

  if (!bodyHistoryController.isFrozen) {
    historyFrameManager.trimToFrameLimit();
    audioHistoryController.trimToFrames(historyFrameManager.getFrames());
  }

  historyFrameManager.render();
});

historySlider.addEventListener("input", () => {
  syncHistorySelectionFeedback();
});

fromEvent(startBtn, "click")
  .pipe(
    concatMap(async () => {
      stopCamera$.next();
      const activeVideo = await webcam.cycle();
      formController.syncStartButtonLabel({
        currentCameraIndex: webcam.currentDeviceIndex,
        totalCameraCount: webcam.videoInputDevices.length,
      });
      if (activeVideo === null) {
        audioHistoryController.reset();
        await webcamRecordingController.stop();
        syncDownloadButtonState();
        return null;
      }

      await visionManager.initialize();
      await visionManager.waitForVideoFrame(activeVideo);
      await audioHistoryController.attachStream(webcam.getCurrentStream());
      await webcamRecordingController.start(webcam.getCurrentStream());
      webcam.syncCanvasesToScaledDimensions([liveCanvas, bodyCanvas, historyCanvas, bodyHistoryCanvas], targetCanvasWidth);
      syncPresentCanvasLayout();
      bodyHistoryController.reset();
      historyFrameManager.reset();
      lastObservedHistoryFrameIndex = historyFrameManager.getSelectedFrameIndex();
      syncHistorySelectionFeedback();
      syncDownloadButtonState();
      return activeVideo;
    }),
    switchMap((activeVideo) => {
      if (activeVideo === null) {
        audioHistoryController.stopPreview();
        return EMPTY;
      }

      return animationFrames().pipe(
        takeUntil(stopCamera$),
        throttleTime(1000 / IDEAL_FRAME_RATE),
        concatMap(async ({ timestamp }) => {
          const processingFrame = webcam.createProcessingFrameSource(video, processingCanvas);
          liveCtx.drawImage(video, 0, 0, liveCanvas.width, liveCanvas.height);
          const { handLandmarks, handMetrics, hasOpenHand, bodyFrame } = await visionManager.processFrame({
            videoFrame: processingFrame,
            sourceCanvas: processingFrame,
            timestamp,
            bodySegmentThreshold,
          });
          updateHudState(hudState, { isHandOpen: hasOpenHand });
          formController.updateHandOpennessMeter(getControllingHandMetric(handMetrics)?.openness);

          const freezeState = bodyHistoryController.updateFreezeState(hasOpenHand);

          if (freezeState.didFreezeStart) {
            historyFrameManager.freezeSelection();
          }

          if (freezeState.didFreezeEnd) {
            historyFrameManager.followLatestFrame();
            historyFrameManager.trimToFrameLimit();
          }

          bodyCtx.clearRect(0, 0, bodyCanvas.width, bodyCanvas.height);
          bodyCtx.drawImage(bodyFrame, 0, 0, bodyCanvas.width, bodyCanvas.height);

          if (!freezeState.isFrozen) {
            historyFrameManager.captureFrame(
              {
                full: cloneCanvasFrame(liveCanvas),
                body: bodyFrame,
                ...audioHistoryController.captureFrameReference(),
              },
              {
                frameLimit: getHistoryFrameLimit(),
              }
            );
            audioHistoryController.trimToFrames(historyFrameManager.getFrames());
          }

          if (freezeState.isFrozen) {
            const palmOrientation = getControllingPalmOrientation(handMetrics);

            if (typeof palmOrientation === "number") {
              historyFrameManager.setRelativeSelection(mapPalmOrientationToHistoryOffset(palmOrientation));
            }
          }

          visionManager.renderHandMarkers({
            context: liveCtx,
            handLandmarks,
            width: liveCanvas.width,
            height: liveCanvas.height,
          });
          historyFrameManager.render();
          syncHistorySelectionFeedback();
          stats.textContent = visionManager.formatHandStats(handLandmarks, handMetrics);
        })
      );
    })
  )
  .subscribe();

function getHistoryFrameLimit() {
  return bodyHistoryController.getDefaultMaxDepth();
}

function syncAudioHistoryPlayback() {
  const frames = historyFrameManager.getFrames();
  const selectedFrame = frames[historyFrameManager.getSelectedFrameIndex()];

  audioHistoryController.syncToFrame(selectedFrame, {
    shouldScrub: bodyHistoryController.isFrozen || !historyFrameManager.isFollowingLatestFrame(),
  });
}

function syncHistorySelectionFeedback() {
  syncAudioHistoryPlayback();
  queueHudTickForHistoryFrameChange();
}

function queueHudTickForHistoryFrameChange() {
  const selectedFrameIndex = historyFrameManager.getSelectedFrameIndex();
  const shouldTick = bodyHistoryController.isFrozen || !historyFrameManager.isFollowingLatestFrame();
  const didFrameChange = selectedFrameIndex !== lastObservedHistoryFrameIndex;

  lastObservedHistoryFrameIndex = selectedFrameIndex;

  if (didFrameChange && shouldTick) {
    historyFrameTick$.next(selectedFrameIndex);
  }
}

function getControllingHandMetric(handMetrics) {
  const openHandMetric = handMetrics.find((metric) => metric?.isOpen && typeof metric?.openness === "number");

  if (openHandMetric) {
    return openHandMetric;
  }

  return handMetrics.find((metric) => typeof metric?.openness === "number");
}

function getControllingPalmOrientation(handMetrics) {
  const openHandMetric = handMetrics.find((metric) => metric?.isOpen && typeof metric?.palmOrientation === "number");

  if (openHandMetric) {
    return openHandMetric.palmOrientation;
  }

  const firstTrackedHandMetric = handMetrics.find((metric) => typeof metric?.palmOrientation === "number");
  return firstTrackedHandMetric?.palmOrientation;
}

function mapPalmOrientationToHistoryOffset(palmOrientation) {
  const clampedOrientation = Math.max(-PALM_CONTROL_ANGLE_LIMIT, Math.min(PALM_CONTROL_ANGLE_LIMIT, palmOrientation));
  const normalizedOrientation = (clampedOrientation + PALM_CONTROL_ANGLE_LIMIT) / (PALM_CONTROL_ANGLE_LIMIT * 2);
  const relativeOffsetLimit = historyFrameManager.getRelativeOffsetLimit();

  return Math.round(-normalizedOrientation * relativeOffsetLimit);
}

function isPresentModeEnabled(currentWindow) {
  return new URLSearchParams(currentWindow.location.search).get(PRESENT_MODE_QUERY_PARAM) === "true";
}

function configureDebugButton() {
  if (!debugBtn) {
    return;
  }

  debugBtn.hidden = false;
  debugBtn.addEventListener("click", () => {
    window.location.assign(createDebugModeUrl(window));
  });
}

function configureDownloadButton() {
  if (!downloadBtn) {
    return;
  }

  downloadBtn.hidden = false;
  syncDownloadButtonState();
  downloadBtn.addEventListener("click", async () => {
    try {
      downloadBtn.disabled = true;
      await webcamRecordingController.download();
    } catch (error) {
      console.error("Unable to download webcam recording.", error);
    } finally {
      syncDownloadButtonState();
    }
  });
}

function configurePresentButton() {
  if (!presentBtn) {
    return;
  }

  presentBtn.hidden = false;
  presentBtn.addEventListener("click", () => {
    window.location.assign(createPresentModeUrl(window));
  });
}

function createDebugModeUrl(currentWindow) {
  const searchParams = new URLSearchParams(currentWindow.location.search);
  searchParams.delete(PRESENT_MODE_QUERY_PARAM);

  return createUrlWithSearchParams(currentWindow, searchParams);
}

function createPresentModeUrl(currentWindow) {
  const searchParams = new URLSearchParams(currentWindow.location.search);
  searchParams.set(PRESENT_MODE_QUERY_PARAM, "true");

  return createUrlWithSearchParams(currentWindow, searchParams);
}

function createUrlWithSearchParams(currentWindow, searchParams) {
  const nextQueryString = searchParams.toString();
  return nextQueryString
    ? `${currentWindow.location.pathname}?${nextQueryString}${currentWindow.location.hash}`
    : `${currentWindow.location.pathname}${currentWindow.location.hash}`;
}

function createRenderCanvas(canvasElement, shouldUseOffscreenCanvas) {
  if (!shouldUseOffscreenCanvas) {
    return canvasElement;
  }

  return document.createElement("canvas");
}

function syncDownloadButtonState() {
  if (!downloadBtn) {
    return;
  }

  downloadBtn.disabled = !webcamRecordingController.canDownload();
}

function syncPresentCanvasLayout() {
  if (!isPresentMode || !presentStage) {
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const canvasWidth = bodyHistoryCanvas.width;
  const canvasHeight = bodyHistoryCanvas.height;

  presentStage.style.width = `${viewportWidth}px`;
  presentStage.style.height = `${viewportHeight}px`;

  if (!(canvasWidth > 0) || !(canvasHeight > 0)) {
    bodyHistoryCanvas.style.width = `${viewportWidth}px`;
    bodyHistoryCanvas.style.height = `${viewportHeight}px`;
    return;
  }

  const canvasAspectRatio = canvasWidth / canvasHeight;
  const viewportAspectRatio = viewportWidth / viewportHeight;
  let renderedWidth = viewportWidth;
  let renderedHeight = viewportHeight;

  if (canvasAspectRatio > viewportAspectRatio) {
    renderedHeight = Math.round(viewportWidth / canvasAspectRatio);
  } else {
    renderedWidth = Math.round(viewportHeight * canvasAspectRatio);
  }

  bodyHistoryCanvas.style.width = `${renderedWidth}px`;
  bodyHistoryCanvas.style.height = `${renderedHeight}px`;
}
