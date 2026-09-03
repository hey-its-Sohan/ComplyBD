/**
 * pipeline.test.js
 * -----------------------------------------------------------------------------
 * Dependency-free assertions for the extraction + grounding engine.
 * Run with:  npm run test:pipeline   (from /server)
 *
 * These tests do not touch MongoDB or any network, so they verify the safety
 * behaviour the whitepaper requires in about a second.
 */

const assert = require("node:assert/strict");
const { runPipeline, buildFieldTable } = require("./regulatoryPipeline");
const { groundExtraction } = require("./groundingEngine");
const { normalizeWithMap, parseDateString, dateSurfaceForms } = require("./banglaText");
const { DEMO_GROUNDED, DEMO_UNGROUNDED } = require("../seed/demoCirculars");

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
  }
}

async function main() {
  console.log("\nbanglaText");

  await test("offset map points back at the original characters", () => {
    const src = "মূসক   হার\u200Cপুনর্নির্ধারণ ১৫%";
    const { text, map } = normalizeWithMap(src);
    assert.equal(map.length, text.length);
    const idx = text.indexOf("15");
    assert.ok(idx >= 0, "Bengali digits should normalize to ASCII");
    assert.equal(src.slice(map[idx], map[idx + 1] + 1), "১৫");
  });

  await test("parses Bangla dates", () => {
    assert.equal(parseDateString("১ সেপ্টেম্বর ২০২৬").iso, "2026-09-01");
    assert.equal(parseDateString("১৪ জুলাই ২০২৬").iso, "2026-07-14");
    assert.equal(parseDateString("2026-04-01").iso, "2026-04-01");
    assert.equal(parseDateString("1 September 2026").iso, "2026-09-01");
  });

  await test("generates Bangla surface forms for an ISO date", () => {
    const forms = dateSurfaceForms("2026-09-01");
    assert.ok(forms.includes("১ সেপ্টেম্বর ২০২৬"), `missing Bangla form, got ${forms.slice(0, 5)}`);
  });

  console.log("\ngroundingEngine");

  await test("grounds a value written in Bangla from an ISO date", () => {
    const { fieldGrounding } = groundExtraction(DEMO_GROUNDED.documentText, {
      businessCategory: "Restaurant",
      obligationType: "VAT Rate Change",
      effectiveDate: "2026-09-01",
      penalty: "জরিমানা ৩০,০০০ টাকা",
      fieldEvidence: {},
    });
    const date = fieldGrounding.find((f) => f.field === "effectiveDate");
    assert.equal(date.grounded, true, "effective date should ground");
    assert.ok(
      DEMO_GROUNDED.documentText.slice(date.start, date.end).includes("সেপ্টেম্বর"),
      `offsets should point at the date, got "${DEMO_GROUNDED.documentText.slice(date.start, date.end)}"`
    );
  });

  await test("refuses to ground a value that is absent from the source", () => {
    const { fieldGrounding } = groundExtraction(DEMO_UNGROUNDED.documentText, {
      businessCategory: "Small Manufacturer",
      obligationType: "Invoice / Record Keeping",
      effectiveDate: "2026-04-01",
      penalty: "জরিমানা ৫০,০০০ টাকা",
      fieldEvidence: {},
    });
    const date = fieldGrounding.find((f) => f.field === "effectiveDate");
    const penalty = fieldGrounding.find((f) => f.field === "penalty");
    assert.equal(date.grounded, false, "a date never written in the document must not ground");
    assert.equal(penalty.grounded, false, "an invented penalty must not ground");
    assert.match(date.note, /requires review/);
  });

  await test("detects a fabricated evidence quote", () => {
    const { fieldGrounding } = groundExtraction(DEMO_GROUNDED.documentText, {
      businessCategory: "Restaurant",
      obligationType: "VAT Rate Change",
      effectiveDate: "2026-09-01",
      penalty: "জরিমানা ৩০,০০০ টাকা",
      fieldEvidence: {
        penalty: "জরিমানা ৯,৯৯,৯৯৯ টাকা এবং কারাদণ্ড প্রযোজ্য হইবে",
      },
    });
    const penalty = fieldGrounding.find((f) => f.field === "penalty");
    assert.equal(penalty.evidenceClaimVerified, false, "a quote not in the document must be flagged");
  });

  console.log("\nregulatoryPipeline — grounded circular");

  const good = await runPipeline(DEMO_GROUNDED);

  await test("all four checked fields are grounded", () => {
    const ungrounded = good.fieldGrounding.filter((f) => !f.grounded).map((f) => f.field);
    assert.deepEqual(ungrounded, [], `expected none ungrounded, got ${ungrounded}`);
  });

  await test("effective date is read from the document, not the database", () => {
    assert.equal(good.extraction.meta.dateSource, "document");
    assert.equal(good.extraction.effectiveDate, "2026-09-01");
  });

  await test("reaches high confidence and auto-verifies", () => {
    assert.equal(good.confidence.band, "high", `got ${good.confidence.band} at ${good.confidence.score}`);
    assert.equal(good.routing.reviewStatus, "verified");
    assert.equal(good.routing.autoVerified, true);
  });

  await test("field table renders evidence for every row", () => {
    const rows = buildFieldTable(good);
    assert.equal(rows.length, 4);
    rows.forEach((row) => {
      assert.ok(row.evidence, `row ${row.field} should carry evidence`);
      assert.ok(row.confidence > 0, `row ${row.field} should have confidence`);
    });
  });

  await test("evidence offsets slice the real source text", () => {
    good.sourceEvidence.forEach((span) => {
      assert.equal(
        good.documentText.slice(span.start, span.end),
        span.text,
        `offsets for ${span.field} must match the snippet`
      );
    });
  });

  console.log("\nregulatoryPipeline — ungrounded circular");

  const bad = await runPipeline(DEMO_UNGROUNDED);

  await test("unsupported effective date and penalty are flagged", () => {
    const byField = Object.fromEntries(bad.fieldGrounding.map((f) => [f.field, f]));
    assert.equal(byField.effectiveDate.grounded, false);
    assert.equal(byField.penalty.grounded, false);
  });

  await test("falls back to database metadata for the date and admits it", () => {
    assert.equal(bad.extraction.meta.dateSource, "database-metadata");
    assert.equal(bad.extraction.meta.penaltySource, "generic-fallback");
  });

  await test("drops to low confidence", () => {
    assert.equal(bad.confidence.band, "low", `got ${bad.confidence.band} at ${bad.confidence.score}`);
    assert.ok(bad.confidence.score <= 45, `score should be capped, got ${bad.confidence.score}`);
  });

  await test("is blocked from verification and routed to review", () => {
    assert.equal(bad.confidence.blockedFromVerification, true);
    assert.notEqual(bad.routing.reviewStatus, "verified");
    assert.equal(bad.routing.reviewStatus, "needs_review");
  });

  await test("the category it did find is still grounded", () => {
    const category = bad.fieldGrounding.find((f) => f.field === "businessCategory");
    assert.equal(category.grounded, true, "Small Manufacturer should ground on কারখানা/উৎপাদনকারী");
  });

  console.log("\nsafety invariant");

  await test("no ungrounded critical field can ever produce a verified obligation", async () => {
    const circulars = [DEMO_GROUNDED, DEMO_UNGROUNDED];
    for (const circular of circulars) {
      const result = await runPipeline(circular);
      const criticalUngrounded = result.fieldGrounding.some(
        (f) => ["effectiveDate", "penalty"].includes(f.field) && !f.grounded
      );
      if (criticalUngrounded) {
        assert.notEqual(
          result.obligationDraft.reviewStatus,
          "verified",
          `${circular.title} was verified despite an ungrounded critical field`
        );
      }
    }
  });

  await test("confidence reasoning is always explainable", () => {
    [good, bad].forEach((result) => {
      assert.ok(result.confidence.reasons.length >= 3, "every score needs written reasons");
      assert.ok(result.routing.routingReason, "every routing decision needs a reason");
    });
  });

  console.log("\nprovider abstraction");

  // Exercises the API-key path without a network call: the provider is real,
  // only the transport is stubbed.
  const HONEST_RESPONSE =
    "```json\n" +
    JSON.stringify({
      businessCategory: "Restaurant",
      obligationType: "VAT Rate Change",
      effectiveDate: "2026-09-01",
      penalty: "জরিমানা ৩০,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ অর্থ",
      requiredAction: "চালানে ১৫% মূসক আলাদাভাবে দেখাতে হবে।",
      evidenceText: "এই আদেশ ১ সেপ্টেম্বর ২০২৬ তারিখ হইতে কার্যকর হবে।",
      summaryBangla: "১ সেপ্টেম্বর ২০২৬ থেকে রেস্তোরাঁয় ১৫% মূসক প্রযোজ্য।",
      confidence: 0.93,
      fieldEvidence: {
        businessCategory: "রেস্তোরাঁ",
        obligationType: "মূসক হার পুনর্নির্ধারণ",
        effectiveDate: "১ সেপ্টেম্বর ২০২৬",
        penalty: "জরিমানা ৩০,০০০ টাকা",
      },
    }) +
    "\n```";

  // A confident model inventing a harsher penalty and a later date than the
  // circular actually contains.
  const HALLUCINATED_RESPONSE = JSON.stringify({
    businessCategory: "Restaurant",
    obligationType: "VAT Rate Change",
    effectiveDate: "2027-01-01",
    penalty: "জরিমানা ৫,০০,০০০ টাকা এবং তিন বছরের কারাদণ্ড",
    requiredAction: "অবিলম্বে কার্যক্রম বন্ধ করুন।",
    evidenceText: "কারাদণ্ড প্রযোজ্য হইবে",
    summaryBangla: "কঠোর শাস্তি প্রযোজ্য।",
    confidence: 0.97,
    fieldEvidence: { penalty: "তিন বছরের কারাদণ্ড", effectiveDate: "১ জানুয়ারি ২০২৭" },
  });

  const savedEnv = { provider: process.env.AI_PROVIDER, key: process.env.OPENAI_API_KEY };
  const savedFetch = global.fetch;

  function stubFetch(content, { fail = false } = {}) {
    global.fetch = async (_url, opts) => {
      if (fail) throw new Error("connection reset");
      if (!String(opts.headers.Authorization || "").startsWith("Bearer ")) {
        throw new Error("request was sent without an Authorization header");
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content } }], usage: { total_tokens: 800 } }),
      };
    };
  }

  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";

  await test("uses the live provider when an API key is present", async () => {
    stubFetch(HONEST_RESPONSE);
    const result = await runPipeline(DEMO_GROUNDED);
    assert.equal(result.obligationDraft.extractionMethod, "llm-openai");
    assert.equal(result.confidence.band, "high");
    assert.equal(result.routing.reviewStatus, "verified");
  });

  await test("strips markdown fences from a model response", async () => {
    stubFetch(HONEST_RESPONSE);
    const result = await runPipeline(DEMO_GROUNDED);
    assert.equal(result.extraction.effectiveDate, "2026-09-01");
    assert.equal(result.extraction.businessCategory, "Restaurant");
  });

  await test("a confident model cannot publish invented values", async () => {
    stubFetch(HALLUCINATED_RESPONSE);
    const result = await runPipeline(DEMO_GROUNDED);
    const byField = Object.fromEntries(result.fieldGrounding.map((f) => [f.field, f]));

    assert.equal(result.extraction.confidence, 0.97, "the model claimed high confidence");
    assert.equal(byField.effectiveDate.grounded, false, "an invented date must not ground");
    assert.equal(byField.penalty.grounded, false, "an invented penalty must not ground");
    assert.equal(result.confidence.band, "low", `got ${result.confidence.band}`);
    assert.equal(result.routing.reviewStatus, "needs_review");
    assert.equal(result.confidence.blockedFromVerification, true);
  });

  await test("degrades to the demo engine when the provider is unreachable", async () => {
    stubFetch(null, { fail: true });
    const result = await runPipeline(DEMO_GROUNDED);
    assert.equal(result.obligationDraft.extractionMethod, "deterministic-demo-fallback-from-openai");
    assert.match(result.provider.fallbackReason, /connection reset/);
    assert.equal(result.routing.reviewStatus, "verified", "the demo must still work during an outage");
  });

  global.fetch = savedFetch;
  process.env.AI_PROVIDER = savedEnv.provider;
  if (savedEnv.key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedEnv.key;

  console.log(`\n${passed} passed, ${failed} failed\n`);

  if (failed) {
    failures.forEach((f) => {
      console.log(`--- ${f.name}`);
      console.log(f.err.stack);
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
