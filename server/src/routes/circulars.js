const express = require("express");
const Circular = require("../models/Circular");
const Obligation = require("../models/Obligation");
const { authRequired, requireRoles } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");
const { extractObligations } = require("../utils/extract");
const { matchAndAlert } = require("../utils/match");

const router = express.Router();

router.get("/", authRequired, async (_req, res) => {
  const circulars = await Circular.find().sort({ publishedDate: -1 });
  res.json(circulars);
});

router.get("/:id", authRequired, async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) return res.status(404).json({ message: "Circular not found" });
  const obligations = await Obligation.find({ circularId: circular._id });
  res.json({ circular, obligations });
});

router.post("/", authRequired, requireRoles("accountant", "reviewer"), async (req, res) => {
  const { title, source, documentText, publishedDate, effectiveDate, sourceUrl } = req.body || {};
  if (!title || !documentText) return res.status(400).json({ message: "Title and document text are required" });

  const circular = await Circular.create({
    title,
    source: source || "NBR",
    documentText,
    publishedDate: publishedDate ? new Date(publishedDate) : new Date(),
    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    sourceUrl: sourceUrl || "",
    status: "ingested",
  });

  await writeAudit({
    action: "CIRCULAR_INGESTED",
    entityType: "Circular",
    entityId: circular._id,
    actorId: req.user._id,
    metadata: { title: circular.title },
  });

  res.status(201).json(circular);
});

router.post("/:id/extract", authRequired, requireRoles("accountant", "reviewer"), async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) return res.status(404).json({ message: "Circular not found" });

  const drafts = extractObligations(circular);
  const created = await Obligation.insertMany(drafts);
  circular.status = "extracted";
  await circular.save();

  await writeAudit({
    action: "OBLIGATIONS_EXTRACTED",
    entityType: "Circular",
    entityId: circular._id,
    actorId: req.user._id,
    metadata: { count: created.length },
  });

  const alerts = [];
  for (const ob of created) {
    if (ob.reviewStatus !== "needs_review" && ob.confidence >= 75) {
      ob.reviewStatus = "verified";
      await ob.save();
      const made = await matchAndAlert(ob, req.user._id);
      alerts.push(...made);
    }
  }

  res.json({ circular, obligations: created, alertsCreated: alerts.length });
});

module.exports = router;
