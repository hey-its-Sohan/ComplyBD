const express = require("express");
const Obligation = require("../models/Obligation");
const { authRequired, requireRoles } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");
const { matchAndAlert } = require("../utils/match");
const { groundObligation } = require("../utils/grounding");
const Circular = require("../models/Circular");

const router = express.Router();

router.get("/", authRequired, async (_req, res) => {
  const queue = await Obligation.find({
    reviewStatus: { $in: ["needs_review", "pending"] },
  })
    .populate("circularId", "title source documentText publishedDate")
    .sort({ confidence: 1, createdAt: -1 });
  res.json(queue);
});

router.patch("/:id", authRequired, requireRoles("reviewer", "accountant"), async (req, res) => {
  const obligation = await Obligation.findById(req.params.id);
  if (!obligation) return res.status(404).json({ message: "Obligation not found" });

  const { decision, summaryBangla, penalty } = req.body || {};
  if (summaryBangla) obligation.summaryBangla = summaryBangla;
  if (penalty) obligation.penalty = penalty;

  const circular = await Circular.findById(obligation.circularId);
  if (circular) {
    const grounded = groundObligation(circular.documentText, {
      summarySnippet: (summaryBangla || obligation.summaryBangla || "").slice(0, 24),
      penalty: obligation.penalty,
    });
    if (grounded.sourceSpans.length) {
      obligation.sourceSpans = grounded.sourceSpans;
    }
  }

  if (decision === "verified") {
    obligation.reviewStatus = "verified";
    obligation.verifiedBy = req.user._id;
    if (obligation.confidence < 70) obligation.confidence = 88;
    obligation.groundingStatus = obligation.sourceSpans.length ? "grounded" : obligation.groundingStatus;
    await obligation.save();
    const alerts = await matchAndAlert(obligation, req.user._id);
    await writeAudit({
      action: "OBLIGATION_VERIFIED",
      entityType: "Obligation",
      entityId: obligation._id,
      actorId: req.user._id,
      metadata: { alertsCreated: alerts.length },
    });
    return res.json({ obligation, alertsCreated: alerts.length });
  }

  if (decision === "rejected") {
    obligation.reviewStatus = "rejected";
    obligation.verifiedBy = req.user._id;
    await obligation.save();
    await writeAudit({
      action: "OBLIGATION_REJECTED",
      entityType: "Obligation",
      entityId: obligation._id,
      actorId: req.user._id,
      metadata: {},
    });
    return res.json({ obligation, alertsCreated: 0 });
  }

  await obligation.save();
  res.json({ obligation });
});

module.exports = router;
