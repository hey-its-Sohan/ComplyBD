/**
 * demoProvider.js
 * -----------------------------------------------------------------------------
 * Deterministic extraction engine. No network, no API key, no randomness.
 *
 * This is the default provider so the product is always demonstrable. It reads
 * the actual circular text supplied to it — it does not replay canned answers —
 * and it is deliberately allowed to guess. When it guesses (for example falling
 * back to a database effective date that was never written in the document) the
 * grounding engine catches it and the obligation is routed to human review.
 * That failure path is a feature: it is what proves the safety layer works.
 */

const {
  parseDateString,
  formatDate,
  toBengaliDigits,
  toAsciiDigits,
  normalize,
  BANGLA_MONTHS,
} = require("../banglaText");
const { CATEGORY_TERMS, OBLIGATION_TERMS, banglaCategory } = require("../fieldLexicon");

// Detection uses exactly the same term lists the grounding engine verifies
// against, so this engine can never propose a label it cannot support.
const CATEGORY_RULES = Object.entries(CATEGORY_TERMS).map(([category, keywords]) => ({
  category,
  keywords,
}));

const OBLIGATION_RULES = Object.entries(OBLIGATION_TERMS)
  .filter(([, keywords]) => keywords.length)
  .map(([type, keywords]) => ({ type, keywords }));

// Words that signal a date is the *effective* date rather than the issue date.
const EFFECTIVE_CUES = ["কার্যকর", "বলবৎ", "থেকে", "হইতে", "প্রযোজ্য হবে", "effective"];

// Words that signal an issue/publication date, which we must not mistake for
// the effective date.
const ISSUE_CUES = ["তারিখ:", "তারিখ :", "ইস্যু", "স্মারক"];

const BANGLA_MONTH_PATTERN = BANGLA_MONTHS.flatMap((m) => m.names).join("|");

/**
 * Find every date-looking string in the document along with its offset.
 */
function findDateCandidates(text) {
  const candidates = [];
  const patterns = [
    new RegExp(`[০-৯0-9]{1,2}\\s*(?:${BANGLA_MONTH_PATTERN})\\s*,?\\s*[০-৯0-9]{4}`, "g"),
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    /\b\d{4}-\d{2}-\d{2}\b/g,
  ];

  patterns.forEach((re) => {
    let match;
    while ((match = re.exec(text)) !== null) {
      candidates.push({ raw: match[0], start: match.index, end: match.index + match[0].length });
    }
  });

  return candidates.sort((a, b) => a.start - b.start);
}

/**
 * Score each date by the words around it and pick the most likely effective date.
 */
function pickEffectiveDate(text) {
  const candidates = findDateCandidates(text);
  if (!candidates.length) return null;

  let best = null;

  for (const candidate of candidates) {
    const window = text.slice(Math.max(0, candidate.start - 60), candidate.end + 80);
    let score = 0;
    EFFECTIVE_CUES.forEach((cue) => {
      if (window.includes(cue)) score += 2;
    });
    ISSUE_CUES.forEach((cue) => {
      if (window.includes(cue)) score -= 3;
    });
    // A date in the first two lines is almost always the issue date.
    if (candidate.start < (text.indexOf("\n\n") >= 0 ? text.indexOf("\n\n") : 120)) score -= 1;

    const parsed = parseDateString(candidate.raw);
    if (!parsed) continue;

    if (!best || score > best.score) {
      best = { ...candidate, score, parsed };
    }
  }

  if (!best || best.score <= 0) return null;
  return best;
}

/**
 * Pull the penalty clause. Bangla circulars almost always phrase this with
 * জরিমানা / দণ্ড / শাস্তি, so we capture the containing clause verbatim.
 */
function pickPenalty(text) {
  const patterns = [
    /(?:জরিমানা|অর্থদণ্ড|দণ্ড|শাস্তি)[^\n।]{0,140}/,
    /penalty[^\n.]{0,140}/i,
    /fine of[^\n.]{0,140}/i,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      return { raw: match[0].trim(), start: match.index, end: match.index + match[0].length };
    }
  }
  return null;
}

function detectCategory(text) {
  const normalized = normalize(text, { stripPunctuation: true });
  const scored = CATEGORY_RULES.map((rule) => {
    const hits = rule.keywords.filter((k) => normalized.includes(normalize(k, { stripPunctuation: true })));
    return { category: rule.category, hits, count: hits.length };
  })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!scored.length) {
    return { category: "Retail Shop", evidence: null, alternates: [], inferred: true };
  }

  return {
    category: scored[0].category,
    evidence: scored[0].hits[0],
    alternates: scored.slice(1).map((s) => s.category),
    inferred: false,
  };
}

function detectObligationType(text) {
  const normalized = normalize(text, { stripPunctuation: true });
  for (const rule of OBLIGATION_RULES) {
    const hit = rule.keywords.find((k) => normalized.includes(normalize(k, { stripPunctuation: true })));
    if (hit) return { type: rule.type, evidence: hit, inferred: false };
  }
  return { type: "General Compliance", evidence: null, inferred: true };
}

function pickVatRate(text) {
  const ascii = toAsciiDigits(text);
  const match =
    ascii.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:মূসক|ভ্যাট|vat|উৎসে কর)/i) ||
    ascii.match(/(?:মূসক|ভ্যাট|vat)\s*(\d{1,2}(?:\.\d+)?)\s*%/i) ||
    ascii.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  return match ? match[1] : null;
}

/**
 * Build the required action sentence in Bangla from what we found.
 */
function buildRequiredAction({ obligationType, vatRate, effectiveDateBangla }) {
  const when = effectiveDateBangla ? `${effectiveDateBangla} তারিখ থেকে ` : "";
  switch (obligationType) {
    case "VAT Rate Change":
      return `${when}চালানে ${vatRate ? toBengaliDigits(vatRate) + "% " : ""}মূসক আলাদাভাবে দেখান এবং হিসাব ব্যবস্থায় নতুন হার হালনাগাদ করুন।`;
    case "EFD Device Mandate":
      return `${when}অনুমোদিত ইলেকট্রনিক ফিসকাল ডিভাইস স্থাপন করুন এবং সংযোগ সচল রাখুন।`;
    case "Withholding Tax":
      return `${when}সরবরাহকারীকে পরিশোধের সময় নির্ধারিত হারে উৎসে কর কর্তন করে জমা দিন।`;
    case "E-Return Filing":
      return `${when}নির্ধারিত সময়ে মূসক রিটার্ন অনলাইনে দাখিল করুন।`;
    case "Invoice / Record Keeping":
      return `${when}চালান ও হিসাব নথি নির্ধারিত ফরম্যাটে সংরক্ষণ করুন।`;
    case "Registration Requirement":
      return `${when}নিবন্ধন তথ্য হালনাগাদ করুন এবং চালানে বিআইএন উল্লেখ করুন।`;
    default:
      return `${when}পরিপত্রে বর্ণিত নির্দেশনা অনুসরণ করুন এবং প্রয়োজনে হিসাবরক্ষকের সঙ্গে পরামর্শ করুন।`;
  }
}

function buildSummary({ category, obligationType, vatRate, effectiveDateBangla, penalty }) {
  const parts = [];
  const when = effectiveDateBangla ? `${effectiveDateBangla} থেকে` : "নির্ধারিত তারিখ থেকে";
  const bnCategory = banglaCategory(category);

  if (obligationType === "VAT Rate Change" && vatRate) {
    parts.push(`${when} ${bnCategory} শ্রেণির ব্যবসায় ${toBengaliDigits(vatRate)}% মূসক প্রযোজ্য।`);
  } else if (obligationType === "EFD Device Mandate") {
    parts.push(`${when} ${bnCategory} শ্রেণির প্রতিষ্ঠানে ইলেকট্রনিক ফিসকাল ডিভাইস ব্যবহার বাধ্যতামূলক।`);
  } else if (obligationType === "Withholding Tax" && vatRate) {
    parts.push(`${when} ${bnCategory} শ্রেণির ব্যবসাকে ${toBengaliDigits(vatRate)}% উৎসে কর কর্তন করতে হবে।`);
  } else {
    parts.push(`${when} ${bnCategory} শ্রেণির ব্যবসার জন্য এই পরিপত্রের নির্দেশনা প্রযোজ্য।`);
  }

  if (penalty) parts.push("অমান্য করলে জরিমানার ঝুঁকি রয়েছে।");
  return parts.join(" ");
}

/**
 * Extract structured fields from a circular.
 *
 * @param {{ title: string, documentText: string, publishedDate?: *, effectiveDate?: *, sourceUrl?: string }} circular
 * @returns {Promise<object>} extraction payload
 */
async function extract(circular) {
  const text = String(circular.documentText || "");

  const categoryResult = detectCategory(text);
  const obligationResult = detectObligationType(text);
  const vatRate = pickVatRate(text);
  const dateHit = pickEffectiveDate(text);
  const penaltyHit = pickPenalty(text);

  // Deliberate fallbacks. When the document does not state a date or a penalty
  // we still populate the field from metadata or a generic clause — and the
  // grounding engine will correctly mark it as unsupported.
  const effectiveDateIso = dateHit
    ? dateHit.parsed.iso
    : circular.effectiveDate
      ? (parseDateString(circular.effectiveDate) || {}).iso || null
      : null;

  const penalty = penaltyHit ? penaltyHit.raw : "জরিমানা প্রযোজ্য হতে পারে";

  const effectiveDateBangla = effectiveDateIso
    ? toBengaliDigits(String(parseDateString(effectiveDateIso).day)) +
      " " +
      (BANGLA_MONTHS.find((m) => m.index === parseDateString(effectiveDateIso).month) || {}).canonical +
      " " +
      toBengaliDigits(String(parseDateString(effectiveDateIso).year))
    : null;

  // Self-reported confidence. Lower when we had to infer rather than read.
  let selfConfidence = 0.9;
  if (categoryResult.inferred) selfConfidence -= 0.15;
  if (obligationResult.inferred) selfConfidence -= 0.15;
  if (!dateHit) selfConfidence -= 0.2;
  if (!penaltyHit) selfConfidence -= 0.15;
  selfConfidence = Math.max(0.25, Math.round(selfConfidence * 100) / 100);

  const evidenceText = [
    dateHit ? dateHit.raw : null,
    penaltyHit ? penaltyHit.raw : null,
    categoryResult.evidence,
  ]
    .filter(Boolean)
    .join(" … ");

  return {
    businessCategory: categoryResult.category,
    obligationType: obligationResult.type,
    effectiveDate: effectiveDateIso,
    penalty,
    requiredAction: buildRequiredAction({
      obligationType: obligationResult.type,
      vatRate,
      effectiveDateBangla,
    }),
    evidenceText,
    summaryBangla: buildSummary({
      category: categoryResult.category,
      obligationType: obligationResult.type,
      vatRate,
      effectiveDateBangla,
      penalty: penaltyHit ? penaltyHit.raw : null,
    }),
    confidence: selfConfidence,

    // Per-field citations. The grounding engine verifies each of these
    // independently, so a wrong citation is caught rather than trusted.
    fieldEvidence: {
      businessCategory: categoryResult.evidence,
      obligationType: obligationResult.evidence,
      effectiveDate: dateHit ? dateHit.raw : null,
      penalty: penaltyHit ? penaltyHit.raw : null,
    },

    // Extra context the pipeline carries through but does not require.
    meta: {
      vatRate,
      alternateCategories: categoryResult.alternates,
      effectiveDateReadable: effectiveDateIso ? formatDate(effectiveDateIso) : null,
      effectiveDateBangla,
      dateSource: dateHit ? "document" : circular.effectiveDate ? "database-metadata" : "none",
      penaltySource: penaltyHit ? "document" : "generic-fallback",
    },
  };
}

module.exports = {
  id: "demo",
  label: "Deterministic demo engine",
  requiresApiKey: false,
  isAvailable: () => true,
  extract,
  // exported for tests
  _internals: { detectCategory, detectObligationType, pickEffectiveDate, pickPenalty, pickVatRate },
};
