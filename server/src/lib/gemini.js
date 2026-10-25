import { HttpError } from "./security.js";

export function geminiConfigured() {
  return Boolean(process.env.Gemini_API_KEY || process.env.GEMINI_API_KEY);
}
export async function* geminiStream({ contents, system, tools, signal }) {
  const apiKey = process.env.Gemini_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new HttpError(
      503,
      "Your assistant isn’t configured yet. Add a Gemini key on the server to enable live help. Your workspace works fully without it.",
    );
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    throw new HttpError(
      503,
      "The assistant model configuration needs attention.",
    );
  const timeout = AbortSignal.timeout(45000);
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 1800,
            ...(model.startsWith("gemini-3.1-flash-lite")
              ? { thinkingConfig: { thinkingLevel: "minimal" } }
              : {}),
          },
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
    );
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError")
      throw new HttpError(
        504,
        "The assistant took a little too long. Please try again.",
      );
    throw new HttpError(
      502,
      "The assistant could not connect. Please try again shortly.",
    );
  }
  if (!response.ok) {
    if (response.status === 429)
      throw new HttpError(
        429,
        "The assistant is at its rate limit. Give it a moment, then try again.",
      );
    if (response.status === 404)
      throw new HttpError(
        503,
        "The configured Gemini model is unavailable for this API key. Ask your administrator to update GEMINI_MODEL.",
      );
    if ([400, 401, 403].includes(response.status))
      throw new HttpError(
        503,
        "The assistant’s key or model configuration needs attention. Contact your administrator.",
      );
    throw new HttpError(
      502,
      "The assistant is temporarily unavailable. Your workspace is still ready to use.",
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let boundary;
      while ((boundary = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (!line.startsWith("data:")) continue;
        const text = line.slice(5).trim();
        if (!text || text === "[DONE]") continue;
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new HttpError(
            502,
            "The assistant sent an incomplete response. Please try again.",
          );
        }
        if (data.error)
          throw new HttpError(
            502,
            "The assistant could not complete that response. Please try again.",
          );
        const candidate = data.candidates?.[0];
        if (
          candidate?.finishReason === "SAFETY" ||
          data.promptFeedback?.blockReason
        )
          throw new HttpError(
            400,
            "Please rephrase that request so I can help with your workspace.",
          );
        for (const part of candidate?.content?.parts || [])
          if (!part.thought) yield part;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
