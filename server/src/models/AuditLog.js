const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, default: "" },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  previousHash: { type: String, required: true },
  currentHash: { type: String, required: true },
  metadata: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ timestamp: 1 });
auditLogSchema.index({ currentHash: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
