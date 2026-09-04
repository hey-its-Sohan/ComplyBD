const express = require("express");
const Obligation = require("../models/Obligation");
const { authRequired, requireRoles } = require("../middleware/auth");
const { verifyObligation, rejectObligation } = require("../services/obligationDecisions");
const { DISCLAIMER } = require("../services/regulatoryPipeline");
const { versionHistory } = require("../services/obligationVersions");

const router = express.Router();

/**
 * GET /api/obligations
 * Filters: ?reviewStatus= ?category= ?band= ?grounded=true|false ?circularId=
 */
router.get("/", authRequired, async (req, res) => {
  const filter = {};
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  if (req.query.category) filter.businessCategory = req.query.category;
  if (req.query.band) filter.confidenceBand = req.query.band;
  if (req.query.circularId) filter.circularId = req.query.circularId;
  if (req.query.grounded === "true") filter.groundingStatus = "grounded";
  if (req.query.grounded === "false") filter.groundingStatus = { $in: ["partial", "ungrounded"] };

  const obligations = await Obligation.find(filter)
    .populate("circularId", "title source publishedDate")
    .populate("verifiedBy", "name")
    .sort({ createdAt: -1 });

  res.json(obligations);
});

/**
 * GET /api/obligations/:id
 * Returns the obligation plus the source text, so the split viewer can
 * highlight evidence without a second request.
 */
router.get("/:id", authRequired, async (req, res) => {
  const obligation = await Obligation.findById(req.params.id)
    .populate("circularId")
    .populate("verifiedBy", "name email");
  if (!obligation) return res.status(404).json({ message: "Obligation not found" });

  // Source provenance is mandatory on this page, so resolve the circular
  // explicitly rather than trusting that populate produced a document. A raw
  // ObjectId here would render the whole Source panel blank.
  const Circular = require("../models/Circular");
  let circular = obligation.circularId;
  if (circular && !circular.title && obligation.circularId) {
    circular = await Circular.findById(
      circular._id ? circular._id : circular
    );
  }

  // Who this obligation actually reached, scoped to what the caller may see.
  const Business = require("../models/Business");
  const Alert = require("../models/Alert");

  const scope = {};
  if (req.user.role === "accountant") scope.accountantId = req.user._id;
  if (req.user.role === "owner") scope.ownerId = req.user._id;

  const visible = await Business.find(scope).select("_id name category location");
  const visibleById = new Map(visible.map((b) => [String(b._id), b]));

  const alerts = await Alert.find({ obligationId: obligation._id })
    .populate("businessId", "name category location")
    .sort({ deliveredAt: -1 });

  // `businessId` is an object once populated and a raw ObjectId otherwise.
  // Resolve against the scoped list so either shape yields the same answer.
  const affected = [];
  for (const a of alerts) {
    const ref = a.businessId;
    const key = String(ref && ref._id ? ref._id : ref || "");
    const business = visibleById.get(key) || (ref && ref.name ? ref : null);
    if (!business || !visibleById.has(key)) continue;
    affected.push({
      alertId: a._id,
      businessId: business._id,
      name: business.name,
      category: business.category,
      location: business.location,
      priority: a.priority,
      status: a.status,
    });
  }

  const alertedIds = new Set(affected.map((a) => String(a.businessId)));

  // Businesses that match the category but have no alert yet — usually because
  // the obligation has not been verified. Worth showing rather than hiding.
  const wouldMatch = visible
    .filter((b) => b.category === obligation.businessCategory)
    .filter((b) => !alertedIds.has(String(b._id)))
    .map((b) => ({ businessId: b._id, name: b.name, category: b.category, location: b.location }));

  const versions = await versionHistory(obligation._id);

  res.json({
    obligation,
    circular,
    documentText: circular ? circular.documentText : "",
    affectedClients: affected,
    pendingMatches: wouldMatch,
    versions,
    disclaimer: DISCLAIMER,
  });
});

/**
 * POST /api/obligations/:id/verify
 * Body: { override?: boolean, overrideReason?: string, summaryBangla?, penalty?, requiredAction? }
 *
 * Refuses with 409 when a critical field is ungrounded, unless the reviewer
 * explicitly overrides and gives a reason, which is written to the audit trail.
 */
router.post("/:id/verify", authRequired, requireRoles("accountant", "reviewer"), async (req, res) => {
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
 * POST /api/obligations/:id/reject
 * Body: { reason?: string }
 */
router.post("/:id/reject", authRequired, requireRoles("accountant", "reviewer"), async (req, res) => {
  const result = await rejectObligation({
    obligationId: req.params.id,
    actor: req.user,
    reason: (req.body && req.body.reason) || "",
  });

  if (!result.ok) {
    return res.status(result.status || 400).json({ message: result.message });
  }

  res.json({ obligation: result.obligation, alertsCreated: 0 });
});

module.exports = router;
