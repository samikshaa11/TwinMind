function normalizeApiKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");
}

export function attachGroqApiKey(req, res, next) {
  const headerKey = req.headers["x-groq-api-key"];
  const auth = req.headers.authorization;

  let key = null;
  if (typeof headerKey === "string" && headerKey.trim()) {
    key = normalizeApiKey(headerKey);
  } else if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    key = normalizeApiKey(auth.slice(7));
  }

  if (!key) {
    return res.status(401).json({
      error:
        "Missing Groq API key. Send header X-Groq-API-Key or Authorization: Bearer <key>.",
      code: "MISSING_API_KEY",
    });
  }

  if (!/^gsk_[A-Za-z0-9_-]{20,}$/.test(key)) {
    return res.status(401).json({
      error:
        "Invalid Groq API key format. Re-paste a full key from Groq Console (starts with gsk_).",
      code: "INVALID_API_KEY_FORMAT",
    });
  }

  req.groqApiKey = key;
  next();
}
