import { useMemo, useState } from "react";
import type { CopilotSettings } from "../types";
import { downloadJsonExport } from "../services/export";
import { loadSettings, saveSettings } from "../services/settings";
import { useMeetingCopilot } from "../hooks/useMeetingCopilot";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { SuggestionsPanel } from "../components/SuggestionsPanel";
import { ChatPanel } from "../components/ChatPanel";
import { SettingsDrawer } from "../components/SettingsDrawer";

const STYLE_LABEL: Record<CopilotSettings["meetingStyle"], string> = {
  auto: "Auto",
  sales: "Sales Call",
  product: "Product Review",
  engineering: "Engineering Sync",
};

export function CopilotPage() {
  const [settings, setSettings] = useState<CopilotSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const copilot = useMeetingCopilot(settings);

  const chatDisabled = useMemo(
    () => !settings.groqApiKey.trim(),
    [settings.groqApiKey]
  );

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      <header className="border-b border-zinc-900/80 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              TwinMind
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-50">AI meeting copilot</h1>
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                Domain-adaptive: {STYLE_LABEL[settings.meetingStyle]}
              </span>
            </div>
            <p className="max-w-xl text-sm text-zinc-500">
              Three live columns: transcript → short suggestions → detailed chat grounded in what was
              said. Style-aware prompts tune outputs for sales, product, or engineering meetings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                downloadJsonExport({
                  exportedAt: new Date().toISOString(),
                  transcript: copilot.transcript,
                  suggestions: copilot.suggestions,
                  chat: copilot.chat,
                });
              }}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200"
            >
              Settings
            </button>
          </div>
        </div>
        {copilot.lastError && (
          <div className="mx-auto flex max-w-[1600px] items-start gap-3 border-t border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="flex-1">{copilot.lastError}</p>
            <button
              type="button"
              onClick={copilot.clearLastError}
              className="rounded-md border border-amber-400/40 px-2 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-500/20"
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <TranscriptPanel
          segments={copilot.transcript}
          recording={copilot.recording}
          transcribing={copilot.transcribing}
          onStart={copilot.startRecording}
          onStop={copilot.stopRecording}
          micError={copilot.micError}
        />
        <SuggestionsPanel
          suggestions={copilot.suggestions}
          loading={copilot.suggestionLoading}
          disabled={copilot.chatLoading || chatDisabled}
          onPick={copilot.pickSuggestion}
          onRefresh={copilot.refreshSuggestions}
        />
        <ChatPanel
          messages={copilot.chat}
          loading={copilot.chatLoading}
          disabled={chatDisabled}
          onSend={copilot.sendUserMessage}
        />
      </main>

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setSettings(next);
          saveSettings(next);
        }}
      />
    </div>
  );
}
