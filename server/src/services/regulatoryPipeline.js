/**
 * regulatoryPipeline.js
 * -----------------------------------------------------------------------------
 * The core of ComplyBD.
 *
 *   Bangla circular
 *     -> AI structured extraction        (swappable provider, demo engine default)
 *     -> deterministic grounding         (no model involved)
 *     -> transparent confidence scoring
 *     -> review routing
 *
 * The pipeline never decides that an obligation is trustworthy on the model's
 * say-so. Every field the model proposes is looked up in the original document
 * first. Anything that cannot be located is flagged, not published.
 *
 * This module holds no database dependency on purpose — it takes a plain
 * circular object and returns a plain result object, so it can be unit tested
 * without Mongo and reused from a queue worker later.
 */

const { runExtraction, providerStatus } = require("./llm");
const { groundExtraction, GROUNDED_FIELDS } = require("./groundingEngine");
const { evaluateConfidence, routeObligation } = require("./confidence");
const { formatDate, formatDateBangla, parseDateString } = require("./banglaText");

const PIPELINE_VERSION = "2.0.0";

const STEPS = [
  { key: "ingested", label: "Document ingested" },
  { key: "extracted", label: "AI extraction" },
  { key: "grounded", label: "Grounding check" },
  { key: "scored", label: "Confidence evaluation" },
  { key: "routed", label: "Human review / verified" },
];

const DISCLAIMER =
  "Informational compliance tool only. This system does not provide legal or tax advice. Please consult a licensed accountant or lawyer for high-stakes decisions.";

/**
 * @typedef {object} PipelineResult
 * @property {string} pipelineVersion
 * @property {Array}  trace              per-step status for the UI
 * @property {object} extraction         raw provider output
 * @property {Array}  fieldGrounding     per-field verification results
 * @property {number} overallGroundingScore
 * @property {Array}  sourceEvidence     grounded snippets with offsets
 * @property {object} confidence         score, band, reasons, components
 * @property {object} routing            reviewStatus + reason
 * @property {object} obligationDraft    ready to persist as an Obligation
 */

/**
 * Run the full pipeline over one circular.
 *
 * @param {{ _id?: *, title: string, documentText: string, publishedDate?: *, effectiveDate?: *, sourceUrl?: string }} circular
 * @returns {Promise<PipelineResult>}
 */
async function runPipeline(circular) {
  if (!circular || typeof circular !== "object") {
    throw new Error("runPipeline requires a circular object");
  }

  const documentText = String(circular.documentText || "");
  if (!documentText.trim()) {
    throw new Error("Circular has no document text to analyse");
  }

  const trace = [];
  const startedAt = Date.now();

  // ---------------------------------------------------------------- 1. INGEST
  const stepStart = Date.now();
  const charCount = documentText.length;
  const wordCount = documentText.split(/\s+/).filter(Boolean).length;
  pushStep(trace, "ingested", "complete", {
    detail: `${charCount.toLocaleString("en-US")} characters, ${wordCount.toLocaleString("en-US")} words`,
    ms: Date.now() - stepStart,
  });

  // ------------------------------------------------------------- 2. EXTRACTION
  const extractStart = Date.now();
  const { extraction, providerId, providerLabel, extractionMethod, fallbackReason } =
    await runExtraction({
      title: circular.title,
      documentText,
      publishedDate: circular.publishedDate,
      effectiveDate: circular.effectiveDate,
      sourceUrl: circular.sourceUrl,
    });

  pushStep(trace, "extracted", "complete", {
    detail: fallbackReason
      ? `${providerLabel} · ${fallbackReason}`
      : `${providerLabel} proposed ${GROUNDED_FIELDS.length} checkable fields`,
    ms: Date.now() - extractStart,
    meta: { providerId, extractionMethod, fallbackReason },
  });

  // --------------------------------------------------------------- 3. GROUNDING
  const groundStart = Date.now();
  const { fieldGrounding, overallGroundingScore, sourceEvidence } = groundExtraction(
    documentText,
    extraction
  );
  const groundedCount = fieldGrounding.filter((f) => f.grounded).length;

  pushStep(trace, "grounded", groundedCount === fieldGrounding.length ? "complete" : "warning", {
    detail: `${groundedCount} of ${fieldGrounding.length} fields located in the source text`,
    ms: Date.now() - groundStart,
    meta: { overallGroundingScore },
  });

  // -------------------------------------------------------------- 4. CONFIDENCE
  const scoreStart = Date.now();
  const confidence = evaluateConfidence({ extraction, fieldGrounding, overallGroundingScore });

  pushStep(trace, "scored", confidence.band === "low" ? "warning" : "complete", {
    detail: `${confidence.score}% — ${confidence.band} confidence`,
    ms: Date.now() - scoreStart,
    meta: { band: confidence.band, reasons: confidence.reasons },
  });

  // ----------------------------------------------------------------- 5. ROUTING
  const routeStart = Date.now();
  const routing = routeObligation({ confidence, fieldGrounding });

  pushStep(trace, "routed", routing.reviewStatus === "verified" ? "complete" : "warning", {
    detail: routing.reviewStatus === "verified" ? "Auto-verified" : `Sent to review (${routing.reviewStatus})`,
    ms: Date.now() - routeStart,
    meta: { reviewStatus: routing.reviewStatus, reason: routing.routingReason },
  });

  const effectiveDateParsed = parseDateString(extraction.effectiveDate);

  const obligationDraft = {
    circularId: circular._id || null,
    businessCategory: extraction.businessCategory,
    obligationType: extraction.obligationType,
    effectiveDate: effectiveDateParsed ? new Date(`${effectiveDateParsed.iso}T00:00:00.000Z`) : null,
    penalty: extraction.penalty || "",
    requiredAction: extraction.requiredAction || "",
    summaryBangla: extraction.summaryBangla || "",
    evidenceText: extraction.evidenceText || "",

    confidence: confidence.score,
    confidenceBand: confidence.band,
    confidenceReasons: confidence.reasons,
    aiConfidence: confidence.components.aiConfidence,

    extractionMethod,
    fieldGrounding,
    overallGroundingScore,
    sourceEvidence,
    // Mirrors sourceEvidence so the Prompt 1 highlighter keeps working unchanged.
    sourceSpans: sourceEvidence.map((e) => ({
      field: e.field,
      text: e.text,
      start: e.start,
      end: e.end,
    })),
    groundingStatus: groundingStatusFor(fieldGrounding),
    reviewStatus: routing.reviewStatus,
    routingReason: routing.routingReason,
    autoVerified: routing.autoVerified,
    pipelineVersion: PIPELINE_VERSION,
    extractedFields: {
      ...(extraction.meta || {}),
      effectiveDateReadable: effectiveDateParsed ? formatDate(effectiveDateParsed.iso) : null,
      effectiveDateBangla: effectiveDateParsed ? formatDateBangla(effectiveDateParsed.iso) : null,
    },
  };

  return {
    pipelineVersion: PIPELINE_VERSION,
    disclaimer: DISCLAIMER,
    steps: STEPS,
    trace,
    provider: { id: providerId, label: providerLabel, extractionMethod, fallbackReason },
    extraction,
    fieldGrounding,
    overallGroundingScore,
    sourceEvidence,
    confidence,
    routing,
    obligationDraft,
    documentText,
    totalMs: Date.now() - startedAt,
  };
}

/**
 * Rows for the "Field | AI Output | Source Evidence | Grounded | Confidence"
 * table. Built server-side so the API, the UI and any export agree exactly.
 */
function buildFieldTable(result) {
  const labels = {
    businessCategory: "Affected category",
    obligationType: "Obligation type",
    effectiveDate: "Effective date",
    penalty: "Penalty",
  };

  return result.fieldGrounding.map((field) => {
    const isDate = field.field === "effectiveDate";
    const display = isDate && field.extractedValue ? formatDate(field.extractedValue) : field.extractedValue;

    // Per-field confidence: the model's own confidence tempered by how strongly
    // this specific field matched the source.
    const fieldConfidence = field.grounded
      ? Math.round(
          Math.min(
            99,
            field.score * 100 * 0.75 + (result.confidence.components.aiConfidence || 0) * 0.25
          )
        )
      : 0;

    return {
      field: field.field,
      label: labels[field.field] || field.field,
      aiOutput: display === null || display === "" ? "— not extracted —" : String(display),
      evidence: field.evidence || "",
      context: field.context || "",
      grounded: field.grounded,
      matchType: field.matchType,
      confidence: fieldConfidence,
      start: field.start,
      end: field.end,
      note: field.note,
      evidenceClaimVerified: field.evidenceClaimVerified,
    };
  });
}

function groundingStatusFor(fieldGrounding) {
  const total = fieldGrounding.length || 1;
  const grounded = fieldGrounding.filter((f) => f.grounded).length;
  const ratio = grounded / total;
  if (ratio === 1) return "grounded";
  if (ratio < 0.5) return "ungrounded";
  return "partial";
}

function pushStep(trace, key, status, { detail, ms, meta } = {}) {
  const step = STEPS.find((s) => s.key === key);
  trace.push({
    key,
    label: step ? step.label : key,
    status,
    detail: detail || "",
    ms: typeof ms === "number" ? ms : 0,
    meta: meta || {},
  });
}

module.exports = {
  PIPELINE_VERSION,
  STEPS,
  DISCLAIMER,
  runPipeline,
  buildFieldTable,
  providerStatus,
};
