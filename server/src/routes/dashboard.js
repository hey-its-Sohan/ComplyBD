const express = require("express");
const Business = require("../models/Business");
const Alert = require("../models/Alert");
const Obligation = require("../models/Obligation");
const Circular = require("../models/Circular");
const { authRequired } = require("../middleware/auth");
const { priorityFromObligation } = require("../utils/match");

const router = express.Router();

const OPEN_STATUSES = ["new", "seen"];

/** Businesses this user is allowed to see. Reviewers see everything. */
async function scopedBusinesses(user) {
  if (user.role === "owner") return Business.find({ ownerId: user._id });
  if (user.role === "accountant") return Business.find({ accountantId: user._id });
  return Business.find();
}

/**
 * A client's compliance state, derived rather than stored so it can never go
 * stale against the alerts it summarises.
 */
function complianceHealth(alerts) {
  const open = alerts.filter((a) => OPEN_STATUSES.includes(a.status));
  const urgent = open.filter((a) => a.priority === "high");

  if (urgent.length) {
    return { status: "action_needed", label: "Action needed", open: open.length, urgent: urgent.length };
  }
  if (open.length) {
    return { status: "attention", label: "Needs attention", open: open.length, urgent: 0 };
  }
  return { status: "clear", label: "Up to date", open: 0, urgent: 0 };
}

/**
 * GET /api/dashboard/accountant
 * Top metrics, the compliance-changes feed, and the client roster.
 */
router.get("/accountant", authRequired, async (req, res) => {
  const businesses = await scopedBusinesses(req.user);
  const ids = businesses.map((b) => b._id);

  const alerts = await Alert.find({ businessId: { $in: ids } })
    .populate("businessId")
    .populate({ path: "obligationId", populate: { path: "circularId", select: "title source" } })
    .sort({ deliveredAt: -1 });

  const [circularCount, requiresReview, verifiedObligations, obligationsExtracted] =
    await Promise.all([
      Circular.countDocuments(),
      Obligation.countDocuments({ reviewStatus: { $in: ["needs_review", "pending"] } }),
      Obligation.countDocuments({ reviewStatus: "verified" }),
      Obligation.countDocuments(),
    ]);

  // Compliance changes: every verified obligation, with how many of this
  // accountant's clients it actually touches.
  const obligations = await Obligation.find({ reviewStatus: { $ne: "rejected" } })
    .populate("circularId", "title source publishedDate sourceUrl")
    .sort({ effectiveDate: 1, createdAt: -1 })
    .limit(40);

  const countsByCategory = businesses.reduce((acc, b) => {
    if (b.authorizationStatus === "authorized") acc[b.category] = (acc[b.category] || 0) + 1;
    return acc;
  }, {});

  const changes = obligations.map((ob) => ({
    _id: ob._id,
    circularTitle: ob.circularId?.title || "Untitled circular",
    circularId: ob.circularId?._id || null,
    source: ob.circularId?.source || "",
    businessCategory: ob.businessCategory,
    obligationType: ob.obligationType,
    effectiveDate: ob.effectiveDate,
    priority: priorityFromObligation(ob),
    reviewStatus: ob.reviewStatus,
    confidence: ob.confidence,
    confidenceBand: ob.confidenceBand,
    groundingStatus: ob.groundingStatus,
    extractionMethod: ob.extractionMethod,
    autoVerified: ob.autoVerified,
    summaryBangla: ob.summaryBangla,
    // Clients on this accountant's books, not the global match count.
    affectedClients: countsByCategory[ob.businessCategory] || 0,
    matchedBusinessCount: ob.matchedBusinessCount || 0,
  }));

  const openAlerts = alerts.filter((a) => OPEN_STATUSES.includes(a.status));

  // Clients touched by at least one non-rejected obligation. Counted from the
  // categories that actually produced changes, not just the size of the book.
  const affectedCategories = new Set(changes.map((c) => c.businessCategory));
  const affectedClients = businesses.filter(
    (b) => b.authorizationStatus === "authorized" && affectedCategories.has(b.category)
  ).length;

  res.json({
    totalClients: businesses.length,
    obligationsExtracted,
    verifiedObligations,
    affectedClients,
    newRegulatoryChanges: circularCount,
    requiresReview,
    verifiedAlerts: verifiedObligations,
    totalAlerts: alerts.length,
    openAlerts: openAlerts.length,
    urgentAlerts: alerts.filter((a) => a.priority === "high" && OPEN_STATUSES.includes(a.status)).length,
    businesses,
    alerts,
    changes,
    categoryBreakdown: Object.entries(countsByCategory).map(([category, count]) => ({
      category,
      count,
    })),
  });
});

/**
 * GET /api/dashboard/clients
 * One row per client for the management table.
 */
router.get("/clients", authRequired, async (req, res) => {
  const businesses = await scopedBusinesses(req.user);
  const ids = businesses.map((b) => b._id);

  const alerts = await Alert.find({ businessId: { $in: ids } }).sort({ deliveredAt: -1 });

  const byBusiness = alerts.reduce((acc, a) => {
    const key = String(a.businessId);
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  const rows = businesses.map((b) => {
    const own = byBusiness[String(b._id)] || [];
    const health = complianceHealth(own);
    return {
      _id: b._id,
      name: b.name,
      category: b.category,
      location: b.location,
      authorizationStatus: b.authorizationStatus,
      tin: b.tin,
      vatBin: b.vatBin,
      health,
      activeAlerts: health.open,
      urgentAlerts: health.urgent,
      totalAlerts: own.length,
      lastUpdated: own.length ? own[0].deliveredAt : null,
    };
  });

  res.json({ clients: rows });
});

/**
 * GET /api/dashboard/clients/:id
 * Profile, health, current alerts, relevant obligations and history.
 */
router.get("/clients/:id", authRequired, async (req, res) => {
  const business = await Business.findById(req.params.id)
    .populate("ownerId", "name email")
    .populate("accountantId", "name email");
  if (!business) return res.status(404).json({ message: "Client not found" });

  // `populate` turns these into objects, but a lean or unpopulated read leaves
  // raw ObjectIds. Compare on whichever shape arrived rather than assuming.
  const refId = (ref) => String(ref && ref._id ? ref._id : ref || "");

  // Owners may only open their own shops; accountants only their own books.
  if (req.user.role === "owner" && refId(business.ownerId) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not your business" });
  }
  if (req.user.role === "accountant" && refId(business.accountantId) !== String(req.user._id)) {
    return res.status(403).json({ message: "This client is not on your books" });
  }

  const alerts = await Alert.find({ businessId: business._id })
    .populate({ path: "obligationId", populate: { path: "circularId", select: "title source sourceUrl" } })
    .sort({ deliveredAt: -1 });

  const obligations = await Obligation.find({
    businessCategory: business.category,
    reviewStatus: { $ne: "rejected" },
  })
    .populate("circularId", "title source publishedDate sourceUrl")
    .sort({ effectiveDate: 1 });

  const current = alerts.filter((a) => OPEN_STATUSES.includes(a.status));
  const history = alerts.filter((a) => !OPEN_STATUSES.includes(a.status));

  res.json({
    business,
    health: complianceHealth(alerts),
    currentAlerts: current,
    historicalAlerts: history,
    obligations,
  });
});

/**
 * GET /api/dashboard/owner
 * Deliberately thin. The owner screen shows alerts and nothing else.
 */
router.get("/owner", authRequired, async (req, res) => {
  const businesses = await Business.find({ ownerId: req.user._id });
  const ids = businesses.map((b) => b._id);

  const alerts = await Alert.find({ businessId: { $in: ids } })
    .populate("businessId")
    .populate({
      path: "obligationId",
      populate: { path: "circularId", select: "title source effectiveDate sourceUrl" },
    })
    .sort({ deliveredAt: -1 });

  // The owner needs a way to reach a human. Look up whoever keeps their books.
  const User = require("../models/User");
  const accountantId = businesses.find((b) => b.accountantId)?.accountantId || null;
  const accountant = accountantId
    ? await User.findById(accountantId).select("name email")
    : null;

  res.json({
    businesses,
    alerts,
    openAlerts: alerts.filter((a) => OPEN_STATUSES.includes(a.status)).length,
    urgentAlerts: alerts.filter((a) => a.priority === "high" && OPEN_STATUSES.includes(a.status)).length,
    accountant,
  });
});

module.exports = router;
