import type { Suggestion } from "../types";
import { formatClock } from "../services/transcript";
import { SuggestionSkeleton } from "./Skeleton";

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  loading: boolean;
  disabled: boolean;
  onPick: (text: string) => void;
  onRefresh: () => void;
}

function groupBatches(items: Suggestion[]) {
  const map = new Map<string, Suggestion[]>();
  for (const s of items) {
    const row = map.get(s.batchId) ?? [];
    row.push(s);
    map.set(s.batchId, row);
  }
  return [...map.entries()]
    .map(([batchId, rows]) => ({
      batchId,
      rows,
      ts: Math.max(...rows.map((r) => r.timestamp)),
    }))
    .sort((a, b) => b.ts - a.ts);
}

export function SuggestionsPanel({
  suggestions,
  loading,
  disabled,
  onPick,
  onRefresh,
}: SuggestionsPanelProps) {
  const batches = groupBatches(suggestions);

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-sm shadow-black/40">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Live suggestions</h2>
          <p className="text-xs text-zinc-500">
            Exactly 3 per batch · Newest batches on top · Click for a deeper answer in chat
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh now
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="space-y-2" aria-busy="true">
            <p className="text-xs font-medium text-zinc-400">Generating suggestions…</p>
            <SuggestionSkeleton />
            <SuggestionSkeleton />
            <SuggestionSkeleton />
          </div>
        )}

        {!loading && batches.length === 0 && (
          <p className="text-sm leading-relaxed text-zinc-500">
            Suggestions appear every refresh interval once there is transcript context in your
            configured window (default ~2 minutes).
          </p>
        )}

        {batches.map((batch) => (
          <div key={batch.batchId} className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              <span>{formatClock(batch.ts)}</span>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
            <div className="grid gap-2">
              {batch.rows.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(s.text)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left text-sm leading-snug text-zinc-100 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
