export class GroqService {
  async transcribe(apiKey: string, audio: Blob, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    const extension = audio.type.includes("webm") ? "webm" : "ogg";
    form.append("file", audio, `speech.${extension}`);
    form.append("model", "whisper-large-v3-turbo");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });

    if (!response.ok) {
      throw new Error(`STT ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { text?: string };
    return data.text || "";
  }

  async complete(apiKey: string, text: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content:
              "Complete user's sentence in the most sensible way. Respond only with a few words to fill the __ as if uttered by the user themselves. Respond with the __ portion and don't say anything else.",
          },
          { role: "user", content: `${text} __` },
        ],
        temperature: 0,
        max_completion_tokens: 120,
        reasoning_effort: "low",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }
}
