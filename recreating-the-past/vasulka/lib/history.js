export function cloneCanvasFrame(sourceCanvas) {
  const frame = document.createElement("canvas");
  frame.width = sourceCanvas.width;
  frame.height = sourceCanvas.height;
  frame.getContext("2d").drawImage(sourceCanvas, 0, 0, frame.width, frame.height);
  return frame;
}

export class BodyHistoryController {
  constructor({ slider, minDepth = 1, expansionDurationMs = 1000, frozenMaxDepthMultiplier = 2, onRender = () => {} }) {
    this.slider = slider;
    this.minDepth = minDepth;
    this.expansionDurationMs = expansionDurationMs;
    this.frozenMaxDepthMultiplier = frozenMaxDepthMultiplier;
    this.onRender = onRender;
    this.defaultMaxDepth = this.readSliderMax();
    this.animatedDepth = minDepth;
    this.animationFrameId = null;
    this.animationStartTime = null;
    this.animationFromDepth = minDepth;
    this.animationToDepth = minDepth;
    this.animationDurationMs = 0;
    this.isFrozen = false;

    this.stepExpansion = this.stepExpansion.bind(this);
    this.setSliderMax(this.defaultMaxDepth);
    this.setDepth(minDepth);
  }

  readSliderMax() {
    const nextDepth = Number.parseInt(this.slider.max, 10);
    return Number.isNaN(nextDepth) || nextDepth < this.minDepth ? this.minDepth : nextDepth;
  }

  getDefaultMaxDepth() {
    return this.defaultMaxDepth;
  }

  getFrozenMaxDepth() {
    return this.defaultMaxDepth * this.frozenMaxDepthMultiplier;
  }

  setSliderMax(nextMaxDepth) {
    const clampedMaxDepth = Math.max(this.minDepth, nextMaxDepth);
    this.slider.max = String(clampedMaxDepth);
  }

  getDepth() {
    return Math.max(this.minDepth, Math.round(this.animatedDepth));
  }

  getMaxDepth() {
    return this.readSliderMax();
  }

  setDepth(nextDepth) {
    const clampedDepth = Math.max(this.minDepth, Math.min(this.getMaxDepth(), nextDepth));
    this.animatedDepth = clampedDepth;
    this.slider.value = String(Math.round(clampedDepth));
  }

  handleSliderInput() {
    if (this.isFrozen) {
      return;
    }

    const nextDepth = Number.parseInt(this.slider.value, 10);
    this.setDepth(Number.isNaN(nextDepth) ? this.minDepth : nextDepth);
  }

  stopExpansion() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.animationStartTime = null;
  }

  getAnimationDuration(fromDepth, toDepth) {
    const depthRange = this.getMaxDepth() - this.minDepth;

    if (depthRange <= 0) {
      return 0;
    }

    return (Math.abs(toDepth - fromDepth) / depthRange) * this.expansionDurationMs;
  }

  stepExpansion(timestamp) {
    if (this.animationStartTime === null) {
      this.animationStartTime = timestamp;
    }

    const elapsed = timestamp - this.animationStartTime;
    const progress = this.animationDurationMs <= 0 ? 1 : Math.min(elapsed / this.animationDurationMs, 1);
    const nextDepth = this.animationFromDepth + (this.animationToDepth - this.animationFromDepth) * progress;

    this.setDepth(nextDepth);
    this.onRender();

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(this.stepExpansion);
      return;
    }

    this.animationFrameId = null;

    if (this.animationToDepth <= this.minDepth) {
      this.setSliderMax(this.getDefaultMaxDepth());
      this.onRender();
    }
  }

  animateDepth(targetDepth) {
    this.stopExpansion();

    const clampedTargetDepth = Math.max(this.minDepth, Math.min(this.getMaxDepth(), targetDepth));
    this.animationFromDepth = this.animatedDepth;
    this.animationToDepth = clampedTargetDepth;
    this.animationDurationMs = this.getAnimationDuration(this.animationFromDepth, this.animationToDepth);

    if (this.animationDurationMs <= 0) {
      this.setDepth(clampedTargetDepth);

      if (clampedTargetDepth <= this.minDepth) {
        this.setSliderMax(this.getDefaultMaxDepth());
      }

      this.onRender();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.stepExpansion);
  }

  startExpansion() {
    this.setSliderMax(this.getFrozenMaxDepth());
    this.setDepth(this.minDepth);
    this.animateDepth(this.getMaxDepth());
  }

  updateFreezeState(isHandOpen) {
    if (isHandOpen && !this.isFrozen) {
      this.isFrozen = true;
      this.startExpansion();
      return { didFreezeStart: true, didFreezeEnd: false, isFrozen: true };
    }

    if (isHandOpen && this.isFrozen) {
      this.animateDepth(this.getMaxDepth());
      return { didFreezeStart: false, didFreezeEnd: false, isFrozen: true };
    }

    if (!isHandOpen && this.isFrozen) {
      this.isFrozen = false;
      this.animateDepth(this.minDepth);
      return { didFreezeStart: false, didFreezeEnd: true, isFrozen: false };
    }

    return { didFreezeStart: false, didFreezeEnd: false, isFrozen: false };
  }

  reset() {
    this.stopExpansion();
    this.isFrozen = false;
    this.setSliderMax(this.getDefaultMaxDepth());
    this.setDepth(this.minDepth);
  }
}

export class HistoryFrameManager {
  constructor({ renderTargets, slider, getFrameLimit }) {
    this.renderTargets = renderTargets;
    this.slider = slider;
    this.getFrameLimit = getFrameLimit;
    this.relativeOffsetLimit = this.readRelativeOffsetLimit();
    this.frames = [];
    this.selectedFrameIndex = 0;
    this.followsLatestFrame = true;
    this.anchorFrameIndex = null;

    this.slider.addEventListener("input", () => {
      const nextRelativeOffset = Number.parseInt(this.slider.value, 10);
      this.setRelativeSelection(Number.isNaN(nextRelativeOffset) ? 0 : nextRelativeOffset);
      this.render();
    });
  }

  getFrames() {
    return this.frames;
  }

  getSelectedFrameIndex() {
    return this.selectedFrameIndex;
  }

  isFollowingLatestFrame() {
    return this.followsLatestFrame;
  }

  readRelativeOffsetLimit() {
    const minLimit = Number.parseInt(this.slider.min, 10);
    const maxLimit = Number.parseInt(this.slider.max, 10);

    return Math.max(Number.isNaN(minLimit) ? 0 : Math.abs(minLimit), Number.isNaN(maxLimit) ? 0 : Math.abs(maxLimit));
  }

  getRelativeOffsetLimit() {
    return this.relativeOffsetLimit;
  }

  getAnchorFrameIndex() {
    if (typeof this.anchorFrameIndex === "number") {
      return this.anchorFrameIndex;
    }

    return Math.max(this.frames.length - 1, 0);
  }

  getRelativeBounds() {
    const anchorFrameIndex = this.getAnchorFrameIndex();
    const relativeOffsetLimit = this.getRelativeOffsetLimit();

    return {
      min: -Math.min(anchorFrameIndex, relativeOffsetLimit),
      max: 0,
    };
  }

  setRelativeSelection(nextRelativeOffset) {
    const { min, max } = this.getRelativeBounds();
    const clampedRelativeOffset = Math.max(min, Math.min(max, nextRelativeOffset));
    const anchorFrameIndex = this.getAnchorFrameIndex();

    this.selectedFrameIndex = anchorFrameIndex + clampedRelativeOffset;

    if (this.anchorFrameIndex === null) {
      this.followsLatestFrame = clampedRelativeOffset === 0;
    } else {
      this.followsLatestFrame = false;
    }

    this.syncSlider();
  }

  freezeSelection() {
    this.followsLatestFrame = false;
    this.anchorFrameIndex = this.selectedFrameIndex;
    this.syncSlider();
  }

  followLatestFrame() {
    this.followsLatestFrame = true;
    this.anchorFrameIndex = null;
    this.syncSlider();
  }

  captureFrame(frameSet, { frameLimit = this.getFrameLimit() } = {}) {
    this.frames.push(frameSet);

    while (this.frames.length > frameLimit) {
      this.frames.shift();
    }

    this.syncSlider();
    return true;
  }

  trimToFrameLimit() {
    const frameLimit = this.getFrameLimit();

    while (this.frames.length > frameLimit) {
      this.frames.shift();
    }

    this.syncSlider();
  }

  render() {
    const frameSet = this.frames[this.selectedFrameIndex];

    if (!frameSet) {
      for (const renderTarget of this.renderTargets) {
        renderTarget.context.clearRect(0, 0, renderTarget.canvas.width, renderTarget.canvas.height);
      }
      return;
    }

    for (const renderTarget of this.renderTargets) {
      renderTarget.context.clearRect(0, 0, renderTarget.canvas.width, renderTarget.canvas.height);

      if (typeof renderTarget.render === "function") {
        renderTarget.render({
          context: renderTarget.context,
          canvas: renderTarget.canvas,
          frameSet,
          frames: this.frames,
          selectedFrameIndex: this.selectedFrameIndex,
        });
        continue;
      }

      if (typeof renderTarget.compositeFrameCount === "number" && renderTarget.compositeFrameCount > 1) {
        const startIndex = Math.max(0, this.selectedFrameIndex - renderTarget.compositeFrameCount + 1);

        for (let frameIndex = startIndex; frameIndex <= this.selectedFrameIndex; frameIndex += 1) {
          const compositeFrame = this.frames[frameIndex]?.[renderTarget.key];

          if (!compositeFrame) {
            continue;
          }

          renderTarget.context.drawImage(compositeFrame, 0, 0, renderTarget.canvas.width, renderTarget.canvas.height);
        }

        continue;
      }

      const frame = frameSet[renderTarget.key];

      if (!frame) {
        continue;
      }

      renderTarget.context.drawImage(frame, 0, 0, renderTarget.canvas.width, renderTarget.canvas.height);
    }
  }

  syncSlider() {
    const maxIndex = Math.max(this.frames.length - 1, 0);

    if (this.followsLatestFrame) {
      this.selectedFrameIndex = maxIndex;
    } else {
      this.selectedFrameIndex = Math.max(0, Math.min(this.selectedFrameIndex, maxIndex));
    }

    const anchorFrameIndex = this.getAnchorFrameIndex();
    const { min, max } = this.getRelativeBounds();
    const relativeValue = this.selectedFrameIndex - anchorFrameIndex;

    this.slider.min = String(min);
    this.slider.max = String(max);
    this.slider.value = String(Math.max(min, Math.min(max, relativeValue)));
    this.slider.disabled = this.frames.length <= 1;
  }

  reset() {
    this.frames = [];
    this.selectedFrameIndex = 0;
    this.followsLatestFrame = true;
    this.anchorFrameIndex = null;
    this.syncSlider();
    this.render();
  }
}
