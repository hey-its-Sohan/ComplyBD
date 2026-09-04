const mongoose = require("mongoose");

const sourceSpanSchema = new mongoose.Schema(
  {
    field: String,
    text: String,
    start: Number,
    end: Number,
  },
  { _id: false }
);

/**
 * One field's verification result. This is the record that lets a reviewer (or
 * an auditor) see exactly which words in the original circular justified an
 * AI-proposed value — or that nothing did.
 */
const fieldGroundingSchema = new mongoose.Schema(
  {
    field: String,
    extractedValue: mongoose.Schema.Types.Mixed,
    grounded: { type: Boolean, default: false },
    matchType: { type: String, enum: ["exact", "variant", "fuzzy", "none"], default: "none" },
    score: { type: Number, default: 0 },
    evidence: { type: String, default: "" },
    start: { type: Number, default: null },
    end: { type: Number, default: null },
    context: { type: String, default: "" },
    evidenceClaimVerified: { type: Boolean, default: null },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const obligationSchema = new mongoose.Schema({
  circularId: { type: mongoose.Schema.Types.ObjectId, ref: "Circular", required: true },
  businessCategory: { type: String, required: true },
  obligationType: { type: String, required: true },
  effectiveDate: Date,
  penalty: String,
  sourceSpans: [sourceSpanSchema],
  summaryBangla: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  groundingStatus: { type: String, enum: ["grounded", "partial", "ungrounded"], default: "partial" },
  reviewStatus: {
    type: String,
    enum: ["needs_review", "pending", "verified", "rejected"],
    default: "needs_review",
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  extractedFields: { type: Object, default: {} },

  // ---------------------------------------------------------------------------
  // Regulatory pipeline fields.
  // Obligations created before the pipeline existed simply leave these empty,
  // so everything built in Prompt 1 keeps working untouched.
  // ---------------------------------------------------------------------------

  /** Which engine produced this: deterministic-demo, llm-openai, llm-anthropic. */
  extractionMethod: { type: String, default: "" },

  /** Per-field verification against the source circular. */
  fieldGrounding: { type: [fieldGroundingSchema], default: [] },

  /** Weighted 0..1 share of checked fields that were located in the source. */
  overallGroundingScore: { type: Number, default: 0 },

  /** Bucketed confidence. The numeric score stays in `confidence`. */
  confidenceBand: { type: String, enum: ["high", "medium", "low", ""], default: "" },

  /** Plain-language explanation of how the score was reached. */
  confidenceReasons: { type: [String], default: [] },

  /** The model's own self-reported confidence, before grounding was applied. */
  aiConfidence: { type: Number, default: 0 },

  /** Exact snippets with character offsets into the circular text. */
  sourceEvidence: { type: [sourceSpanSchema], default: [] },

  /** Why this landed in its current review state. */
  routingReason: { type: String, default: "" },

  /** True when the pipeline verified it without a human. */
  autoVerified: { type: Boolean, default: false },

  /** What the business actually has to do, in Bangla. */
  requiredAction: { type: String, default: "" },

  /** Supporting quote the extraction engine cited. */
  evidenceText: { type: String, default: "" },

  /** Version of the pipeline that produced this record. */
  pipelineVersion: { type: String, default: "" },

  /** How many SME businesses this obligation matched when it was published. */
  matchedBusinessCount: { type: Number, default: 0 },

  // ---------------------------------------------------------------------------
  // Versioning. Full snapshots live in the ObligationVersion collection; these
  // fields are the pointers the UI needs without a join.
  // ---------------------------------------------------------------------------

  /** Increments on every recorded change. Version 1 is the AI draft. */
  version: { type: Number, default: 1 },

  /** When this obligation first became visible to businesses. */
  publishedAt: { type: Date, default: null },

  /** Last time any field changed. */
  updatedAt: { type: Date, default: Date.now },

  createdAt: { type: Date, default: Date.now },
});

obligationSchema.index({ reviewStatus: 1, confidence: 1 });
obligationSchema.index({ circularId: 1 });

module.exports = mongoose.model("Obligation", obligationSchema);
