const express = require("express");
const AuditLog = require("../models/AuditLog");
const Anchor = require("../models/Anchor");
const { authRequired, requireRoles } = require("../middleware/auth");
const { anchorAuditTrail } = require("../utils/audit");

const router = express.Router();

router.get("/", authRequired, async (req, res) => {
  const logs = await AuditLog.find()
    .populate("actorId", "name email role")
    .sort({ timestamp: -1, _id: -1 })
    .limit(200);
  res.json(logs);
});

router.get("/anchors", authRequired, async (_req, res) => {
  const anchors = await Anchor.find().sort({ anchoredAt: -1 }).limit(50);
  res.json(anchors);
});

router.post("/anchor", authRequired, requireRoles("reviewer", "accountant"), async (req, res) => {
  const anchor = await anchorAuditTrail();
  res.json(anchor || { message: "No new entries to anchor" });
});

module.exports = router;
