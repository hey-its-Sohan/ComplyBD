const express = require("express");
const Obligation = require("../models/Obligation");
const { authRequired, requireRoles } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");
const { matchAndAlert } = require("../utils/match");
const { groundObligation } = require("../utils/grounding");
const Circular = require("../models/Circular");
const { verifyObligation, rejectObligation } = require("../services/obligationDecisions");

const router = express.Router();

/** Items awaiting a human decision, worst confidence first. */
function queueQuery() {
  return Obligation.find({ reviewStatus: { $in: ["needs_review", "pending"] } })
    .populate("circularId", "title source documentText publishedDate sourceUrl")
    .sort({ confidence: 1, createdAt: -1 });
}

/**
 * GET /api/reviews
 * Kept from Prompt 1 so the existing Review queue page keeps working.
 */
router.get("/", authRequired, async (_req, res) => {
  const queue = await queueQuery();
  res.json(queue);
});

/**
 * GET /api/reviews/queue
 * Same queue plus a summary block for dashboards.
 */
router.get("/queue", authRequired, async (_req, res) => {
  const queue = await queueQuery();

  const summary = {
    total: queue.length,
    needsReview: queue.filter((q) => q.reviewStatus === "needs_review").length,
    pending: queue.filter((q) => q.reviewStatus === "pending").length,
    lowConfidence: queue.filter((q) => q.confidenceBand === "low").length,
    blockedByGrounding: queue.filter((q) =>
      (q.fieldGrounding || []).some(
        (f) => ["effectiveDate", "penalty"].includes(f.field) && !f.grounded
      )
    ).length,
  };

  res.json({ queue, summary });
});

/**
 * POST /api/reviews/:id/approve
 * Body: { override?, overrideReason?, summaryBangla?, penalty?, requiredAction? }
 */
router.post("/:id/approve", authRequired, requireRoles("reviewer", "accountant"), async (req, res) => {
  const { override, overrideReason, summaryBangla, penalty, requiredAction } = req.body || {};

  const result = await verifyObligation({
    obligationId: req.params.id,
    actor: req.user,
    override: Boolean(override),
    overrideReason: overrideReason || "",
    edits: { summaryBangla, penalty, requiredAction },
  });

  if (!result.ok) {
    return res.status(result.status || 400).json({
      message: result.message,
      blockedFields: result.blockedFields || [],
      requiresOverride: Boolean(result.requiresOverride),
    });
  }

  res.json({
    obligation: result.obligation,
    alertsCreated: result.alertsCreated,
    overrodeFields: result.overrodeFields || [],
  });
});

/**
 * POST /api/reviews/:id/reject
 * Body: { reason?: string }
 */
router.post("/:id/reject", authRequired, requireRoles("reviewer", "accountant"), async (req, res) => {
  const result = await rejectObligation({
    obligationId: req.params.id,
    actor: req.user,
    reason: (req.body && req.body.reason) || "",
  });

  if (!result.ok) return res.status(result.status || 400).json({ message: result.message });

  res.json({ obligation: result.obligation, alertsCreated: 0 });
});

/**
 * PATCH /api/reviews/:id
 * The original Prompt 1 decision endpoint. Left in place so nothing that
 * already calls it breaks; it now delegates to the shared decision logic for
 * pipeline-produced obligations so the grounding safeguard applies there too.
 */
router.patch("/:id", authRequired, requireRoles("reviewer", "accountant"), async (req, res) => {
  const obligation = await Obligation.findById(req.params.id);
  if (!obligation) return res.status(404).json({ message: "Obligation not found" });

  const { decision, summaryBangla, penalty, override, overrideReason } = req.body || {};

  if (decision === "verified") {
    const result = await verifyObligation({
      obligationId: obligation._id,
      actor: req.user,
      override: Boolean(override),
      overrideReason: overrideReason || "",
      edits: { summaryBangla, penalty },
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        message: result.message,
        blockedFields: result.blockedFields || [],
        requiresOverride: Boolean(result.requiresOverride),
      });
    }
    return res.json({ obligation: result.obligation, alertsCreated: result.alertsCreated });
  }

  if (decision === "rejected") {
    const result = await rejectObligation({
      obligationId: obligation._id,
      actor: req.user,
      reason: overrideReason || "",
    });
    if (!result.ok) return res.status(result.status || 400).json({ message: result.message });
    return res.json({ obligation: result.obligation, alertsCreated: 0 });
  }

  // No decision: just save edits and refresh the legacy spans.
  if (summaryBangla) obligation.summaryBangla = summaryBangla;
  if (penalty) obligation.penalty = penalty;

  const circular = await Circular.findById(obligation.circularId);
  if (circular && !obligation.pipelineVersion) {
    const grounded = groundObligation(circular.documentText, {
      summarySnippet: (summaryBangla || obligation.summaryBangla || "").slice(0, 24),
      penalty: obligation.penalty,
    });
    if (grounded.sourceSpans.length) obligation.sourceSpans = grounded.sourceSpans;
  }

  await obligation.save();
  await writeAudit({
    action: "OBLIGATION_EDITED",
    entityType: "Obligation",
    entityId: obligation._id,
    actorId: req.user._id,
    metadata: {},
  });

  res.json({ obligation });
});

module.exports = router;
