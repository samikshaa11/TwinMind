import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { formatErrorResponse } from "./utils/errors.js";

const app = express();

/**
 * 🚀 PRODUCTION-CORRECT PORT HANDLING (Render-safe)
 * MUST use process.env.PORT exactly once
 */
const PORT = process.env.PORT || 8787;

/**
 * -----------------------------
 * CORS CONFIG
 * -----------------------------
 */
const configuredOrigins =
  process.env.CORS_ORIGIN?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) || [];

function isLocalDevOrigin(origin) {
  if (!origin) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

app.use(
  cors({
    origin(origin, cb) {
      if (isLocalDevOrigin(origin)) {
        cb(null, true);
        return;
      }

      if (configuredOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error(`CORS blocked for origin: ${origin || "unknown"}`));
    },
    credentials: false,
  })
);

/**
 * -----------------------------
 * MIDDLEWARE
 * -----------------------------
 */
app.use(express.json({ limit: "2mb" }));

/**
 * -----------------------------
 * ROUTES
 * -----------------------------
 */
app.use("/api", apiRouter);

/**
 * -----------------------------
 * ERROR HANDLER
 * -----------------------------
 */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status =
    err?.status && Number.isInteger(err.status) ? err.status : 500;

  res.status(status).json(formatErrorResponse(err));
});

/**
 * -----------------------------
 * SERVER START (IMPORTANT FIX)
 * -----------------------------
 * ❌ NO PORT SCANNING
 * ❌ NO RETRIES
 * ❌ NO DYNAMIC BINDING
 *
 * Render REQUIREMENT: bind exactly once to process.env.PORT
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`TwinMind API listening on port ${PORT}`);
});
