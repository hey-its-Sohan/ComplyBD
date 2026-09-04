const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  /**
   * Position in the chain, starting at 0.
   *
   * Ordering the chain by timestamp alone is not safe: several records can be
   * written inside the same millisecond, and verification would then depend on
   * an arbitrary tiebreak. An explicit sequence makes the order the chain was
   * built in unambiguous and independent of clock resolution.
   */
  sequence: { type: Number, required: true, default: 0 },

  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, default: "" },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  previousHash: { type: String, required: true },
  currentHash: { type: String, required: true },
  metadata: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ sequence: 1 }, { unique: true });
auditLogSchema.index({ timestamp: 1 });
auditLogSchema.index({ currentHash: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
