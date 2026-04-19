import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "../types";
import { formatClock } from "../services/transcript";

export interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  recording: boolean;
  transcribing: boolean;
  onStart: () => void | Promise<void>;
  onStop: () => void;
  micError: string | null;
}

export function TranscriptPanel({
  segments,
  recording,
  transcribing,
  onStart,
  onStop,
  micError,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments]);

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-sm shadow-black/40">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Live transcript</h2>
          <p className="text-xs text-zinc-500">Microphone → short chunks → Whisper transcription</p>
        </div>
        <div className="flex items-center gap-2">
          {transcribing && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
              Transcribing…
            </span>
          )}
          {recording && !transcribing && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
              Listening
            </span>
          )}
          {!recording ? (
            <button
              type="button"
              onClick={() => void onStart()}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Start microphone
            </button>
          ) : (
            <button
              type="button"
              onClick={onStop}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
            >
              Stop
            </button>
          )}
        </div>
      </header>

      {micError && (
        <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {micError}
        </div>
      )}

      <div className="scroll-fade-mask relative flex-1 overflow-y-auto px-4 py-4">
        {segments.length === 0 ? (
          <p className="text-sm leading-relaxed text-zinc-500">
            Start the microphone to capture speech. Transcript lines appear here as each chunk is
            processed — newest at the bottom.
          </p>
        ) : (
          <ul className="space-y-3">
            {segments.map((s, idx) => (
              <li key={`${s.timestamp}-${idx}`} className="text-sm leading-relaxed">
                <span className="mr-2 font-mono text-[11px] text-zinc-500">
                  {formatClock(s.timestamp)}
                </span>
                <span className="text-zinc-100">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
