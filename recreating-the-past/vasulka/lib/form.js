const QUERY_PARAM_KEYS = {
  bodyThreshold: "bodyThreshold",
  handOpenThreshold: "handOpenThreshold",
  handCloseThreshold: "handCloseThreshold",
};

export function createGlitchFormController({ document, window, defaultBodyThreshold, defaultHandOpenThreshold, defaultHandCloseThreshold }) {
  const elements = {
    startBtn: document.getElementById("startBtn"),
    historySlider: document.getElementById("historySlider"),
    historyDepthSlider: document.getElementById("historyDepth"),
    bodyThresholdSlider: document.getElementById("bodyThresholdSlider"),
    bodyThresholdValue: document.getElementById("bodyThresholdValue"),
    handOpennessMeter: document.getElementById("handOpennessMeter"),
    handOpennessValue: document.getElementById("handOpennessValue"),
    handOpenThresholdValue: document.getElementById("handOpenThresholdValue"),
    handCloseThresholdValue: document.getElementById("handCloseThresholdValue"),
    handOpenThresholdSlider: document.getElementById("handOpenThresholdSlider"),
    handOpenThresholdSliderValue: document.getElementById("handOpenThresholdSliderValue"),
    handCloseThresholdSlider: document.getElementById("handCloseThresholdSlider"),
    handCloseThresholdSliderValue: document.getElementById("handCloseThresholdSliderValue"),
    stats: document.getElementById("stats"),
  };

  const initialHandOpenThreshold = readSliderDefaultValue(elements.handOpenThresholdSlider, defaultHandOpenThreshold);
  const initialHandCloseThreshold = readSliderDefaultValue(elements.handCloseThresholdSlider, defaultHandCloseThreshold);

  const thresholdListeners = new Set();
  const state = {
    bodyThreshold: defaultBodyThreshold,
    handOpenThreshold: initialHandOpenThreshold,
    handCloseThreshold: initialHandCloseThreshold,
  };

  elements.bodyThresholdSlider.addEventListener("input", () => {
    const nextThreshold = Number.parseInt(elements.bodyThresholdSlider.value, 10);
    const fallbackThreshold = readIntegerParam(window, QUERY_PARAM_KEYS.bodyThreshold, defaultBodyThreshold);

    applyThresholdState(
      {
        bodyThreshold: Number.isNaN(nextThreshold) ? fallbackThreshold : nextThreshold,
      },
      { syncUrl: true, notify: true }
    );
  });

  elements.handOpenThresholdSlider.addEventListener("input", () => {
    applyHandThresholds({
      openThreshold: elements.handOpenThresholdSlider.value,
      closeThreshold: elements.handCloseThresholdSlider.value,
      changedControl: "open",
    });
  });

  elements.handCloseThresholdSlider.addEventListener("input", () => {
    applyHandThresholds({
      openThreshold: elements.handOpenThresholdSlider.value,
      closeThreshold: elements.handCloseThresholdSlider.value,
      changedControl: "close",
    });
  });

  window.addEventListener("popstate", () => {
    hydrateThresholdStateFromUrl({ notify: true });
  });

  function onThresholdStateChange(listener) {
    thresholdListeners.add(listener);

    return () => {
      thresholdListeners.delete(listener);
    };
  }

  function emitThresholdStateChange() {
    const snapshot = {
      bodyThreshold: state.bodyThreshold,
      handOpenThreshold: state.handOpenThreshold,
      handCloseThreshold: state.handCloseThreshold,
    };

    thresholdListeners.forEach((listener) => listener(snapshot));
  }

  function hydrateThresholdStateFromUrl({ notify = false } = {}) {
    applyThresholdState(
      {
        bodyThreshold: readIntegerParam(window, QUERY_PARAM_KEYS.bodyThreshold, defaultBodyThreshold),
        handOpenThreshold: readIntegerParam(window, QUERY_PARAM_KEYS.handOpenThreshold, initialHandOpenThreshold),
        handCloseThreshold: readIntegerParam(window, QUERY_PARAM_KEYS.handCloseThreshold, initialHandCloseThreshold),
      },
      { syncUrl: true, notify }
    );
  }

  function applyHandThresholds({ openThreshold, closeThreshold, changedControl }) {
    let nextOpenThreshold = Number.parseInt(openThreshold, 10);
    let nextCloseThreshold = Number.parseInt(closeThreshold, 10);

    const fallbackOpenThreshold = readIntegerParam(window, QUERY_PARAM_KEYS.handOpenThreshold, initialHandOpenThreshold);
    const fallbackCloseThreshold = readIntegerParam(window, QUERY_PARAM_KEYS.handCloseThreshold, initialHandCloseThreshold);

    nextOpenThreshold = clampSliderValue(elements.handOpenThresholdSlider, Number.isNaN(nextOpenThreshold) ? fallbackOpenThreshold : nextOpenThreshold);
    nextCloseThreshold = clampSliderValue(elements.handCloseThresholdSlider, Number.isNaN(nextCloseThreshold) ? fallbackCloseThreshold : nextCloseThreshold);

    if (changedControl === "open" && nextOpenThreshold < nextCloseThreshold) {
      nextCloseThreshold = nextOpenThreshold;
    }

    if (changedControl === "close" && nextCloseThreshold > nextOpenThreshold) {
      nextOpenThreshold = nextCloseThreshold;
    }

    applyThresholdState(
      {
        handOpenThreshold: nextOpenThreshold,
        handCloseThreshold: nextCloseThreshold,
      },
      { syncUrl: true, notify: true }
    );
  }

  function applyThresholdState(nextState, { syncUrl, notify }) {
    if (typeof nextState.bodyThreshold === "number") {
      state.bodyThreshold = clampSliderValue(elements.bodyThresholdSlider, nextState.bodyThreshold);
    }

    if (typeof nextState.handOpenThreshold === "number") {
      state.handOpenThreshold = clampSliderValue(elements.handOpenThresholdSlider, nextState.handOpenThreshold);
    }

    if (typeof nextState.handCloseThreshold === "number") {
      state.handCloseThreshold = clampSliderValue(elements.handCloseThresholdSlider, nextState.handCloseThreshold);
    }

    if (state.handCloseThreshold > state.handOpenThreshold) {
      state.handCloseThreshold = state.handOpenThreshold;
    }

    syncBodyThresholdControls();
    syncHandThresholdControls();

    if (syncUrl) {
      syncThresholdQueryParams(window, state);
    }

    if (notify) {
      emitThresholdStateChange();
    }
  }

  function syncBodyThresholdControls() {
    elements.bodyThresholdSlider.value = String(state.bodyThreshold);
    elements.bodyThresholdValue.textContent = String(state.bodyThreshold);
  }

  function syncHandThresholdControls() {
    elements.handOpenThresholdSlider.value = String(state.handOpenThreshold);
    elements.handCloseThresholdSlider.value = String(state.handCloseThreshold);
    elements.handOpenThresholdSliderValue.textContent = String(state.handOpenThreshold);
    elements.handCloseThresholdSliderValue.textContent = String(state.handCloseThreshold);
    elements.handOpenThresholdValue.textContent = String(state.handOpenThreshold);
    elements.handCloseThresholdValue.textContent = String(state.handCloseThreshold);
    elements.handOpennessMeter.low = String(state.handCloseThreshold);
    elements.handOpennessMeter.high = String(state.handOpenThreshold);
    elements.handOpennessMeter.optimum = String(state.handOpenThreshold);
  }

  function updateHandOpennessMeter(openness) {
    if (typeof openness !== "number" || Number.isNaN(openness)) {
      elements.handOpennessMeter.value = 0;
      elements.handOpennessValue.textContent = "n/a";
      return;
    }

    const meterMax = Number.parseFloat(elements.handOpennessMeter.max) || 0;
    elements.handOpennessMeter.value = String(Math.max(0, Math.min(meterMax, openness)));
    elements.handOpennessValue.textContent = openness.toFixed(1);
  }

  function syncStartButtonLabel({ currentCameraIndex, totalCameraCount }) {
    if (currentCameraIndex < 0 || totalCameraCount < 1) {
      elements.startBtn.textContent = "Start";
      return;
    }

    elements.startBtn.textContent = `Cam (${currentCameraIndex + 1}/${totalCameraCount})`;
  }

  return {
    elements,
    onThresholdStateChange,
    hydrateThresholdStateFromUrl,
    updateHandOpennessMeter,
    syncStartButtonLabel,
    get bodyThreshold() {
      return state.bodyThreshold;
    },
    get handOpenThreshold() {
      return state.handOpenThreshold;
    },
    get handCloseThreshold() {
      return state.handCloseThreshold;
    },
  };
}

function readIntegerParam(window, paramName, fallbackValue) {
  const searchParams = new URLSearchParams(window.location.search);
  const rawValue = searchParams.get(paramName);

  if (rawValue === null) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isNaN(parsedValue) ? fallbackValue : parsedValue;
}

function clampSliderValue(slider, value) {
  const min = Number.parseFloat(slider.min);
  const max = Number.parseFloat(slider.max);
  let nextValue = value;

  if (Number.isFinite(min)) {
    nextValue = Math.max(min, nextValue);
  }

  if (Number.isFinite(max)) {
    nextValue = Math.min(max, nextValue);
  }

  return Math.round(nextValue);
}

function readSliderDefaultValue(slider, fallbackValue) {
  const defaultValue = Number.parseInt(slider?.getAttribute("value") ?? "", 10);
  return Number.isNaN(defaultValue) ? fallbackValue : defaultValue;
}

function syncThresholdQueryParams(window, { bodyThreshold, handOpenThreshold, handCloseThreshold }) {
  const searchParams = new URLSearchParams(window.location.search);

  if (typeof bodyThreshold === "number") {
    searchParams.set(QUERY_PARAM_KEYS.bodyThreshold, String(bodyThreshold));
  }

  if (typeof handOpenThreshold === "number") {
    searchParams.set(QUERY_PARAM_KEYS.handOpenThreshold, String(handOpenThreshold));
  }

  if (typeof handCloseThreshold === "number") {
    searchParams.set(QUERY_PARAM_KEYS.handCloseThreshold, String(handCloseThreshold));
  }

  const nextQueryString = searchParams.toString();
  const nextUrl = nextQueryString
    ? `${window.location.pathname}?${nextQueryString}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;

  window.history.replaceState(null, "", nextUrl);
}
