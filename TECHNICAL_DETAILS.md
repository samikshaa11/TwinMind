# TwinMind Copilot - Technical Details

This document is the end-to-end technical reference for the TwinMind meeting copilot implementation.

## 1) System overview

The app has three real-time flows:

1. **Audio -> Transcript**
   - Browser microphone via `MediaRecorder`.
   - Rotating chunk strategy in frontend.
   - Multipart upload to backend `/api/transcribe`.
   - Backend sends chunk to Groq Whisper (`whisper-large-v3`).
   - Transcript appended in-memory as `{ text, timestamp }`.

2. **Transcript -> Suggestions**
   - Every interval (or manual refresh), only recent transcript window is used.
   - Frontend trims context to keep suggestion prompt small for latency.
   - Backend uses GPT OSS 120B and strict output format.
   - Suggestion parser + quality pass enforce clean, diverse, exactly 3 suggestions.

3. **Suggestion / Question -> Chat**
   - Suggestion click or user question is sent to `/api/chat`.
   - Backend prompts GPT OSS 120B with full transcript context.
   - Assistant response appended in-memory chat timeline.

## 2) Data model

Frontend state shape:

- `transcript: Array<{ text: string; timestamp: number }>`
- `suggestions: Array<{ id: string; text: string; timestamp: number; batchId: string }>`
- `chat: Array<{ role: "user" | "assistant"; content: string; timestamp: number }>`

## 3) Frontend architecture

Main areas:

- `src/pages/CopilotPage.tsx`: page composition + settings/export controls.
- `src/hooks/useMeetingCopilot.ts`: orchestration of transcription, suggestions, and chat.
- `src/hooks/useAudioRecorder.ts`: robust chunk recording lifecycle.
- `src/services/api.ts`: API transport, backend discovery fallback, key normalization.
- `src/services/settings.ts`: default prompts + localStorage persistence.
- `src/components/*`: transcript/suggestions/chat/settings UI.

### 3.1 Recorder strategy (reliability)

The recorder uses a **rotate-per-chunk** pattern:

- Start recorder.
- After `chunkDurationMs`, stop recorder to produce a complete chunk.
- On `onstop`, if still recording, immediately create/start next recorder.

Why:
- Avoids invalid partial container fragments seen with some timeslice/requestData combinations.
- Produces self-contained media chunks that Whisper can decode consistently.

### 3.2 Suggestion latency controls

`useMeetingCopilot` reduces unnecessary suggestion calls by:

- Hashing recent transcript text.
- Skipping auto-refresh when transcript hash has not changed.
- Applying minimum cooldown between auto refreshes.
- Triggering suggestion generation shortly after new transcript arrives (small delay) to reduce perceived wait.

### 3.3 Backend endpoint fallback

In dev, `api.ts` can recover if proxy port drifts:

- Tries same-origin `/api` first.
- Falls back across local backend candidates (`8787-8807`).
- Retries fallback when proxy returns `500` due to stale target port.
- Caches first healthy base and reuses it.

## 4) Backend architecture

Main areas:

- `server.js`: Express setup, CORS, dynamic port bind with fallback.
- `routes/transcribe.js`: audio upload handling via `multer` memory storage.
- `routes/suggestions.js`: suggestion generation endpoint.
- `routes/chat.js`: chat endpoint for suggestion clicks and user questions.
- `middleware/groqAuth.js`: API key extraction/normalization/format guard.
- `utils/groqClient.js`: Groq API client with timeout/retry/network mapping.

### 4.1 Groq client hardening

`groqClient.js` includes:

- Request timeout (`AbortController`).
- Retry on transient failures (`408`, `429`, `5xx`).
- Explicit network error mapping (`GROQ_NETWORK_ERROR`).
- Endpoint-specific timeout budgets:
  - chat/suggestions: 90s
  - transcription: 60s
- Timeout-specific error code (`GROQ_TIMEOUT`) for clearer diagnosis.
- Chat/suggestion calls use low reasoning effort with reduced max tokens to keep responses fast and lower timeout probability.

### 4.2 Multipart transcription path

Transcription uses native runtime primitives:

- `FormData` + `Blob` (Node fetch-compatible)
- No manual multipart headers

This avoids malformed multipart boundary failures.

## 5) Suggestion quality logic

Backend quality pipeline:

1. Generate suggestions with style + context-signal prompt guidance.
2. Parse output with JSON-first strategy (`parseThreeSuggestions`):
   - if model returns JSON array of `{ type, text }`, extract `text`
   - otherwise fallback to robust line parsing
3. Improve set (`improveSuggestionSet`):
   - normalize text
   - similarity dedupe (Jaccard over token sets)
   - type diversity preference (question / clarification / fact-check / strategic / answer)
4. If quality low (<3 distinct), retry generation once with higher temperature.
5. Return plain text suggestions only (`string[]`) to the frontend.

## 6) Prompting strategy

Templates:

- Suggestion prompt: `{recent_transcript}`, `{meeting_style}`, `{context_signals}`
- Suggestion-click prompt: `{suggestion}`, `{full_transcript}`
- Chat prompt: `{question}`, `{full_transcript}`

All defaults are editable in Settings and persisted locally.

Meeting-style adaptation:

- `auto` (default): infer style from transcript content.
- `sales`: optimize for discovery, objections, value framing, and close signals.
- `product`: optimize for user impact, metrics, prioritization, and experiments.
- `engineering`: optimize for tradeoffs, risks, edge-cases, and feasibility.

This style flag is sent from frontend settings to backend suggestion/chat services and appended as explicit instruction in prompt payloads.

Style values are normalized to:
- `auto`
- `sales`
- `engineering`
- `product`

## 7) Error handling behavior

Frontend:

- User-visible banner for actionable errors.
- Distinguishes missing key, empty transcript, API failures, and empty transcription output.

Backend:

- Structured error responses with `error` + optional `code`.
- Includes `detail` payload in non-production mode for diagnostics.

## 8) Security notes

- API key is user-supplied and stored in browser localStorage for prototype simplicity.
- For production, key handling should move server-side with session/token strategy.
- Revoke exposed keys immediately if pasted into terminal or logs.

## 9) Performance and scalability considerations

Current latency/perf optimizations:

- Small recent transcript context for suggestions.
- Reduced redundant suggestion calls via hash/cooldown gating.
- Lightweight in-memory client state.

Future improvements:

- WebSocket streaming transcript updates.
- Background workers for queueing transcription jobs.
- Persisted session storage (optional) with retention controls.

## 10) Runbook (local)

1. Install: `npm install`
2. Start: `npm run dev`
3. Use current printed frontend/backend URLs.
4. In Settings:
   - paste valid Groq key
   - recommended chunk for testing: `8000` ms
5. Speak for ~10-15s and stop to verify transcript, then refresh suggestions.

## 11) Known failure modes and mitigation

- **Proxy target drift (`ECONNREFUSED`)**  
  Frontend fallback probes local backend ports (`8787-8807`) and retries on proxy `500`/`502`/`503`/`504`.

- **Groq latency spikes**  
  Chat/suggestion calls run with low reasoning effort and tighter token budgets to reduce timeout risk.

- **Non-plain suggestion output**  
  Parser normalizes object/JSON-like outputs into plain text strings before UI render.

