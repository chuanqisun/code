import Matter from "https://esm.sh/matter-js@0.20.0";

const { Bodies, Body, Engine, Events, Runner, World } = Matter;

const BASE_CANVAS_WIDTH = 320;
const BASE_CANVAS_HEIGHT = 240;
const BASE_APPLE_RADIUS = 14;
const CENTER_SPAWN_JITTER_RATIO = 0.08;
const MASK_ROW_STEP = 2;
const APPLE_SPAWN_INTERVAL_MS = 333;
const DEFAULT_MAX_APPLES = Number.POSITIVE_INFINITY;
const APPLE_EMOJI = "🍎";
const BASE_APPLE_FONT_SIZE_PX = 28;

export function createApplePhysicsScene({ canvas, onAppleHit = () => {} }) {
  const ctx = canvas.getContext("2d");
  const engine = Engine.create();
  const runner = Runner.create();
  const appleSilhouetteSpriteCache = new Map();

  engine.world.gravity.y = 0.9;

  let walls = createWorldWalls(canvas.width, canvas.height);
  let rigidMaskBody = null;
  let appleBodies = [];
  let lastSpawnTimestamp = 0;
  let emissionStartTimestamp = Number.POSITIVE_INFINITY;
  let maxApples = DEFAULT_MAX_APPLES;
  let emittedAppleCount = 0;
  let lastAppleHitTimestamp = Number.NEGATIVE_INFINITY;
  let hasRegisteredHit = false;
  let hitAppleBody = null;
  let hasHitAppleClearedScreen = false;

  World.add(engine.world, walls);
  Events.on(engine, "collisionStart", handleCollisionStart);
  Runner.run(runner, engine);
  renderFrame();

  function updateMask(confidenceMask, width, height, threshold) {
    if (!confidenceMask || !width || !height) {
      clearMaskBody();
      return;
    }

    resizeScene(width, height);

    const mask = confidenceMask.getAsFloat32Array();
    const rectangles = [];

    for (let y = 0; y < height; y += MASK_ROW_STEP) {
      let runStart = -1;

      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const invertedIntensity = 255 - Math.max(0, Math.min(255, Math.round(mask[index] * 255)));
        const isSolid = invertedIntensity >= threshold;

        if (isSolid && runStart === -1) {
          runStart = x;
        }

        if ((!isSolid || x === width - 1) && runStart !== -1) {
          const runEnd = isSolid && x === width - 1 ? x + 1 : x;
          const runWidth = runEnd - runStart;

          if (runWidth >= 1) {
            rectangles.push(
              Bodies.rectangle(runStart + runWidth / 2, y + MASK_ROW_STEP / 2, runWidth, MASK_ROW_STEP, {
                isStatic: true,
                friction: 0.6,
                restitution: 0.2,
              })
            );
          }

          runStart = -1;
        }
      }
    }

    replaceMaskBody(rectangles);
    pruneOffscreenApples();
  }

  function renderFrame(timestamp = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spawnApples(timestamp);
    drawApples();
    pruneOffscreenApples();

    requestAnimationFrame(renderFrame);
  }

  function drawApples() {
    for (const appleBody of appleBodies) {
      ctx.save();
      ctx.translate(appleBody.position.x, appleBody.position.y);
      ctx.rotate(appleBody.angle);
      const appleFontSizePx = getAppleFontSize(canvas.width, canvas.height);

      if (hasRegisteredHit) {
        drawAppleSilhouette(ctx, getAppleSilhouetteSprite(appleSilhouetteSpriteCache, appleFontSizePx));
      } else {
        drawAppleEmoji(ctx, appleFontSizePx);
      }

      ctx.restore();
    }
  }

  function resizeScene(width, height) {
    if (canvas.width === width && canvas.height === height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;
    World.remove(engine.world, walls);
    walls = createWorldWalls(width, height);
    World.add(engine.world, walls);

    for (const appleBody of appleBodies) {
      const appleRadius = getAppleRadius(canvas.width, canvas.height);
      const clampedX = Math.min(Math.max(appleBody.position.x, appleRadius), width - appleRadius);
      Body.setPosition(appleBody, { x: clampedX, y: Math.min(appleBody.position.y, height - appleRadius) });
    }
  }

  function replaceMaskBody(rectangles) {
    clearMaskBody();

    if (!rectangles.length) {
      return;
    }

    rigidMaskBody = Body.create({
      parts: rectangles,
      isStatic: true,
      friction: 0.6,
      restitution: 0.2,
    });

    World.add(engine.world, rigidMaskBody);
  }

  function clearMaskBody() {
    if (!rigidMaskBody) {
      return;
    }

    World.remove(engine.world, rigidMaskBody);
    rigidMaskBody = null;
  }

  function pruneOffscreenApples() {
    const visibleApples = [];
    const appleRadius = getAppleRadius(canvas.width, canvas.height);
    const despawnMargin = appleRadius * 6;

    for (const appleBody of appleBodies) {
      const isVisible =
        appleBody.position.x >= -despawnMargin && appleBody.position.x <= canvas.width + despawnMargin && appleBody.position.y <= canvas.height + despawnMargin;

      if (isVisible) {
        visibleApples.push(appleBody);
        continue;
      }

      if (appleBody === hitAppleBody) {
        hitAppleBody = null;
        hasHitAppleClearedScreen = true;
      }

      World.remove(engine.world, appleBody);
    }

    appleBodies = visibleApples;
  }

  function spawnApples(timestamp) {
    if (timestamp < emissionStartTimestamp || emittedAppleCount >= maxApples) {
      return;
    }

    if (timestamp - lastSpawnTimestamp < APPLE_SPAWN_INTERVAL_MS) {
      return;
    }

    lastSpawnTimestamp = timestamp;

    const appleRadius = getAppleRadius(canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const jitterRange = canvas.width * CENTER_SPAWN_JITTER_RATIO;
    const spawnX = clamp(centerX + (Math.random() - 0.5) * jitterRange * 2, appleRadius, canvas.width - appleRadius);
    const appleBody = Bodies.circle(spawnX, -appleRadius * 2, appleRadius, {
      restitution: 0.85,
      friction: 0.01,
      frictionAir: 0.001,
      density: 0.0015,
    });

    Body.setAngularVelocity(appleBody, (Math.random() - 0.5) * 0.2);
    World.add(engine.world, appleBody);
    appleBodies.push(appleBody);
    emittedAppleCount += 1;
  }

  function handleCollisionStart(event) {
    if (!rigidMaskBody || hasRegisteredHit) {
      return;
    }

    for (const pair of event.pairs) {
      const bodyA = pair.bodyA.parent ?? pair.bodyA;
      const bodyB = pair.bodyB.parent ?? pair.bodyB;
      const appleBody = appleBodies.includes(bodyA) ? bodyA : appleBodies.includes(bodyB) ? bodyB : null;
      const otherBody = appleBody === bodyA ? bodyB : appleBody === bodyB ? bodyA : null;

      if (!appleBody || otherBody !== rigidMaskBody) {
        continue;
      }

      const timestamp = performance.now();

      if (timestamp - lastAppleHitTimestamp < 120) {
        continue;
      }

      lastAppleHitTimestamp = timestamp;
      hasRegisteredHit = true;
      hitAppleBody = appleBody;
      hasHitAppleClearedScreen = false;
      onAppleHit({
        timestamp,
        appleBody,
      });
      return;
    }
  }

  function startEmission({ delayMs = 0, maxCount = DEFAULT_MAX_APPLES } = {}) {
    emissionStartTimestamp = performance.now() + delayMs;
    maxApples = maxCount;
    emittedAppleCount = 0;
    lastSpawnTimestamp = emissionStartTimestamp - APPLE_SPAWN_INTERVAL_MS;
    hasRegisteredHit = false;
    hitAppleBody = null;
    hasHitAppleClearedScreen = false;
    lastAppleHitTimestamp = Number.NEGATIVE_INFINITY;
  }

  function stopEmission() {
    emissionStartTimestamp = Number.POSITIVE_INFINITY;
  }

  return {
    hasHitAppleClearedScreen: () => hasHitAppleClearedScreen,
    startEmission,
    stopEmission,
    updateMask,
  };
}

function createWorldWalls(width, height) {
  return [Bodies.rectangle(-20, height / 2, 40, height, { isStatic: true }), Bodies.rectangle(width + 20, height / 2, 40, height, { isStatic: true })];
}

function drawAppleEmoji(ctx, fontSizePx) {
  ctx.font = `${fontSizePx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(APPLE_EMOJI, 0, 0);
}

function getAppleSilhouetteSprite(cache, fontSizePx) {
  if (!cache.has(fontSizePx)) {
    cache.set(fontSizePx, createAppleSilhouetteSprite(APPLE_EMOJI, fontSizePx));
  }

  return cache.get(fontSizePx);
}

function drawAppleSilhouette(ctx, sprite) {
  if (!sprite) {
    drawFallbackAppleSilhouette(ctx);
    return;
  }

  ctx.drawImage(sprite.canvas, -sprite.offsetX, -sprite.offsetY, sprite.width, sprite.height);
}

function createAppleSilhouetteSprite(emoji, fontSizePx) {
  const spriteCanvas = document.createElement("canvas");
  const spriteSize = Math.ceil(fontSizePx * 2.5);

  spriteCanvas.width = spriteSize;
  spriteCanvas.height = spriteSize;

  const spriteCtx = spriteCanvas.getContext("2d", { willReadFrequently: true });

  if (!spriteCtx) {
    return null;
  }

  spriteCtx.clearRect(0, 0, spriteSize, spriteSize);
  spriteCtx.font = `${fontSizePx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  spriteCtx.textAlign = "center";
  spriteCtx.textBaseline = "middle";
  spriteCtx.fillText(emoji, spriteSize / 2, spriteSize / 2);

  const imageData = spriteCtx.getImageData(0, 0, spriteSize, spriteSize);
  const bounds = findOpaqueBounds(imageData.data, spriteSize, spriteSize);

  if (!bounds) {
    return null;
  }

  const { minX, minY, maxX, maxY } = bounds;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const croppedCanvas = document.createElement("canvas");

  croppedCanvas.width = width;
  croppedCanvas.height = height;

  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    return null;
  }

  const croppedImageData = croppedCtx.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = ((minY + y) * spriteSize + (minX + x)) * 4;
      const targetIndex = (y * width + x) * 4;
      const alpha = imageData.data[sourceIndex + 3];

      croppedImageData.data[targetIndex] = 255;
      croppedImageData.data[targetIndex + 1] = 255;
      croppedImageData.data[targetIndex + 2] = 255;
      croppedImageData.data[targetIndex + 3] = alpha;
    }
  }

  croppedCtx.putImageData(croppedImageData, 0, 0);

  return {
    canvas: croppedCanvas,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
  };
}

function findOpaqueBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX === -1 || maxY === -1) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function drawFallbackAppleSilhouette(ctx) {
  ctx.fillStyle = "#fff";
  const radius = getAppleRadius(ctx.canvas.width, ctx.canvas.height);

  ctx.beginPath();
  ctx.moveTo(0, radius * 1.05);
  ctx.bezierCurveTo(radius * 0.95, radius * 1.05, radius * 1.45, radius * 0.2, radius * 1.3, -radius * 0.35);
  ctx.bezierCurveTo(radius * 1.15, -radius * 1.1, radius * 0.35, -radius * 1.2, 0, -radius * 0.55);
  ctx.bezierCurveTo(-radius * 0.35, -radius * 1.2, -radius * 1.15, -radius * 1.1, -radius * 1.3, -radius * 0.35);
  ctx.bezierCurveTo(-radius * 1.45, radius * 0.2, -radius * 0.95, radius * 1.05, 0, radius * 1.05);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-radius * 0.1, -radius * 0.95);
  ctx.quadraticCurveTo(radius * 0.05, -radius * 1.4, radius * 0.32, -radius * 1.6);
  ctx.lineWidth = Math.max(2, radius * 0.14);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(radius * 0.48, -radius * 1.18, radius * 0.36, radius * 0.18, -0.55, 0, Math.PI * 2);
  ctx.fill();
}

function getAppleRadius(width, height) {
  const widthScale = width / BASE_CANVAS_WIDTH;
  const heightScale = height / BASE_CANVAS_HEIGHT;
  return Math.max(8, Math.round(BASE_APPLE_RADIUS * Math.min(widthScale, heightScale)));
}

function getAppleFontSize(width, height) {
  const widthScale = width / BASE_CANVAS_WIDTH;
  const heightScale = height / BASE_CANVAS_HEIGHT;
  return Math.max(16, Math.round(BASE_APPLE_FONT_SIZE_PX * Math.min(widthScale, heightScale)));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
