/**
 * obligationDecisions.js
 * -----------------------------------------------------------------------------
 * Shared verify / reject logic, used by both /api/obligations and /api/reviews
 * so the two routes can never drift into different safety behaviour.
 *
 * The automated pipeline may never verify an obligation whose critical fields
 * are unsupported by the source text. A named human reviewer may override that,
 * but only deliberately: they must pass `override: true` with a written reason,
 * and the override is written to the hash-chained audit log under their user id.
 * Accountability moves to a person; it does not disappear.
 */

const Obligation = require("../models/Obligation");
const { writeAudit } = require("../utils/audit");
const { matchAndAlert } = require("../utils/match");
const { CRITICAL_FIELDS } = require("./confidence");
const { recordVersion } = require("./obligationVersions");

/**
 * Which critical fields, if any, are not supported by the circular text.
 */
function ungroundedCriticalFields(obligation) {
  const grounding = obligation.fieldGrounding || [];
  if (!grounding.length) return [];
  return grounding
    .filter((f) => CRITICAL_FIELDS.includes(f.field) && !f.grounded)
    .map((f) => f.field);
}

/**
 * Verify an obligation and dispatch alerts to matching SMEs.
 *
 * @returns {Promise<{ ok: boolean, status?: number, message?: string, blockedFields?: string[], obligation?: object, alertsCreated?: number }>}
 */
async function verifyObligation({ obligationId, actor, override = false, overrideReason = "", edits = {} }) {
  const obligation = await Obligation.findById(obligationId);
  if (!obligation) return { ok: false, status: 404, message: "Obligation not found" };

  if (obligation.reviewStatus === "verified") {
    return { ok: true, obligation, alertsCreated: 0, alreadyVerified: true };
  }

  const blocked = ungroundedCriticalFields(obligation);

  if (blocked.length && !override) {
    return {
      ok: false,
      status: 409,
      message:
        `Cannot verify: ${blocked.join(" and ")} could not be found in the source circular. ` +
        "Correct the value, or confirm the override to take personal responsibility for publishing it.",
      blockedFields: blocked,
      requiresOverride: true,
    };
  }

  if (blocked.length && override && !String(overrideReason).trim()) {
    return {
      ok: false,
      status: 400,
      message: "An override needs a written reason. It is recorded in the audit trail.",
      blockedFields: blocked,
      requiresOverride: true,
    };
  }

  // Reviewer corrections are applied before verification so the alert that goes
  // out to SME owners reflects the human-approved wording, not the draft.
  if (typeof edits.summaryBangla === "string" && edits.summaryBangla.trim()) {
    obligation.summaryBangla = edits.summaryBangla.trim();
  }
  if (typeof edits.penalty === "string" && edits.penalty.trim()) {
    obligation.penalty = edits.penalty.trim();
  }
  if (typeof edits.requiredAction === "string" && edits.requiredAction.trim()) {
    obligation.requiredAction = edits.requiredAction.trim();
  }

  obligation.reviewStatus = "verified";
  obligation.verifiedBy = actor._id;
  obligation.autoVerified = false;
  obligation.routingReason = blocked.length
    ? `Verified by ${actor.name} with an explicit override. Reason: ${overrideReason}`
    : `Verified by ${actor.name} after review.`;

  await obligation.save();

  // The review decision itself, recorded before anything is published.
  await writeAudit({
    action: "REVIEW_PERFORMED",
    entityType: "Obligation",
    entityId: obligation._id,
    actorId: actor._id,
    metadata: {
      decision: "approved",
      reviewer: actor.name,
      override: blocked.length > 0,
      overriddenFields: blocked,
    },
  });

  const alerts = await matchAndAlert(obligation, actor._id);

  if (alerts.length) {
    await writeAudit({
      action: "ALERT_PUBLISHED",
      entityType: "Obligation",
      entityId: obligation._id,
      actorId: actor._id,
      metadata: {
        count: alerts.length,
        businessIds: alerts.map((a) => String(a.businessId)),
      },
    });
  }

  const verifyEntry = await writeAudit({
    action: blocked.length ? "OBLIGATION_VERIFIED_WITH_OVERRIDE" : "OBLIGATION_VERIFIED",
    entityType: "Obligation",
    entityId: obligation._id,
    actorId: actor._id,
    metadata: {
      confidence: obligation.confidence,
      confidenceBand: obligation.confidenceBand,
      groundingScore: obligation.overallGroundingScore,
      alertsCreated: alerts.length,
      overriddenFields: blocked,
      overrideReason: blocked.length ? overrideReason : undefined,
    },
  });

  await recordVersion({
    obligation,
    changeType: "verified",
    changeNote: blocked.length
      ? `Published by ${actor.name} with an override on ${blocked.join(", ")}.`
      : `Approved by ${actor.name}.`,
    actor,
    auditHash: verifyEntry?.currentHash || "",
  });

  return { ok: true, obligation, alertsCreated: alerts.length, overrodeFields: blocked };
}

/**
 * Reject an obligation. Rejected obligations never generate alerts.
 */
async function rejectObligation({ obligationId, actor, reason = "" }) {
  const obligation = await Obligation.findById(obligationId);
  if (!obligation) return { ok: false, status: 404, message: "Obligation not found" };

  obligation.reviewStatus = "rejected";
  obligation.verifiedBy = actor._id;
  obligation.autoVerified = false;
  obligation.routingReason = reason
    ? `Rejected by ${actor.name}. Reason: ${reason}`
    : `Rejected by ${actor.name}.`;

  await obligation.save();

  await writeAudit({
    action: "REVIEW_PERFORMED",
    entityType: "Obligation",
    entityId: obligation._id,
    actorId: actor._id,
    metadata: { decision: "rejected", reviewer: actor.name, reason },
  });

  const rejectEntry = await writeAudit({
    action: "OBLIGATION_REJECTED",
    entityType: "Obligation",
    entityId: obligation._id,
    actorId: actor._id,
    metadata: { reason, confidence: obligation.confidence },
  });

  await recordVersion({
    obligation,
    changeType: "rejected",
    changeNote: reason ? `Rejected by ${actor.name}. ${reason}` : `Rejected by ${actor.name}.`,
    actor,
    auditHash: rejectEntry?.currentHash || "",
  });

  return { ok: true, obligation, alertsCreated: 0 };
}

module.exports = {
  ungroundedCriticalFields,
  verifyObligation,
  rejectObligation,
};
