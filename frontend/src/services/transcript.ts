import type { TranscriptSegment } from "../types";

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function buildRecentTranscript(
  segments: TranscriptSegment[],
  contextWindowMs: number,
  now: number = Date.now()
): string {
  const cutoff = now - contextWindowMs;
  const joined = segments
    .filter((s) => s.timestamp >= cutoff)
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n");
  // Keep prompt lean for lower latency and more focused suggestions.
  const MAX_CHARS = 2500;
  if (joined.length <= MAX_CHARS) return joined;
  return joined.slice(joined.length - MAX_CHARS);
}

export function buildFullTranscriptForModel(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const body = s.text.trim();
      if (!body) return "";
      return `[${formatClock(s.timestamp)}] ${body}`;
    })
    .filter(Boolean)
    .join("\n");
}
