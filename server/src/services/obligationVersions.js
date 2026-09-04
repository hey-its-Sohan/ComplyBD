/**
 * obligationVersions.js
 * -----------------------------------------------------------------------------
 * Records an immutable snapshot each time an obligation changes state.
 *
 * The obligation document itself always holds the current state; the version
 * collection holds everything it used to be. Nothing here overwrites a previous
 * version, so "what guidance did we publish on 3 September, and who approved
 * it" stays answerable after any number of corrections.
 */

const ObligationVersion = require("../models/ObligationVersion");

/**
 * Append a version.
 *
 * @param {object} params
 * @param {object} params.obligation   the obligation document (mutated: version/updatedAt)
 * @param {string} params.changeType   extracted | verified | rejected | edited | reprocessed
 * @param {string} [params.changeNote] short human explanation
 * @param {object} [params.actor]      the acting user
 * @param {string} [params.auditHash]  hash of the audit record describing this change
 * @returns {Promise<object|null>} the version document
 */
async function recordVersion({ obligation, changeType, changeNote = "", actor = null, auditHash = "" }) {
  if (!obligation) return null;

  try {
    const existing = await ObligationVersion.countDocuments({ obligationId: obligation._id });
    const version = existing + 1;

    const snapshot = await ObligationVersion.create({
      obligationId: obligation._id,
      version,
      changeType,
      changeNote,
      businessCategory: obligation.businessCategory,
      obligationType: obligation.obligationType,
      effectiveDate: obligation.effectiveDate,
      penalty: obligation.penalty,
      requiredAction: obligation.requiredAction,
      summaryBangla: obligation.summaryBangla,
      confidence: obligation.confidence,
      confidenceBand: obligation.confidenceBand,
      groundingStatus: obligation.groundingStatus,
      overallGroundingScore: obligation.overallGroundingScore,
      reviewStatus: obligation.reviewStatus,
      extractionMethod: obligation.extractionMethod,
      pipelineVersion: obligation.pipelineVersion,
      actorId: actor?._id || null,
      actorName: actor?.name || (changeType === "extracted" ? "Extraction pipeline" : ""),
      auditHash,
    });

    obligation.version = version;
    obligation.updatedAt = new Date();

    // publishedAt is set once, the first time guidance actually goes out.
    if (obligation.reviewStatus === "verified" && !obligation.publishedAt) {
      obligation.publishedAt = new Date();
    }

    if (typeof obligation.save === "function") await obligation.save();

    return snapshot;
  } catch (err) {
    console.warn("Version snapshot failed:", err.message);
    return null;
  }
}

/** Full history, oldest first. */
async function versionHistory(obligationId) {
  return ObligationVersion.find({ obligationId })
    .populate("actorId", "name role")
    .sort({ version: 1 });
}

module.exports = { recordVersion, versionHistory };
