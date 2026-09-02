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
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Obligation", obligationSchema);
