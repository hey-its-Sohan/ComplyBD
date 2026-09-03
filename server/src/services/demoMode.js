/**
 * demoMode.js
 * -----------------------------------------------------------------------------
 * Demo mode is the default, and that is deliberate: the whole product has to run
 * on a laptop with MongoDB and nothing else — no paid API key, no wallet, no RPC
 * endpoint. A judge clones the repo, runs two commands, and everything works.
 *
 * Demo mode does not weaken any safety behaviour. Grounding, confidence scoring,
 * review routing, the hash chain and role restrictions are identical either way.
 * What it changes is only where inputs come from:
 *
 *   - extraction may fall back to the deterministic engine when no API key is set
 *   - anchoring may use a simulated (but deterministic, re-derivable) anchor id
 *   - sample NBR-style circulars are seeded
 *   - the demo reset endpoint is available
 *
 * Set DEMO_MODE=false for a deployment where those affordances should be off.
 */

function isDemoMode() {
  const raw = process.env.DEMO_MODE;
  if (raw === undefined || raw === "") return true; // default on
  return String(raw).trim().toLowerCase() !== "false";
}

/** Blocks a route entirely when demo mode is off. */
function requireDemoMode(_req, res, next) {
  if (!isDemoMode()) {
    return res.status(403).json({
      message:
        "This endpoint is only available in demo mode. Set DEMO_MODE=true to enable it.",
    });
  }
  next();
}

/** Summary for the UI, so the interface can be honest about what it is running. */
function demoStatus() {
  const { providerStatus } = require("./llm");
  const blockchain = require("./blockchainService");
  const provider = providerStatus();
  const chain = blockchain.status();

  return {
    demoMode: isDemoMode(),
    resetAvailable: isDemoMode(),
    extraction: {
      active: provider.activeLabel,
      usingLiveModel: provider.usingLiveModel,
      note: provider.usingLiveModel
        ? "Extraction is calling a live model. Grounding still verifies every field against the source."
        : "Extraction is using the deterministic engine. No API key required.",
    },
    blockchain: {
      mode: chain.mode,
      label: chain.label,
      note: chain.disclosure,
    },
    externalServicesRequired: provider.usingLiveModel || chain.live,
  };
}

module.exports = { isDemoMode, requireDemoMode, demoStatus };
