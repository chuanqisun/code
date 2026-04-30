import * as THREE from "https://esm.sh/three@0.180.0/build/three.module.js";
import { font } from "../font.js";

export const DISPLAY_SEQUENCE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const BLANK_CHARACTER = "-";

const DEFAULT_CUBE_SIZE = 0.82;
const BOLD_EDGE_RADIUS = 0.025;
const LEFT_TRANSITION_DIRECTION = -1;
const RIGHT_TRANSITION_DIRECTION = 1;
const MIN_RANDOM_BOLD_EDGES = 3;
const MAX_RANDOM_BOLD_EDGES = 5;
const DEFAULT_RANDOM_EDGE_INTERVAL_MS = 1000;

function createEdgePoints(cubeSize) {
  const half = cubeSize / 2;

  return [
    [
      [-half, -half, -half],
      [half, -half, -half],
    ],
    [
      [half, -half, -half],
      [half, half, -half],
    ],
    [
      [half, half, -half],
      [-half, half, -half],
    ],
    [
      [-half, half, -half],
      [-half, -half, -half],
    ],
    [
      [-half, -half, half],
      [half, -half, half],
    ],
    [
      [half, -half, half],
      [half, half, half],
    ],
    [
      [half, half, half],
      [-half, half, half],
    ],
    [
      [-half, half, half],
      [-half, -half, half],
    ],
    [
      [-half, -half, -half],
      [-half, -half, half],
    ],
    [
      [half, -half, -half],
      [half, -half, half],
    ],
    [
      [half, half, -half],
      [half, half, half],
    ],
    [
      [-half, half, -half],
      [-half, half, half],
    ],
  ];
}

function toRadians(rotation) {
  return {
    x: THREE.MathUtils.degToRad(rotation.x),
    y: THREE.MathUtils.degToRad(rotation.y),
    z: THREE.MathUtils.degToRad(rotation.z),
  };
}

const characterMap = Object.fromEntries(
  Object.entries(font).map(([character, config]) => [
    character.toUpperCase(),
    {
      boldEdges: config.boldEdges,
      rotation: toRadians(config.rotation),
    },
  ])
);

function normalizeCharacter(character) {
  const normalized = String(character ?? "")
    .trim()
    .toUpperCase();

  if (normalized === BLANK_CHARACTER) {
    return BLANK_CHARACTER;
  }

  if (!characterMap[normalized]) {
    throw new Error(`Unsupported display character: ${character}`);
  }

  return normalized;
}

function createMotion(rotation, startTimeMs) {
  const directionX = Math.random() < 0.5 ? -1 : 1;
  const directionY = Math.random() < 0.5 ? -1 : 1;
  const directionZ = Math.random() < 0.5 ? -1 : 1;

  return {
    baseX: rotation.x,
    baseY: rotation.y,
    baseZ: rotation.z,
    startTimeSeconds: startTimeMs / 1000,
    velocityX: directionX * (0.45 + Math.random() * 0.65),
    velocityY: directionY * (0.45 + Math.random() * 0.65),
    velocityZ: directionZ * (0.3 + Math.random() * 0.5),
  };
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function cloneRotation(source) {
  return {
    x: source.x,
    y: source.y,
    z: source.z,
  };
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function shortestAngleDelta(start, target) {
  return wrapAngle(target - start);
}

function chooseExpandedTargetAngle(start, target, direction) {
  const delta = shortestAngleDelta(start, target);
  const extraTurns = 1;
  const directionMatchesDelta = Math.abs(delta) > 0.0001 && Math.sign(delta) === direction;
  const turns = directionMatchesDelta || Math.abs(delta) <= 0.0001 ? extraTurns : extraTurns + 1;

  return start + delta + direction * turns * Math.PI * 2;
}

function chooseExpandedTargetRotation(start, target, direction) {
  return {
    x: chooseExpandedTargetAngle(start.x, target.x, direction),
    y: chooseExpandedTargetAngle(start.y, target.y, direction),
    z: chooseExpandedTargetAngle(start.z, target.z, direction),
  };
}

function createBoldEdgeProgresses(indices, edgeCount) {
  const visibleEdges = new Set(indices);

  return Array.from({ length: edgeCount }, (_, index) => (visibleEdges.has(index) ? 1 : 0));
}

function interpolateValues(startValues, targetValues, progress) {
  return startValues.map((startValue, index) => THREE.MathUtils.lerp(startValue, targetValues[index], progress));
}

function arraysMatch(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function randomIntInclusive(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffleIndices(length) {
  const indices = Array.from({ length }, (_, index) => index);

  for (let index = indices.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }

  return indices;
}

function createRandomBoldEdgeProgresses(edgeCount, previousProgresses = null) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const progresses = new Array(edgeCount).fill(0);
    const activeCount = randomIntInclusive(MIN_RANDOM_BOLD_EDGES, Math.min(MAX_RANDOM_BOLD_EDGES, edgeCount));
    const indices = shuffleIndices(edgeCount).slice(0, activeCount);

    indices.forEach((index) => {
      progresses[index] = 1;
    });

    if (!arraysMatch(progresses, previousProgresses)) {
      return progresses;
    }
  }

  return createBoldEdgeProgresses(shuffleIndices(edgeCount).slice(0, MIN_RANDOM_BOLD_EDGES), edgeCount);
}

class SplitCubeHalf {
  constructor({ cubeGeometry, edgeGeometry, cylinderGeometry, edgePoints, splitX, side, color }) {
    this.group = new THREE.Group();
    this.materials = this.createMaterials(splitX, side, color);
    this.boldEdges = [];

    const shell = new THREE.Mesh(cubeGeometry, this.materials.depth);
    shell.renderOrder = 0;
    this.group.add(shell);

    const edges = new THREE.LineSegments(edgeGeometry, this.materials.line);
    edges.renderOrder = 2;
    this.group.add(edges);

    edgePoints.forEach(([startPoint, endPoint]) => {
      const start = new THREE.Vector3(...startPoint);
      const end = new THREE.Vector3(...endPoint);
      const direction = new THREE.Vector3().subVectors(end, start);
      const unitDirection = direction.clone().normalize();
      const length = direction.length();

      const cylinder = new THREE.Mesh(cylinderGeometry, this.materials.bold);
      cylinder.position.copy(start);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDirection);
      cylinder.renderOrder = 3;
      cylinder.visible = false;

      this.boldEdges.push({
        mesh: cylinder,
        start,
        unitDirection,
        length,
      });
      this.group.add(cylinder);
    });
  }

  createMaterials(splitX, side, color) {
    const plane = side === "left" ? new THREE.Plane(new THREE.Vector3(-1, 0, 0), splitX) : new THREE.Plane(new THREE.Vector3(1, 0, 0), -splitX);

    return {
      line: new THREE.LineBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        clippingPlanes: [plane],
      }),
      bold: new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        clippingPlanes: [plane],
      }),
      depth: new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
        clippingPlanes: [plane],
      }),
    };
  }

  setBoldEdgeProgresses(progresses) {
    this.boldEdges.forEach((edge, index) => {
      const progress = THREE.MathUtils.clamp(progresses[index] ?? 0, 0, 1);
      const visible = progress > 0.0001;

      edge.mesh.visible = visible;

      if (!visible) {
        edge.mesh.position.copy(edge.start);
        edge.mesh.scale.set(1, 0.000001, 1);
        return;
      }

      edge.mesh.scale.set(1, progress, 1);
      edge.mesh.position.copy(edge.start).addScaledVector(edge.unitDirection, (edge.length * progress) / 2);
    });
  }

  setRotation(rotation) {
    this.group.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  getRotation() {
    return cloneRotation(this.group.rotation);
  }
}

export class SplitCubePairDisplay {
  constructor({ scene, splitX, x = 0, y = 0, z = 0, cubeSize = DEFAULT_CUBE_SIZE, color = 0x000000 }) {
    this.object3d = new THREE.Group();
    this.object3d.position.set(x, y, z);

    const edgePoints = createEdgePoints(cubeSize);
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
    const cylinderGeometry = new THREE.CylinderGeometry(BOLD_EDGE_RADIUS, BOLD_EDGE_RADIUS, cubeSize, 12);

    this.leftHalf = new SplitCubeHalf({ cubeGeometry, edgeGeometry, cylinderGeometry, edgePoints, splitX, side: "left", color });
    this.rightHalf = new SplitCubeHalf({ cubeGeometry, edgeGeometry, cylinderGeometry, edgePoints, splitX, side: "right", color });

    this.object3d.add(this.leftHalf.group);
    this.object3d.add(this.rightHalf.group);
    scene.add(this.object3d);

    this.currentCharacter = null;
    this.mode = "static";
    this.transition = null;
    this.leftMotion = null;
    this.rightMotion = null;
    this.randomEdgeTransition = null;
    this.currentEdgeProgresses = new Array(edgePoints.length).fill(0);

    this.leftHalf.setRotation(this.randomRotation());
    this.rightHalf.setRotation(this.randomRotation());
    this.applyBoldEdgeProgresses(this.currentEdgeProgresses);
  }

  randomRotation() {
    return {
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 2.4,
      z: (Math.random() - 0.5) * 1.2,
    };
  }

  startRandomMotion(startTimeMs = performance.now(), edgeIntervalMs = DEFAULT_RANDOM_EDGE_INTERVAL_MS, options = {}) {
    this.syncState(startTimeMs);

    const { immediateEdges = false } = options;
    const durationMs = Math.max(1, edgeIntervalMs);
    const targetEdgeProgresses = createRandomBoldEdgeProgresses(this.currentEdgeProgresses.length, this.currentEdgeProgresses);

    this.mode = "random";
    this.transition = null;
    this.leftMotion = createMotion(this.leftHalf.getRotation(), startTimeMs);
    this.rightMotion = createMotion(this.rightHalf.getRotation(), startTimeMs);

    if (immediateEdges) {
      this.applyBoldEdgeProgresses(targetEdgeProgresses);
    }

    this.randomEdgeTransition = {
      startTimeMs,
      durationMs,
      startEdgeProgresses: immediateEdges ? [...targetEdgeProgresses] : [...this.currentEdgeProgresses],
      targetEdgeProgresses,
    };
  }

  setCharacter(character, durationMs = 1000, startTimeMs = performance.now()) {
    this.syncState(startTimeMs);

    const normalized = normalizeCharacter(character);
    const target = normalized === BLANK_CHARACTER ? null : characterMap[normalized];
    const targetRotation = target ? target.rotation : { x: 0, y: 0, z: 0 };
    const targetEdgeProgresses = target
      ? createBoldEdgeProgresses(target.boldEdges, this.currentEdgeProgresses.length)
      : new Array(this.currentEdgeProgresses.length).fill(0);

    if (durationMs <= 0) {
      this.leftHalf.setRotation(targetRotation);
      this.rightHalf.setRotation(targetRotation);
      this.applyBoldEdgeProgresses(targetEdgeProgresses);
      this.currentCharacter = normalized;
      this.mode = "static";
      this.transition = null;
      this.randomEdgeTransition = null;
      return;
    }

    this.mode = "transition";
    this.currentCharacter = normalized;
    this.randomEdgeTransition = null;
    const leftStartRotation = this.leftHalf.getRotation();
    const rightStartRotation = this.rightHalf.getRotation();

    this.transition = {
      startTimeMs,
      durationMs,
      targetRotation,
      startEdgeProgresses: [...this.currentEdgeProgresses],
      targetEdgeProgresses,
      leftStartRotation,
      rightStartRotation,
      leftTransitionTarget: chooseExpandedTargetRotation(leftStartRotation, targetRotation, LEFT_TRANSITION_DIRECTION),
      rightTransitionTarget: chooseExpandedTargetRotation(rightStartRotation, targetRotation, RIGHT_TRANSITION_DIRECTION),
    };
  }

  update(nowMs) {
    this.syncState(nowMs);
  }

  syncState(nowMs) {
    if (this.mode === "random") {
      const nowSeconds = nowMs / 1000;
      this.leftHalf.setRotation(this.evaluateMotion(this.leftMotion, nowSeconds));
      this.rightHalf.setRotation(this.evaluateMotion(this.rightMotion, nowSeconds));
      this.syncRandomEdges(nowMs);
      return;
    }

    if (this.mode !== "transition" || !this.transition) {
      return;
    }

    const progress = THREE.MathUtils.clamp((nowMs - this.transition.startTimeMs) / this.transition.durationMs, 0, 1);
    const eased = easeInOutCubic(progress);

    this.leftHalf.setRotation(this.interpolateRotation(this.transition.leftStartRotation, this.transition.leftTransitionTarget, eased));
    this.rightHalf.setRotation(this.interpolateRotation(this.transition.rightStartRotation, this.transition.rightTransitionTarget, eased));
    this.applyBoldEdgeProgresses(interpolateValues(this.transition.startEdgeProgresses, this.transition.targetEdgeProgresses, eased));

    if (progress >= 1) {
      this.mode = "static";
      this.leftHalf.setRotation(this.transition.targetRotation);
      this.rightHalf.setRotation(this.transition.targetRotation);
      this.applyBoldEdgeProgresses(this.transition.targetEdgeProgresses);
      this.transition = null;
    }
  }

  syncRandomEdges(nowMs) {
    if (!this.randomEdgeTransition) {
      return;
    }

    while (nowMs >= this.randomEdgeTransition.startTimeMs + this.randomEdgeTransition.durationMs) {
      this.applyBoldEdgeProgresses(this.randomEdgeTransition.targetEdgeProgresses);

      this.randomEdgeTransition = {
        startTimeMs: this.randomEdgeTransition.startTimeMs + this.randomEdgeTransition.durationMs,
        durationMs: this.randomEdgeTransition.durationMs,
        startEdgeProgresses: [...this.currentEdgeProgresses],
        targetEdgeProgresses: createRandomBoldEdgeProgresses(this.currentEdgeProgresses.length, this.currentEdgeProgresses),
      };
    }

    const progress = THREE.MathUtils.clamp((nowMs - this.randomEdgeTransition.startTimeMs) / this.randomEdgeTransition.durationMs, 0, 1);
    const eased = easeInOutCubic(progress);

    this.applyBoldEdgeProgresses(interpolateValues(this.randomEdgeTransition.startEdgeProgresses, this.randomEdgeTransition.targetEdgeProgresses, eased));
  }

  applyBoldEdgeProgresses(progresses) {
    this.currentEdgeProgresses = [...progresses];
    this.leftHalf.setBoldEdgeProgresses(progresses);
    this.rightHalf.setBoldEdgeProgresses(progresses);
  }

  evaluateMotion(motion, nowSeconds) {
    const elapsed = nowSeconds - motion.startTimeSeconds;

    return {
      x: motion.baseX + elapsed * motion.velocityX,
      y: motion.baseY + elapsed * motion.velocityY,
      z: motion.baseZ + elapsed * motion.velocityZ,
    };
  }

  interpolateRotation(start, target, progress) {
    return {
      x: THREE.MathUtils.lerp(start.x, target.x, progress),
      y: THREE.MathUtils.lerp(start.y, target.y, progress),
      z: THREE.MathUtils.lerp(start.z, target.z, progress),
    };
  }
}
