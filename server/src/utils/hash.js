const crypto = require("crypto");

/**
 * The genesis marker for the first record in the chain. A literal string rather
 * than a hash, so a reader can tell at a glance where the chain begins.
 */
const GENESIS = "GENESIS";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

/**
 * Deterministic JSON: object keys are emitted in sorted order at every depth.
 *
 * This matters more than it looks. Audit metadata is stored in Mongo and read
 * back later for verification, and a round-trip does not guarantee the original
 * key order. Hashing `JSON.stringify(metadata)` directly would therefore make
 * a perfectly untampered chain fail verification whenever the driver happened
 * to return keys in a different order. Sorting removes that entirely.
 */
function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${parts.join(",")}}`;
}

/**
 * The exact string that gets hashed for an audit record.
 *
 * The whitepaper's formula is previousHash + action + entityId + timestamp +
 * metadata. This implementation also folds in entityType and actorId.
 *
 * That addition is deliberate: without actorId in the digest, the name attached
 * to a decision could be changed after the fact without breaking the chain —
 * someone could reassign who approved an obligation and the audit trail would
 * still report itself intact. For a compliance record, who acted is exactly the
 * fact most worth protecting, so it is covered by the hash.
 */
function canonicalAuditString({ previousHash, action, entityType, entityId, actorId, timestamp, metadata }) {
  return [
    previousHash || GENESIS,
    action || "",
    entityType || "",
    String(entityId || ""),
    String(actorId || ""),
    timestamp instanceof Date ? timestamp.toISOString() : String(timestamp || ""),
    stableStringify(metadata || {}),
  ].join("|");
}

function hashAuditPayload(payload) {
  return sha256(canonicalAuditString(payload));
}

/** Kept for callers written against the earlier API. */
function genesisHash() {
  return GENESIS;
}

module.exports = {
  GENESIS,
  sha256,
  stableStringify,
  canonicalAuditString,
  hashAuditPayload,
  genesisHash,
};
