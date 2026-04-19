import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_SUGGESTION_DETAIL_PROMPT,
  fillTemplate,
} from "../utils/promptTemplates.js";
import { groqChatCompletion, MODEL_CHAT } from "../utils/groqClient.js";
import { getMeetingStyleInstruction, normalizeMeetingStyle } from "../utils/meetingStyle.js";

export async function chatFromSuggestion({
  apiKey,
  suggestion,
  fullTranscript,
  promptTemplate,
  meetingStyle,
}) {
  const s = String(suggestion ?? "").trim();
  const t = String(fullTranscript ?? "").trim();

  if (!s) throw Object.assign(new Error("suggestion is required."), { status: 400 });
  if (!t) throw Object.assign(new Error("fullTranscript is required."), { status: 400 });

  const template = promptTemplate?.trim() || DEFAULT_SUGGESTION_DETAIL_PROMPT;
  const styleInstruction = getMeetingStyleInstruction(normalizeMeetingStyle(meetingStyle));
  const userContent = fillTemplate(template, {
    meeting_style: styleInstruction,
    suggestion: s,
    full_transcript: t,
  });

  const { text } = await groqChatCompletion({
    apiKey,
    model: MODEL_CHAT,
    messages: [{ role: "user", content: userContent }],
    temperature: 0.5,
    maxTokens: 900,
    reasoningEffort: "low",
  });

  return { reply: text.trim() };
}

export async function chatFromQuestion({
  apiKey,
  question,
  fullTranscript,
  promptTemplate,
  meetingStyle,
}) {
  const q = String(question ?? "").trim();
  const t = String(fullTranscript ?? "").trim();

  if (!q) throw Object.assign(new Error("question is required."), { status: 400 });
  if (!t) throw Object.assign(new Error("fullTranscript is required."), { status: 400 });

  const template = promptTemplate?.trim() || DEFAULT_CHAT_PROMPT;
  const styleInstruction = getMeetingStyleInstruction(normalizeMeetingStyle(meetingStyle));
  const userContent = fillTemplate(template, {
    meeting_style: styleInstruction,
    question: q,
    full_transcript: t,
  });

  const { text } = await groqChatCompletion({
    apiKey,
    model: MODEL_CHAT,
    messages: [{ role: "user", content: userContent }],
    temperature: 0.45,
    maxTokens: 900,
    reasoningEffort: "low",
  });

  return { reply: text.trim() };
}
