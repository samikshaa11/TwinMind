import { Router } from "express";
import { attachGroqApiKey } from "../middleware/groqAuth.js";
import { transcribeRouter } from "./transcribe.js";
import { suggestionsRouter } from "./suggestions.js";
import { chatRouter } from "./chat.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "twinmind-copilot-api" });
});

apiRouter.use(attachGroqApiKey);

apiRouter.use("/transcribe", transcribeRouter);
apiRouter.use("/suggestions", suggestionsRouter);
apiRouter.use("/chat", chatRouter);
