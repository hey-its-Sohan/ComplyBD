const Business = require("../models/Business");
const Alert = require("../models/Alert");

function priorityFromObligation(obligation) {
  if (obligation.confidence < 50) return "high";
  if (String(obligation.obligationType).toLowerCase().includes("vat")) return "high";
  if (obligation.groundingStatus === "ungrounded") return "high";
  return obligation.confidence >= 85 ? "medium" : "low";
}

async function matchAndAlert(obligation, actorId) {
  if (obligation.reviewStatus === "rejected") return [];
  if (obligation.reviewStatus === "needs_review") return [];

  const businesses = await Business.find({
    category: obligation.businessCategory,
    authorizationStatus: "authorized",
  });

  const created = [];
  for (const business of businesses) {
    const existing = await Alert.findOne({ obligationId: obligation._id, businessId: business._id });
    if (existing) continue;
    const alert = await Alert.create({
      obligationId: obligation._id,
      businessId: business._id,
      priority: priorityFromObligation(obligation),
      title: `${obligation.obligationType} — ${business.name}`,
      messageBangla: `${business.name} (${business.location}): ${obligation.summaryBangla}`,
      status: "new",
      deliveredAt: new Date(),
    });
    created.push(alert);
  }
  return created;
}

module.exports = { matchAndAlert, priorityFromObligation };
