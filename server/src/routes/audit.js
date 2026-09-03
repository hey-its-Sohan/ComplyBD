const express = require("express");
const AuditLog = require("../models/AuditLog");
const Anchor = require("../models/Anchor");
const { authRequired, requireRoles } = require("../middleware/auth");
const {
  anchorAuditTrail,
  verifyAuditChain,
  auditSummary,
  actionLabel,
} = require("../utils/audit");

const router = express.Router();

/**
 * The audit trail is staff-only.
 *
 * Audit metadata legitimately contains other clients' names, business ids and
 * reviewer decisions — it is a record of everything the system did, not of one
 * business. An SME owner has no reason to read it and every reason not to be
 * able to, so the whole router is gated rather than each endpoint.
 *
 * Owners still get their own provenance: verification badges and trust
 * indicators on their alerts, sourced from the obligation rather than the log.
 */
const staffOnly = [authRequired, requireRoles("accountant", "reviewer")];

/**
 * GET /api/audit
 * The timeline. Supports ?action=, ?entityType= and ?limit=.
 */
router.get("/", staffOnly, async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.entityType) filter.entityType = req.query.entityType;

  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const logs = await AuditLog.find(filter)
    .populate("actorId", "name email role")
    .sort({ sequence: -1 })
    .limit(limit);

  res.json(
    logs.map((log) => ({
      _id: log._id,
      sequence: log.sequence,
      action: log.action,
      actionLabel: actionLabel(log.action),
      entityType: log.entityType,
      entityId: log.entityId,
      actor: log.actorId || null,
      previousHash: log.previousHash,
      currentHash: log.currentHash,
      metadata: log.metadata,
      timestamp: log.timestamp,
    }))
  );
});

/**
 * GET /api/audit/summary
 * Record count, chain-tip hash, verification result and anchor state.
 */
router.get("/summary", staffOnly, async (_req, res) => {
  res.json(await auditSummary());
});

/**
 * GET /api/audit/verify
 * Recompute every hash and report whether the chain is intact.
 */
router.get("/verify", staffOnly, async (_req, res) => {
  res.json(await verifyAuditChain());
});

/** The distinct actions present, for the timeline filter. */
router.get("/actions", staffOnly, async (_req, res) => {
  const actions = await AuditLog.distinct("action");
  res.json(actions.sort().map((a) => ({ action: a, label: actionLabel(a) })));
});

router.get("/anchors", staffOnly, async (_req, res) => {
  const anchors = await Anchor.find().sort({ anchoredAt: -1 }).limit(50);
  res.json(anchors);
});

/**
 * POST /api/audit/anchor
 * Hash the current audit state and publish the commitment.
 */
router.post("/anchor", staffOnly, async (req, res) => {
  const anchor = await anchorAuditTrail({ actorId: req.user._id, force: true });
  if (!anchor) {
    return res.status(422).json({ message: "There are no audit records to anchor yet." });
  }
  const summary = await auditSummary();
  res.json({ anchor, summary });
});

module.exports = router;
