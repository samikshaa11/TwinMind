const GROQ_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

export const MODEL_WHISPER = "whisper-large-v3";
export const MODEL_CHAT = "openai/gpt-oss-120b";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function mapNetworkError(err, endpoint) {
  const timedOut =
    err?.name === "AbortError" ||
    /aborted|abort|timed out|timeout/i.test(String(err?.message || ""));
  const e = new Error(
    timedOut
      ? `Groq ${endpoint} timed out. Try again or reduce context size/chunk duration.`
      : `Could not reach Groq ${endpoint}. Check internet/VPN/firewall and try again.`
  );
  e.status = 502;
  e.code = timedOut ? "GROQ_TIMEOUT" : "GROQ_NETWORK_ERROR";
  e.raw = { message: err?.message || "Unknown network failure" };
  return e;
}

async function fetchWithRetry(url, options, endpointName, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let lastNetworkErr = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
        await delay(300 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastNetworkErr = err;
      if (attempt < MAX_RETRIES) {
        await delay(300 * (attempt + 1));
        continue;
      }
      throw mapNetworkError(err, endpointName);
    }
  }

  throw mapNetworkError(lastNetworkErr, endpointName);
}

export async function groqChatCompletion({
  apiKey,
  model,
  messages,
  temperature = 0.6,
  maxTokens = 2048,
  reasoningEffort = "low",
}) {
  const res = await fetchWithRetry(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      reasoning_effort: reasoningEffort,
    }),
  }, "chat API", 90_000);

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `Groq chat request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.raw = json;
    throw err;
  }

  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    const err = new Error("Groq returned no message content.");
    err.status = 502;
    err.raw = json;
    throw err;
  }

  return { text, raw: json };
}

export async function groqAudioTranscription({ apiKey, buffer, filename, contentType }) {
  const form = new FormData();
  form.append("model", MODEL_WHISPER);
  const blob = new Blob([buffer], { type: contentType || "application/octet-stream" });
  form.append("file", blob, filename || "audio.webm");

  const res = await fetchWithRetry(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  }, "transcription API", 60_000);

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `Groq transcription failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.raw = json;
    throw err;
  }

  const text = json?.text;
  if (typeof text !== "string") {
    const err = new Error("Groq returned no transcription text.");
    err.status = 502;
    err.raw = json;
    throw err;
  }

  return { text: text.trim(), raw: json };
}
