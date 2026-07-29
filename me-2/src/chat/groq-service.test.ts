import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroqService } from "./groq-service";
import type { ChatMessage } from "./thread-manager";

describe("GroqService", () => {
  let groq: GroqService;

  beforeEach(() => {
    groq = new GroqService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends transcription request to Groq STT API", async () => {
    const mockBlob = new Blob(["fake audio"], { type: "audio/webm" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Transcribed audio text" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await groq.transcribe("test-api-key", mockBlob);
    expect(result).toBe("Transcribed audio text");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(options.headers.Authorization).toBe("Bearer test-api-key");
  });

  it("sends complete request with ChatMessage array payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "filled response" } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const messages: ChatMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Hello __" },
    ];

    const result = await groq.complete("test-api-key", messages);
    expect(result).toBe("filled response");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(options.headers["Authorization"]).toBe("Bearer test-api-key");
    const body = JSON.parse(options.body);
    expect(body.messages).toEqual(messages);
    expect(body.model).toBe("openai/gpt-oss-120b");
  });

  it("throws error when API response is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(groq.complete("bad-key", [])).rejects.toThrow("LLM 401: Unauthorized");
  });
});
