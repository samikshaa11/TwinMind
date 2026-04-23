import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { formatErrorResponse } from "./utils/errors.js";

const app = express();

const preferredPort = Number(process.env.PORT) || 8787;
const MAX_PORT_TRIES = 30;

const configuredOrigins =
  process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) || [];

function isLocalDevOrigin(origin) {
  if (!origin) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

// const corsOptions = {
//   origin: 'https://twin-mind-frontend-samikshas-projects-14a163de.vercel.app/', // Replace with your domain
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow only specific HTTP methods
//   credentials: true // Allow cookies/headers if needed
// };

// app.use(cors(corsOptions));


app.use(cors());

// app.use(
//   cors({
//     origin(origin, cb) {
//       if (isLocalDevOrigin(origin)) {
//         cb(null, true);
//         return;
//       }
//       if (configuredOrigins.includes(origin)) {
//         cb(null, true);
//         return;
//       }
//       cb(new Error(`CORS blocked for origin: ${origin || "unknown"}`));
//     },
//     credentials: false,
//   })
// );

app.use(express.json({ limit: "2mb" }));

app.use("/api", apiRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json(formatErrorResponse(err));
});

let boundPort = preferredPort;
const server = app.listen(boundPort);

server.on("listening", () => {
  const addr = server.address();
  const p = typeof addr === "object" && addr && "port" in addr ? addr.port : boundPort;
  // eslint-disable-next-line no-console
  console.log(`TwinMind API listening on http://localhost:${p}`);
  if (p !== preferredPort) {
    // eslint-disable-next-line no-console
    console.warn(
      `[TwinMind] Port ${preferredPort} was in use; using ${p}. If the UI cannot reach the API, add to frontend/.env.development:\n  VITE_API_PROXY_TARGET=http://localhost:${p}\n`
    );
  }
});

server.on("error", (err) => {
  const code = /** @type {NodeJS.ErrnoException} */ (err).code;
  if (code === "EADDRINUSE" && boundPort - preferredPort < MAX_PORT_TRIES) {
    boundPort += 1;
    server.listen(boundPort);
    return;
  }
  // eslint-disable-next-line no-console
  console.error("TwinMind API failed to start:", err);
  process.exit(1);
});
