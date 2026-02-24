// ── Constants & configuration ─────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";
const VB_BASE = 1.5;
let vbHalfX = VB_BASE;
let vbHalfY = VB_BASE;
const DOT_RADIUS = "0.005";
const FONT_SIZE_SVG = "0.035";
const FONT_FAMILY_SVG = "ui-monospace,'Courier New',monospace";
const RULER_TICK_LEN = 0.02;
const RULER_TICK_STEP = 0.05;
const RULER_MARKER_LEN = 0.04;
const BLINK_HALF_CYCLES = 6; // 3 blinks × 2
const BLINK_INTERVAL_MS = 40;
const TOOLTIP_MARGIN = 12;

// Demo timing
const DEMO_INITIAL_DELAY = 500;
const DEMO_MOVE_DURATION = 1000;
const DEMO_PAUSE_BEFORE_CONFIRM = 500;
const DEMO_PAUSE_AFTER_CONFIRM = 500;

const VERTEX = {
  A: { x: 0, y: -1 },
  B: { x: -Math.sqrt(3) / 2, y: 0.5 },
  C: { x: Math.sqrt(3) / 2, y: 0.5 },
};

// ── Audio system ──────────────────────────────────────────────────────────────

let audioCtx = null;
let masterGain = null;
let soundEnabled = false;
let ambientMasterGain = null;
let ambientNodes = [];
let ambientPlaying = false;

function ensureAudioCtx() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioCtx.destination);
}

function playConfirmSound() {
  if (!soundEnabled) return;
  ensureAudioCtx();
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(masterGain);

  // Low-Pitch Chime (C4 → E4)
  osc.type = "sine";
  osc.frequency.setValueAtTime(261.63, t); // C4
  osc.frequency.setValueAtTime(329.63, t + 0.1); // E4

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
  gain.gain.setValueAtTime(0.4, t + 0.1);
  gain.gain.linearRampToValueAtTime(0.6, t + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

  osc.start(t);
  osc.stop(t + 0.4);
}

function playHoverSound() {
  if (!soundEnabled) return;
  ensureAudioCtx();
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(masterGain);

  // High-Tech Tick
  osc.type = "sine";
  osc.frequency.setValueAtTime(2000, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.03);

  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

  osc.start(t);
  osc.stop(t + 0.03);
}

// ── Ambient soundtrack ────────────────────────────────────────────────────────

function createBrownNoise() {
  const bufferSize = audioCtx.sampleRate * 5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    output[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5;
  }
  return buffer;
}

function startAmbient() {
  if (ambientPlaying) return;
  ensureAudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  ambientPlaying = true;

  ambientMasterGain = audioCtx.createGain();
  ambientMasterGain.gain.value = 0;

  // Cavernous delay network
  const delay = audioCtx.createDelay();
  delay.delayTime.value = 0.8;
  const feedback = audioCtx.createGain();
  feedback.gain.value = 0.6;
  const delayFilter = audioCtx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 1000;

  ambientMasterGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delayFilter);
  delayFilter.connect(delay);

  ambientMasterGain.connect(audioCtx.destination);
  delay.connect(audioCtx.destination);

  const t = audioCtx.currentTime;

  // Deep drone (detuned oscillators)
  const baseFreq = 43.65; // F1
  const frequencies = [baseFreq, baseFreq * 1.01, baseFreq * 1.5, baseFreq * 2.01];

  const droneFilter = audioCtx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 150;
  droneFilter.Q.value = 2;
  droneFilter.connect(ambientMasterGain);

  // LFO for breathing effect
  const lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.05;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 100;
  lfo.connect(lfoGain);
  lfoGain.connect(droneFilter.frequency);
  lfo.start(t);
  ambientNodes.push(lfo);

  frequencies.forEach((freq) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const oscGain = audioCtx.createGain();
    oscGain.gain.value = 0.15;
    osc.connect(oscGain);
    oscGain.connect(droneFilter);
    osc.start(t);
    ambientNodes.push(osc);
  });

  // Rumble (filtered brown noise)
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = createBrownNoise();
  noiseSource.loop = true;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 80;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.8;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ambientMasterGain);
  noiseSource.start(t);
  ambientNodes.push(noiseSource);

  // Fade in over 4 seconds
  ambientMasterGain.gain.linearRampToValueAtTime(0.5, t + 4.0);
}

function stopAmbient() {
  if (!ambientPlaying || !ambientMasterGain) return;
  ambientPlaying = false;

  const t = audioCtx.currentTime;
  ambientMasterGain.gain.cancelScheduledValues(t);
  ambientMasterGain.gain.setValueAtTime(ambientMasterGain.gain.value, t);
  ambientMasterGain.gain.linearRampToValueAtTime(0.001, t + 3.0);

  const nodesToStop = ambientNodes.slice();
  ambientNodes = [];
  nodesToStop.forEach((node) => {
    try {
      node.stop(t + 3.1);
    } catch (_) {}
  });
}

// ── DOM references ────────────────────────────────────────────────────────────

const tooltip = document.getElementById("tooltip");
const wordsLayer = document.getElementById("words-layer");
const hoverLayer = document.getElementById("hover-layer");
const svg = document.getElementById("svg");
const canvasWrap = document.getElementById("canvas-wrap");

// ── Mutable state ─────────────────────────────────────────────────────────────

let projectedPoints = [];
let nearestPoint = null;
let visitedPoints = [];
let visitedSet = new Set();

let hoverMarker = null;
let hoverEdges = [];
let hoverEdgeLabels = [];
let hoverCursorMarker = null;
let hoverCursorLink = null;
let lastVisitedLine = null;
let lastVisitedLabel = null;
let rulerMarkers = { top: null, bottom: null, left: null, right: null };
let rulerMarkersMatch = { top: null, bottom: null, left: null, right: null };
let pathPreviewLine = null;
let demoActive = false;
let demoRafId = null;
let trackingActive = false;
let cursorSvg = null;

// ── SVG layer setup ───────────────────────────────────────────────────────────

const pathLayer = createSvgElement("g", { id: "path-layer" });
svg.insertBefore(pathLayer, hoverLayer);

const rulerLayer = createSvgElement("g", { id: "ruler-layer" });
svg.insertBefore(rulerLayer, svg.firstChild);

// ── Responsive viewBox ─────────────────────────────────────────────────────────

function updateViewBox() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  if (!w || !h) return;
  const aspect = w / h;
  if (aspect >= 1) {
    vbHalfY = VB_BASE;
    vbHalfX = VB_BASE * aspect;
  } else {
    vbHalfX = VB_BASE;
    vbHalfY = VB_BASE / aspect;
  }
  svg.setAttribute("viewBox", `${f5(-vbHalfX)} ${f5(-vbHalfY)} ${f5(vbHalfX * 2)} ${f5(vbHalfY * 2)}`);
  rebuildRulers();
  requestAnimationFrame(updateVertexLabelBackgrounds);
}

new ResizeObserver(() => updateViewBox()).observe(canvasWrap);

// ── Initialization ────────────────────────────────────────────────────────────

updateViewBox();
const demo = new URLSearchParams(window.location.search).get("demo") !== "off";

// Load compressed data (no server needed)
const dataReady = loadCompressedData();
requestAnimationFrame(updateVertexLabelBackgrounds);
initToggles(demo);

// ── Data loading (client-side only) ───────────────────────────────────────────

async function loadCompressedData() {
  const loadingMsg = document.getElementById("loading-msg");
  const btnStart = document.getElementById("btn-start");

  try {
    const res = await fetch("data/oxford-3000-compressed.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    raw.forEach(([word, mathX, mathY]) => {
      const { x: sx, y: sy } = mathToSvg(mathX, mathY);
      if (isOutOfBounds(sx, sy)) return;

      const dot = createSvgElement("circle", { class: "word-dot", cx: f5(sx), cy: f5(sy), r: DOT_RADIUS });
      wordsLayer.appendChild(dot);

      projectedPoints.push({ word, sx, sy, dotEl: dot });
    });

    loadingMsg.classList.add("hidden");
    btnStart.disabled = false;
  } catch (err) {
    console.error("Failed to load data:", err);
    loadingMsg.textContent = "failed to load data";
  }
}

// ── Splash gate ───────────────────────────────────────────────────────────────

const splash = document.getElementById("splash");
const btnStart = document.getElementById("btn-start");

btnStart.addEventListener("click", async () => {
  splash.classList.add("hidden");

  // Enable sound by default (user gesture satisfies autoplay policy)
  soundEnabled = true;
  setToggle(document.getElementById("btn-sound"), true);
  startAmbient();

  await dataReady;
  if (demo) startDemo();
});

// ── HUD toggles ──────────────────────────────────────────────────────────────

function initToggles(autoOn) {
  const btnAuto = document.getElementById("btn-auto");
  const btnSound = document.getElementById("btn-sound");

  // Auto toggle reflects initial demo state
  setToggle(btnAuto, autoOn);

  btnAuto.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = btnAuto.getAttribute("aria-pressed") !== "true";
    setToggle(btnAuto, next);
    if (next) {
      if (!demoActive) startDemo();
    } else {
      if (demoActive) {
        stopDemo();
        canvasWrap.classList.add("cursor-hidden");
      }
    }
  });

  // Sound toggle (on by default after splash)
  setToggle(btnSound, false);

  btnSound.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = btnSound.getAttribute("aria-pressed") !== "true";
    setToggle(btnSound, next);
    soundEnabled = next;
    if (next) {
      ensureAudioCtx();
      startAmbient();
    } else {
      stopAmbient();
    }
  });
}

function setToggle(btn, on) {
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  const label = btn.textContent.split(":")[0].trim();
  btn.textContent = `${label}: ${on ? "on" : "off"}`;
}

// ── Event handlers ────────────────────────────────────────────────────────────

canvasWrap.addEventListener("mousemove", handleMouseMove);
canvasWrap.addEventListener("mouseleave", handleMouseLeave);
canvasWrap.addEventListener("click", handleClick);

function handleMouseMove(event) {
  if (demoActive) return;
  if (!trackingActive || !projectedPoints.length) {
    clearCursorDisplay();
    return;
  }
  const svgCoords = mouseEventToSvg(event);
  if (!svgCoords) {
    clearCursorDisplay();
    return;
  }
  setCursorPosition(svgCoords);
}

function handleMouseLeave() {
  if (demoActive) return;
  clearCursorDisplay();
}

function handleClick(event) {
  if (demoActive) {
    stopDemo();
    setToggle(document.getElementById("btn-auto"), false);
    canvasWrap.classList.add("cursor-hidden");
  }
  if (!trackingActive) {
    trackingActive = true;
    canvasWrap.classList.add("tracking");
    handleMouseMove(event);
    return;
  }
  if (!nearestPoint) return;
  confirmPoint(nearestPoint);
  setCursorPosition(cursorSvg); // re-render with updated visited state
  blinkConfirmation();
}

function confirmPoint(point) {
  const idx = projectedPoints.indexOf(point);
  if (idx === -1) return false;
  visitedSet.add(idx);
  visitedPoints.push(point);
  point.dotEl.classList.add("visited");
  point.dotEl.style.fillOpacity = "1";
  renderPath();
  playConfirmSound();
  return true;
}

// ── Shared cursor layer ──────────────────────────────────────────────────────

function setCursorPosition(svgCoords) {
  cursorSvg = svgCoords;
  if (!cursorSvg || !projectedPoints.length) {
    clearCursorDisplay();
    return;
  }
  const prevNearest = nearestPoint;
  nearestPoint = findNearestPoint(cursorSvg);
  if (nearestPoint && nearestPoint !== prevNearest) {
    playHoverSound();
  }
  updatePathPreview(cursorSvg);
  if (nearestPoint) {
    updateHoverGeometry(nearestPoint, cursorSvg);
    showTooltipAtSvg(nearestPoint, cursorSvg.x, cursorSvg.y);
  } else {
    hideTooltip();
    clearHoverGeometry();
  }
}

function clearCursorDisplay() {
  cursorSvg = null;
  nearestPoint = null;
  clearHoverGeometry();
  hideTooltip();
}

// ── Hover geometry ────────────────────────────────────────────────────────────

function ensureHoverPrimitives() {
  if (!hoverMarker) {
    hoverMarker = createSvgElement("circle", { class: "active-node", r: DOT_RADIUS });
    hoverLayer.appendChild(hoverMarker);
  }

  if (!hoverEdges.length) {
    ["A", "B", "C"].forEach(() => {
      const line = createSvgElement("line", { class: "link-line" });
      hoverLayer.appendChild(line);
      hoverEdges.push(line);

      const label = createSvgElement("text", {
        class: "link-label",
        "text-anchor": "middle",
        "font-size": FONT_SIZE_SVG,
        "font-family": FONT_FAMILY_SVG,
      });
      hoverLayer.appendChild(label);
      ensureTextBackground(label, "distance-label-bg");
      hoverEdgeLabels.push(label);
    });
  }

  if (!hoverCursorLink) {
    hoverCursorLink = createSvgElement("line", { class: "cursor-link-line" });
    hoverLayer.appendChild(hoverCursorLink);
  }

  if (!hoverCursorMarker) {
    hoverCursorMarker = createSvgElement("circle", { class: "hover-cursor-dot", r: DOT_RADIUS });
    hoverLayer.appendChild(hoverCursorMarker);
  }

  if (!lastVisitedLine) {
    lastVisitedLine = createSvgElement("line", { class: "last-visited-line" });
    hoverLayer.appendChild(lastVisitedLine);

    lastVisitedLabel = createSvgElement("text", {
      class: "last-visited-label",
      "text-anchor": "middle",
      "font-size": FONT_SIZE_SVG,
      "font-family": FONT_FAMILY_SVG,
    });
    hoverLayer.appendChild(lastVisitedLabel);
    ensureTextBackground(lastVisitedLabel, "distance-label-bg");
  }
}

function updateHoverGeometry(point, mouseSvg) {
  ensureHoverPrimitives();

  setSvgPos(hoverMarker, { cx: f5(point.sx), cy: f5(point.sy) });
  setSvgLine(hoverCursorLink, mouseSvg.x, mouseSvg.y, point.sx, point.sy);
  setSvgPos(hoverCursorMarker, { cx: f5(mouseSvg.x), cy: f5(mouseSvg.y) });

  updateRulerMarkers(mouseSvg.x, mouseSvg.y, rulerMarkers);
  updateRulerMarkers(point.sx, point.sy, rulerMarkersMatch);

  // Distance lines from vertices to cursor (Euclidean distance)
  const keys = ["A", "B", "C"];
  keys.forEach((key, i) => {
    const v = VERTEX[key];
    const dx = point.sx - v.x;
    const dy = point.sy - v.y;
    const dist = Math.sqrt(dx * dx + dy * dy).toFixed(3);
    setSvgLine(hoverEdges[i], v.x, v.y, mouseSvg.x, mouseSvg.y);
    positionMidpointLabel(hoverEdgeLabels[i], v.x, v.y, mouseSvg.x, mouseSvg.y, dist);
  });

  // Distance line from last visited point to cursor
  updateLastVisitedMeasure(mouseSvg);
}

function updateLastVisitedMeasure(mouseSvg) {
  if (visitedPoints.length && lastVisitedLine && lastVisitedLabel) {
    const last = visitedPoints[visitedPoints.length - 1];
    setSvgLine(lastVisitedLine, last.sx, last.sy, mouseSvg.x, mouseSvg.y);

    const dx = mouseSvg.x - last.sx;
    const dy = mouseSvg.y - last.sy;
    const dist = Math.sqrt(dx * dx + dy * dy).toFixed(3);
    positionMidpointLabel(lastVisitedLabel, last.sx, last.sy, mouseSvg.x, mouseSvg.y, dist);
  } else {
    hideSvgLine(lastVisitedLine);
    hideSvgLabel(lastVisitedLabel);
  }
}

function clearHoverGeometry() {
  hideSvgCircle(hoverMarker);
  hoverEdges.forEach(hideSvgLine);
  hoverEdgeLabels.forEach(hideSvgLabel);
  hideSvgLine(hoverCursorLink);
  clearRulerMarkers();
  hideSvgCircle(hoverCursorMarker);
  hideSvgLine(lastVisitedLine);
  hideSvgLabel(lastVisitedLabel);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function showTooltipAtSvg(point, svgX, svgY) {
  document.getElementById("tt-text").textContent = point.word;
  tooltip.classList.add("visible");
  const p = svgToContainerPx(svgX, svgY);
  positionTooltipAtContainer(p.x, p.y);
}

function hideTooltip() {
  tooltip.classList.remove("visible");
}

function positionTooltipAtContainer(x, y) {
  const tipW = tooltip.offsetWidth || 260;
  const tipH = tooltip.offsetHeight || 110;
  const cw = canvasWrap.clientWidth;
  const ch = canvasWrap.clientHeight;

  let left = x - tipW / 2;
  let top = y - tipH - TOOLTIP_MARGIN;

  left = clamp(left, TOOLTIP_MARGIN, cw - tipW - TOOLTIP_MARGIN);
  top = clamp(top, TOOLTIP_MARGIN, ch - tipH - TOOLTIP_MARGIN);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

// ── Exploration path ──────────────────────────────────────────────────────────

function updatePathPreview(mouseSvg) {
  if (!visitedPoints.length || !mouseSvg) {
    hideSvgLine(pathPreviewLine);
    return;
  }
  if (!pathPreviewLine) {
    pathPreviewLine = createSvgElement("line", { class: "path-line-preview" });
    pathLayer.appendChild(pathPreviewLine);
  }
  const last = visitedPoints[visitedPoints.length - 1];
  setSvgLine(pathPreviewLine, last.sx, last.sy, mouseSvg.x, mouseSvg.y);
}

function renderPath() {
  pathLayer.innerHTML = "";
  pathPreviewLine = null;
  for (let i = 1; i < visitedPoints.length; i++) {
    const prev = visitedPoints[i - 1];
    const curr = visitedPoints[i];
    const line = createSvgElement("line", {
      class: "path-line",
      x1: f5(prev.sx),
      y1: f5(prev.sy),
      x2: f5(curr.sx),
      y2: f5(curr.sy),
    });
    pathLayer.appendChild(line);
  }
}

// ── Blink confirmation ────────────────────────────────────────────────────────

function blinkConfirmation() {
  const targets = [];
  if (tooltip) targets.push(tooltip);
  hoverEdges.forEach((el) => targets.push(el));
  hoverEdgeLabels.forEach((el) => {
    targets.push(el);
    const bg = el.previousSibling;
    if (bg?.nodeName === "rect") targets.push(bg);
  });
  if (hoverMarker) targets.push(hoverMarker);
  if (hoverCursorLink) targets.push(hoverCursorLink);
  if (hoverCursorMarker) targets.push(hoverCursorMarker);

  let count = 0;
  function step() {
    if (count >= BLINK_HALF_CYCLES) {
      targets.forEach((el) => {
        el.style.removeProperty("opacity");
        el.classList.remove("blink-hide");
      });
      return;
    }
    const hide = count % 2 === 0;
    targets.forEach((el) => el.classList.toggle("blink-hide", hide));
    count++;
    setTimeout(step, BLINK_INTERVAL_MS);
  }
  step();
}

// ── Ruler construction ────────────────────────────────────────────────────────

function rebuildRulers() {
  rulerLayer.innerHTML = "";
  // Horizontal ticks (top & bottom edges)
  for (let x = -vbHalfX; x <= vbHalfX + 1e-9; x = +(x + RULER_TICK_STEP).toFixed(4)) {
    appendRulerTick(rulerLayer, x, -vbHalfY, x, -vbHalfY + RULER_TICK_LEN);
    appendRulerTick(rulerLayer, x, vbHalfY, x, vbHalfY - RULER_TICK_LEN);
  }
  // Vertical ticks (left & right edges)
  for (let y = -vbHalfY; y <= vbHalfY + 1e-9; y = +(y + RULER_TICK_STEP).toFixed(4)) {
    appendRulerTick(rulerLayer, -vbHalfX, y, -vbHalfX + RULER_TICK_LEN, y);
    appendRulerTick(rulerLayer, vbHalfX, y, vbHalfX - RULER_TICK_LEN, y);
  }
  // Position markers
  ["top", "bottom", "left", "right"].forEach((side) => {
    rulerMarkersMatch[side] = appendHiddenLine(rulerLayer, "ruler-marker-match");
    rulerMarkers[side] = appendHiddenLine(rulerLayer, "ruler-marker");
  });
}

function updateRulerMarkers(sx, sy, markers) {
  const x = f5(sx);
  const y = f5(sy);
  setLineAttrs(markers.top, x, f5(-vbHalfY), x, f5(-vbHalfY + RULER_MARKER_LEN));
  setLineAttrs(markers.bottom, x, f5(vbHalfY), x, f5(vbHalfY - RULER_MARKER_LEN));
  setLineAttrs(markers.left, f5(-vbHalfX), y, f5(-vbHalfX + RULER_MARKER_LEN), y);
  setLineAttrs(markers.right, f5(vbHalfX), y, f5(vbHalfX - RULER_MARKER_LEN), y);
}

function clearRulerMarkers() {
  [rulerMarkers, rulerMarkersMatch].forEach((markers) => {
    Object.values(markers).forEach(hideSvgLine);
  });
}

function updateVertexLabelBackgrounds() {
  ["labelA", "labelB", "labelC"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) updateTextBackground(el, "vertex-label-bg");
  });
}

// ── SVG helpers (pure / low-level) ────────────────────────────────────────────

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function setSvgPos(el, attrs) {
  if (!el) return;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function setSvgLine(el, x1, y1, x2, y2) {
  if (!el) return;
  setLineAttrs(el, f5(x1), f5(y1), f5(x2), f5(y2));
}

function setLineAttrs(el, x1, y1, x2, y2) {
  if (!el) return;
  el.setAttribute("x1", x1);
  el.setAttribute("y1", y1);
  el.setAttribute("x2", x2);
  el.setAttribute("y2", y2);
}

function hideSvgCircle(el) {
  if (!el) return;
  el.setAttribute("cx", "-999");
  el.setAttribute("cy", "-999");
}

function hideSvgLine(el) {
  if (!el) return;
  setLineAttrs(el, "-999", "-999", "-999", "-999");
}

function hideSvgLabel(el) {
  if (!el) return;
  el.textContent = "";
  el.removeAttribute("transform");
  const bg = el.previousSibling;
  if (bg?.nodeName === "rect") {
    bg.setAttribute("x", "-999");
    bg.setAttribute("y", "-999");
    bg.setAttribute("width", "0");
    bg.setAttribute("height", "0");
    bg.removeAttribute("transform");
  }
}

function positionMidpointLabel(label, x1, y1, x2, y2, text) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  let angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  const rot = `rotate(${angle.toFixed(2)}, ${f5(mx)}, ${f5(my)})`;
  label.setAttribute("x", f5(mx));
  label.setAttribute("y", f5(my));
  label.setAttribute("dominant-baseline", "central");
  label.setAttribute("transform", rot);
  label.textContent = text;
  updateTextBackground(label, "distance-label-bg");

  const bg = label.previousSibling;
  if (bg?.nodeName === "rect") bg.setAttribute("transform", rot);
}

function ensureTextBackground(textEl, className) {
  const parent = textEl?.parentNode;
  if (!parent) return null;
  let bg = textEl.previousSibling;
  if (!bg || bg.nodeName !== "rect" || !bg.classList?.contains(className)) {
    bg = createSvgElement("rect", { class: className });
    parent.insertBefore(bg, textEl);
  }
  return bg;
}

function updateTextBackground(textEl, className, px = 0.012, py = 0.008) {
  const bg = ensureTextBackground(textEl, className);
  if (!bg || !textEl?.textContent) return;
  const bbox = textEl.getBBox();
  bg.setAttribute("x", f5(bbox.x - px));
  bg.setAttribute("y", f5(bbox.y - py));
  bg.setAttribute("width", f5(bbox.width + px * 2));
  bg.setAttribute("height", f5(bbox.height + py * 2));
}

function appendRulerTick(parent, x1, y1, x2, y2) {
  const tick = createSvgElement("line", {
    class: "ruler-tick",
    x1: x1.toFixed(4),
    y1: y1.toFixed(4),
    x2: x2.toFixed(4),
    y2: y2.toFixed(4),
  });
  parent.appendChild(tick);
}

function appendHiddenLine(parent, className) {
  const line = createSvgElement("line", { class: className, x1: "-999", y1: "-999", x2: "-999", y2: "-999" });
  parent.appendChild(line);
  return line;
}

// ── Demo mode ─────────────────────────────────────────────────────────────────

function startDemo() {
  demoActive = true;
  trackingActive = true;
  canvasWrap.classList.add("tracking");
  function pickRandomTarget() {
    if (!projectedPoints.length) return null;
    return projectedPoints[Math.floor(Math.random() * projectedPoints.length)];
  }

  function randomOffset(base, range) {
    const offset = (Math.random() - 0.5) * 2 * range;
    return clamp(base + offset, -VB_BASE + 0.05, VB_BASE - 0.05);
  }

  let lastDemoCursor = { x: 0, y: 0 };

  function animateMoveTo(target, duration) {
    return new Promise((resolve) => {
      const startX = lastDemoCursor.x;
      const startY = lastDemoCursor.y;
      const DEVIATION = 1;
      const endX = randomOffset(target.sx, DEVIATION);
      const endY = randomOffset(target.sy, DEVIATION);
      const t0 = performance.now();

      function frame(now) {
        if (!demoActive) {
          resolve();
          return;
        }
        const elapsed = now - t0;
        const raw = clamp(elapsed / duration, 0, 1);
        const t = easeInOut(raw);
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        lastDemoCursor = { x: cx, y: cy };
        setCursorPosition({ x: cx, y: cy });
        if (raw < 1) {
          demoRafId = requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }
      demoRafId = requestAnimationFrame(frame);
    });
  }

  async function demoLoop() {
    await delay(DEMO_INITIAL_DELAY);
    while (demoActive) {
      const target = pickRandomTarget();
      if (!target || !demoActive) break;

      await animateMoveTo(target, DEMO_MOVE_DURATION);
      if (!demoActive) break;

      await delay(DEMO_PAUSE_BEFORE_CONFIRM);
      if (!demoActive) break;

      const pointToConfirm = nearestPoint || target;
      confirmPoint(pointToConfirm);
      setCursorPosition(cursorSvg);
      blinkConfirmation();

      await delay(DEMO_PAUSE_AFTER_CONFIRM);
    }
    if (demoActive) stopDemo();
  }

  demoLoop();
}

function stopDemo() {
  demoActive = false;
  if (demoRafId) {
    cancelAnimationFrame(demoRafId);
    demoRafId = null;
  }
  clearCursorDisplay();
}

function delay(ms) {
  return new Promise((resolve) => {
    const check = () => {
      if (!demoActive) {
        resolve();
        return;
      }
      resolve();
    };
    setTimeout(check, ms);
  });
}

// ── Generic helpers (pure) ────────────────────────────────────────────────────

function findNearestPoint(mouseSvg) {
  let best = null;
  let bestDist2 = Infinity;
  for (const pt of projectedPoints) {
    const dx = mouseSvg.x - pt.sx;
    const dy = mouseSvg.y - pt.sy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = pt;
    }
  }
  return best;
}

function mouseEventToSvg(event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const ctm = svg.getScreenCTM();
  return ctm ? pt.matrixTransform(ctm.inverse()) : null;
}

function svgToContainerPx(svgX, svgY) {
  const vb = svg.viewBox.baseVal;
  return {
    x: ((svgX - vb.x) / vb.width) * canvasWrap.clientWidth,
    y: ((svgY - vb.y) / vb.height) * canvasWrap.clientHeight,
  };
}

/** SVG uses y-down; our math coords are y-up → flip y */
function mathToSvg(x, y) {
  return { x, y: -y };
}

function isOutOfBounds(sx, sy) {
  return sx < -vbHalfX || sx > vbHalfX || sy < -vbHalfY || sy > vbHalfY;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Ease-in-out cubic */
function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Format number to 5 decimal places for SVG attributes */
function f5(n) {
  return Number(n).toFixed(5);
}
