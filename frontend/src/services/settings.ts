import type { CopilotSettings } from "../types";

const STORAGE_KEY = "twinmind.copilot.settings.v1";

function normalizeMeetingStyle(
  value: unknown
): CopilotSettings["meetingStyle"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "sales" || v === "sales_call") return "sales";
  if (v === "engineering" || v === "engineering_sync") return "engineering";
  if (v === "product" || v === "product_review") return "product";
  return "auto";
}

export const DEFAULT_SUGGESTION_PROMPT = `You are a real-time meeting copilot.

You are an elite real-time meeting copilot.

First, analyze the transcript:

* Is there a question?
* Is a decision being discussed?
* Any confusion?
* Any metrics or claims?
* What is the meeting goal?

Then generate EXACTLY 3 suggestions.

Each suggestion MUST be one of:

1. Question to ask next
2. Direct answer to a recent question
3. Clarification
4. Fact-check
5. Strategic insight or next step

STRICT RULES:

* Each suggestion must be a DIFFERENT type
* Max 18 words
* Highly specific to the transcript
* Immediately useful in the next 30 seconds
* Avoid generic advice
* Avoid repeating earlier suggestions

STYLE:

* Crisp, actionable, conversational
* Sound like a smart teammate

OUTPUT FORMAT (STRICT JSON):
[
{ "type": "question", "text": "..." },
{ "type": "answer", "text": "..." },
{ "type": "insight", "text": "..." }
]

MEETING STYLE:
{meeting_style}

{context_signals}

Transcript:
{recent_transcript}`;

export const DEFAULT_SUGGESTION_DETAIL_PROMPT = `You are a high-performance meeting copilot.

User clicked this suggestion:
{suggestion}

Expand this into something the user can say or use immediately.

INCLUDE:

* Clear actionable response
* Why it matters
* Optional example phrasing

STYLE:

* Concise, practical, confident
* Not generic

LIMIT: 120 words

MEETING STYLE:
{meeting_style}

Transcript:
{full_transcript}`;

export const DEFAULT_CHAT_PROMPT = `You are a smart meeting copilot.

Answer the user's question using the transcript context.

RULES:

* If answer exists in transcript -> use it
* If partial -> infer carefully
* If missing -> say so, then help anyway

PRIORITIZE:

* Direct answers
* Actionable guidance
* Relevance

STYLE:

* Crisp, professional, no fluff

MEETING STYLE:
{meeting_style}

Transcript:
{full_transcript}

USER:
{question}`;

export const DEFAULT_SETTINGS: CopilotSettings = {
  groqApiKey: "",
  meetingStyle: "auto",
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  suggestionDetailPrompt: DEFAULT_SUGGESTION_DETAIL_PROMPT,
  chatPrompt: DEFAULT_CHAT_PROMPT,
  contextWindowMs: 120_000,
  chunkDurationMs: 30_000,
  suggestionIntervalMs: 30_000,
};

export function loadSettings(): CopilotSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CopilotSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      groqApiKey: typeof parsed.groqApiKey === "string" ? parsed.groqApiKey : "",
      meetingStyle: normalizeMeetingStyle(parsed.meetingStyle),
      suggestionPrompt:
        typeof parsed.suggestionPrompt === "string"
          ? parsed.suggestionPrompt
          : DEFAULT_SETTINGS.suggestionPrompt,
      suggestionDetailPrompt:
        typeof parsed.suggestionDetailPrompt === "string"
          ? parsed.suggestionDetailPrompt
          : DEFAULT_SETTINGS.suggestionDetailPrompt,
      chatPrompt:
        typeof parsed.chatPrompt === "string"
          ? parsed.chatPrompt
          : DEFAULT_SETTINGS.chatPrompt,
      contextWindowMs:
        typeof parsed.contextWindowMs === "number" && parsed.contextWindowMs >= 5000
          ? parsed.contextWindowMs
          : DEFAULT_SETTINGS.contextWindowMs,
      chunkDurationMs:
        typeof parsed.chunkDurationMs === "number" && parsed.chunkDurationMs >= 3000
          ? parsed.chunkDurationMs
          : DEFAULT_SETTINGS.chunkDurationMs,
      suggestionIntervalMs:
        typeof parsed.suggestionIntervalMs === "number" &&
        parsed.suggestionIntervalMs >= 5000
          ? parsed.suggestionIntervalMs
          : DEFAULT_SETTINGS.suggestionIntervalMs,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: CopilotSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
