const HEART_BURST_DURATION_MS = 3000;

export function createPlayer({ steps, elements, effectState, onTriggerDissolve = () => {} }) {
  const stepByState = new Map(steps.map((step) => [step.state, step]));

  effectState.hasStartedVideo ??= false;
  effectState.scriptHintOverride ??= null;
  effectState.scriptResetTimeoutId ??= null;
  effectState.makeHeartHintTimeoutId ??= null;
  effectState.scriptState ??= steps[0]?.state ?? null;

  function applyPresentation() {
    const step = stepByState.get(effectState.scriptState);

    if (!step) {
      return;
    }

    elements.scriptHint.textContent = effectState.hasStartedVideo ? effectState.scriptHintOverride ?? step.hint : "";

    for (const canvas of document.querySelectorAll("canvas")) {
      canvas.classList.toggle("is-active", canvas.id === step.activeCanvasId);
    }

    for (const panel of document.querySelectorAll(".panel")) {
      panel.classList.toggle("is-active-panel", panel.dataset.canvasId === step.activeCanvasId);
    }

    for (const row of document.querySelectorAll(".row")) {
      const hasActivePanel = row.querySelector(`.panel[data-canvas-id="${step.activeCanvasId}"]`) !== null;
      row.classList.toggle("is-active-row", hasActivePanel);
    }
  }

  function clearMakeHeartHintTimer() {
    if (!effectState.makeHeartHintTimeoutId) {
      return;
    }

    window.clearTimeout(effectState.makeHeartHintTimeoutId);
    effectState.makeHeartHintTimeoutId = null;
  }

  function resetScript() {
    clearMakeHeartHintTimer();
    effectState.scriptState = steps[0]?.state ?? null;
    effectState.scriptHintOverride = null;
    elements.invertCanvas6Input.checked = false;
    applyPresentation();
  }

  function scheduleReset(resetAt) {
    if (effectState.scriptResetTimeoutId) {
      window.clearTimeout(effectState.scriptResetTimeoutId);
    }

    const delay = Math.max(0, resetAt - performance.now());

    effectState.scriptResetTimeoutId = window.setTimeout(() => {
      effectState.scriptResetTimeoutId = null;
      resetScript();
    }, delay);
  }

  function updateTimers(previousState, nextState) {
    if (previousState !== nextState) {
      clearMakeHeartHintTimer();
      effectState.scriptHintOverride = null;
    }

    if (previousState !== "make-heart" && nextState === "make-heart") {
      effectState.makeHeartHintTimeoutId = window.setTimeout(() => {
        effectState.makeHeartHintTimeoutId = null;

        if (effectState.scriptState !== "make-heart") {
          return;
        }

        effectState.scriptHintOverride = "kiss now";
        applyPresentation();
      }, 6000);
    }
  }

  function runActions(actions, timestamp) {
    for (const action of actions) {
      if (action === "toggle-canvas6-invert") {
        elements.invertCanvas6Input.checked = !elements.invertCanvas6Input.checked;
        continue;
      }

      if (action === "trigger-heart-burst") {
        const burstStartedAt = effectState.lastFrameTimestamp || timestamp;
        const hasActiveBurst = effectState.canvas6HeartBursts.some((burstState) => {
          if (!burstState || burstState.startedAt == null) {
            return false;
          }

          return burstStartedAt - burstState.startedAt < HEART_BURST_DURATION_MS;
        });

        if (!hasActiveBurst) {
          effectState.canvas6HeartBursts.push({
            startedAt: burstStartedAt,
            completedAt: burstStartedAt + HEART_BURST_DURATION_MS,
          });
        }
        continue;
      }

      if (action === "trigger-dissolve") {
        onTriggerDissolve(timestamp);
        continue;
      }

      if (action === "schedule-reset") {
        scheduleReset(timestamp + 6000);
      }
    }
  }

  function advance(eventName, timestamp = performance.now()) {
    const previousState = effectState.scriptState;
    const currentStep = stepByState.get(effectState.scriptState);
    const transition = currentStep?.transitions?.[eventName];

    if (!transition) {
      return false;
    }

    runActions(transition.actions ?? [], timestamp);
    effectState.scriptState = transition.target;
    updateTimers(previousState, effectState.scriptState);
    applyPresentation();

    return true;
  }

  function startVideo() {
    effectState.hasStartedVideo = true;
    applyPresentation();
  }

  return {
    advance,
    applyPresentation,
    startVideo,
  };
}
