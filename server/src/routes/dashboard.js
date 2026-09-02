const express = require("express");
const Business = require("../models/Business");
const Alert = require("../models/Alert");
const Obligation = require("../models/Obligation");
const Circular = require("../models/Circular");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/accountant", authRequired, async (req, res) => {
  const businesses = await Business.find({ accountantId: req.user._id });
  const ids = businesses.map((b) => b._id);
  const alerts = await Alert.find({ businessId: { $in: ids } })
    .populate("businessId")
    .populate({ path: "obligationId", populate: { path: "circularId", select: "title source" } })
    .sort({ deliveredAt: -1 });
  const reviewCount = await Obligation.countDocuments({ reviewStatus: { $in: ["needs_review", "pending"] } });
  const circularCount = await Circular.countDocuments();
  const verifiedAlerts = alerts.filter((a) => a.obligationId && a.obligationId.reviewStatus === "verified").length;

  res.json({
    totalClients: businesses.length,
    newRegulatoryChanges: circularCount,
    requiresReview: reviewCount,
    verifiedAlerts,
    businesses,
    alerts,
  });
});

router.get("/owner", authRequired, async (req, res) => {
  const businesses = await Business.find({ ownerId: req.user._id });
  const ids = businesses.map((b) => b._id);
  const alerts = await Alert.find({ businessId: { $in: ids } })
    .populate("businessId")
    .populate({ path: "obligationId", populate: { path: "circularId", select: "title source effectiveDate" } })
    .sort({ deliveredAt: -1 });
  res.json({ businesses, alerts, openAlerts: alerts.filter((a) => a.status !== "resolved").length });
});

module.exports = router;
