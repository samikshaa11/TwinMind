const explicitBase = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
let cachedBase: string | null = explicitBase || null;

const PORT_CANDIDATES = Array.from({ length: 21 }, (_, i) => 8787 + i);

function candidateBases(): string[] {
  const list: string[] = [];

  // In production: ONLY use deployed backend
  if (import.meta.env.PROD) {
    if (explicitBase) return [explicitBase];
    return []; // fail fast instead of hitting frontend
  }

  // Local dev behavior (keep your current logic)
  if (cachedBase) list.push(cachedBase);
  if (explicitBase) list.push(explicitBase);
  list.push("");

  for (const p of PORT_CANDIDATES) {
    list.push(`http://127.0.0.1:${p}`);
    list.push(`http://localhost:${p}`);
  }

  return [...new Set(list)];
}

function shouldRetryStatus(status: number): boolean {
  // Include 500 because Vite proxy returns 500 when target port is stale/unreachable.
  return status === 404 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchWithBackendFallback(path: string, init: RequestInit): Promise<Response> {
  let lastNetworkError: unknown = null;
  let lastResponse: Response | null = null;

  for (const base of candidateBases()) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, init);
      if (res.ok) {
        cachedBase = base;
        return res;
      }
      lastResponse = res;
      if (!shouldRetryStatus(res.status)) {
        return res;
      }
    } catch (err) {
      lastNetworkError = err;
    }
  }

  if (lastResponse) return lastResponse;

  throw new ApiError(
    "Could not reach the backend API. Ensure `npm run dev` is running and check the backend port log.",
    0,
    lastNetworkError
  );
}

async function groqHeaders(apiKey: string): Promise<HeadersInit> {
  const key = normalizeApiKey(apiKey);
  return {
    "X-Groq-API-Key": key,
    "Content-Type": "application/json",
  };
}

function normalizeApiKey(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");
}

function extensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("m4a")) return "m4a";
  if (m.includes("mp4")) return "mp4";
  return "webm";
}

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function transcribeAudio(apiKey: string, blob: Blob): Promise<{ text: string }> {
  const key = normalizeApiKey(apiKey);
  const fd = new FormData();
  const ext = extensionForMime(blob.type || "");
  fd.append("audio", blob, `chunk.${ext}`);

  const res = await fetchWithBackendFallback("/api/transcribe", {
    method: "POST",
    headers: {
      "X-Groq-API-Key": key,
    },
    body: fd,
  });

  const json = await readJson(res);
  if (!res.ok) {
    throw new ApiError(json?.error ?? `Transcription failed (${res.status})`, res.status, json);
  }
  return { text: json.text ?? "" };
}

export async function fetchSuggestions(
  apiKey: string,
  recentTranscript: string,
  suggestionPrompt?: string,
  meetingStyle?: string
): Promise<{ suggestions: string[] }> {
  const res = await fetchWithBackendFallback("/api/suggestions", {
    method: "POST",
    headers: await groqHeaders(apiKey),
    body: JSON.stringify({
      recentTranscript,
      ...(suggestionPrompt !== undefined ? { suggestionPrompt } : {}),
      ...(meetingStyle !== undefined ? { meetingStyle } : {}),
    }),
  });

  const json = await readJson(res);
  if (!res.ok) {
    throw new ApiError(json?.error ?? `Suggestions failed (${res.status})`, res.status, json);
  }
  const suggestions = json.suggestions;
  if (!Array.isArray(suggestions)) {
    throw new ApiError("Invalid suggestions payload.", res.status, json);
  }
  return { suggestions: suggestions.map(String) };
}

export async function chatFromSuggestion(params: {
  apiKey: string;
  suggestion: string;
  fullTranscript: string;
  suggestionDetailPrompt?: string;
  meetingStyle?: string;
}): Promise<{ reply: string }> {
  const res = await fetchWithBackendFallback("/api/chat", {
    method: "POST",
    headers: await groqHeaders(params.apiKey),
    body: JSON.stringify({
      mode: "suggestion",
      suggestion: params.suggestion,
      fullTranscript: params.fullTranscript,
      ...(params.suggestionDetailPrompt !== undefined
        ? { suggestionDetailPrompt: params.suggestionDetailPrompt }
        : {}),
      ...(params.meetingStyle !== undefined ? { meetingStyle: params.meetingStyle } : {}),
    }),
  });

  const json = await readJson(res);
  if (!res.ok) {
    throw new ApiError(json?.error ?? `Chat failed (${res.status})`, res.status, json);
  }
  return { reply: String(json.reply ?? "") };
}

export async function chatFromQuestion(params: {
  apiKey: string;
  question: string;
  fullTranscript: string;
  chatPrompt?: string;
  meetingStyle?: string;
}): Promise<{ reply: string }> {
  const res = await fetchWithBackendFallback("/api/chat", {
    method: "POST",
    headers: await groqHeaders(params.apiKey),
    body: JSON.stringify({
      mode: "question",
      question: params.question,
      fullTranscript: params.fullTranscript,
      ...(params.chatPrompt !== undefined ? { chatPrompt: params.chatPrompt } : {}),
      ...(params.meetingStyle !== undefined ? { meetingStyle: params.meetingStyle } : {}),
    }),
  });

  const json = await readJson(res);
  if (!res.ok) {
    throw new ApiError(json?.error ?? `Chat failed (${res.status})`, res.status, json);
  }
  return { reply: String(json.reply ?? "") };
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
