import { Router } from "express";
import multer from "multer";
import { transcribeChunk } from "../services/transcription.service.js";
import { formatErrorResponse, getErrorStatus } from "../utils/errors.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // Groq docs mention large limits for paid tiers; guard abuse
});

export const transcribeRouter = Router();

transcribeRouter.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        error: 'Expected multipart field "audio" with audio bytes.',
        code: "MISSING_AUDIO",
      });
    }

    const mimeType = req.file.mimetype || "application/octet-stream";
    const original = req.file.originalname || "audio.webm";

    const { text } = await transcribeChunk({
      apiKey: req.groqApiKey,
      buffer: req.file.buffer,
      filename: original,
      mimeType,
    });

    return res.json({ text });
  } catch (err) {
    const status = getErrorStatus(err);
    return res.status(status).json(formatErrorResponse(err));
  }
});
