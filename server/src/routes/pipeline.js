const express = require("express");
const { authRequired } = require("../middleware/auth");
const {
  PIPELINE_VERSION,
  STEPS,
  DISCLAIMER,
  providerStatus,
} = require("../services/regulatoryPipeline");
const { CRITICAL_FIELDS, CORE_FIELDS, WEIGHTS, BANDS } = require("../services/confidence");
const { GROUNDED_FIELDS } = require("../services/groundingEngine");

const router = express.Router();

/**
 * GET /api/pipeline/config
 *
 * Everything the UI needs to explain itself: which engine is live, which fields
 * get checked, and the exact scoring rules. Publishing the rules is the point —
 * a confidence score nobody can audit is not worth much in a compliance tool.
 */
router.get("/config", authRequired, (_req, res) => {
  res.json({
    pipelineVersion: PIPELINE_VERSION,
    disclaimer: DISCLAIMER,
    steps: STEPS,
    provider: providerStatus(),
    grounding: {
      checkedFields: GROUNDED_FIELDS,
      criticalFields: CRITICAL_FIELDS,
      coreFields: CORE_FIELDS,
    },
    scoring: {
      weights: WEIGHTS,
      bands: BANDS,
      rules: [
        "A field is grounded only if its value, a known surface form of it, or enough of its wording is found in the original circular.",
        "If the effective date or the penalty cannot be located in the source, confidence is capped at 45 and the obligation cannot be auto-verified.",
        "If the affected category or obligation type is not grounded, confidence is capped at 64.",
        "If the model quotes evidence that is not in the document, confidence is capped at 64.",
        "Only a high-confidence obligation with all four fields grounded is verified automatically.",
      ],
    },
  });
});

module.exports = router;
