/**
 * groundingEngine.js
 * -----------------------------------------------------------------------------
 * Deterministic verification layer. Nothing here calls a model.
 *
 * Given a value the AI proposed and the original circular text, decide whether
 * that value is actually supported by the document, and if so return the exact
 * evidence snippet plus its character offsets.
 *
 * Match strategies, tried in order of strength:
 *   1. exact   — the value appears verbatim after normalization
 *   2. variant — a known surface form of the value appears (dates, numbers)
 *   3. fuzzy   — enough of the value's content tokens appear in one window
 *
 * A field that matches none of these is NOT grounded, and the pipeline must
 * refuse to publish it as verified.
 */

const {
  normalizeWithMap,
  normalize,
  contentTokens,
  tokenizeWithOffsets,
  dateSurfaceForms,
  parseDateString,
  toAsciiDigits,
  toBengaliDigits,
  sentenceAround,
} = require("./banglaText");
const { lexiconForms } = require("./fieldLexicon");

// A fuzzy match needs this share of the value's content tokens inside one window.
const FUZZY_THRESHOLD = 0.6;

// Confidence contribution of each match strategy.
const MATCH_SCORES = {
  exact: 1,
  variant: 0.95,
  fuzzy: 0.7,
  none: 0,
};

/**
 * Pre-compute both normalization passes of a document once, so grounding many
 * fields against the same circular stays cheap.
 */
function prepareSource(documentText) {
  const source = String(documentText || "");
  const tight = normalizeWithMap(source);
  const loose = normalizeWithMap(source, { stripPunctuation: true });
  return {
    source,
    tight,
    loose,
    looseTokens: tokenizeWithOffsets(loose.text),
  };
}

/**
 * Translate a [start, end) range in a normalized string back to original offsets.
 */
function toSourceRange(prepared, view, normStart, normEnd) {
  const map = view.map;
  if (!map.length) return null;
  const safeStart = Math.max(0, Math.min(normStart, map.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(normEnd - 1, map.length - 1));
  const start = map[safeStart];
  const end = map[safeEnd] + 1;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return { start, end, text: prepared.source.slice(start, end) };
}

/**
 * Strategy 1 & 2: look for a literal needle in either normalization pass.
 */
function findLiteral(prepared, needle) {
  if (!needle) return null;

  const attempts = [
    { view: prepared.tight, needle: normalize(needle) },
    { view: prepared.loose, needle: normalize(needle, { stripPunctuation: true }) },
  ];

  for (const attempt of attempts) {
    if (!attempt.needle || attempt.needle.length < 2) continue;
    const idx = attempt.view.text.indexOf(attempt.needle);
    if (idx < 0) continue;
    const range = toSourceRange(prepared, attempt.view, idx, idx + attempt.needle.length);
    if (range) return range;
  }

  return null;
}

/**
 * Strategy 3: sliding-window token overlap. Finds the densest window of source
 * tokens containing the value's content tokens and scores it by coverage.
 */
function findFuzzy(prepared, value) {
  const wanted = contentTokens(value);
  if (!wanted.length) return null;

  const wantedSet = new Set(wanted);
  const tokens = prepared.looseTokens;
  if (!tokens.length) return null;

  // Window a little wider than the phrase, so intervening words are tolerated.
  const windowSize = Math.min(tokens.length, Math.max(wanted.length * 3, wanted.length + 6));

  let best = null;

  for (let i = 0; i < tokens.length; i += 1) {
    const window = tokens.slice(i, i + windowSize);
    if (!window.length) break;

    const seen = new Set();
    let firstHit = -1;
    let lastHit = -1;

    window.forEach((t, offset) => {
      if (!wantedSet.has(t.token)) return;
      seen.add(t.token);
      if (firstHit < 0) firstHit = i + offset;
      lastHit = i + offset;
    });

    const coverage = seen.size / wantedSet.size;
    if (firstHit < 0) continue;
    if (!best || coverage > best.coverage) {
      best = { coverage, firstHit, lastHit };
    }
    if (coverage === 1) break;
  }

  if (!best || best.coverage < FUZZY_THRESHOLD) return null;

  const startTok = prepared.looseTokens[best.firstHit];
  const endTok = prepared.looseTokens[best.lastHit];
  const range = toSourceRange(prepared, prepared.loose, startTok.start, endTok.end);
  if (!range) return null;

  return { ...range, coverage: best.coverage };
}

/**
 * Candidate surface forms to try for a value, depending on the field type.
 */
function surfaceForms(field, value) {
  const forms = [];
  const raw = value == null ? "" : String(value);

  if (field === "effectiveDate") {
    forms.push(...dateSurfaceForms(value));
    return forms;
  }

  // Enum labels are written in English but the document is in Bangla, so an
  // approved surface term standing in for the label counts as evidence.
  if (field === "businessCategory" || field === "obligationType") {
    if (raw) forms.push(raw);
    forms.push(...lexiconForms(field, raw));
    return forms;
  }

  if (raw) {
    forms.push(raw);
    const ascii = toAsciiDigits(raw);
    const bengali = toBengaliDigits(raw);
    if (ascii !== raw) forms.push(ascii);
    if (bengali !== raw) forms.push(bengali);

    // Bare numbers inside the value (e.g. "25,000" out of a penalty clause) are
    // strong anchors in their own right.
    const numbers = ascii.match(/\d[\d,]{2,}/g) || [];
    numbers.forEach((n) => {
      forms.push(n);
      forms.push(toBengaliDigits(n));
    });
  }

  return forms;
}

/**
 * Ground one field.
 *
 * @param {object} prepared      result of prepareSource()
 * @param {string} field         field name
 * @param {*} extractedValue     the value the model proposed
 * @param {string} [claimedEvidence] the snippet the model says it came from
 * @returns {{
 *   field: string, extractedValue: *, grounded: boolean, matchType: string,
 *   score: number, evidence: string, start: number|null, end: number|null,
 *   context: string, evidenceClaimVerified: boolean|null, note: string
 * }}
 */
function groundField(prepared, field, extractedValue, claimedEvidence) {
  const result = {
    field,
    extractedValue: extractedValue == null ? null : extractedValue,
    grounded: false,
    matchType: "none",
    score: 0,
    evidence: "",
    start: null,
    end: null,
    context: "",
    evidenceClaimVerified: null,
    note: "",
  };

  if (extractedValue === null || extractedValue === undefined || extractedValue === "") {
    result.note = "No value extracted for this field.";
    return result;
  }

  // 1 & 2 — literal / variant match on the value itself.
  const forms = surfaceForms(field, extractedValue);
  let hit = null;
  let matchType = "none";

  for (let i = 0; i < forms.length; i += 1) {
    const found = findLiteral(prepared, forms[i]);
    if (found) {
      hit = found;
      matchType = i === 0 ? "exact" : "variant";
      break;
    }
  }

  // 3 — fall back to token overlap.
  if (!hit) {
    const fuzzy = findFuzzy(prepared, extractedValue);
    if (fuzzy) {
      hit = fuzzy;
      matchType = "fuzzy";
    }
  }

  // The model's own evidence claim is independently verified. If the model
  // quoted text that is not in the document, that is a hallucinated citation
  // and we record it even when the value itself grounds another way.
  if (claimedEvidence) {
    const claimHit = findLiteral(prepared, claimedEvidence) || findFuzzy(prepared, claimedEvidence);
    result.evidenceClaimVerified = Boolean(claimHit);
    if (!hit && claimHit) {
      // Evidence exists but the value phrasing differs — only trust this if the
      // value's key tokens actually live inside the quoted evidence.
      const valueTokens = contentTokens(extractedValue);
      const evidenceTokens = new Set(contentTokens(claimHit.text));
      const overlap = valueTokens.length
        ? valueTokens.filter((t) => evidenceTokens.has(t)).length / valueTokens.length
        : 0;
      if (overlap >= FUZZY_THRESHOLD) {
        hit = claimHit;
        matchType = "fuzzy";
      }
    }
  }

  if (!hit) {
    result.note = "Not found in source — requires review";
    return result;
  }

  const context = sentenceAround(prepared.source, hit.start, hit.end);

  result.grounded = true;
  result.matchType = matchType;
  result.score = MATCH_SCORES[matchType] * (matchType === "fuzzy" && hit.coverage ? hit.coverage : 1);
  result.evidence = hit.text;
  result.start = hit.start;
  result.end = hit.end;
  result.context = context.text;
  result.note =
    matchType === "exact"
      ? "Exact match in source text."
      : matchType === "variant"
        ? "Matched an equivalent surface form in the source text."
        : "Matched by phrase overlap — verify wording during review.";

  return result;
}

/**
 * Ground the four fields the whitepaper requires to be checked before an
 * obligation may be trusted.
 */
const GROUNDED_FIELDS = ["businessCategory", "obligationType", "effectiveDate", "penalty"];

/**
 * @param {string} documentText original circular text
 * @param {object} extraction   fields proposed by the extraction provider
 * @returns {{ fieldGrounding: Array, overallGroundingScore: number, sourceEvidence: Array }}
 */
function groundExtraction(documentText, extraction) {
  const prepared = prepareSource(documentText);
  const fieldEvidence = extraction.fieldEvidence || {};

  const fieldGrounding = GROUNDED_FIELDS.map((field) =>
    groundField(prepared, field, extraction[field], fieldEvidence[field] || null)
  );

  // Weighted so a fabricated date or penalty hurts more than a category guess.
  const weights = {
    businessCategory: 0.2,
    obligationType: 0.2,
    effectiveDate: 0.3,
    penalty: 0.3,
  };

  const overall = fieldGrounding.reduce(
    (sum, item) => sum + (weights[item.field] || 0) * item.score,
    0
  );

  const sourceEvidence = fieldGrounding
    .filter((f) => f.grounded)
    .map((f) => ({ field: f.field, text: f.evidence, start: f.start, end: f.end }));

  return {
    fieldGrounding,
    overallGroundingScore: Math.round(overall * 100) / 100,
    sourceEvidence,
  };
}

module.exports = {
  GROUNDED_FIELDS,
  FUZZY_THRESHOLD,
  prepareSource,
  groundField,
  groundExtraction,
  findLiteral,
  findFuzzy,
};
