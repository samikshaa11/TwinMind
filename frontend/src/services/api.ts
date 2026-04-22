const BASE_URL = "https://twinmind-tsnd.onrender.com";

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

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  console.log("URL inisde method:" + url);
  return fetch(url, init);
}

function normalizeApiKey(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");
}

function groqHeaders(apiKey: string): HeadersInit {
  return {
    "X-Groq-API-Key": normalizeApiKey(apiKey),
    "Content-Type": "application/json",
  };
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

/* -------------------- TRANSCRIPTION -------------------- */

export async function transcribeAudio(
  apiKey: string,
  blob: Blob
): Promise<{ text: string }> {
  const fd = new FormData();
  const ext = extensionForMime(blob.type || "");

  fd.append("audio", blob, `chunk.${ext}`);

  const res = await request("/api/transcribe", {
    method: "POST",
    headers: {
      "X-Groq-API-Key": normalizeApiKey(apiKey),
    },
    body: fd,
  });

  const json = await readJson(res);

  if (!res.ok) {
    throw new ApiError(
      json?.error ?? `Transcription failed (${res.status})`,
      res.status,
      json
    );
  }

  return { text: json.text ?? "" };
}

/* -------------------- SUGGESTIONS -------------------- */

export async function fetchSuggestions(
  apiKey: string,
  recentTranscript: string,
  suggestionPrompt?: string,
  meetingStyle?: string
): Promise<{ suggestions: string[] }> {
  const res = await request("/api/suggestions", {
    method: "POST",
    headers: groqHeaders(apiKey),
    body: JSON.stringify({
      recentTranscript,
      suggestionPrompt,
      meetingStyle,
    }),
  });

  const json = await readJson(res);

  if (!res.ok) {
    throw new ApiError(
      json?.error ?? `Suggestions failed (${res.status})`,
      res.status,
      json
    );
  }

  if (!Array.isArray(json.suggestions)) {
    throw new ApiError("Invalid suggestions payload", res.status, json);
  }

  return { suggestions: json.suggestions.map(String) };
}

/* -------------------- CHAT -------------------- */

export async function chatFromSuggestion(params: {
  apiKey: string;
  suggestion: string;
  fullTranscript: string;
  suggestionDetailPrompt?: string;
  meetingStyle?: string;
}): Promise<{ reply: string }> {
  const res = await request("/api/chat", {
    method: "POST",
    headers: groqHeaders(params.apiKey),
    body: JSON.stringify({
      mode: "suggestion",
      suggestion: params.suggestion,
      fullTranscript: params.fullTranscript,
      suggestionDetailPrompt: params.suggestionDetailPrompt,
      meetingStyle: params.meetingStyle,
    }),
  });

  const json = await readJson(res);

  if (!res.ok) {
    throw new ApiError(
      json?.error ?? `Chat failed (${res.status})`,
      res.status,
      json
    );
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
  const res = await request("/api/chat", {
    method: "POST",
    headers: groqHeaders(params.apiKey),
    body: JSON.stringify({
      mode: "question",
      question: params.question,
      fullTranscript: params.fullTranscript,
      chatPrompt: params.chatPrompt,
      meetingStyle: params.meetingStyle,
    }),
  });

  const json = await readJson(res);

  if (!res.ok) {
    throw new ApiError(
      json?.error ?? `Chat failed (${res.status})`,
      res.status,
      json
    );
  }

  return { reply: String(json.reply ?? "") };
}
