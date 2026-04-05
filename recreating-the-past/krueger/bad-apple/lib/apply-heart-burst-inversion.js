const HEART_BURST_DURATION_MS = 3000;
const HEART_BURST_EMIT_INTERVAL_MS = 200;
const heartEntryScaleCache = new Map();
const heartEntryScaleBuildState = new Map();
const HEART_CACHE_BUILD_SLICE_MS = 4;

export function prewarmHeartBurstInversionCache(width, height, options = {}) {
  if (!width || !height) {
    return;
  }

  const bandThickness = options.bandThickness ?? 10;
  const maxVisibleScale = Math.hypot(width / 2, height / 2) + bandThickness;
  const cacheKey = `${width}x${height}`;

  if (heartEntryScaleCache.has(cacheKey) || heartEntryScaleBuildState.has(cacheKey)) {
    return;
  }

  const buildState = {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    maxVisibleScale,
    nextRow: 0,
    entryScales: new Float32Array(width * height),
  };

  heartEntryScaleBuildState.set(cacheKey, buildState);
  scheduleHeartEntryScaleBuild(cacheKey);
}

export function applyHeartBurstInversion(sourceImageData, elapsed, burstStates, options = {}) {
  if (!sourceImageData || !Array.isArray(burstStates) || burstStates.length === 0) {
    return sourceImageData;
  }

  const { width, height, data } = sourceImageData;
  const travelSpeed = options.travelSpeed ?? 0.2;
  const initialScale = options.initialScale ?? 10;
  const bandThickness = options.bandThickness ?? 10;
  const maxVisibleScale = Math.hypot(width / 2, height / 2) + bandThickness;
  const activeBursts = burstStates.filter((burstState) => {
    if (!burstState || burstState.startedAt == null) {
      return false;
    }

    const age = elapsed - burstState.startedAt;

    if (age < 0 || age >= HEART_BURST_DURATION_MS) {
      return false;
    }

    return true;
  });

  if (activeBursts.length === 0) {
    return sourceImageData;
  }

  const output = new ImageData(width, height);
  const outputPixels = output.data;
  prewarmHeartBurstInversionCache(width, height, options);
  const heartEntryScales = getHeartEntryScales(width, height, maxVisibleScale);
  const heartBands = activeBursts.flatMap((burstState) => {
    const burstAge = elapsed - burstState.startedAt;
    const emissionCount = Math.floor(burstAge / HEART_BURST_EMIT_INTERVAL_MS) + 1;

    return Array.from({ length: emissionCount }, (_, emissionIndex) => {
      const emittedAt = emissionIndex * HEART_BURST_EMIT_INTERVAL_MS;
      const age = burstAge - emittedAt;
      const outerScale = initialScale + age * travelSpeed;

      return {
        outerScale,
        innerScale: outerScale - bandThickness,
      };
    });
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const entryScale = heartEntryScales[y * width + x];
      let inversionCount = 0;

      for (const { outerScale, innerScale } of heartBands) {
        if (entryScale <= outerScale && entryScale > innerScale) {
          inversionCount += 1;
        }
      }

      const shouldInvert = inversionCount % 2 === 1;

      if (shouldInvert) {
        outputPixels[pixelIndex] = 255 - data[pixelIndex];
        outputPixels[pixelIndex + 1] = 255 - data[pixelIndex + 1];
        outputPixels[pixelIndex + 2] = 255 - data[pixelIndex + 2];
      } else {
        outputPixels[pixelIndex] = data[pixelIndex];
        outputPixels[pixelIndex + 1] = data[pixelIndex + 1];
        outputPixels[pixelIndex + 2] = data[pixelIndex + 2];
      }

      outputPixels[pixelIndex + 3] = data[pixelIndex + 3];
    }
  }

  return output;
}

function getHeartEntryScales(width, height, maxVisibleScale) {
  const cacheKey = `${width}x${height}`;
  const cached = heartEntryScaleCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const buildState = heartEntryScaleBuildState.get(cacheKey);

  if (buildState) {
    buildHeartEntryScales(buildState, Number.POSITIVE_INFINITY);
    heartEntryScaleBuildState.delete(cacheKey);
    heartEntryScaleCache.set(cacheKey, buildState.entryScales);
    return buildState.entryScales;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const entryScales = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      entryScales[y * width + x] = findHeartEntryScale(x, y, centerX, centerY, maxVisibleScale);
    }
  }

  heartEntryScaleCache.set(cacheKey, entryScales);

  return entryScales;
}

function scheduleHeartEntryScaleBuild(cacheKey) {
  const buildStep = (deadline) => {
    const buildState = heartEntryScaleBuildState.get(cacheKey);

    if (!buildState) {
      return;
    }

    const remainingTime = typeof deadline?.timeRemaining === "function" ? deadline.timeRemaining() : HEART_CACHE_BUILD_SLICE_MS;
    buildHeartEntryScales(buildState, Math.max(remainingTime, HEART_CACHE_BUILD_SLICE_MS));

    if (buildState.nextRow >= buildState.height) {
      heartEntryScaleBuildState.delete(cacheKey);
      heartEntryScaleCache.set(cacheKey, buildState.entryScales);
      return;
    }

    scheduleHeartBuildCallback(buildStep);
  };

  scheduleHeartBuildCallback(buildStep);
}

function scheduleHeartBuildCallback(callback) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 100 });
    return;
  }

  window.setTimeout(() => callback(), 0);
}

function buildHeartEntryScales(buildState, maxSliceMs) {
  const { width, height, centerX, centerY, maxVisibleScale, entryScales } = buildState;
  const startTime = performance.now();

  while (buildState.nextRow < height) {
    const y = buildState.nextRow;

    for (let x = 0; x < width; x += 1) {
      entryScales[y * width + x] = findHeartEntryScale(x, y, centerX, centerY, maxVisibleScale);
    }

    buildState.nextRow += 1;

    if (performance.now() - startTime >= maxSliceMs) {
      break;
    }
  }
}

function findHeartEntryScale(x, y, centerX, centerY, maxScale) {
  if (isInsideHeart(x, y, centerX, centerY, 1e-6)) {
    return 0;
  }

  if (!isInsideHeart(x, y, centerX, centerY, maxScale)) {
    return Number.POSITIVE_INFINITY;
  }

  let lowerBound = 0;
  let upperBound = maxScale;

  for (let iteration = 0; iteration < 28; iteration += 1) {
    const middle = (lowerBound + upperBound) / 2;

    if (isInsideHeart(x, y, centerX, centerY, middle)) {
      upperBound = middle;
    } else {
      lowerBound = middle;
    }
  }

  return upperBound;
}

function isInsideHeart(x, y, centerX, centerY, scale) {
  const normalizedX = (x - centerX) / scale;
  const normalizedY = (centerY - y) / scale;
  const heartValue = (normalizedX ** 2 + normalizedY ** 2 - 1) ** 3 - normalizedX ** 2 * normalizedY ** 3;

  return heartValue <= 0;
}
