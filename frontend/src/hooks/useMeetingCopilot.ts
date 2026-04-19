import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, CopilotSettings, Suggestion, TranscriptSegment } from "../types";
import {
  ApiError,
  chatFromQuestion,
  chatFromSuggestion,
  fetchSuggestions,
  transcribeAudio,
} from "../services/api";
import { buildFullTranscriptForModel, buildRecentTranscript } from "../services/transcript";
import { useAudioRecorder } from "./useAudioRecorder";

export interface UseMeetingCopilotResult {
  transcript: TranscriptSegment[];
  suggestions: Suggestion[];
  chat: ChatMessage[];
  recording: boolean;
  transcribing: boolean;
  suggestionLoading: boolean;
  chatLoading: boolean;
  micError: string | null;
  lastError: string | null;
  clearLastError: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  refreshSuggestions: () => void;
  pickSuggestion: (text: string) => Promise<void>;
  sendUserMessage: (text: string) => Promise<void>;
}

function hashText(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function toSuggestionBatch(texts: string[]): Suggestion[] {
  const batchId = crypto.randomUUID();
  const ts = Date.now();
  return texts.slice(0, 3).map((text) => ({
    id: crypto.randomUUID(),
    text,
    timestamp: ts,
    batchId,
  }));
}

export function useMeetingCopilot(settings: CopilotSettings): UseMeetingCopilotResult {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const [transcribing, setTranscribing] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const transcriptRef = useRef(transcript);
  const inFlightSuggestionsRef = useRef(false);
  const manualDebounceRef = useRef<number | null>(null);
  const lastSuggestionHashRef = useRef<string>("");
  const lastSuggestionAtRef = useRef<number>(0);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const clearLastError = useCallback(() => setLastError(null), []);

  const runSuggestions = useCallback(async (opts?: { manual?: boolean }) => {
    if (inFlightSuggestionsRef.current) return;

    const s = settingsRef.current;
    const apiKey = s.groqApiKey.trim();
    if (!apiKey) {
      if (opts?.manual) {
        setLastError("Add your Groq API key in Settings to generate suggestions.");
      }
      return;
    }

    const recent = buildRecentTranscript(transcriptRef.current, s.contextWindowMs);
    if (!recent.trim()) {
      if (opts?.manual) {
        setLastError("No transcript in the current context window yet — start recording or wait for speech.");
      }
      return;
    }

    const now = Date.now();
    const transcriptHash = hashText(recent);
    const minGap = Math.min(10_000, Math.max(2500, Math.floor(s.suggestionIntervalMs / 2)));
    if (!opts?.manual) {
      const unchanged = transcriptHash === lastSuggestionHashRef.current;
      const tooSoon = now - lastSuggestionAtRef.current < minGap;
      if (unchanged || tooSoon) return;
    }

    inFlightSuggestionsRef.current = true;
    setSuggestionLoading(true);

    try {
      const { suggestions: texts } = await fetchSuggestions(
        apiKey,
        recent,
        s.suggestionPrompt,
        s.meetingStyle
      );

      const next = toSuggestionBatch(texts);

      setSuggestions((prev) => [...next, ...prev]);
      lastSuggestionHashRef.current = transcriptHash;
      lastSuggestionAtRef.current = Date.now();
      setLastError(null);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Could not refresh suggestions. Check your network and API key.";
      setLastError(msg);
    } finally {
      inFlightSuggestionsRef.current = false;
      setSuggestionLoading(false);
    }
  }, []);

  const runSuggestionsRef = useRef(runSuggestions);
  useEffect(() => {
    runSuggestionsRef.current = runSuggestions;
  }, [runSuggestions]);

  useEffect(() => {
    const ms = Math.max(5000, settings.suggestionIntervalMs);
    const id = window.setInterval(() => {
      void runSuggestionsRef.current();
    }, ms);
    return () => clearInterval(id);
  }, [settings.suggestionIntervalMs]);

  const refreshSuggestions = useCallback(() => {
    if (manualDebounceRef.current !== null) {
      window.clearTimeout(manualDebounceRef.current);
    }
    manualDebounceRef.current = window.setTimeout(() => {
      manualDebounceRef.current = null;
      void runSuggestionsRef.current({ manual: true });
    }, 450);
  }, []);

  const onAudioChunk = useCallback(async (blob: Blob) => {
    const apiKey = settingsRef.current.groqApiKey.trim();
    if (!apiKey) {
      setLastError("Add your Groq API key in Settings to transcribe audio.");
      return;
    }

    setTranscribing(true);
    try {
      const { text } = await transcribeAudio(apiKey, blob);
      const trimmed = text.trim();
      if (!trimmed) {
        setLastError(
          "Audio chunk was received but transcription was empty. Speak clearly, keep mic close, and try 8-10s chunks."
        );
        return;
      }

      setTranscript((prev) => [...prev, { text: trimmed, timestamp: Date.now() }]);
      setLastError(null);
      // Kick suggestion generation soon after fresh transcript arrives.
      if (!inFlightSuggestionsRef.current) {
        window.setTimeout(() => {
          void runSuggestionsRef.current();
        }, 250);
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Transcription failed. Verify your API key and try again.";
      setLastError(msg);
    } finally {
      setTranscribing(false);
    }
  }, []);

  const { recording, micError, start, stop } = useAudioRecorder({
    chunkDurationMs: settings.chunkDurationMs,
    onChunk: onAudioChunk,
  });

  const pickSuggestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const apiKey = settingsRef.current.groqApiKey.trim();
      if (!apiKey) {
        setLastError("Add your Groq API key in Settings before using chat.");
        return;
      }

      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setChat((c) => [...c, userMsg]);
      setChatLoading(true);

      try {
        const full = buildFullTranscriptForModel(transcriptRef.current);
        const { reply } = await chatFromSuggestion({
          apiKey,
          suggestion: trimmed,
          fullTranscript: full,
          suggestionDetailPrompt: settingsRef.current.suggestionDetailPrompt,
          meetingStyle: settingsRef.current.meetingStyle,
        });
        const asst: ChatMessage = {
          role: "assistant",
          content: reply,
          timestamp: Date.now(),
        };
        setChat((c) => [...c, asst]);
        setLastError(null);
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : "Assistant could not respond. Try again.";
        setLastError(msg);
        const errAsst: ChatMessage = {
          role: "assistant",
          content: `Sorry — ${msg}`,
          timestamp: Date.now(),
        };
        setChat((c) => [...c, errAsst]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading]
  );

  const sendUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const apiKey = settingsRef.current.groqApiKey.trim();
      if (!apiKey) {
        setLastError("Add your Groq API key in Settings before using chat.");
        return;
      }

      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setChat((c) => [...c, userMsg]);
      setChatLoading(true);

      try {
        const full = buildFullTranscriptForModel(transcriptRef.current);
        const { reply } = await chatFromQuestion({
          apiKey,
          question: trimmed,
          fullTranscript: full,
          chatPrompt: settingsRef.current.chatPrompt,
          meetingStyle: settingsRef.current.meetingStyle,
        });
        const asst: ChatMessage = {
          role: "assistant",
          content: reply,
          timestamp: Date.now(),
        };
        setChat((c) => [...c, asst]);
        setLastError(null);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Assistant could not respond. Try again.";
        setLastError(msg);
        const errAsst: ChatMessage = {
          role: "assistant",
          content: `Sorry — ${msg}`,
          timestamp: Date.now(),
        };
        setChat((c) => [...c, errAsst]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading]
  );

  return useMemo(
    () => ({
      transcript,
      suggestions,
      chat,
      recording,
      transcribing,
      suggestionLoading,
      chatLoading,
      micError,
      lastError,
      clearLastError,
      startRecording: start,
      stopRecording: stop,
      refreshSuggestions,
      pickSuggestion,
      sendUserMessage,
    }),
    [
      transcript,
      suggestions,
      chat,
      recording,
      transcribing,
      suggestionLoading,
      chatLoading,
      micError,
      lastError,
      clearLastError,
      start,
      stop,
      refreshSuggestions,
      pickSuggestion,
      sendUserMessage,
    ]
  );
}
