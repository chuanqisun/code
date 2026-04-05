export function createCameraManager({
  videoElement,
  startButton,
  controlsElement,
  debugEnabled,
  debugVideoConstraints,
  presentationVideoConstraints,
  onFirstStream,
}) {
  const mediaState = {
    activeStream: null,
    availableVideoInputs: [],
    activeVideoInputIndex: -1,
    hasStartedProcessing: false,
  };

  async function refreshVideoInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    mediaState.availableVideoInputs = devices.filter((device) => device.kind === "videoinput");

    if (!mediaState.availableVideoInputs.length) {
      mediaState.activeVideoInputIndex = -1;
      return;
    }

    const activeDeviceId = mediaState.activeStream?.getVideoTracks()[0]?.getSettings().deviceId;

    if (!activeDeviceId) {
      mediaState.activeVideoInputIndex = 0;
      return;
    }

    const matchedIndex = mediaState.availableVideoInputs.findIndex((device) => device.deviceId === activeDeviceId);
    mediaState.activeVideoInputIndex = matchedIndex >= 0 ? matchedIndex : 0;
  }

  function stopActiveStream() {
    mediaState.activeStream?.getTracks().forEach((track) => track.stop());
    mediaState.activeStream = null;
  }

  function getVideoConstraintsForDevice(deviceId) {
    const baseConstraints = debugEnabled ? debugVideoConstraints : presentationVideoConstraints;

    if (!deviceId) {
      return baseConstraints;
    }

    return {
      ...baseConstraints,
      deviceId: { exact: deviceId },
    };
  }

  function updateStartButtonLabel() {
    if (mediaState.availableVideoInputs.length > 1) {
      startButton.textContent = "Next Camera";
      return;
    }

    startButton.textContent = mediaState.activeStream ? "Restart Webcam" : "Start Webcam";
  }

  async function startNextCamera() {
    if (mediaState.activeStream === null) {
      await refreshVideoInputs();
    }

    const nextIndex =
      mediaState.availableVideoInputs.length > 1
        ? (mediaState.activeVideoInputIndex + 1) % mediaState.availableVideoInputs.length
        : mediaState.activeVideoInputIndex;
    const nextDeviceId = nextIndex >= 0 ? mediaState.availableVideoInputs[nextIndex]?.deviceId : undefined;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: getVideoConstraintsForDevice(nextDeviceId),
      audio: false,
    });

    stopActiveStream();
    mediaState.activeStream = stream;
    videoElement.srcObject = stream;
    await videoElement.play();
    await refreshVideoInputs();

    if (!debugEnabled) {
      controlsElement.classList.add("live");
    }

    if (!mediaState.hasStartedProcessing) {
      onFirstStream();
      mediaState.hasStartedProcessing = true;
    }

    updateStartButtonLabel();
  }

  return {
    refreshVideoInputs,
    startNextCamera,
    updateStartButtonLabel,
  };
}
