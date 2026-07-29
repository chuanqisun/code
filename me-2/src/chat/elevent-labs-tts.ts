export interface TTSCallbacks {
  onAudio: (base64Audio: string) => void;
  onFinal: () => void;
  onError: (error: Error) => void;
}

export class ElevenLabsTTS {
  private socket: WebSocket | null = null;
  private connectionId = 0;

  async connect(
    apiKey: string,
    voiceId: string,
    currentTurn: number,
    isTurnActive: (turn: number, connId: number) => boolean,
    callbacks: TTSCallbacks,
  ): Promise<WebSocket> {
    const connId = ++this.connectionId;
    const url =
      `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input` +
      "?model_id=eleven_flash_v2_5&output_format=pcm_24000&inactivity_timeout=180";

    const currentSocket = new WebSocket(url);
    this.socket = currentSocket;

    return new Promise((resolve, reject) => {
      let settled = false;

      currentSocket.onopen = () => {
        if (!isTurnActive(currentTurn, connId)) {
          currentSocket.close();
          return;
        }

        currentSocket.send(
          JSON.stringify({
            text: " ",
            "xi-api-key": apiKey,
          }),
        );

        settled = true;
        resolve(currentSocket);
      };

      currentSocket.onmessage = (event: MessageEvent) => {
        if (!isTurnActive(currentTurn, connId)) return;

        try {
          const message = JSON.parse(event.data as string);

          if (message.audio) {
            callbacks.onAudio(message.audio);
          }

          if (message.isFinal === true) {
            callbacks.onFinal();
          }

          if (message.error) {
            throw new Error(typeof message.error === "string" ? message.error : JSON.stringify(message.error));
          }
        } catch (error) {
          callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
      };

      currentSocket.onerror = () => {
        if (!settled) reject(new Error("WebSocket connection failed"));
      };

      currentSocket.onclose = (event) => {
        if (!settled) {
          reject(new Error(event.reason || "WebSocket closed before ready"));
        }
        if (this.socket === currentSocket) {
          this.socket = null;
        }
      };
    });
  }

  sendText(currentSocket: WebSocket, text: string): void {
    if (currentSocket.readyState !== WebSocket.OPEN) {
      throw new Error("TTS connection is unavailable");
    }

    currentSocket.send(
      JSON.stringify({
        text: text + " ",
        flush: true,
      }),
    );
    currentSocket.send(JSON.stringify({ text: "" }));
  }

  close(): void {
    this.connectionId++;
    const oldSocket = this.socket;
    this.socket = null;

    if (oldSocket) {
      oldSocket.onopen = null;
      oldSocket.onmessage = null;
      oldSocket.onerror = null;
      oldSocket.onclose = null;
      try {
        oldSocket.close();
      } catch {}
    }
  }

  getConnectionId(): number {
    return this.connectionId;
  }

  getSocket(): WebSocket | null {
    return this.socket;
  }
}
