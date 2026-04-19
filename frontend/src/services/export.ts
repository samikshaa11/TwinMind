import type { ChatMessage, Suggestion, TranscriptSegment } from "../types";

export interface ExportPayload {
  exportedAt: string;
  transcript: TranscriptSegment[];
  suggestions: Suggestion[];
  chat: ChatMessage[];
}

export function downloadJsonExport(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `twinmind-export-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
