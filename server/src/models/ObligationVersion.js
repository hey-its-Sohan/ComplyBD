const mongoose = require("mongoose");

/**
 * An immutable snapshot of an obligation at one point in its life.
 *
 * Compliance guidance changes meaning when it is corrected, so the record of
 * what was published and when must survive the correction. Versions are only
 * ever appended; nothing here is updated or deleted. Version 1 is the AI draft,
 * later versions capture each human decision.
 */
const obligationVersionSchema = new mongoose.Schema({
  obligationId: { type: mongoose.Schema.Types.ObjectId, ref: "Obligation", required: true, index: true },
  version: { type: Number, required: true },

  /** What happened to produce this version. */
  changeType: {
    type: String,
    enum: ["extracted", "verified", "rejected", "edited", "reprocessed"],
    required: true,
  },
  changeNote: { type: String, default: "" },

  /** Snapshot of the fields that matter for guidance. */
  businessCategory: String,
  obligationType: String,
  effectiveDate: Date,
  penalty: String,
  requiredAction: String,
  summaryBangla: String,

  confidence: Number,
  confidenceBand: String,
  groundingStatus: String,
  overallGroundingScore: Number,
  reviewStatus: String,
  extractionMethod: String,
  pipelineVersion: String,

  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorName: { type: String, default: "" },

  /** Ties this version to the audit record that describes it. */
  auditHash: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
});

obligationVersionSchema.index({ obligationId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("ObligationVersion", obligationVersionSchema);
