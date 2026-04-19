import { useEffect, useState } from "react";
import type { CopilotSettings } from "../types";

export interface SettingsDrawerProps {
  open: boolean;
  settings: CopilotSettings;
  onClose: () => void;
  onSave: (next: CopilotSettings) => void;
}

export function SettingsDrawer({ open, settings, onClose, onSave }: SettingsDrawerProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close settings overlay"
        onClick={onClose}
      />

      <div className="relative z-10 m-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/60">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Settings</h2>
            <p className="text-xs text-zinc-500">
              Keys stay in this browser (localStorage). Never hardcode secrets in the client in
              production apps without additional protection.
            </p>
            <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
              Domain-adaptive copilot: choose a meeting style below to sharpen suggestions and chat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            onClose();
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-300">Groq API key</span>
            <input
              type="password"
              autoComplete="off"
              value={draft.groqApiKey}
              onChange={(e) => setDraft((d) => ({ ...d, groqApiKey: e.target.value }))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Paste your key"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-300">
              Meeting style tuning (domain-adaptive)
            </span>
            <select
              value={draft.meetingStyle}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  meetingStyle: e.target.value as CopilotSettings["meetingStyle"],
                }))
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="auto">Auto-detect from transcript</option>
              <option value="sales">Sales call</option>
              <option value="engineering">Engineering sync</option>
              <option value="product">Product review</option>
            </select>
            <span className="text-[11px] text-zinc-600">
              Directly changes prompt strategy for suggestion quality and chat relevance.
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-300">Context window (ms)</span>
              <input
                type="number"
                min={5000}
                step={1000}
                value={draft.contextWindowMs}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, contextWindowMs: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <span className="text-[11px] text-zinc-600">Recent transcript fed to suggestions</span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-300">Audio chunk duration (ms)</span>
              <input
                type="number"
                min={3000}
                step={1000}
                value={draft.chunkDurationMs}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, chunkDurationMs: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <span className="text-[11px] text-zinc-600">
                MediaRecorder timeslice — restart mic after changing
              </span>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-300">Suggestion refresh interval (ms)</span>
            <input
              type="number"
              min={5000}
              step={1000}
              value={draft.suggestionIntervalMs}
              onChange={(e) =>
                setDraft((d) => ({ ...d, suggestionIntervalMs: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-300">Live suggestions prompt</span>
            <textarea
              value={draft.suggestionPrompt}
              onChange={(e) => setDraft((d) => ({ ...d, suggestionPrompt: e.target.value }))}
              rows={10}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-100"
            />
            <span className="text-[11px] text-zinc-600">Placeholder: {"{recent_transcript}"}</span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-300">Suggestion detail prompt (click)</span>
            <textarea
              value={draft.suggestionDetailPrompt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, suggestionDetailPrompt: e.target.value }))
              }
              rows={8}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-100"
            />
            <span className="text-[11px] text-zinc-600">
              Placeholders: {"{suggestion}"}, {"{full_transcript}"}
            </span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-300">Chat prompt (typed questions)</span>
            <textarea
              value={draft.chatPrompt}
              onChange={(e) => setDraft((d) => ({ ...d, chatPrompt: e.target.value }))}
              rows={8}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-100"
            />
            <span className="text-[11px] text-zinc-600">
              Placeholders: {"{full_transcript}"}, {"{question}"}
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
