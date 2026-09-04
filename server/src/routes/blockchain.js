const express = require("express");
const Anchor = require("../models/Anchor");
const { authRequired, requireRoles } = require("../middleware/auth");
const { anchorAuditTrail, auditSummary } = require("../utils/audit");
const blockchain = require("../services/blockchainService");

const router = express.Router();

// Anchor data is part of the compliance record, not a business's own data.
const staffOnly = [authRequired, requireRoles("accountant", "reviewer")];

/**
 * GET /api/blockchain/status
 * Which mode is active, the latest anchor, and how much of the trail it covers.
 */
router.get("/status", staffOnly, async (_req, res) => {
  const [summary, anchors] = await Promise.all([
    auditSummary(),
    Anchor.find().sort({ anchoredAt: -1 }).limit(20),
  ]);

  res.json({
    service: blockchain.status(),
    latestAuditHash: summary.latestHash,
    auditRecords: summary.totalRecords,
    unanchoredRecords: summary.unanchoredRecords,
    chainIntact: summary.verification.intact,
    latestAnchor: summary.latestAnchor,
    anchors,
    anchorCount: summary.anchorCount,
  });
});

/**
 * POST /api/blockchain/anchor
 * Same operation as /api/audit/anchor, exposed here so the blockchain screen
 * does not have to reach into the audit namespace.
 */
router.post("/anchor", staffOnly, async (req, res) => {
  const anchor = await anchorAuditTrail({ actorId: req.user._id, force: true });
  if (!anchor) {
    return res.status(422).json({ message: "There are no audit records to anchor yet." });
  }
  res.json({ anchor, service: blockchain.status() });
});

/**
 * GET /api/blockchain/anchors/:id/verify
 * Re-derives a demo anchor id from the hash it claims to commit to. A live
 * transaction cannot be checked this way, and the response says so plainly
 * rather than reporting a verification that did not happen.
 */
router.get("/anchors/:id/verify", staffOnly, async (req, res) => {
  const anchor = await Anchor.findById(req.params.id);
  if (!anchor) return res.status(404).json({ message: "Anchor not found" });

  res.json({ anchor, result: blockchain.verifyAnchor(anchor) });
});

module.exports = router;
