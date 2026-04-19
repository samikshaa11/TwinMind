import { Router } from "express";
import { chatFromQuestion, chatFromSuggestion } from "../services/chat.service.js";
import { formatErrorResponse, getErrorStatus } from "../utils/errors.js";

export const chatRouter = Router();

/**
 * POST /api/chat
 * body: { mode: "suggestion" | "question", suggestion?, question?, fullTranscript, suggestionDetailPrompt?, chatPrompt? }
 */
chatRouter.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const mode = body.mode;
    const fullTranscript = body.fullTranscript;

    if (mode === "suggestion") {
      const result = await chatFromSuggestion({
        apiKey: req.groqApiKey,
        suggestion: body.suggestion,
        fullTranscript,
        promptTemplate: body.suggestionDetailPrompt,
        meetingStyle: body.meetingStyle,
      });
      return res.json(result);
    }

    if (mode === "question") {
      const result = await chatFromQuestion({
        apiKey: req.groqApiKey,
        question: body.question,
        fullTranscript,
        promptTemplate: body.chatPrompt,
        meetingStyle: body.meetingStyle,
      });
      return res.json(result);
    }

    return res.status(400).json({
      error: 'Invalid mode. Use "suggestion" or "question".',
      code: "INVALID_CHAT_MODE",
    });
  } catch (err) {
    const status = getErrorStatus(err);
    return res.status(status).json(formatErrorResponse(err));
  }
});
