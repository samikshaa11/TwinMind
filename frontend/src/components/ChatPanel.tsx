import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { formatClock } from "../services/transcript";
import { SkeletonLine } from "./Skeleton";

export interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, loading, disabled, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-sm shadow-black/40">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Copilot chat</h2>
        <p className="text-xs text-zinc-500">
          Session is in-memory only. Use suggestions or ask your own question with full transcript
          context.
        </p>
      </header>

      <div className="scroll-fade-mask flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !loading && (
          <p className="text-sm leading-relaxed text-zinc-500">
            Click a suggestion or type a question. Answers use the meeting transcript as ground
            context.
          </p>
        )}
        {messages.map((m, idx) => (
          <article
            key={`${m.timestamp}-${idx}`}
            className={
              m.role === "user"
                ? "ml-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
                : "mr-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-50"
            }
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span className="font-semibold uppercase tracking-wide text-zinc-400">
                {m.role === "user" ? "You" : "Copilot"}
              </span>
              <span className="font-mono">{formatClock(m.timestamp)}</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </article>
        ))}

        {loading && (
          <div className="mr-6 space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3" aria-busy="true">
            <SkeletonLine className="h-3 w-1/3" />
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-3 w-11/12" />
            <SkeletonLine className="h-3 w-4/6" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-zinc-800 p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || loading || disabled) return;
            onSend(draft);
            setDraft("");
          }}
        >
          <label className="sr-only" htmlFor="chat-input">
            Ask the copilot
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a detailed question…"
            disabled={disabled || loading}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || loading || !draft.trim()}
            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </footer>
    </section>
  );
}
