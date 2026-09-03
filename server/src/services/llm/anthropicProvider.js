/**
 * anthropicProvider.js
 * -----------------------------------------------------------------------------
 * Second real provider. Its only purpose beyond working is to prove the
 * abstraction holds: it implements the same four-member interface as the OpenAI
 * and demo providers, and the pipeline needs no changes to use it.
 *
 * Enable with:  AI_PROVIDER=anthropic  and  ANTHROPIC_API_KEY=...
 */

const { buildExtractionPrompt, coerceExtraction } = require("./promptContract");

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000);

function apiKey() {
  return process.env.ANTHROPIC_API_KEY || "";
}

function isAvailable() {
  return Boolean(apiKey());
}

async function extract(circular) {
  const key = apiKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const { system, user } = buildExtractionPrompt(circular);
  const baseUrl = process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0,
        system,
        messages: [
          { role: "user", content: user },
          // Prefilling the opening brace keeps the reply to bare JSON.
          { role: "assistant", content: "{" },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!text) throw new Error("Anthropic returned an empty completion");

    return coerceExtraction(`{${text}`, {
      provider: "anthropic",
      model,
      usage: data.usage || null,
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  id: "anthropic",
  label: "Anthropic Claude",
  requiresApiKey: true,
  isAvailable,
  extract,
};
