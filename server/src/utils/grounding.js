function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findSpan(documentText, needle) {
  if (!needle) return null;
  const source = String(documentText || "");
  const idx = source.indexOf(needle);
  if (idx >= 0) {
    return { text: needle, start: idx, end: idx + needle.length };
  }
  const lowerSource = source.toLowerCase();
  const lowerNeedle = String(needle).toLowerCase();
  const idx2 = lowerSource.indexOf(lowerNeedle);
  if (idx2 >= 0) {
    return { text: source.slice(idx2, idx2 + needle.length), start: idx2, end: idx2 + needle.length };
  }
  return null;
}

function groundObligation(documentText, fields) {
  const spans = [];
  const checks = [];

  Object.entries(fields).forEach(([key, value]) => {
    if (!value) {
      checks.push({ field: key, grounded: false });
      return;
    }
    const span = findSpan(documentText, value);
    if (span) {
      spans.push({ field: key, ...span });
      checks.push({ field: key, grounded: true });
    } else {
      checks.push({ field: key, grounded: false });
    }
  });

  const groundedCount = checks.filter((c) => c.grounded).length;
  const ratio = checks.length ? groundedCount / checks.length : 0;
  const confidence = Math.round(ratio * 100);
  let groundingStatus = "partial";
  if (ratio === 1) groundingStatus = "grounded";
  if (ratio < 0.5) groundingStatus = "ungrounded";

  return { sourceSpans: spans, confidence, groundingStatus, checks };
}

function confidenceFromGrounding(groundingStatus, extraBoost = 0) {
  const base = groundingStatus === "grounded" ? 92 : groundingStatus === "partial" ? 64 : 28;
  return Math.max(5, Math.min(99, base + extraBoost));
}

module.exports = { findSpan, groundObligation, confidenceFromGrounding, normalize };
