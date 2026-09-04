const express = require("express");
const Business = require("../models/Business");
const { authRequired, requireRoles } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");

const router = express.Router();

/**
 * Which businesses a role may see:
 *   owner      — only the shops they own
 *   accountant — only the clients assigned to them
 *   reviewer   — all, because review decisions are category-wide and a reviewer
 *                never sees an individual owner's alerts
 */
function scopeFor(user) {
  if (user.role === "owner") return { ownerId: user._id };
  if (user.role === "accountant") return { accountantId: user._id };
  return {};
}

/** True when this user may act on this business. */
function canAccess(user, business) {
  const refId = (ref) => String(ref && ref._id ? ref._id : ref || "");
  if (user.role === "reviewer") return true;
  if (user.role === "owner") return refId(business.ownerId) === String(user._id);
  if (user.role === "accountant") return refId(business.accountantId) === String(user._id);
  return false;
}

router.get("/", authRequired, async (req, res) => {
  const businesses = await Business.find(scopeFor(req.user))
    .populate("ownerId", "name email")
    .populate("accountantId", "name email");
  res.json(businesses);
});

router.get("/:id", authRequired, async (req, res) => {
  const business = await Business.findById(req.params.id)
    .populate("ownerId", "name email")
    .populate("accountantId", "name email");
  if (!business) return res.status(404).json({ message: "Business not found" });

  if (!canAccess(req.user, business)) {
    return res.status(403).json({ message: "You do not have access to this business" });
  }

  res.json(business);
});

/**
 * PATCH /api/businesses/:id
 *
 * Only a small set of fields is editable, and every change is written to the
 * audit trail with its before and after values — a client's category decides
 * which obligations reach them, so silently changing it would silently change
 * what guidance they get.
 */
const EDITABLE = ["name", "category", "location", "tin", "vatBin", "authorizationStatus"];

router.patch("/:id", authRequired, requireRoles("accountant", "reviewer"), async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) return res.status(404).json({ message: "Business not found" });

  if (!canAccess(req.user, business)) {
    return res.status(403).json({ message: "This client is not on your books" });
  }

  const changes = {};
  for (const field of EDITABLE) {
    if (req.body?.[field] === undefined) continue;
    const next = req.body[field];
    if (String(business[field] ?? "") === String(next)) continue;
    changes[field] = { from: business[field] ?? null, to: next };
    business[field] = next;
  }

  if (!Object.keys(changes).length) {
    return res.json({ business, changed: [], message: "Nothing changed" });
  }

  try {
    await business.save();
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  await writeAudit({
    action: "BUSINESS_UPDATED",
    entityType: "Business",
    entityId: business._id,
    actorId: req.user._id,
    metadata: { changes, businessName: business.name },
  });

  res.json({ business, changed: Object.keys(changes) });
});

module.exports = router;
