# TwinMind · AI Meeting Copilot

Production-style prototype: **live microphone transcription** (Groq Whisper Large V3), **three rolling suggestions** every configurable interval (Groq `openai/gpt-oss-120b`), and a **chat column** for deep answers grounded in the **full transcript**. All state is **in-memory** in the browser session; settings (including API key) persist in **localStorage**.

Recent improvements included:
- Better suggestion quality (dedupe + diversity scoring + retry).
- Lower latency (smaller suggestion context + smarter refresh gating).
- Refactored orchestration internals for maintainability.
- Domain-adaptive prompting via meeting style presets (`auto`, `sales`, `engineering`, `product`).
- Plain-text suggestion rendering guarantee (JSON-like model output is normalized to plain text suggestions).

---

## Quick start

**1. Prerequisites**

- Node.js **≥ 18.18**
- A **Groq API key** ([Groq Console](https://console.groq.com/))

**2. Install**

From the repo root (uses **npm workspaces** — installs `backend` + `frontend` together):

```bash
npm install
```

The script `npm run install:all` runs the same command for convenience.

Or install a single workspace:

```bash
npm install -w backend
npm install -w frontend
```

**3. Run backend and frontend together**

```bash
npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend:** http://localhost:8787 by default (if `8787` is busy, the server tries the next ports and prints the URL).  
- In development, Vite **proxies** `/api/*` → the backend. The default proxy target is `http://127.0.0.1:8787`.

If you see the backend start on **8788** (or any other port), set the proxy target and restart dev:

```bash
cp frontend/.env.development.example frontend/.env.development
```

Then edit `frontend/.env.development`:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:8788
```

This repo includes `frontend/.env.development` pointing at `8788` (because `8787` is in use on this machine). If your backend prints a different port, update it accordingly.

Additionally, the frontend has a backend fallback mechanism: if the proxy target is wrong, it auto-tries common local backend ports (`8787-8807`) and uses the first healthy API it can reach. This now also recovers when Vite proxy returns `500` for stale targets.

Backend Groq calls now use endpoint-specific timeouts:
- Chat/suggestions: up to 90s
- Transcription: up to 60s
This reduces false "network failed" errors under heavier prompts.
Additionally, chat/suggestion completions run in low-reasoning mode with tighter token budgets to reduce timeout risk and improve responsiveness.

**4. Configure**

Open **Settings** in the UI and paste your **Groq API key**. Adjust prompts, **context window** (ms of transcript for suggestions), **chunk duration** (MediaRecorder timeslice), and **suggestion interval** as needed.

**Recording behavior (important):**

- Transcript updates when a chunk is uploaded (default every ~30s).
- Pressing **Stop** now forces an immediate final chunk upload, so short clips are transcribed too.
- If you want faster visible updates while testing, set **Audio chunk duration** to `8000-12000` ms in Settings.

> **Security note:** Storing API keys in `localStorage` is acceptable for a local prototype but **not** a production pattern. A hardened deploy would use short-lived tokens, server-side secrets, or a backend session.

---

## Project layout

```
TwinMind/
├── backend/                 # Express API (Groq Whisper + chat)
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── utils/
├── frontend/                # Vite + React + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── services/
│   └── vite.config.ts       # dev proxy to :8787
├── package.json             # workspaces + dev scripts (concurrently)
├── README.md
└── TECHNICAL_DETAILS.md
```

---

## Architecture

### Data flow

1. **Microphone →** `MediaRecorder` emits a blob every **chunk duration** (default ~30s).  
2. **Blob →** `POST /api/transcribe` (multipart field `audio`) → Groq Whisper `whisper-large-v3`.  
3. **Transcript append →** `{ text, timestamp }` segments; list auto-scrolls to the latest line.  
4. **Suggestions →** On a timer (and **Refresh now**, debounced), last **context window** of transcript is sent to `POST /api/suggestions`. Backend returns **exactly 3** strings; UI assigns a **batch id** and prepends the batch so **newest batches appear first**.  
5. **Chat →** Clicking a suggestion or typing a question calls `POST /api/chat` with mode `suggestion` or `question` and the **full transcript** string for grounding.

### Backend responsibilities

| Route | Role |
|--------|------|
| `GET /api/health` | Health check (no API key) |
| `POST /api/transcribe` | Whisper transcription |
| `POST /api/suggestions` | Three live suggestions from recent transcript |
| `POST /api/chat` | Detailed answer from clicked suggestion or user question |

Groq credentials are sent per request via **`X-Groq-API-Key`** or **`Authorization: Bearer`**.

### Frontend responsibilities

- **Orchestration:** `useMeetingCopilot` coordinates transcript, suggestion polling, and chat.  
- **Latency UX:** Skeletons for suggestion load and assistant reply; debounced manual refresh; non-spam errors on the background timer.  
- **Latency controls:** suggestion refresh skips unchanged recent transcript and enforces a short cooldown to avoid redundant LLM calls.
- **Export:** JSON download including `exportedAt`, `transcript`, `suggestions`, `chat`, all with timestamps.

---

## Prompt strategy and quality controls

Default prompts live in **`backend/utils/promptTemplates.js`** and are duplicated in **`frontend/src/services/settings.ts`** for first render. The UI lets you edit:

- **Live suggestions** — template with `{recent_transcript}`, `{meeting_style}`, and transcript signal hints.
- **Suggestion detail (click)** — `{suggestion}`, `{full_transcript}`.  
- **Chat (typed)** — `{full_transcript}`, `{question}`.

The chat model is **`openai/gpt-oss-120b`** on Groq for both suggestions and chat completions.

Suggestion quality logic now includes:
- Post-parse normalization and deduplication by token similarity.
- Inferred-type diversity preference (question/clarification/fact-check/strategic/answer).
- A second generation attempt with higher temperature when the first result is low-diversity.
- Safe JSON-first parsing with plain-text extraction, plus fallback parsing.
- UI always shows plain-text suggestion strings only.
- Style-aware guidance injected into prompts for domain-specific meetings:
  - **Sales call:** discovery, objection handling, ROI, next-step close.
  - **Product review:** user impact, metrics, trade-offs, rollout risks.
  - **Engineering sync:** blockers, dependencies, ownership, architecture/ops risk.

---

## Configuration (production / custom API URL)

Create `frontend/.env` when the UI and API are on different origins:

```env
VITE_API_BASE=https://your-api.example.com
```

Leave unset in local dev to use the **same-origin** `/api` path and Vite proxy.

Backend CORS defaults include `http://localhost:5173`. Override with `CORS_ORIGIN` (comma-separated) when needed.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install backend + frontend (workspaces) |
| `npm run dev` | Backend + frontend (watch) |
| `npm run build` | Build frontend to `frontend/dist` |
| `npm start` | Run backend only (`backend` start) |

---

## Tradeoffs

| Choice | Why |
|--------|-----|
| **Client-side API key** | Matches “settings panel key” requirement; simplest for a demo. Tradeoff: XSS and device access could expose the key — production should proxy through your server. |
| **In-memory chat** | Spec: session only; refresh clears chat. |
| **Line-based suggestion parse** | Spec text prompts + reliability; avoids brittle JSON when models drift. Backend enforces **3 suggestions** after parse. |
| **Separate suggestion vs chat prompts** | Clear separation of “short chips” vs “long answer” behaviors. |
| **Vite proxy in dev** | Avoids CORS friction; production needs `VITE_API_BASE` or a reverse proxy. |

---

## Technical reference

For full end-to-end technical details (state model, data flow, endpoint contracts, failure handling, quality/latency logic, and extension points), see:

- `TECHNICAL_DETAILS.md`

---

## Troubleshooting

- **`Transcription failed (500)` with Vite proxy errors**  
  Your Vite proxy target and backend port are mismatched. Restart and use the printed backend port; set `frontend/.env.development` accordingly.

- **`Could not reach Groq chat API...`**  
  Usually timeout or transient network issue. Backend now uses retries, endpoint-specific timeout budgets, and low-reasoning mode for faster completions.

- **Suggestions show JSON-like objects instead of plain text**  
  Backend parser now extracts and normalizes suggestion text so UI always displays plain text suggestions.

---

## License

Use and modify for your TwinMind prototype as needed.
