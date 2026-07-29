declare global {
  interface AudioContext {
    setSinkId?(sinkId: string): Promise<void>;
  }
}

export class AudioDevices {
  static isSinkIdSupported(): boolean {
    return typeof AudioContext.prototype.setSinkId === "function";
  }

  async populate(inputSelect: HTMLSelectElement, outputSelect: HTMLSelectElement): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      inputSelect.innerHTML = '<option value="">Unavailable</option>';
      outputSelect.innerHTML = '<option value="">Unavailable</option>';
      inputSelect.disabled = true;
      outputSelect.disabled = true;
      return;
    }

    const selectedInput = inputSelect.value;
    const selectedOutput = outputSelect.value;
    const devices = await navigator.mediaDevices.enumerateDevices();

    this.fillSelect(
      inputSelect,
      devices.filter((device) => device.kind === "audioinput"),
      selectedInput,
      "Microphone",
    );
    this.fillSelect(
      outputSelect,
      devices.filter((device) => device.kind === "audiooutput"),
      selectedOutput,
      "Speaker",
    );

    outputSelect.disabled = !AudioDevices.isSinkIdSupported();
  }

  private fillSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[], selectedId: string, fallbackLabel: string): void {
    select.replaceChildren();

    devices.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `${fallbackLabel} ${index + 1}`;
      select.append(option);
    });

    if (!devices.length) {
      select.append(new Option(`No ${fallbackLabel.toLowerCase()}s found`, ""));
      select.disabled = true;
      return;
    }

    select.disabled = false;
    if (devices.some((device) => device.deviceId === selectedId)) {
      select.value = selectedId;
    }
  }

  async setOutputSink(audioContext: AudioContext | null, deviceId: string): Promise<void> {
    if (!audioContext || typeof audioContext.setSinkId !== "function") return;
    await audioContext.setSinkId(deviceId);
  }
}
