/**
 * promptContract.js
 * -----------------------------------------------------------------------------
 * One prompt and one response shape shared by every LLM provider, so swapping
 * models cannot silently change the contract the rest of the pipeline relies on.
 */

const EXTRACTION_SCHEMA = `{
  "businessCategory": "one of: Restaurant | Retail Shop | Electronics Shop | Clothing Business | Small Manufacturer",
  "obligationType": "short English label, e.g. VAT Rate Change, EFD Device Mandate, Withholding Tax, E-Return Filing, Invoice / Record Keeping, Registration Requirement",
  "effectiveDate": "ISO date YYYY-MM-DD, or null if the document does not state one",
  "penalty": "the penalty clause quoted from the document, or null if none is stated",
  "requiredAction": "what the business owner must actually do, written in Bangla",
  "evidenceText": "verbatim quote from the document supporting this obligation",
  "summaryBangla": "two plain-Bangla sentences a shop owner can understand",
  "confidence": 0.0,
  "fieldEvidence": {
    "businessCategory": "verbatim quote or null",
    "obligationType": "verbatim quote or null",
    "effectiveDate": "verbatim quote or null",
    "penalty": "verbatim quote or null"
  }
}`;

const SYSTEM_PROMPT = `You extract compliance obligations from Bangladeshi regulatory circulars (NBR, VAT wing, SRO notices) for small business owners.

Rules you must follow:
1. Return a single JSON object and nothing else. No markdown, no commentary.
2. Every value in "fieldEvidence" must be copied character-for-character from the document. Never paraphrase a quote.
3. If the document does not state a value, return null. Do not guess a date or a penalty that is not written in the text.
4. Bangla output must stay in Bangla. Do not translate quotes.
5. "confidence" is your own honest estimate between 0 and 1.

Your output is verified against the source text by a separate deterministic checker. Invented values and invented quotes will be detected and rejected, so accuracy matters more than completeness.

Respond using exactly this shape:
${EXTRACTION_SCHEMA}`;

/**
 * The only fields ever sent to an external AI provider.
 *
 * Everything here comes from a published government circular, which is public
 * information. Business names, owner names, TINs, VAT BINs, locations, user
 * accounts and alert history are deliberately absent and must stay absent: the
 * extraction step reads regulations, not customer records.
 *
 * `toPublicCircular` is the enforcement point rather than a convention. It
 * builds a fresh object with an explicit allow-list, so a field added to the
 * Circular model later cannot leak into a prompt by default.
 */
const PUBLIC_CIRCULAR_FIELDS = ["title", "documentText", "publishedDate", "sourceUrl", "source"];

function toPublicCircular(circular) {
  const safe = {};
  for (const field of PUBLIC_CIRCULAR_FIELDS) {
    if (circular && circular[field] !== undefined && circular[field] !== null) {
      safe[field] = circular[field];
    }
  }
  return safe;
}

function buildExtractionPrompt(circular) {
  const safe = toPublicCircular(circular);

  const user = [
    `Title: ${safe.title || "(untitled)"}`,
    safe.publishedDate ? `Published: ${new Date(safe.publishedDate).toISOString().slice(0, 10)}` : null,
    safe.sourceUrl ? `Source URL: ${safe.sourceUrl}` : null,
    "",
    "Document text:",
    "-----",
    String(safe.documentText || ""),
    "-----",
    "",
    "Extract the single most important obligation for small businesses from this document.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { system: SYSTEM_PROMPT, user };
}

/** Strip markdown fences a model may add despite instructions. */
function stripFences(text) {
  return String(text || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

const ALLOWED_CATEGORIES = [
  "Restaurant",
  "Retail Shop",
  "Electronics Shop",
  "Clothing Business",
  "Small Manufacturer",
];

/**
 * Parse and normalize a raw model response into the pipeline's extraction shape.
 * Throws if the response is not usable, so the caller can fall back.
 */
function coerceExtraction(raw, meta = {}) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(stripFences(raw)) : raw;
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model returned a non-object response");
  }

  const category = ALLOWED_CATEGORIES.includes(parsed.businessCategory)
    ? parsed.businessCategory
    : matchCategory(parsed.businessCategory);

  const confidence =
    typeof parsed.confidence === "number"
      ? parsed.confidence > 1
        ? parsed.confidence / 100
        : parsed.confidence
      : 0.6;

  const fieldEvidence = parsed.fieldEvidence && typeof parsed.fieldEvidence === "object" ? parsed.fieldEvidence : {};

  return {
    businessCategory: category,
    obligationType: str(parsed.obligationType) || "General Compliance",
    effectiveDate: str(parsed.effectiveDate) || null,
    penalty: str(parsed.penalty) || null,
    requiredAction: str(parsed.requiredAction) || "",
    evidenceText: str(parsed.evidenceText) || "",
    summaryBangla: str(parsed.summaryBangla) || "",
    confidence: Math.max(0, Math.min(1, confidence)),
    fieldEvidence: {
      businessCategory: str(fieldEvidence.businessCategory) || null,
      obligationType: str(fieldEvidence.obligationType) || null,
      effectiveDate: str(fieldEvidence.effectiveDate) || null,
      penalty: str(fieldEvidence.penalty) || null,
    },
    meta: { ...meta, rawCategory: parsed.businessCategory || null },
  };
}

function matchCategory(value) {
  const text = String(value || "").toLowerCase();
  const found = ALLOWED_CATEGORIES.find((c) => text.includes(c.toLowerCase()));
  if (found) return found;
  if (text.includes("restaurant") || text.includes("food")) return "Restaurant";
  if (text.includes("electronic")) return "Electronics Shop";
  if (text.includes("cloth") || text.includes("garment")) return "Clothing Business";
  if (text.includes("manufact") || text.includes("factory")) return "Small Manufacturer";
  return "Retail Shop";
}

function str(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

module.exports = {
  PUBLIC_CIRCULAR_FIELDS,
  toPublicCircular,
  EXTRACTION_SCHEMA,
  SYSTEM_PROMPT,
  ALLOWED_CATEGORIES,
  buildExtractionPrompt,
  coerceExtraction,
  stripFences,
};
