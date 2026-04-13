const BODY_HISTORY_HUD_HEIGHT = 56;
const HUD_TOP_OFFSET = 10;
const HUD_ANIMATION_SPEED = 0.16;
const HUD_TICK_GAIN = 0.12;

export function createHudTickController(currentWindow) {
  return {
    window: currentWindow,
    soundEnabled: true,
    audioContext: null,
    masterGain: null,
  };
}

export function createHudState() {
  return {
    isHandOpen: false,
    visibility: 0,
  };
}

export function updateHudState(hudState, { isHandOpen }) {
  hudState.isHandOpen = isHandOpen;
  const targetVisibility = isHandOpen ? 1 : 0;
  hudState.visibility += (targetVisibility - hudState.visibility) * HUD_ANIMATION_SPEED;

  if (Math.abs(targetVisibility - hudState.visibility) < 0.01) {
    hudState.visibility = targetVisibility;
  }
}

export function shouldRenderHud(hudState) {
  return hudState.visibility > 0.001;
}

export function playHudTick(hudTickController) {
  if (!hudTickController?.soundEnabled) {
    return;
  }

  const { audioContext, masterGain } = ensureHudTickAudio(hudTickController);
  const now = audioContext.currentTime;

  const bodyOsc = audioContext.createOscillator();
  const bodyGain = audioContext.createGain();
  const clickOsc = audioContext.createOscillator();
  const clickGain = audioContext.createGain();

  bodyOsc.connect(bodyGain);
  bodyGain.connect(masterGain);

  clickOsc.connect(clickGain);
  clickGain.connect(masterGain);

  bodyOsc.type = "triangle";
  bodyOsc.frequency.setValueAtTime(1400, now);
  bodyOsc.frequency.exponentialRampToValueAtTime(700, now + 0.045);

  bodyGain.gain.setValueAtTime(0.07, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  clickOsc.type = "sine";
  clickOsc.frequency.setValueAtTime(3200, now);
  clickOsc.frequency.exponentialRampToValueAtTime(1800, now + 0.012);

  clickGain.gain.setValueAtTime(0.025, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

  bodyOsc.start(now);
  clickOsc.start(now);

  bodyOsc.stop(now + 0.045);
  clickOsc.stop(now + 0.012);
}

export function drawBodyHistoryHud({ context, canvas, slider, hudState }) {
  const sliderMin = Number.parseInt(slider.min, 10);
  const sliderMax = Number.parseInt(slider.max, 10);
  const sliderValue = Number.parseInt(slider.value, 10);
  const min = Number.isNaN(sliderMin) ? -60 : sliderMin;
  const max = Number.isNaN(sliderMax) ? 0 : sliderMax;
  const value = Number.isNaN(sliderValue) ? max : sliderValue;
  const range = Math.max(max - min, 1);
  const normalizedValue = (value - min) / range;
  const hudWidth = Math.min(canvas.width - 24, 280);
  const hudHeight = Math.min(BODY_HISTORY_HUD_HEIGHT, canvas.height - 16);
  const hudX = (canvas.width - hudWidth) / 2;
  const hiddenOffset = hudHeight + HUD_TOP_OFFSET + 8;
  const translateY = (1 - hudState.visibility) * -hiddenOffset;
  const hudY = HUD_TOP_OFFSET;
  const rulerStartX = hudX + 18;
  const rulerEndX = hudX + hudWidth - 18;
  const rulerY = hudY + hudHeight - 18;
  const markerX = rulerStartX + (rulerEndX - rulerStartX) * normalizedValue;
  const tickCount = Math.max(Math.min(range, 24), 8);
  const labeledTickValues = getHudLabeledTickValues(min, max);

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.globalAlpha = Math.max(0, Math.min(1, hudState.visibility));
  context.translate(0, translateY);

  const hudBackgroundGradient = context.createLinearGradient(0, 0, 0, hudY + hudHeight + 4);
  hudBackgroundGradient.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  hudBackgroundGradient.addColorStop(0.45, "rgba(0, 0, 0, 0.22)");
  hudBackgroundGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = hudBackgroundGradient;
  context.fillRect(0, 0, canvas.width, hudY + hudHeight + 4);

  context.beginPath();
  context.moveTo(rulerStartX, rulerY);
  context.lineTo(rulerEndX, rulerY);
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.lineWidth = 1;
  context.stroke();

  for (let tickIndex = 0; tickIndex <= tickCount; tickIndex += 1) {
    const progress = tickIndex / tickCount;
    const x = rulerStartX + (rulerEndX - rulerStartX) * progress;
    const tickTop = rulerY - 8;

    context.beginPath();
    context.moveTo(x, rulerY);
    context.lineTo(x, tickTop);
    context.strokeStyle = "rgba(255, 255, 255, 0.45)";
    context.stroke();
  }

  for (const tickValue of labeledTickValues) {
    const progress = (tickValue - min) / range;
    const x = rulerStartX + (rulerEndX - rulerStartX) * progress;
    const tickTop = rulerY - 14;

    context.beginPath();
    context.moveTo(x, rulerY);
    context.lineTo(x, tickTop);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.font = "10px monospace";
    context.textAlign = "center";
    context.fillText(formatHudTickLabel(tickValue), x, tickTop - 4);
  }

  context.beginPath();
  context.moveTo(markerX, hudY + 4);
  context.lineTo(markerX, rulerY + 4);
  context.strokeStyle = "rgba(255, 255, 255, 1)";
  context.lineWidth = 1.5;
  context.stroke();

  context.restore();
}

function getHudLabeledTickValues(min, max) {
  return [0, -19, -39, -79, -119].filter((value) => value >= min && value <= max);
}

function ensureHudTickAudio(hudTickController) {
  if (!hudTickController.audioContext) {
    const AudioContextConstructor = hudTickController.window.AudioContext || hudTickController.window.webkitAudioContext;
    hudTickController.audioContext = new AudioContextConstructor({ latencyHint: "interactive" });
  }

  if (!hudTickController.masterGain) {
    hudTickController.masterGain = hudTickController.audioContext.createGain();
    hudTickController.masterGain.gain.value = HUD_TICK_GAIN;
    hudTickController.masterGain.connect(hudTickController.audioContext.destination);
  }

  if (hudTickController.audioContext.state === "suspended") {
    hudTickController.audioContext.resume();
  }

  return {
    audioContext: hudTickController.audioContext,
    masterGain: hudTickController.masterGain,
  };
}

function formatHudTickLabel(value) {
  if (value === 0) {
    return "now";
  }

  return `T${value - 1}`;
}
