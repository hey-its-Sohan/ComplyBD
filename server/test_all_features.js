/**
 * test_all_features.js
 * -----------------------------------------------------------------------------
 * Comprehensive feature verification test suite against the live ComplyBD server.
 * Uses native Node fetch (zero external dependencies).
 */

const assert = require("assert");

const BASE_URL = "http://localhost:5000";
const CLIENT_URL = "http://localhost:5173";

let passedCount = 0;
let failedCount = 0;

async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function test(name, fn) {
  try {
    process.stdout.write(`Testing: ${name} ... `);
    await fn();
    console.log("PASSED \x1b[32m✔\x1b[0m");
    passedCount++;
  } catch (err) {
    console.log("FAILED \x1b[31m✖\x1b[0m");
    console.error("   Error:", err.message);
    failedCount++;
  }
}

async function runAll() {
  console.log("\n=======================================================");
  console.log("   COMPLYBD COMPREHENSIVE FEATURE VERIFICATION SUITE   ");
  console.log("=======================================================\n");

  let accountantToken, ownerToken, reviewerToken;
  let sampleBusinessId, sampleAlertId, ungroundedObligationId, sampleCircularId;

  // 1. Health & Server Check
  await test("1. API Health endpoint is alive", async () => {
    const res = await request(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
    assert.strictEqual(res.data.name, "ComplyBD");
  });

  await test("2. Frontend Vite server is serving the web app", async () => {
    const res = await request(CLIENT_URL);
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.data === "string" && (res.data.includes("ComplyBD") || res.data.includes("root")));
  });

  await test("3. Frontend proxy routes /api to backend correctly", async () => {
    const res = await request(`${CLIENT_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
  });

  // 2. Authentication & Roles
  await test("4. Accountant login & JWT generation", async () => {
    const res = await request(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "accountant@complybd.com", password: "demo123" }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, "accountant");
    accountantToken = res.data.token;
  });

  await test("5. SME Owner login & JWT generation", async () => {
    const res = await request(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "owner@complybd.com", password: "demo123" }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, "owner");
    ownerToken = res.data.token;
  });

  await test("6. Reviewer login & JWT generation", async () => {
    const res = await request(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "reviewer@complybd.com", password: "demo123" }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, "reviewer");
    reviewerToken = res.data.token;
  });

  await test("7. Role Enforcement: Owner cannot access Staff-only Audit Trail", async () => {
    const res = await request(`${BASE_URL}/api/audit`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // 3. Accountant Dashboard & Client Roster
  await test("8. Accountant Dashboard metrics & clients", async () => {
    const res = await request(`${BASE_URL}/api/dashboard/accountant`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.businesses));
    assert.ok(res.data.businesses.length > 0);
    assert.ok(Array.isArray(res.data.changes));
    sampleBusinessId = res.data.businesses[0]._id;

    const clientsRes = await request(`${BASE_URL}/api/dashboard/clients`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(clientsRes.status, 200);
    assert.ok(Array.isArray(clientsRes.data.clients));
  });

  await test("9. Accountant Business update & Audit logging", async () => {
    assert.ok(sampleBusinessId);
    const res = await request(`${BASE_URL}/api/businesses/${sampleBusinessId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accountantToken}` },
      body: JSON.stringify({ location: "ধানমন্ডি ২৭, ঢাকা (হালনাগাদকৃত)" }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.business.location, "ধানমন্ডি ২৭, ঢাকা (হালনাগাদকৃত)");
  });

  // 4. SME Owner Dashboard & Bangla Alerts
  await test("10. SME Owner Dashboard & plain Bangla alert answers", async () => {
    const res = await request(`${BASE_URL}/api/dashboard/owner`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.businesses));
    assert.ok(Array.isArray(res.data.alerts));
    if (res.data.alerts.length > 0) {
      sampleAlertId = res.data.alerts[0]._id;
      const sample = res.data.alerts[0];
      assert.ok(sample.title, "Must have alert title");
      assert.ok(sample.priority, "Must have priority");
      assert.ok(sample.messageBangla || sample.whatChanged, "Must have plain Bangla explanation");
    }
  });

  await test("11. SME Owner acknowledges alert ('আমি বুঝেছি')", async () => {
    if (!sampleAlertId) {
      const allAlerts = await request(`${BASE_URL}/api/alerts`, {
        headers: { Authorization: `Bearer ${accountantToken}` },
      });
      sampleAlertId = allAlerts.data[0]._id;
    }
    const res = await request(`${BASE_URL}/api/alerts/${sampleAlertId}/acknowledge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, "acknowledged");
    assert.ok(res.data.acknowledgedAt);
  });

  // 5. Regulatory Intelligence Pipeline (Grounded vs Ungrounded Circulars)
  await test("12. Regulatory Pipeline Configuration & Grounding Rules", async () => {
    const res = await request(`${BASE_URL}/api/pipeline/config`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.pipelineVersion);
    assert.ok(res.data.scoring);
    assert.ok(res.data.grounding);
  });

  await test("13. Process Grounded Circular (Auto-verifies & Dispatches Alerts)", async () => {
    const listRes = await request(`${BASE_URL}/api/circulars`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    const circular = listRes.data.find((c) => c.title.includes("রেস্তোরাঁ ও খাদ্য সেবা")) || listRes.data[0];
    sampleCircularId = circular._id;

    const res = await request(`${BASE_URL}/api/circulars/${sampleCircularId}/process`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.fieldTable);
    assert.ok(res.data.confidence);
    assert.ok(res.data.routing);
  });

  await test("14. Process Ungrounded Circular (Held back with needs_review routing)", async () => {
    const listRes = await request(`${BASE_URL}/api/circulars`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    const circular = listRes.data.find((c) => c.title.includes("০৯/মূসক") || c.title.includes("ডিজিটাল নথি")) || listRes.data[1];

    const res = await request(`${BASE_URL}/api/circulars/${circular._id}/process?dryRun=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.routing.reviewStatus, "needs_review");
    assert.strictEqual(res.data.routing.autoVerified, false);
    assert.strictEqual(res.data.confidence.blockedFromVerification, true);
    ungroundedObligationId = res.data.obligation._id;
  });

  // 6. Reviewer Queue & Grounding Override Gate
  await test("15. Reviewer Queue loads pending/held obligations", async () => {
    const res = await request(`${BASE_URL}/api/reviews/queue`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.queue));
    assert.ok(res.data.summary);
  });

  await test("16. Safety Invariant: Ungrounded obligation cannot be verified without override", async () => {
    if (!ungroundedObligationId) {
      const qRes = await request(`${BASE_URL}/api/reviews/queue`, {
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });
      const held = qRes.data.queue.find((o) => o.reviewStatus === "needs_review");
      if (held) ungroundedObligationId = held._id;
    }
    if (!ungroundedObligationId) return;

    const res = await request(`${BASE_URL}/api/reviews/${ungroundedObligationId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({ override: false }),
    });
    assert.strictEqual(res.status, 409, "Must return 409 Conflict when ungrounded without override");
    assert.strictEqual(res.data.requiresOverride, true);
  });

  await test("17. Safety Invariant: Override without written reason is rejected", async () => {
    if (!ungroundedObligationId) return;
    const res = await request(`${BASE_URL}/api/reviews/${ungroundedObligationId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({ override: true, overrideReason: "" }),
    });
    assert.strictEqual(res.status, 400, "Must return 400 Bad Request when overrideReason is empty");
  });

  await test("18. Reviewer approves with auditable override reason", async () => {
    if (!ungroundedObligationId) return;
    const res = await request(`${BASE_URL}/api/reviews/${ungroundedObligationId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: JSON.stringify({
        override: true,
        overrideReason: "যাচাইকারী হিসেবে উৎস সার্কুলার পড়ে নিশ্চিত করা হলো।",
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.obligation.reviewStatus, "verified");
  });

  // 7. Audit Trail & Cryptographic Hash Chain
  await test("19. Query Hash-Chained Audit Trail", async () => {
    const res = await request(`${BASE_URL}/api/audit`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length > 0);
    const first = res.data[0];
    assert.ok(first.currentHash);
    assert.ok(first.previousHash);
    assert.ok(first.action);
  });

  await test("20. Recompute & Verify SHA-256 Hash Chain Integrity", async () => {
    const res = await request(`${BASE_URL}/api/audit/verify`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.intact, true, "Hash chain MUST verify as intact");
    assert.ok(res.data.checked > 0);
  });

  await test("21. Audit Trail Summary metrics", async () => {
    const res = await request(`${BASE_URL}/api/audit/summary`, {
      headers: { Authorization: `Bearer ${accountantToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.totalRecords > 0);
    assert.ok(res.data.latestHash);
  });

  // 8. Blockchain Anchoring
  await test("22. Blockchain Status Check", async () => {
    const res = await request(`${BASE_URL}/api/blockchain/status`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.chainIntact, true);
  });

  await test("23. Publish Cryptographic Anchor of Audit Trail", async () => {
    const res = await request(`${BASE_URL}/api/audit/anchor`, {
      method: "POST",
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.anchor.anchorId);
    assert.ok(res.data.anchor.committedHash);
    assert.strictEqual(res.data.anchor.status, "anchored");
  });

  await test("24. Verify Anchor Authenticity against Hash", async () => {
    const anchors = await request(`${BASE_URL}/api/audit/anchors`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.ok(anchors.data.length > 0);
    const anchorDbId = anchors.data[0]._id;

    const res = await request(`${BASE_URL}/api/blockchain/anchors/${anchorDbId}/verify`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.result.valid, true);
  });

  // Final summary
  console.log("\n-------------------------------------------------------");
  console.log(`TOTAL TESTS: ${passedCount + failedCount}`);
  console.log(`PASSED:      \x1b[32m${passedCount}\x1b[0m`);
  console.log(`FAILED:      \x1b[31m${failedCount}\x1b[0m`);
  console.log("-------------------------------------------------------\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
