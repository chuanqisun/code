#!/usr/bin/env bash

# Ensure pactl is installed
if ! command -v pactl &> /dev/null; then
    echo "Error: 'pactl' is not installed. Install pulseaudio-utils or pipewire-pulse."
    exit 1
fi

# 1. Save current default microphone and speaker
ORIG_SOURCE=$(pactl get-default-source)
DEFAULT_SINK=$(pactl get-default-sink)

echo "Original Mic: $ORIG_SOURCE"
echo "Current Speaker: $DEFAULT_SINK"

# 2. Create a virtual microphone pointing to the speaker's monitor
# (Browsers ignore raw .monitor sources, so we must remap it as a standard input)
echo "Creating temporary virtual microphone..."
MODULE_ID=$(pactl load-module module-remap-source \
    master="${DEFAULT_SINK}.monitor" \
    source_name= VirtSystemMic \
    source_properties=device.description="System_Audio_As_Mic")

# 3. Set the new virtual mic as the system default
pactl set-default-source VirtSystemMic

echo "--------------------------------------------------------"
echo "✅ ACTIVE: System audio is now routed to your Microphone!"
echo "👉 Open your browser and start the transcription."
echo "🛑 Press [Ctrl+C] or [Enter] in this terminal to restore."
echo "--------------------------------------------------------"

# 4. Cleanup function to restore original state on exit
cleanup() {
    echo -e "\nRestoring original audio settings..."
    pactl set-default-source "$ORIG_SOURCE"
    pactl unload-module "$MODULE_ID"
    echo "✅ Done. Your normal microphone is active again."
    exit 0
}

# Trap Ctrl+C (SIGINT) and terminal close (SIGTERM)
trap cleanup SIGINT SIGTERM

# Wait for user to press Enter
read -r
cleanup