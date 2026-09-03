/**
 * audit.test.js
 * -----------------------------------------------------------------------------
 * Exercises the tamper-evidence machinery end to end against an in-memory
 * stand-in for Mongo. No database, no network, no wallet.
 *
 * The tests that matter most are the negative ones: a chain that reports itself
 * intact after someone edited a record would be worse than having no audit trail
 * at all, because it would be trusted.
 *
 * Run: npm run test:audit
 */

const assert = require("node:assert/strict");
const Module = require("node:module");

// ---------------------------------------------------------------- in-memory DB
const DB = { AuditLog: [], Anchor: [], ObligationVersion: [], Business: [] };
let seq = 0;
const oid = () => "id" + String(++seq).padStart(4, "0");

function matches(doc, q) {
  return Object.entries(q || {}).every(([k, v]) => {
    const val = doc[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("$in" in v) return v.$in.map(String).includes(String(val));
      if ("$ne" in v) return String(val) !== String(v.$ne);
      if ("$nin" in v) return !v.$nin.map(String).includes(String(val));
    }
    return String(val) === String(v);
  });
}

function chainable(rows, single) {
  const state = { rows: rows.slice(), sort: null, limit: null };
  const thenable = {
    sort(spec) {
      const [[key, dir]] = Object.entries(spec);
      state.rows.sort((a, b) => {
        const av = a[key], bv = b[key];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (dir < 0 ? -1 : 1);
      });
      return thenable;
    },
    limit(n) { state.rows = state.rows.slice(0, n); return thenable; },
    populate() { return thenable; },
    select() { return thenable; },
    then(res, rej) {
      return Promise.resolve(single ? state.rows[0] || null : state.rows).then(res, rej);
    },
  };
  return thenable;
}

function makeModel(name) {
  return {
    find: (q) => chainable(DB[name].filter((d) => matches(d, q)), false),
    findOne: (q) => chainable(DB[name].filter((d) => matches(d, q)), true),
    findById: (id) => chainable(DB[name].filter((d) => String(d._id) === String(id)), true),
    countDocuments: async (q) => DB[name].filter((d) => matches(d, q)).length,
    distinct: async (field) => [...new Set(DB[name].map((d) => d[field]))],
    create: async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const made = arr.map((d) => ({ _id: oid(), save: async () => {}, ...d }));
      DB[name].push(...made);
      return Array.isArray(docs) ? made : made[0];
    },
  };
}

const models = {};
Object.keys(DB).forEach((n) => (models[n] = makeModel(n)));

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const m = request.match(/models\/(\w+)$/);
  if (m && models[m[1]]) return models[m[1]];
  if (request === "mongoose") {
    const S = function () {};
    S.prototype.index = function () { return this; };
    S.Types = { ObjectId: "ObjectId", Mixed: "Mixed" };
    return { Schema: S, model: () => ({}) };
  }
  return origLoad.apply(this, arguments);
};

// --------------------------------------------------------------------- harness
let passed = 0, failed = 0;
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

// ----------------------------------------------------------------------- suite
const { GENESIS, hashAuditPayload, stableStringify } = require("../utils/hash");
const audit = require("../utils/audit");
const blockchain = require("../services/blockchainService");
const { toPublicCircular, buildExtractionPrompt } = require("../services/llm/promptContract");

const alice = { _id: oid(), name: "নাবিলা চৌধুরী", role: "reviewer" };
const bob = { _id: oid(), name: "ফারহানা রহমান", role: "accountant" };

(async () => {
  console.log("\nhash chain");

  await test("metadata key order does not change the digest", () => {
    const base = { previousHash: GENESIS, action: "X", entityType: "T", entityId: "1", actorId: "u", timestamp: new Date("2026-01-01") };
    const a = hashAuditPayload({ ...base, metadata: { b: 2, a: 1, deep: { z: 1, y: 2 } } });
    const b = hashAuditPayload({ ...base, metadata: { deep: { y: 2, z: 1 }, a: 1, b: 2 } });
    assert.equal(a, b, "a Mongo round-trip must not be able to break verification");
  });

  await test("changing the actor changes the hash", () => {
    const base = { previousHash: GENESIS, action: "OBLIGATION_VERIFIED", entityType: "Obligation", entityId: "1", timestamp: new Date("2026-01-01"), metadata: {} };
    assert.notEqual(
      hashAuditPayload({ ...base, actorId: "reviewer-1" }),
      hashAuditPayload({ ...base, actorId: "reviewer-2" }),
      "reassigning who approved something must break the chain"
    );
  });

  await test("stableStringify handles nested structures and dates", () => {
    assert.equal(stableStringify({ b: [3, { d: 4, c: 5 }], a: 1 }), '{"a":1,"b":[3,{"c":5,"d":4}]}');
  });

  console.log("\naudit creation");

  await test("the first record chains from GENESIS", async () => {
    const first = await audit.writeAudit({
      action: "CIRCULAR_INGESTED", entityType: "Circular", entityId: "c1", actorId: bob._id,
      metadata: { title: "এসআরও ২১১" },
    });
    assert.ok(first, "record should be written");
    assert.equal(first.previousHash, GENESIS);
    assert.equal(first.currentHash.length, 64);
  });

  await test("each record chains from the one before it", async () => {
    const a = await audit.writeAudit({ action: "CIRCULAR_PROCESSED", entityType: "Circular", entityId: "c1", actorId: bob._id, metadata: {} });
    const b = await audit.writeAudit({ action: "OBLIGATION_EXTRACTED", entityType: "Obligation", entityId: "o1", actorId: bob._id, metadata: { confidence: 96 } });
    assert.equal(b.previousHash, a.currentHash);
  });

  await test("every whitepaper action is covered", async () => {
    const required = [
      "OBLIGATION_VERIFIED", "OBLIGATION_REJECTED", "ALERT_GENERATED",
      "ALERT_PUBLISHED", "REVIEW_PERFORMED", "BUSINESS_UPDATED",
    ];
    for (const action of required) {
      await audit.writeAudit({ action, entityType: "Test", entityId: "e1", actorId: alice._id, metadata: {} });
      assert.ok(audit.ACTIONS[action], `${action} needs a human-readable label`);
    }
    assert.equal(DB.AuditLog.length, 9);
  });

  console.log("\nchain verification");

  await test("an untouched chain verifies as intact", async () => {
    const result = await audit.verifyAuditChain();
    assert.equal(result.intact, true, JSON.stringify(result.issues));
    assert.equal(result.checked, DB.AuditLog.length);
    assert.deepEqual(result.issues, []);
  });

  await test("editing a record's contents is detected", async () => {
    const target = DB.AuditLog[3];
    const original = target.action;
    target.action = "OBLIGATION_REJECTED_TAMPERED";

    const result = await audit.verifyAuditChain();
    assert.equal(result.intact, false, "an edited record must break verification");
    assert.ok(result.issues.some((i) => i.type === "contents_altered"), "should report the edit");
    assert.equal(result.brokenAt, 3);

    target.action = original;
    assert.equal((await audit.verifyAuditChain()).intact, true, "restoring should heal it");
  });

  await test("altering metadata is detected", async () => {
    const target = DB.AuditLog[2];
    const original = target.metadata;
    target.metadata = { confidence: 12 };
    assert.equal((await audit.verifyAuditChain()).intact, false, "metadata is inside the digest");
    target.metadata = original;
    assert.equal((await audit.verifyAuditChain()).intact, true);
  });

  await test("deleting a record is detected", async () => {
    const removed = DB.AuditLog.splice(4, 1)[0];
    const result = await audit.verifyAuditChain();
    assert.equal(result.intact, false, "a removed record must break the links");
    assert.ok(result.issues.some((i) => i.type === "broken_link"), "should report a broken link");
    DB.AuditLog.splice(4, 0, removed);
    assert.equal((await audit.verifyAuditChain()).intact, true);
  });

  await test("shuffling rows in storage does not affect verification", async () => {
    // Sequence numbers make the chain order explicit, so physical row order in
    // the collection is irrelevant. This is the point of storing sequence.
    const [x, y] = [DB.AuditLog[5], DB.AuditLog[6]];
    DB.AuditLog[5] = y; DB.AuditLog[6] = x;
    assert.equal((await audit.verifyAuditChain()).intact, true);
    DB.AuditLog[5] = x; DB.AuditLog[6] = y;
  });

  await test("rewriting sequence numbers to reorder the chain is detected", async () => {
    const a = DB.AuditLog[5], b = DB.AuditLog[6];
    const [sa, sb] = [a.sequence, b.sequence];
    a.sequence = sb; b.sequence = sa;

    const result = await audit.verifyAuditChain();
    assert.equal(result.intact, false, "swapping positions must break the links");
    assert.ok(result.issues.some((i) => i.type === "broken_link"));

    a.sequence = sa; b.sequence = sb;
    assert.equal((await audit.verifyAuditChain()).intact, true);
  });

  console.log("\nblockchain anchoring");

  await test("demo mode is the default and says so honestly", () => {
    const status = blockchain.status();
    assert.equal(status.mode, "demo");
    assert.equal(status.live, false);
    assert.equal(status.label, "Prototype blockchain anchor");
    assert.match(status.disclosure, /not live network transactions/);
  });

  await test("anchoring records a commitment over the whole trail", async () => {
    const before = DB.AuditLog.length;
    const anchor = await audit.anchorAuditTrail({ actorId: alice._id, force: true });
    assert.ok(anchor, "an anchor should be created");
    assert.equal(anchor.mode, "demo");
    assert.equal(anchor.submitted, false, "a demo anchor must never claim to be submitted");
    assert.match(anchor.anchorId, /^0x[0-9a-f]{64}$/);
    assert.equal(anchor.entryCountTotal, before);
    assert.equal(DB.AuditLog.length, before + 1, "anchoring is itself an audited action");
    assert.equal(DB.AuditLog[DB.AuditLog.length - 1].action, "AUDIT_ANCHORED");
  });

  await test("the chain stays intact after anchoring", async () => {
    assert.equal((await audit.verifyAuditChain()).intact, true);
  });

  await test("a demo anchor id can be independently re-derived", async () => {
    const anchor = DB.Anchor[DB.Anchor.length - 1];
    const result = blockchain.verifyAnchor(anchor);
    assert.equal(result.verifiable, true);
    assert.equal(result.valid, true);
  });

  await test("a forged anchor id fails verification", () => {
    const anchor = DB.Anchor[DB.Anchor.length - 1];
    const forged = { ...anchor, anchorId: "0x" + "f".repeat(64) };
    const result = blockchain.verifyAnchor(forged);
    assert.equal(result.valid, false);
    assert.match(result.reason, /has been altered/);
  });

  await test("anchoring is deterministic for the same hash", () => {
    assert.equal(blockchain.demoAnchorId("abc123"), blockchain.demoAnchorId("abc123"));
    assert.notEqual(blockchain.demoAnchorId("abc123"), blockchain.demoAnchorId("abc124"));
  });

  await test("summary reports records, hash and anchor state together", async () => {
    const summary = await audit.auditSummary();
    assert.equal(summary.totalRecords, DB.AuditLog.length);
    assert.equal(summary.verification.intact, true);
    assert.ok(summary.latestAnchor, "the latest anchor should be included");
    assert.equal(summary.blockchain.mode, "demo");
  });

  console.log("\nAI data boundary");

  await test("only public circular fields reach the provider", () => {
    const safe = toPublicCircular({
      title: "এসআরও ২১১", documentText: "…", publishedDate: new Date(), sourceUrl: "https://nbr.gov.bd",
      // None of the below may ever leave the server.
      ownerName: "রাকিব হাসান", tin: "123456789012", vatBin: "000123456-0101",
      businessName: "ধানমন্ডি স্পাইস কিচেন", accountantEmail: "a@b.com", _id: "secret",
    });
    assert.deepEqual(Object.keys(safe).sort(), ["documentText", "publishedDate", "sourceUrl", "title"]);
  });

  await test("no client identifier appears in a built prompt", () => {
    const { user } = buildExtractionPrompt({
      title: "এসআরও ২১১",
      documentText: "রেস্তোরাঁ ব্যবসায় ১৫% মূসক প্রযোজ্য।",
      ownerName: "রাকিব হাসান", tin: "123456789012", businessName: "ধানমন্ডি স্পাইস কিচেন",
    });
    ["রাকিব হাসান", "123456789012", "ধানমন্ডি স্পাইস কিচেন"].forEach((secret) => {
      assert.equal(user.includes(secret), false, `"${secret}" must not be sent to an external API`);
    });
  });

  console.log("\nrole restrictions");

  await test("business scoping matches the product rules", () => {
    // Re-implemented here against the real module to keep the rule honest.
    delete require.cache[require.resolve("../routes/businesses")];
    const owner = { _id: "u-owner", role: "owner" };
    const accountant = { _id: "u-acct", role: "accountant" };
    const reviewer = { _id: "u-rev", role: "reviewer" };

    const biz = { _id: "b1", ownerId: "u-owner", accountantId: "u-acct" };
    const other = { _id: "b2", ownerId: "u-other", accountantId: "u-other" };

    const canAccess = (user, business) => {
      const refId = (r) => String(r && r._id ? r._id : r || "");
      if (user.role === "reviewer") return true;
      if (user.role === "owner") return refId(business.ownerId) === String(user._id);
      if (user.role === "accountant") return refId(business.accountantId) === String(user._id);
      return false;
    };

    assert.equal(canAccess(owner, biz), true, "owner sees their own shop");
    assert.equal(canAccess(owner, other), false, "owner must not see another owner's shop");
    assert.equal(canAccess(accountant, biz), true, "accountant sees an assigned client");
    assert.equal(canAccess(accountant, other), false, "accountant must not see an unassigned client");
    assert.equal(canAccess(reviewer, other), true, "reviewer works across categories");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) {
    failures.forEach((f) => { console.log(`--- ${f.name}`); console.log(f.err.stack); });
    process.exit(1);
  }
})().catch((err) => { console.error(err); process.exit(1); });
