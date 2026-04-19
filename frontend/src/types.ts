export interface TranscriptSegment {
  text: string;
  timestamp: number;
}

export interface Suggestion {
  id: string;
  text: string;
  timestamp: number;
  batchId: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type MeetingStyle = "auto" | "sales" | "engineering" | "product";

export interface CopilotSettings {
  groqApiKey: string;
  meetingStyle: MeetingStyle;
  suggestionPrompt: string;
  suggestionDetailPrompt: string;
  chatPrompt: string;
  contextWindowMs: number;
  chunkDurationMs: number;
  suggestionIntervalMs: number;
}
