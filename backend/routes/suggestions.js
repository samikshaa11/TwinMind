import { Router } from "express";
import { generateSuggestions } from "../services/suggestion.service.js";
import { formatErrorResponse, getErrorStatus } from "../utils/errors.js";

export const suggestionsRouter = Router();

suggestionsRouter.post("/", async (req, res) => {
  try {
    const { recentTranscript, suggestionPrompt, meetingStyle } = req.body ?? {};

    const result = await generateSuggestions({
      apiKey: req.groqApiKey,
      recentTranscript,
      promptTemplate: suggestionPrompt,
      meetingStyle,
    });

    return res.json(result);
  } catch (err) {
    const status = getErrorStatus(err);
    return res.status(status).json(formatErrorResponse(err));
  }
});
