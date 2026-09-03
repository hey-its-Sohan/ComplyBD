const express = require("express");
const Alert = require("../models/Alert");
const Business = require("../models/Business");
const { authRequired } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");

const router = express.Router();

async function scopedBusinessIds(user) {
  if (user.role === "owner") {
    const list = await Business.find({ ownerId: user._id }).select("_id");
    return list.map((b) => b._id);
  }
  if (user.role === "accountant") {
    const list = await Business.find({ accountantId: user._id }).select("_id");
    return list.map((b) => b._id);
  }
  return null;
}

router.get("/", authRequired, async (req, res) => {
  const ids = await scopedBusinessIds(req.user);
  const filter = ids ? { businessId: { $in: ids } } : {};
  if (req.query.status) filter.status = req.query.status;
  const alerts = await Alert.find(filter)
    .populate({ path: "obligationId", populate: { path: "circularId", select: "title source" } })
    .populate("businessId")
    .sort({ deliveredAt: -1 });
  res.json(alerts);
});

router.get("/:id", authRequired, async (req, res) => {
  const alert = await Alert.findById(req.params.id)
    .populate({ path: "obligationId", populate: { path: "circularId" } })
    .populate("businessId");
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  res.json(alert);
});

router.patch("/:id", authRequired, async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  const { status } = req.body || {};
  if (status) alert.status = status;
  await alert.save();
  await writeAudit({
    action: "ALERT_STATUS_UPDATED",
    entityType: "Alert",
    entityId: alert._id,
    actorId: req.user._id,
    metadata: { status: alert.status },
  });
  const populated = await Alert.findById(alert._id)
    .populate({ path: "obligationId", populate: { path: "circularId" } })
    .populate("businessId");
  res.json(populated);
});

/**
 * POST /api/alerts/:id/acknowledge
 * The owner's "আমি বুঝেছি" button. Kept separate from the generic status patch
 * so the moment of acknowledgement is recorded with its own timestamp.
 */
router.post("/:id/acknowledge", authRequired, async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ message: "Alert not found" });

  alert.status = "acknowledged";
  alert.acknowledgedAt = new Date();
  await alert.save();

  await writeAudit({
    action: "ALERT_ACKNOWLEDGED",
    entityType: "Alert",
    entityId: alert._id,
    actorId: req.user._id,
    metadata: { businessId: String(alert.businessId) },
  });

  const populated = await Alert.findById(alert._id)
    .populate({ path: "obligationId", populate: { path: "circularId" } })
    .populate("businessId");
  res.json(populated);
});

module.exports = router;
