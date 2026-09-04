const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  obligationId: { type: mongoose.Schema.Types.ObjectId, ref: "Obligation", required: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
  priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
  title: { type: String, required: true },
  messageBangla: { type: String, required: true },
  status: { type: String, enum: ["new", "seen", "acknowledged", "resolved"], default: "new" },
  deliveredAt: { type: Date, default: Date.now },

  // ---------------------------------------------------------------------------
  // The four questions a shop owner actually has. Stored rather than assembled
  // in the browser, so the accountant view and the owner view can never show a
  // different explanation of the same change.
  // ---------------------------------------------------------------------------

  /** What changed, in one Bangla sentence. */
  whatChanged: { type: String, default: "" },

  /** Why it applies to this specific business. */
  whyItMatters: { type: String, default: "" },

  /** The concrete step to take. */
  whatToDo: { type: String, default: "" },

  /** Copied from the obligation so the card can show a date without a join. */
  effectiveDate: { type: Date, default: null },

  /** Set when the owner presses "আমি বুঝেছি". */
  acknowledgedAt: { type: Date, default: null },
});

alertSchema.index({ businessId: 1, deliveredAt: -1 });
alertSchema.index({ obligationId: 1, businessId: 1 });

module.exports = mongoose.model("Alert", alertSchema);
