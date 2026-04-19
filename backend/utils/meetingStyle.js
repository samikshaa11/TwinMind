export const MEETING_STYLES = /** @type {const} */ (["auto", "sales", "engineering", "product"]);

/**
 * @param {unknown} value
 * @returns {"auto"|"sales"|"engineering"|"product"}
 */
export function normalizeMeetingStyle(value) {
  const raw = String(value ?? "auto").trim().toLowerCase();
  // Backward compatibility with previous enum names
  if (raw === "sales_call") return "sales";
  if (raw === "product_review") return "product";
  if (raw === "engineering_sync") return "engineering";
  if (MEETING_STYLES.includes(raw)) return raw;
  return "auto";
}

export function getMeetingStyleInstruction(style) {
  switch (style) {
    case "sales":
      return "Focus on objections, value articulation, closing signals, and customer pain points. Be persuasive and concise.";
    case "engineering":
      return "Focus on tradeoffs, system design clarity, risks, edge cases, and feasibility. Be precise and technical.";
    case "product":
      return "Focus on user impact, metrics, prioritization, experiments, and UX improvements. Be strategic and user-focused.";
    default:
      return "Infer the meeting type from the transcript (sales, product, engineering) and adapt suggestions dynamically.";
  }
}

