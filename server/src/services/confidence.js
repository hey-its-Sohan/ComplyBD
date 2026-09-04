/**
 * confidence.js
 * -----------------------------------------------------------------------------
 * Transparent, auditable confidence scoring and review routing.
 *
 * Every number produced here comes with a written reason, because a compliance
 * reviewer has to be able to explain to a regulator why a given obligation was
 * published automatically or held back.
 *
 * The hard safety rule, from the whitepaper: an obligation whose effective date
 * or penalty cannot be found in the source text may never become a verified
 * alert, no matter how confident the model claims to be.
 */

// Fields that must be grounded or the obligation drops to low confidence.
const CRITICAL_FIELDS = ["effectiveDate", "penalty"];

// Fields that must be grounded for the obligation to reach high confidence.
const CORE_FIELDS = ["businessCategory", "obligationType"];

const WEIGHTS = {
  aiConfidence: 0.35,
  grounding: 0.5,
  evidenceCompleteness: 0.15,
};

const BANDS = {
  high: 80,
  medium: 55,
};

// Ceilings applied when something is missing. These are caps, not scores.
const CAP_CRITICAL_UNGROUNDED = 45;
const CAP_CORE_UNGROUNDED = 64;
const CAP_MISSING_CRITICAL_VALUE = 40;

/**
 * How complete is the supporting material? Rewards an extraction that carries
 * its own evidence, a required action and a Bangla summary.
 */
function evidenceCompleteness(extraction, fieldGrounding) {
  const checks = [
    Boolean(extraction.evidenceText && String(extraction.evidenceText).trim()),
    Boolean(extraction.requiredAction && String(extraction.requiredAction).trim()),
    Boolean(extraction.summaryBangla && String(extraction.summaryBangla).trim()),
    fieldGrounding.every((f) => f.evidenceClaimVerified !== false),
    fieldGrounding.filter((f) => f.grounded && f.evidence).length >= 2,
  ];
  return checks.filter(Boolean).length / checks.length;
}

/**
 * @param {object} params
 * @param {object} params.extraction        provider output
 * @param {Array}  params.fieldGrounding    per-field grounding results
 * @param {number} params.overallGroundingScore  0..1
 * @returns {{
 *   score: number, band: "high"|"medium"|"low", reasons: string[],
 *   components: object, blockedFromVerification: boolean,
 *   ungroundedFields: string[]
 }}
 */
function evaluateConfidence({ extraction, fieldGrounding, overallGroundingScore }) {
  const reasons = [];

  const aiConfidence = clamp01(
    typeof extraction.confidence === "number"
      ? extraction.confidence > 1
        ? extraction.confidence / 100
        : extraction.confidence
      : 0.6
  );

  const grounding = clamp01(overallGroundingScore);
  const completeness = clamp01(evidenceCompleteness(extraction, fieldGrounding));

  const base =
    WEIGHTS.aiConfidence * aiConfidence +
    WEIGHTS.grounding * grounding +
    WEIGHTS.evidenceCompleteness * completeness;

  let score = Math.round(base * 100);

  reasons.push(
    `Model self-reported confidence ${Math.round(aiConfidence * 100)}% (weight ${WEIGHTS.aiConfidence}).`
  );
  reasons.push(
    `Deterministic grounding score ${Math.round(grounding * 100)}% (weight ${WEIGHTS.grounding}).`
  );
  reasons.push(
    `Evidence completeness ${Math.round(completeness * 100)}% (weight ${WEIGHTS.evidenceCompleteness}).`
  );

  const byField = Object.fromEntries(fieldGrounding.map((f) => [f.field, f]));
  const ungroundedFields = fieldGrounding.filter((f) => !f.grounded).map((f) => f.field);

  let blockedFromVerification = false;

  // Rule 1 — a critical field with no value at all.
  const missingCritical = CRITICAL_FIELDS.filter(
    (f) => !byField[f] || byField[f].extractedValue === null || byField[f].extractedValue === ""
  );
  if (missingCritical.length) {
    score = Math.min(score, CAP_MISSING_CRITICAL_VALUE);
    blockedFromVerification = true;
    reasons.push(
      `Capped at ${CAP_MISSING_CRITICAL_VALUE}: no value extracted for ${missingCritical.join(", ")}.`
    );
  }

  // Rule 2 — effective date or penalty not found in the source text.
  const ungroundedCritical = CRITICAL_FIELDS.filter((f) => byField[f] && !byField[f].grounded);
  if (ungroundedCritical.length) {
    score = Math.min(score, CAP_CRITICAL_UNGROUNDED);
    blockedFromVerification = true;
    reasons.push(
      `Capped at ${CAP_CRITICAL_UNGROUNDED}: ${ungroundedCritical.join(", ")} could not be located in the source text, so the value may be fabricated.`
    );
  }

  // Rule 3 — category or obligation type not grounded.
  const ungroundedCore = CORE_FIELDS.filter((f) => byField[f] && !byField[f].grounded);
  if (ungroundedCore.length) {
    score = Math.min(score, CAP_CORE_UNGROUNDED);
    reasons.push(
      `Capped at ${CAP_CORE_UNGROUNDED}: ${ungroundedCore.join(", ")} not grounded in the source text.`
    );
  }

  // Rule 4 — the model quoted evidence that does not exist in the document.
  const fabricatedCitations = fieldGrounding.filter((f) => f.evidenceClaimVerified === false);
  if (fabricatedCitations.length) {
    score = Math.min(score, CAP_CORE_UNGROUNDED);
    reasons.push(
      `Capped at ${CAP_CORE_UNGROUNDED}: quoted evidence for ${fabricatedCitations
        .map((f) => f.field)
        .join(", ")} does not appear in the document.`
    );
  }

  score = Math.max(0, Math.min(99, score));

  let band = "low";
  if (score >= BANDS.high) band = "high";
  else if (score >= BANDS.medium) band = "medium";

  // Belt and braces: high band is unreachable while a critical field is unsupported.
  if (blockedFromVerification && band === "high") band = "low";

  return {
    score,
    band,
    reasons,
    ungroundedFields,
    blockedFromVerification,
    components: {
      aiConfidence: Math.round(aiConfidence * 100),
      groundingScore: Math.round(grounding * 100),
      evidenceCompleteness: Math.round(completeness * 100),
      weights: WEIGHTS,
    },
  };
}

/**
 * Decide where the obligation goes next.
 *
 * high + everything grounded  -> verified (alerts may be dispatched)
 * medium                      -> pending review
 * low                         -> needs_review, flagged
 */
function routeObligation({ confidence, fieldGrounding }) {
  const allGrounded = fieldGrounding.every((f) => f.grounded);

  if (confidence.band === "high" && allGrounded && !confidence.blockedFromVerification) {
    return {
      reviewStatus: "verified",
      autoVerified: true,
      routingReason:
        "High confidence and all four checked fields grounded in the source text. Eligible for automatic verification.",
    };
  }

  if (confidence.band === "medium" && !confidence.blockedFromVerification) {
    return {
      reviewStatus: "pending",
      autoVerified: false,
      routingReason:
        "Medium confidence. Held for human confirmation before any SME alert is sent.",
    };
  }

  return {
    reviewStatus: "needs_review",
    autoVerified: false,
    routingReason: confidence.blockedFromVerification
      ? "Blocked from automatic verification: a critical field is not supported by the source text."
      : "Low confidence. Routed to the review queue for a human decision.",
  };
}

function clamp01(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

module.exports = {
  CRITICAL_FIELDS,
  CORE_FIELDS,
  WEIGHTS,
  BANDS,
  evaluateConfidence,
  routeObligation,
  evidenceCompleteness,
};
