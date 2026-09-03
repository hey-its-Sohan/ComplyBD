/**
 * llm/index.js
 * -----------------------------------------------------------------------------
 * Provider registry and fallback policy.
 *
 * Every provider implements the same interface:
 *   { id, label, requiresApiKey, isAvailable(): boolean, extract(circular): Promise<extraction> }
 *
 * Adding another model means adding one file and one line to PROVIDERS. Nothing
 * else in the pipeline changes.
 *
 * Policy: use the configured provider when its key is present; otherwise use the
 * deterministic demo engine. If a configured provider throws at request time we
 * fall back to the demo engine rather than failing the request, and we record
 * that we did so.
 */

const demoProvider = require("./demoProvider");
const openaiProvider = require("./openaiProvider");
const anthropicProvider = require("./anthropicProvider");

const PROVIDERS = {
  demo: demoProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

function configuredProviderId() {
  return String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
}

/** The provider that will actually be used for the next extraction. */
function resolveProvider() {
  const requested = configuredProviderId();
  const provider = PROVIDERS[requested];

  if (!provider) {
    return { provider: demoProvider, requested, reason: `Unknown AI_PROVIDER "${requested}" — using the demo engine.` };
  }

  if (provider.requiresApiKey && !provider.isAvailable()) {
    return {
      provider: demoProvider,
      requested,
      reason: `No API key found for ${provider.label} — using the deterministic demo engine.`,
    };
  }

  return { provider, requested, reason: null };
}

/**
 * Run extraction with automatic fallback.
 *
 * @returns {Promise<{ extraction: object, providerId: string, extractionMethod: string, fallbackReason: string|null, durationMs: number }>}
 */
async function runExtraction(circular) {
  const { provider, requested, reason } = resolveProvider();
  const started = Date.now();

  try {
    const extraction = await provider.extract(circular);
    return {
      extraction,
      providerId: provider.id,
      providerLabel: provider.label,
      extractionMethod: provider.id === "demo" ? "deterministic-demo" : `llm-${provider.id}`,
      fallbackReason: reason,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    if (provider.id === "demo") throw err;

    // A live provider failed mid-flight. Degrade rather than break the demo.
    const extraction = await demoProvider.extract(circular);
    return {
      extraction,
      providerId: demoProvider.id,
      providerLabel: demoProvider.label,
      extractionMethod: `deterministic-demo-fallback-from-${provider.id}`,
      fallbackReason: `${provider.label} request failed (${err.message}). Fell back to the deterministic demo engine.`,
      durationMs: Date.now() - started,
    };
  }
}

/** Status summary for the UI so judges can see which engine produced a result. */
function providerStatus() {
  const { provider, requested, reason } = resolveProvider();
  return {
    configured: requested,
    active: provider.id,
    activeLabel: provider.label,
    usingLiveModel: provider.id !== "demo",
    fallbackReason: reason,
    available: Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      requiresApiKey: p.requiresApiKey,
      ready: p.isAvailable(),
    })),
  };
}

module.exports = {
  PROVIDERS,
  resolveProvider,
  runExtraction,
  providerStatus,
  configuredProviderId,
};
