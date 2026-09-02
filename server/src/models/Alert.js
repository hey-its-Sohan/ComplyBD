const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  obligationId: { type: mongoose.Schema.Types.ObjectId, ref: "Obligation", required: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
  priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
  title: { type: String, required: true },
  messageBangla: { type: String, required: true },
  status: { type: String, enum: ["new", "seen", "acknowledged", "resolved"], default: "new" },
  deliveredAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Alert", alertSchema);
