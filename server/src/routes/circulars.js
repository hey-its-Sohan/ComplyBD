const express = require("express");
const Circular = require("../models/Circular");
const Obligation = require("../models/Obligation");
const { authRequired, requireRoles } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");
const { extractObligations } = require("../utils/extract");
const { matchAndAlert } = require("../utils/match");
const {
  runPipeline,
  buildFieldTable,
  providerStatus,
  DISCLAIMER,
} = require("../services/regulatoryPipeline");
const { recordVersion } = require("../services/obligationVersions");

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

/**
 * POST /api/circulars/:id/process
 *
 * The main pipeline endpoint: extraction -> grounding -> confidence -> routing.
 * Returns the full trace so the UI can show every stage, not just the answer.
 *
 * Query params:
 *   ?dryRun=true   run the pipeline and return the result without saving
 */
router.post("/:id/process", authRequired, requireRoles("accountant", "reviewer"), async (req, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) return res.status(404).json({ message: "Circular not found" });

  let result;
  try {
    result = await runPipeline(circular);
  } catch (err) {
    return res.status(422).json({ message: `Pipeline failed: ${err.message}` });
  }

  const dryRun = String(req.query.dryRun || "") === "true";
  const fieldTable = buildFieldTable(result);

  const payload = {
    circular: {
      _id: circular._id,
      title: circular.title,
      source: circular.source,
      sourceUrl: circular.sourceUrl,
      publishedDate: circular.publishedDate,
      documentText: circular.documentText,
    },
    pipelineVersion: result.pipelineVersion,
    disclaimer: DISCLAIMER,
    provider: result.provider,
    providerStatus: providerStatus(),
    steps: result.steps,
    trace: result.trace,
    extraction: result.extraction,
    fieldTable,
    fieldGrounding: result.fieldGrounding,
    overallGroundingScore: result.overallGroundingScore,
    sourceEvidence: result.sourceEvidence,
    confidence: result.confidence,
    routing: result.routing,
    totalMs: result.totalMs,
    dryRun,
  };

  if (dryRun) return res.json({ ...payload, obligation: result.obligationDraft, saved: false });

  // Re-processing replaces the previous pipeline output for this circular, but
  // only where a human has not already ruled on it, and never touches the
  // obligations produced by the original extractor.
  await Obligation.deleteMany({
    circularId: circular._id,
    pipelineVersion: { $nin: [null, ""] },
    reviewStatus: { $in: ["needs_review", "pending"] },
    verifiedBy: null,
  });

  const obligation = await Obligation.create({
    ...result.obligationDraft,
    circularId: circular._id,
  });

  circular.status = "extracted";
  await circular.save();

  const extractEntry = await writeAudit({
    action: "OBLIGATION_EXTRACTED",
    entityType: "Obligation",
    entityId: obligation._id,
    actorId: req.user._id,
    metadata: {
      obligationType: obligation.obligationType,
      businessCategory: obligation.businessCategory,
      confidence: obligation.confidence,
      groundingStatus: obligation.groundingStatus,
      extractionMethod: obligation.extractionMethod,
    },
  });

  // Version 1 is always the machine's draft, before any human touches it.
  await recordVersion({
    obligation,
    changeType: "extracted",
    changeNote: `Extracted by ${result.provider.label} and checked against the source text.`,
    actor: null,
    auditHash: extractEntry?.currentHash || "",
  });

  await writeAudit({
    action: "CIRCULAR_PROCESSED",
    entityType: "Circular",
    entityId: circular._id,
    actorId: req.user._id,
    metadata: {
      pipelineVersion: result.pipelineVersion,
      extractionMethod: result.provider.extractionMethod,
      confidence: result.confidence.score,
      confidenceBand: result.confidence.band,
      groundingScore: result.overallGroundingScore,
      reviewStatus: result.routing.reviewStatus,
      ungroundedFields: result.confidence.ungroundedFields,
    },
  });

  // Auto-verified obligations dispatch alerts immediately. Anything the
  // grounding layer held back waits for a human in the review queue.
  let alertsCreated = 0;
  if (obligation.reviewStatus === "verified") {
    const alerts = await matchAndAlert(obligation, req.user._id);
    alertsCreated = alerts.length;
    await writeAudit({
      action: "ALERT_PUBLISHED",
      entityType: "Obligation",
      entityId: obligation._id,
      actorId: req.user._id,
      metadata: { count: alertsCreated, autoVerified: true },
    });
  }

  res.json({ ...payload, obligation, alertsCreated, saved: true });
});

module.exports = router;
