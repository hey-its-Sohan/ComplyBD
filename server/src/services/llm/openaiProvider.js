/**
 * openaiProvider.js
 * -----------------------------------------------------------------------------
 * Real LLM extraction via the OpenAI chat completions API.
 *
 * Uses Node's built-in fetch (Node 18+), so no extra dependency is needed.
 * The model is asked for strict JSON and is explicitly told to quote evidence
 * verbatim. Whatever it returns is still checked by the grounding engine — the
 * model is never trusted on its own word.
 */

const { buildExtractionPrompt, coerceExtraction } = require("./promptContract");

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000);

function apiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function isAvailable() {
  return Boolean(apiKey());
}

async function extract(circular) {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const { system, user } = buildExtractionPrompt(circular);
  const baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty completion");

    return coerceExtraction(content, {
      provider: "openai",
      model,
      usage: data.usage || null,
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  id: "openai",
  label: "OpenAI",
  requiresApiKey: true,
  isAvailable,
  extract,
};
