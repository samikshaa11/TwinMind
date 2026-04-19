import { DEFAULT_SUGGESTION_PROMPT, fillTemplate } from "../utils/promptTemplates.js";
import { improveSuggestionSet, parseThreeSuggestions } from "../utils/parseSuggestions.js";
import { groqChatCompletion, MODEL_CHAT } from "../utils/groqClient.js";
import { AppError } from "../utils/errors.js";
import { getMeetingStyleInstruction, normalizeMeetingStyle } from "../utils/meetingStyle.js";

function analyzeTranscript(text) {
  const lower = text.toLowerCase();
  return `Context signals:
* Question present: ${text.includes("?")}
* Numbers mentioned: ${/\d+/.test(text)}
* Decision discussion: ${lower.includes("should") || lower.includes("decide")}
`;
}

export async function generateSuggestions({ apiKey, recentTranscript, promptTemplate, meetingStyle }) {
  const recent = String(recentTranscript ?? "").trim();
  if (!recent) {
    const err = new Error("recentTranscript is required and must be non-empty.");
    err.status = 400;
    throw err;
  }

  const template = promptTemplate?.trim() || DEFAULT_SUGGESTION_PROMPT;
  const style = normalizeMeetingStyle(meetingStyle);
  const styleInstruction = getMeetingStyleInstruction(style);
  const userContent = fillTemplate(template, {
    meeting_style: styleInstruction,
    context_signals: analyzeTranscript(recent),
    recent_transcript: recent,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { text } = await groqChatCompletion({
      apiKey,
      model: MODEL_CHAT,
      messages: [{ role: "user", content: userContent }],
      temperature: attempt === 0 ? 0.65 : 0.8,
      maxTokens: 220,
      reasoningEffort: "low",
    });

    const parsed = parseThreeSuggestions(text);
    const improved = improveSuggestionSet(parsed);
    if (improved.length === 3) {
      return { suggestions: improved };
    }
  }

  throw new AppError(
    "Could not generate three distinct suggestions. Please refresh again.",
    502,
    "SUGGESTION_QUALITY_LOW"
  );
}
