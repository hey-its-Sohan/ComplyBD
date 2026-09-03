const Business = require("../models/Business");
const Alert = require("../models/Alert");
const { banglaCategory, banglaObligation } = require("../services/fieldLexicon");
const { formatDateBangla } = require("../services/banglaText");
const { writeAudit } = require("./audit");

const DAY = 24 * 60 * 60 * 1000;

/**
 * Urgency combines two things a shop owner weighs differently: how soon the
 * rule bites, and whether getting it wrong costs money.
 *
 * Rate changes, withholding and device mandates carry a direct financial or
 * enforcement penalty, so they escalate faster than procedural duties like
 * filing a return or reformatting an invoice. Without that split almost
 * everything from a single circular lands on the same date and every alert
 * shows as urgent, which tells the owner nothing.
 */
function priorityFromObligation(obligation) {
  const effective = obligation.effectiveDate ? new Date(obligation.effectiveDate).getTime() : null;
  const daysAway = effective ? Math.ceil((effective - Date.now()) / DAY) : null;

  const financial = /vat|মূসক|withholding|উৎসে|efd|ফিসকাল|rate|শুল্ক/i.test(
    String(obligation.obligationType)
  );

  // No stated date: we cannot claim urgency we do not know.
  if (daysAway === null) return financial ? "medium" : "low";

  if (financial && daysAway <= 45) return "high";
  if (financial && daysAway <= 120) return "medium";
  if (!financial && daysAway <= 45) return "medium";
  return "low";
}

/**
 * The four questions, answered in plain Bangla for one specific business.
 * Deliberately descriptive: it says what the circular states and what a business
 * in this category would normally do, never "you are legally required to".
 */
function buildBanglaContent(obligation, business) {
  const category = banglaCategory(obligation.businessCategory);
  const type = banglaObligation(obligation.obligationType);
  const when = obligation.effectiveDate ? formatDateBangla(obligation.effectiveDate) : null;

  const whatChanged = when
    ? `নতুন ${type} সংক্রান্ত নিয়ম ${when} থেকে কার্যকর হবে।`
    : `${type} সংক্রান্ত নতুন নির্দেশনা জারি হয়েছে। কার্যকর তারিখ পরিপত্রে উল্লেখ নেই।`;

  const whyItMatters = `আপনার ${category} ব্যবসার জন্য এই পরিবর্তনটি প্রযোজ্য বলে মনে হচ্ছে (${business.name}, ${business.location})।`;

  const whatToDo =
    obligation.requiredAction && obligation.requiredAction.trim()
      ? `করণীয়: ${obligation.requiredAction.trim()}`
      : `করণীয়: পরিপত্রটি আপনার হিসাবরক্ষকের সঙ্গে দেখে নিন এবং প্রয়োজনীয় হালনাগাদ করুন।`;

  return { whatChanged, whyItMatters, whatToDo };
}

/**
 * Match a verified obligation to SME businesses by category and create alerts.
 *
 * Unverified obligations never reach a business. That is the whole point of the
 * review queue, so the guard lives here rather than in each caller.
 *
 * @returns {Promise<Array>} the alerts created by this call
 */
async function matchAndAlert(obligation, actorId) {
  if (obligation.reviewStatus !== "verified") return [];

  const businesses = await Business.find({
    category: obligation.businessCategory,
    authorizationStatus: "authorized",
  });

  const priority = priorityFromObligation(obligation);
  const created = [];

  for (const business of businesses) {
    const existing = await Alert.findOne({
      obligationId: obligation._id,
      businessId: business._id,
    });
    if (existing) continue;

    const { whatChanged, whyItMatters, whatToDo } = buildBanglaContent(obligation, business);

    const alert = await Alert.create({
      obligationId: obligation._id,
      businessId: business._id,
      priority,
      title: `${obligation.obligationType} — ${business.name}`,
      messageBangla: `${business.name}: ${obligation.summaryBangla}`,
      whatChanged,
      whyItMatters,
      whatToDo,
      effectiveDate: obligation.effectiveDate || null,
      status: "new",
      deliveredAt: new Date(),
    });
    created.push(alert);
  }

  // Each generated alert is recorded individually: the audit trail should be
  // able to answer "was this specific business told, and when".
  for (const alert of created) {
    await writeAudit({
      action: "ALERT_GENERATED",
      entityType: "Alert",
      entityId: alert._id,
      actorId: actorId || null,
      metadata: {
        obligationId: String(obligation._id),
        businessId: String(alert.businessId),
        priority: alert.priority,
        effectiveDate: alert.effectiveDate ? alert.effectiveDate.toISOString() : null,
      },
    });
  }

  // Total reach, not just this batch, so re-running does not reset the count.
  const total = await Alert.countDocuments({ obligationId: obligation._id });
  if (obligation.matchedBusinessCount !== total) {
    obligation.matchedBusinessCount = total;
    if (typeof obligation.save === "function") await obligation.save();
  }

  return created;
}

module.exports = { matchAndAlert, priorityFromObligation, buildBanglaContent };
