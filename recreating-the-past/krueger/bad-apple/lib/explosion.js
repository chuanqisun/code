export function updateExplosionFrame({ timestamp, mirrorTrimSurface, effectState, mirrorTrimOutput, thresholdMask, mirrorTrimMask, width, height }) {
  const explodeState = effectState.canvas4Explode;

  if (explodeState) {
    const explodeElapsed = timestamp - explodeState.startedAt;
    const explodeFrame = mirrorTrimSurface.paintExplodedFrame(explodeState.sourceImageData, explodeState.foregroundMask, explodeElapsed, explodeState);

    if (explodeFrame?.hasVisibleParticles) {
      effectState.lastMirrorTrimFrame = explodeFrame.output;
      return;
    }

    effectState.canvas4Explode = null;
  }

  mirrorTrimSurface.paintImageData(mirrorTrimOutput, width, height);
  effectState.lastMirrorTrimFrame = mirrorTrimSurface.captureImageData();
  effectState.lastMirrorTrimForegroundMask = createExplodeMasks(thresholdMask, mirrorTrimMask);
}

export function triggerCanvas4Explosion(effectState, startedAt = performance.now()) {
  if (effectState.canvas4Explode || !effectState.lastMirrorTrimFrame || !effectState.lastMirrorTrimForegroundMask) {
    return;
  }

  effectState.canvas4Explode = {
    startedAt: effectState.lastFrameTimestamp || startedAt,
    duration: 6000,
    sourceImageData: cloneImageData(effectState.lastMirrorTrimFrame),
    foregroundMask: cloneExplodeMasks(effectState.lastMirrorTrimForegroundMask),
    particles: null,
  };
}

function createExplodeMasks(sourceMask, mirrorMask) {
  return {
    sourceMask: cloneImageData(sourceMask),
    mirrorMask: cloneImageData(mirrorMask),
    meta: { ...(mirrorMask?.meta ?? {}) },
  };
}

function cloneExplodeMasks(masks) {
  if (!masks) {
    return null;
  }

  return {
    sourceMask: cloneImageData(masks.sourceMask),
    mirrorMask: cloneImageData(masks.mirrorMask),
    meta: { ...(masks.meta ?? {}) },
  };
}

function cloneImageData(imageData) {
  if (!imageData) {
    return null;
  }

  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}
