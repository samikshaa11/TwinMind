/**
 * Maps Groq / network errors into HTTP responses without leaking secrets.
 */

export function getErrorStatus(err) {
  if (err && typeof err.status === "number") return err.status;
  return 500;
}

export function formatErrorResponse(err, isDev = process.env.NODE_ENV !== "production") {
  const message =
    err && typeof err.message === "string" && err.message.trim()
      ? err.message
      : "Unexpected server error";

  const body = {
    error: message,
    code: err && err.code ? String(err.code) : undefined,
  };

  if (isDev && err && err.raw) {
    body.detail = err.raw;
  }

  return body;
}

export class AppError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}
