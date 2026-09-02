const crypto = require("crypto");

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function genesisHash() {
  return sha256("complybd-genesis");
}

function hashAuditPayload({ previousHash, action, entityType, entityId, actorId, timestamp, metadata }) {
  const payload = JSON.stringify({
    previousHash,
    action,
    entityType,
    entityId: String(entityId || ""),
    actorId: String(actorId || ""),
    timestamp,
    metadata: metadata || {},
  });
  return sha256(payload);
}

module.exports = { sha256, genesisHash, hashAuditPayload };
