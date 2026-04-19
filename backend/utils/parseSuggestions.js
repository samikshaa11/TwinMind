import { AppError } from "./errors.js";

/**
 * Parse model output into exactly 3 non-empty suggestion strings.
 * Accepts numbered lines, bullets, or plain lines.
 */
export function parseThreeSuggestions(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AppError("Model returned empty suggestions.", 502, "EMPTY_SUGGESTIONS");
  }

  const jsonParsed = tryParseSuggestionJson(raw);
  if (jsonParsed.length >= 3) {
    return jsonParsed.slice(0, 3);
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*[\-*•]\s*/, "")
        .replace(/^\s*\d+[\.)]\s*/, "")
        .trim()
    )
    .filter(Boolean);

  const merged = [];
  for (const line of lines) {
    // Split on semicolons only if line looks like multiple suggestions jammed together
    const parts = line.includes(";") ? line.split(";").map((p) => p.trim()).filter(Boolean) : [line];
    for (const p of parts) merged.push(p);
  }

  const cleaned = merged.map((s) => s.replace(/^["']|["']$/g, "").trim()).filter(Boolean);

  if (cleaned.length < 3) {
    throw new AppError(
      "Could not parse 3 suggestions from model output. Try again or adjust the suggestion prompt.",
      502,
      "PARSE_SUGGESTIONS"
    );
  }

  return cleaned.slice(0, 3);
}

function tryParseSuggestionJson(raw) {
  const blockMatch = raw.match(/\[[\s\S]*\]/);
  const jsonCandidate = (blockMatch ? blockMatch[0] : raw).trim();
  try {
    const parsed = JSON.parse(jsonCandidate);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (item && typeof item.text === "string" ? item.text.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeSuggestion(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "")
    .trim();
}

function tokenSet(text) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 3)
  );
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size && !B.size) return 1;
  let intersection = 0;
  for (const t of A) {
    if (B.has(t)) intersection += 1;
  }
  const union = new Set([...A, ...B]).size || 1;
  return intersection / union;
}

function inferType(text) {
  const t = text.toLowerCase();
  if (t.includes("?")) return "question";
  if (/(clarify|clarification|means|in other words)/.test(t)) return "clarification";
  if (/(fact-check|verify|double-check|correction|incorrect)/.test(t)) return "fact-check";
  if (/(talking point|position|strategy|strategic|framing)/.test(t)) return "strategic";
  return "answer";
}

/**
 * Normalize/dedupe suggestions and prefer diversity by inferred type.
 * Always returns at most 3 suggestions preserving usefulness.
 */
export function improveSuggestionSet(parsedSuggestions) {
  const normalized = parsedSuggestions.map(normalizeSuggestion).filter(Boolean);
  const unique = [];

  for (const s of normalized) {
    const tooSimilar = unique.some((u) => jaccard(u, s) >= 0.8);
    if (!tooSimilar) unique.push(s);
  }

  if (unique.length <= 3) return unique;

  const selected = [];
  const usedTypes = new Set();

  for (const s of unique) {
    const type = inferType(s);
    if (!usedTypes.has(type)) {
      selected.push(s);
      usedTypes.add(type);
    }
    if (selected.length === 3) return selected;
  }

  for (const s of unique) {
    if (!selected.includes(s)) selected.push(s);
    if (selected.length === 3) break;
  }
  return selected;
}
