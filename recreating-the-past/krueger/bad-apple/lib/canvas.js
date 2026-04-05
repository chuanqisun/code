export class CanvasSurface {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  getSize() {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  paintFrame(frame) {
    resizeCanvas(this.canvas, frame.width, frame.height);
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }

  captureImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  paintImageData(output, width, height) {
    this.#paintImageData(output, width, height);
    return output;
  }

  paintExplodedFrame(sourceImageData, foregroundMask, elapsed, effectState, options = {}) {
    if (!sourceImageData || !foregroundMask?.sourceMask || !foregroundMask?.mirrorMask) {
      return null;
    }

    const particles = effectState.particles ?? createExplodeParticles(sourceImageData, foregroundMask, options);

    if (!effectState.particles) {
      effectState.particles = particles;
    }

    const output = cloneImageData(sourceImageData);
    const outputPixels = output.data;
    let hasVisibleParticles = false;

    clearForeground(outputPixels, foregroundMask, options);

    for (const particle of particles) {
      const travel = particle.speed * elapsed;

      if (travel > particle.maxTravel) {
        continue;
      }

      const drift = particle.spin * travel * 0.02;
      const x = particle.originX + particle.velocityX * travel + Math.cos(drift) * particle.wobble;
      const y = particle.originY + particle.velocityY * travel + Math.sin(drift) * particle.wobble;
      const size = particle.size;

      if (!isParticleVisible(x, y, size, output.width, output.height)) {
        continue;
      }

      stampParticle(output, particle, Math.round(x), Math.round(y), size);
      hasVisibleParticles = true;
    }

    if (!hasVisibleParticles && elapsed < EXPLOSION_VISIBILITY_HOLD_MS) {
      hasVisibleParticles = true;
    }

    this.#paintImageData(output, output.width, output.height);

    return { output, hasVisibleParticles };
  }

  paintGeneratedImage(createImage, ...args) {
    const output = createImage(...args);
    const width = args[1];
    const height = args[2];
    this.#paintImageData(output, width, height);
    return output;
  }

  paintPoints(points, width, height) {
    if (!width || !height) {
      return;
    }

    this.ctx.fillStyle = "#ff0000";

    for (const point of points ?? []) {
      if (!point) {
        continue;
      }

      drawMarkerDot(this.ctx, point.x * width, point.y * height);
    }
  }

  #paintImageData(output, width, height) {
    if (!output) {
      return;
    }

    resizeCanvas(this.canvas, width, height);
    this.ctx.putImageData(output, 0, 0);
  }
}

const EXPLOSION_VISIBILITY_HOLD_MS = 6000;

function createExplodeParticles(sourceImageData, foregroundMask, options) {
  const { width, height, data } = sourceImageData;
  const dividerX = options.dividerX ?? foregroundMask.meta?.dividerX ?? width / 2;
  const blockSize = options.blockSize ?? 3;
  const particles = [];

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const blockVariants = sampleForegroundBlockVariants(data, foregroundMask, width, height, x, y, blockSize, dividerX);

      for (const block of blockVariants) {
        if (!block.isForeground) {
          continue;
        }

        const originX = x + blockSize / 2;
        const originY = y + blockSize / 2;
        const baseAngle = Math.atan2(originY - height / 2, originX - dividerX);
        const angleJitter = ((originX * 13 + originY * 7 + block.variantSeed) % 17) / 17 - 0.5;
        const angle = baseAngle + angleJitter * 0.7;
        const horizontalBias = block.side === "right" ? 1 : -1;
        const velocityX = Math.cos(angle) * 0.7 + horizontalBias * 0.55;
        const velocityY = Math.sin(angle) * 0.9;
        const magnitude = Math.hypot(velocityX, velocityY) || 1;
        const seeded = seededUnit(originX + block.variantSeed, originY + block.variantSeed);
        const normalizedVelocityX = velocityX / magnitude;
        const normalizedVelocityY = velocityY / magnitude;
        const speed = options.particleSpeed ?? 0.12 + seeded * 0.18;
        const size = Math.max(1, Math.round(blockSize * (0.8 + seeded * 0.7)));

        particles.push({
          originX,
          originY,
          velocityX: normalizedVelocityX,
          velocityY: normalizedVelocityY,
          speed,
          maxTravel: computeMaxTravel(originX, originY, normalizedVelocityX, normalizedVelocityY, size, width, height),
          size,
          wobble: 2 + seeded * 5,
          spin: horizontalBias * (0.5 + seeded),
          color: block.color,
        });
      }
    }
  }

  return particles;
}

function sampleForegroundBlockVariants(sourcePixels, foregroundMask, width, height, startX, startY, blockSize, dividerX) {
  const sourceTotals = createColorTotals();
  const mirrorTotals = createColorTotals();
  const meta = foregroundMask.meta ?? {};
  const sourceMaskPixels = foregroundMask.sourceMask.data;
  const mirrorMaskPixels = foregroundMask.mirrorMask.data;

  for (let offsetY = 0; offsetY < blockSize; offsetY += 1) {
    const y = startY + offsetY;

    if (y >= height) {
      break;
    }

    for (let offsetX = 0; offsetX < blockSize; offsetX += 1) {
      const x = startX + offsetX;

      if (x >= width) {
        break;
      }

      const pixelIndex = (y * width + x) * 4;

      if (isSourceForegroundPixel(sourceMaskPixels, pixelIndex, x, meta, dividerX)) {
        accumulateColor(sourceTotals, sourcePixels, pixelIndex);
      }

      if (isMirrorForegroundPixel(mirrorMaskPixels, pixelIndex, x, meta, dividerX)) {
        accumulateColor(mirrorTotals, sourcePixels, pixelIndex);
      }
    }
  }

  return [
    {
      isForeground: sourceTotals.count > 0,
      color: [255, 255, 255],
      side: meta.sourceSide ?? inferSide(startX, dividerX),
      variantSeed: 0,
    },
    {
      isForeground: mirrorTotals.count > 0,
      color: [0, 0, 0],
      side: meta.mirrorSide ?? invertSide(inferSide(startX, dividerX)),
      variantSeed: 101,
    },
  ];
}

function clearForeground(outputPixels, foregroundMask, options) {
  const sourceMaskPixels = foregroundMask.sourceMask.data;
  const mirrorMaskPixels = foregroundMask.mirrorMask.data;
  const dividerX = options.dividerX ?? foregroundMask.meta?.dividerX ?? foregroundMask.width / 2;

  for (let pixelIndex = 0; pixelIndex < outputPixels.length; pixelIndex += 4) {
    const x = (pixelIndex / 4) % foregroundMask.sourceMask.width;
    const isSourcePixel = isSourceForegroundPixel(sourceMaskPixels, pixelIndex, x, foregroundMask.meta, dividerX);
    const isMirrorPixel = isMirrorForegroundPixel(mirrorMaskPixels, pixelIndex, x, foregroundMask.meta, dividerX);

    if (!isSourcePixel && !isMirrorPixel) {
      continue;
    }

    const fillValue = isSourcePixel ? 0 : 255;

    outputPixels[pixelIndex] = fillValue;
    outputPixels[pixelIndex + 1] = fillValue;
    outputPixels[pixelIndex + 2] = fillValue;
    outputPixels[pixelIndex + 3] = 255;
  }
}

function stampParticle(imageData, particle, centerX, centerY, size) {
  const { width, height, data } = imageData;
  const radius = Math.max(1, Math.floor(size / 2));

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    const y = centerY + offsetY;

    if (y < 0 || y >= height) {
      continue;
    }

    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const x = centerX + offsetX;

      if (x < 0 || x >= width) {
        continue;
      }

      const pixelIndex = (y * width + x) * 4;

      data[pixelIndex] = particle.color[0];
      data[pixelIndex + 1] = particle.color[1];
      data[pixelIndex + 2] = particle.color[2];
      data[pixelIndex + 3] = 255;
    }
  }
}

function isParticleVisible(x, y, size, width, height) {
  const radius = Math.max(1, Math.floor(size / 2));

  return x + radius >= 0 && x - radius < width && y + radius >= 0 && y - radius < height;
}

function computeMaxTravel(originX, originY, velocityX, velocityY, size, width, height) {
  const radius = Math.max(1, Math.floor(size / 2));
  const bounds = [
    velocityX > 0 ? (width - 1 + radius - originX) / velocityX : Number.POSITIVE_INFINITY,
    velocityX < 0 ? (0 - radius - originX) / velocityX : Number.POSITIVE_INFINITY,
    velocityY > 0 ? (height - 1 + radius - originY) / velocityY : Number.POSITIVE_INFINITY,
    velocityY < 0 ? (0 - radius - originY) / velocityY : Number.POSITIVE_INFINITY,
  ].filter((distance) => Number.isFinite(distance) && distance >= 0);

  return bounds.length > 0 ? Math.min(...bounds) : 0;
}

function isSourceForegroundPixel(maskPixels, pixelIndex, x, meta, dividerX) {
  const sourceSide = meta?.sourceSide ?? inferSide(x, dividerX);
  const inSourceHalf = sourceSide === "left" ? x <= dividerX : x >= dividerX;

  return inSourceHalf && maskPixels[pixelIndex] > 250;
}

function isMirrorForegroundPixel(maskPixels, pixelIndex, x, meta, dividerX) {
  const mirrorSide = meta?.mirrorSide ?? invertSide(inferSide(x, dividerX));
  const inMirrorHalf = mirrorSide === "left" ? x < dividerX : x > dividerX;

  return inMirrorHalf && maskPixels[pixelIndex] < 5;
}

function inferSide(x, dividerX) {
  return x <= dividerX ? "left" : "right";
}

function invertSide(side) {
  return side === "left" ? "right" : "left";
}

function createColorTotals() {
  return {
    count: 0,
  };
}

function accumulateColor(totals, sourcePixels, pixelIndex) {
  totals.count += 1;
}

function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function seededUnit(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

function resizeCanvas(canvas, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawMarkerDot(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}
