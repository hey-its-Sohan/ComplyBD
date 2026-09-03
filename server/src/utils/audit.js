/**
 * audit.js
 * -----------------------------------------------------------------------------
 * The append-only compliance record.
 *
 * Every record stores the hash of the one before it, so altering or deleting any
 * entry breaks every hash after it. That makes tampering detectable without
 * needing a chain at all; the blockchain anchor then makes it detectable even if
 * someone rewrote the whole database, because the anchored digest was published
 * somewhere they do not control.
 */

const AuditLog = require("../models/AuditLog");
const Anchor = require("../models/Anchor");
const { GENESIS, sha256, hashAuditPayload } = require("./hash");
const blockchain = require("../services/blockchainService");

/**
 * Canonical action names. Keeping them in one place stops near-duplicates like
 * OBLIGATION_VERIFIED and OBLIGATION_APPROVED drifting apart over time.
 */
const ACTIONS = {
  CIRCULAR_INGESTED: "Circular created",
  CIRCULAR_PROCESSED: "Circular processed",
  OBLIGATION_EXTRACTED: "Obligation extracted",
  OBLIGATIONS_EXTRACTED: "Obligations extracted",
  OBLIGATION_VERIFIED: "Obligation verified",
  OBLIGATION_VERIFIED_WITH_OVERRIDE: "Obligation verified (override)",
  OBLIGATION_REJECTED: "Obligation rejected",
  OBLIGATION_EDITED: "Obligation edited",
  OBLIGATION_VERSIONED: "Obligation version recorded",
  ALERT_GENERATED: "Alert generated",
  ALERT_PUBLISHED: "Alert published",
  ALERTS_DISPATCHED: "Alerts dispatched",
  ALERT_ACKNOWLEDGED: "Alert acknowledged",
  ALERT_STATUS_UPDATED: "Alert status updated",
  REVIEW_PERFORMED: "Review performed",
  BUSINESS_UPDATED: "Business updated",
  AUTH_LOGIN: "User signed in",
  AUDIT_ANCHORED: "Audit trail anchored",
  SEED_COMPLETED: "Demo data seeded",
};

function actionLabel(action) {
  return ACTIONS[action] || action;
}

/** The hash the next record must chain from. */
async function getLatestRecord() {
  return AuditLog.findOne().sort({ sequence: -1 });
}

async function getLatestHash() {
  const last = await getLatestRecord();
  return last ? last.currentHash : GENESIS;
}

/**
 * Append one record. Never updates or deletes.
 *
 * Audit writes must not break the action they describe: if logging fails we warn
 * and return null rather than failing a verification the user already completed.
 * A missing log is visible as a chain-length mismatch; a rolled-back approval
 * would be worse.
 */
async function writeAudit({ action, entityType, entityId, actorId, metadata }) {
  try {
    const timestamp = new Date();
    const last = await getLatestRecord();
    const previousHash = last ? last.currentHash : GENESIS;
    const sequence = last ? last.sequence + 1 : 0;

    const currentHash = hashAuditPayload({
      previousHash,
      action,
      entityType,
      entityId,
      actorId,
      timestamp,
      metadata,
    });

    return await AuditLog.create({
      sequence,
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      actorId: actorId || null,
      previousHash,
      currentHash,
      metadata: metadata || {},
      timestamp,
    });
  } catch (err) {
    console.warn("Audit write failed:", err.message);
    return null;
  }
}

/**
 * Walk the chain and recompute every hash.
 *
 * Three things are checked per record:
 *   1. the stored currentHash matches a recomputation from its own contents
 *      (catches an edited action, actor, timestamp or metadata)
 *   2. its previousHash matches the preceding record's currentHash
 *      (catches a deleted or reordered record)
 *   3. the first record chains from GENESIS
 *
 * @returns {Promise<{ intact: boolean, checked: number, brokenAt: number|null, issues: Array, firstRecordAt: Date|null, lastRecordAt: Date|null, latestHash: string }>}
 */
async function verifyAuditChain() {
  const logs = await AuditLog.find().sort({ sequence: 1 });

  const issues = [];
  let expectedPrevious = GENESIS;

  logs.forEach((log, index) => {
    if (log.previousHash !== expectedPrevious) {
      issues.push({
        index,
        recordId: String(log._id),
        action: log.action,
        timestamp: log.timestamp,
        type: "broken_link",
        detail:
          index === 0
            ? `The first record should chain from ${GENESIS} but chains from ${String(log.previousHash).slice(0, 16)}…`
            : "This record's previousHash does not match the record before it. An entry may have been removed or reordered.",
      });
    }

    const recomputed = hashAuditPayload({
      previousHash: log.previousHash,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorId: log.actorId,
      timestamp: log.timestamp,
      metadata: log.metadata,
    });

    if (recomputed !== log.currentHash) {
      issues.push({
        index,
        recordId: String(log._id),
        action: log.action,
        timestamp: log.timestamp,
        type: "contents_altered",
        detail: "The stored hash does not match this record's contents. The record has been edited.",
        expected: recomputed,
        found: log.currentHash,
      });
    }

    expectedPrevious = log.currentHash;
  });

  return {
    intact: issues.length === 0,
    checked: logs.length,
    brokenAt: issues.length ? issues[0].index : null,
    issues,
    firstRecordAt: logs.length ? logs[0].timestamp : null,
    lastRecordAt: logs.length ? logs[logs.length - 1].timestamp : null,
    latestHash: logs.length ? logs[logs.length - 1].currentHash : GENESIS,
    genesis: GENESIS,
  };
}

/** Merkle root over a list of hashes; odd nodes are duplicated. */
function merkleRoot(hashes) {
  if (!hashes.length) return sha256("empty");
  let layer = hashes.slice();
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] || left;
      next.push(sha256(left + right));
    }
    layer = next;
  }
  return layer[0];
}

/**
 * Anchor the current audit state.
 *
 * Anchors the Merkle root of every record not yet covered, together with the
 * chain-tip hash, so one anchor commits to the whole history up to that moment.
 *
 * @param {object} [options]
 * @param {*} [options.actorId] who requested the anchor
 * @param {boolean} [options.force] anchor even if nothing new has been recorded
 */
async function anchorAuditTrail(options = {}) {
  const logs = await AuditLog.find().sort({ sequence: 1 });
  if (!logs.length) return null;

  const lastAnchor = await Anchor.findOne().sort({ anchoredAt: -1 });
  const covered = lastAnchor ? lastAnchor.entryCountTotal || 0 : 0;
  const newLogs = logs.slice(covered);

  if (!newLogs.length && !options.force) return lastAnchor;

  const batch = newLogs.length ? newLogs : logs;
  const root = merkleRoot(batch.map((l) => l.currentHash));
  const latestHash = logs[logs.length - 1].currentHash;

  // Commit to both the batch root and the chain tip, so the anchor pins the
  // entire history rather than just this window.
  const committedHash = sha256(`${root}:${latestHash}:${logs.length}`);

  const receipt = await blockchain.anchorHash(committedHash);

  const anchor = await Anchor.create({
    merkleRoot: root,
    committedHash,
    latestHash,
    fromHash: batch[0].currentHash,
    toHash: batch[batch.length - 1].currentHash,
    entryCount: batch.length,
    entryCountTotal: logs.length,
    chain: receipt.network,
    network: receipt.network,
    mode: receipt.mode,
    submitted: receipt.submitted,
    label: receipt.label,
    note: receipt.note,
    explorerUrl: receipt.explorerUrl,
    anchorId: receipt.anchorId,
    txHash: receipt.anchorId,
    status: "anchored",
    anchoredAt: receipt.anchoredAt || new Date(),
  });

  // Recorded after the anchor so the anchor commits to the state before itself.
  await writeAudit({
    action: "AUDIT_ANCHORED",
    entityType: "Anchor",
    entityId: anchor._id,
    actorId: options.actorId || null,
    metadata: {
      entryCount: anchor.entryCount,
      entryCountTotal: anchor.entryCountTotal,
      mode: anchor.mode,
      submitted: anchor.submitted,
      anchorId: anchor.anchorId,
    },
  });

  return anchor;
}

/** Headline numbers for the audit and blockchain screens. */
async function auditSummary() {
  const [verification, total, lastAnchor, anchorCount] = await Promise.all([
    verifyAuditChain(),
    AuditLog.countDocuments(),
    Anchor.findOne().sort({ anchoredAt: -1 }),
    Anchor.countDocuments(),
  ]);

  return {
    totalRecords: total,
    verification,
    latestHash: verification.latestHash,
    anchorCount,
    latestAnchor: lastAnchor,
    unanchoredRecords: Math.max(0, total - (lastAnchor?.entryCountTotal || 0)),
    blockchain: blockchain.status(),
  };
}

module.exports = {
  ACTIONS,
  getLatestRecord,
  actionLabel,
  writeAudit,
  getLatestHash,
  verifyAuditChain,
  merkleRoot,
  anchorAuditTrail,
  auditSummary,
};
