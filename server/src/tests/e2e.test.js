/**
 * e2e.test.js
 * -----------------------------------------------------------------------------
 * The complete product story, exercised against the real route handlers with an
 * in-memory stand-in for Mongo:
 *
 *   Circular -> process -> AI extraction -> grounding -> confidence
 *            -> review routing -> approval -> business matching -> alert
 *            -> owner receives it -> audit log -> hash chain -> anchor
 *
 * No database, no network, no wallet. Run: npm run test:e2e
 */

const assert = require("node:assert/strict");
const Module = require("node:module");

// ------------------------------------------------------------- in-memory store
const DB = {
  User: [], Business: [], Circular: [], Obligation: [], Alert: [],
  AuditLog: [], Anchor: [], ObligationVersion: [],
};
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
  const st = { rows: rows.slice() };
  const t = {
    sort(sp) {
      const [[k, d]] = Object.entries(sp);
      st.rows.sort((a, b) => (a[k] === b[k] ? 0 : (a[k] > b[k] ? 1 : -1) * (d < 0 ? -1 : 1)));
      return t;
    },
    limit(n) { st.rows = st.rows.slice(0, n); return t; },
    populate() { return t; },
    select() { return t; },
    then(r, j) { return Promise.resolve(single ? st.rows[0] || null : st.rows).then(r, j); },
  };
  return t;
}

function model(n) {
  return {
    find: (q) => chainable(DB[n].filter((d) => matches(d, q)), false),
    findOne: (q) => chainable(DB[n].filter((d) => matches(d, q)), true),
    findById: (id) => chainable(DB[n].filter((d) => String(d._id) === String(id)), true),
    countDocuments: async (q) => DB[n].filter((d) => matches(d, q)).length,
    distinct: async (f) => [...new Set(DB[n].map((d) => d[f]))],
    deleteMany: async (q) => {
      const keep = DB[n].filter((d) => !matches(d, q));
      const removed = DB[n].length - keep.length;
      DB[n] = keep;
      return { deletedCount: removed };
    },
    create: async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const made = arr.map((d) => ({ _id: oid(), save: async () => {}, ...d }));
      DB[n].push(...made);
      return Array.isArray(docs) ? made : made[0];
    },
  };
}

const models = {};
Object.keys(DB).forEach((n) => (models[n] = model(n)));

function makeRouter() {
  const stack = [];
  const add = (m) => (p, ...h) =>
    stack.push({ route: { path: p, methods: { [m]: true }, stack: h.flat().map((x) => ({ handle: x })) } });
  return { stack, get: add("get"), post: add("post"), patch: add("patch"), delete: add("delete") };
}
const expressStub = () => ({});
expressStub.Router = makeRouter;

const origLoad = Module._load;
Module._load = function (req) {
  if (req === "express") return expressStub;
  if (req.endsWith("middleware/auth")) {
    return {
      authRequired: (q, s, n) => n(),
      requireRoles: (...roles) => (q, s, n) =>
        roles.includes(q.user?.role) ? n() : s.status(403).json({ message: "Forbidden" }),
    };
  }
  const m = req.match(/models\/(\w+)$/);
  if (m && models[m[1]]) return models[m[1]];
  if (req === "mongoose") {
    const S = function () {};
    S.prototype.index = function () { return this; };
    S.Types = { ObjectId: "ObjectId", Mixed: "Mixed" };
    return { Schema: S, model: () => ({}) };
  }
  return origLoad.apply(this, arguments);
};

function run(router, method, path, user, body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    const layer = router.stack.find(
      (l) => l.route.methods[method] &&
        new RegExp("^" + l.route.path.replace(/:[^/]+/g, "([^/]+)") + "$").test(path)
    );
    if (!layer) return reject(new Error(`no route ${method} ${path}`));
    const keys = (layer.route.path.match(/:[^/]+/g) || []).map((k) => k.slice(1));
    const vals = new RegExp("^" + layer.route.path.replace(/:[^/]+/g, "([^/]+)") + "$").exec(path).slice(1);
    const req = { user, body, query, params: Object.fromEntries(keys.map((k, i) => [k, vals[i]])), headers: {} };
    const state = { statusCode: 200 };
    const res = {
      status(c) { state.statusCode = c; return res; },
      json(d) { resolve({ status: state.statusCode, body: d }); },
    };
    const hs = layer.route.stack.map((s) => s.handle).filter((h) => typeof h === "function" && h.length <= 3);
    (async () => {
      try {
        let i = 0;
        const next = async () => { if (i >= hs.length) return; await hs[i++](req, res, next); };
        await next();
      } catch (e) { reject(e); }
    })();
  });
}

// --------------------------------------------------------------------- harness
let passed = 0, failed = 0;
const failures = [];
async function step(name, fn) {
  try {
    const out = await fn();
    passed += 1;
    console.log(`  ok  ${name}${out ? ` — ${out}` : ""}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

// ----------------------------------------------------------------------- setup
const { DEMO_GROUNDED, DEMO_UNGROUNDED } = require("../seed/demoCirculars");
const circularRoutes = require("../routes/circulars");
const reviewRoutes = require("../routes/reviews");
const obligationRoutes = require("../routes/obligations");
const dashboardRoutes = require("../routes/dashboard");
const alertRoutes = require("../routes/alerts");
const auditRoutes = require("../routes/audit");
const bcRoutes = require("../routes/blockchain");
const audit = require("../utils/audit");

const accountant = { _id: oid(), name: "ফারহানা রহমান", role: "accountant", email: "accountant@complybd.com" };
const reviewer = { _id: oid(), name: "নাবিলা চৌধুরী", role: "reviewer" };
const owner = { _id: oid(), name: "রাকিব হাসান", role: "owner" };
DB.User.push(accountant, reviewer, owner);

const addBiz = (name, category) => {
  const b = {
    _id: oid(), name, category, location: "ঢাকা",
    ownerId: owner._id, accountantId: accountant._id,
    authorizationStatus: "authorized", vatBin: "000-1", save: async () => {},
  };
  DB.Business.push(b);
  return b;
};
addBiz("ধানমন্ডি স্পাইস কিচেন", "Restaurant");
addBiz("গুলশান গার্ডেন বিস্ট্রো", "Restaurant");
addBiz("বনানী মিনি মার্ট", "Retail Shop");
addBiz("মতিঝিল গ্যাজেট হাব", "Electronics Shop");
addBiz("ক্ষুদ্র ইঞ্জিনিয়ারিং", "Small Manufacturer");

const addCircular = (fixture) => {
  const c = { _id: oid(), status: "ingested", save: async () => {}, ...fixture };
  delete c.key;
  DB.Circular.push(c);
  return c;
};
const goodCircular = addCircular(DEMO_GROUNDED);
const weakCircular = addCircular(DEMO_UNGROUNDED);

(async () => {
  console.log("\n1. ACCOUNTANT OPENS THE DASHBOARD");

  let dash;
  await step("dashboard loads with live funnel counts", async () => {
    dash = (await run(dashboardRoutes, "get", "/accountant", accountant)).body;
    assert.equal(dash.totalClients, 5);
    assert.equal(dash.newRegulatoryChanges, 2);
    return `${dash.totalClients} clients, ${dash.newRegulatoryChanges} circulars`;
  });

  console.log("\n2. PROCESS A CIRCULAR THAT GROUNDS CLEANLY");

  let goodRun;
  await step("pipeline runs end to end", async () => {
    const res = await run(circularRoutes, "post", `/${goodCircular._id}/process`, accountant);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    goodRun = res.body;
    return `${goodRun.trace.length} stages, ${goodRun.totalMs}ms`;
  });

  await step("all four fields grounded", () => {
    const ungrounded = goodRun.fieldTable.filter((f) => !f.grounded);
    assert.deepEqual(ungrounded, []);
    return goodRun.fieldTable.map((f) => f.label).join(", ");
  });

  await step("high confidence and auto-verified", () => {
    assert.equal(goodRun.confidence.band, "high");
    assert.equal(goodRun.routing.reviewStatus, "verified");
    return `${goodRun.confidence.score}% ${goodRun.confidence.band}`;
  });

  await step("evidence offsets slice the real source text", () => {
    goodRun.sourceEvidence.forEach((s) => {
      assert.equal(goodCircular.documentText.slice(s.start, s.end), s.text);
    });
    return `${goodRun.sourceEvidence.length} spans verified`;
  });

  await step("alerts dispatched to matching restaurants only", () => {
    assert.equal(goodRun.alertsCreated, 2);
    const alerted = DB.Alert.map((a) => DB.Business.find((b) => b._id === a.businessId).category);
    assert.deepEqual([...new Set(alerted)], ["Restaurant"]);
    return `${goodRun.alertsCreated} alerts, restaurants only`;
  });

  await step("version 1 recorded as the AI draft", () => {
    const versions = DB.ObligationVersion.filter((v) => String(v.obligationId) === String(goodRun.obligation._id));
    assert.ok(versions.length >= 1);
    assert.equal(versions[0].version, 1);
    assert.equal(versions[0].changeType, "extracted");
    return `v${versions[0].version} ${versions[0].changeType}`;
  });

  console.log("\n3. PROCESS A CIRCULAR THAT WITHHOLDS ITS DATE AND PENALTY");

  let weakRun;
  await step("pipeline completes without error", async () => {
    const res = await run(circularRoutes, "post", `/${weakCircular._id}/process`, accountant);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    weakRun = res.body;
    return `${weakRun.confidence.score}% ${weakRun.confidence.band}`;
  });

  await step("unsupported fields flagged, not published", () => {
    const bad = weakRun.fieldTable.filter((f) => !f.grounded).map((f) => f.field);
    assert.deepEqual(bad.sort(), ["effectiveDate", "penalty"]);
    assert.equal(weakRun.confidence.blockedFromVerification, true);
    assert.notEqual(weakRun.routing.reviewStatus, "verified");
    assert.equal(weakRun.alertsCreated, 0);
    return `${bad.join(" + ")} held back, 0 alerts`;
  });

  console.log("\n4. REVIEW QUEUE");

  let queue;
  await step("held obligation appears in the queue", async () => {
    const res = await run(reviewRoutes, "get", "/queue", reviewer);
    queue = res.body;
    assert.ok(queue.queue.find((q) => String(q._id) === String(weakRun.obligation._id)));
    assert.ok(queue.summary.blockedByGrounding >= 1);
    return `${queue.summary.total} waiting, ${queue.summary.blockedByGrounding} blocked by grounding`;
  });

  await step("approval is refused while a critical field is ungrounded", async () => {
    const res = await run(reviewRoutes, "post", `/${weakRun.obligation._id}/approve`, reviewer, {});
    assert.equal(res.status, 409);
    assert.equal(res.body.requiresOverride, true);
    return `HTTP ${res.status}, override required`;
  });

  await step("override without a written reason is refused", async () => {
    const res = await run(reviewRoutes, "post", `/${weakRun.obligation._id}/approve`, reviewer, {
      override: true, overrideReason: "  ",
    });
    assert.equal(res.status, 400);
    return `HTTP ${res.status}`;
  });

  await step("override with a reason publishes and is recorded", async () => {
    const res = await run(reviewRoutes, "post", `/${weakRun.obligation._id}/approve`, reviewer, {
      override: true,
      overrideReason: "Confirmed the effective date by phone with the NBR VAT wing.",
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.obligation.reviewStatus, "verified");
    const entry = DB.AuditLog.find((l) => l.action === "OBLIGATION_VERIFIED_WITH_OVERRIDE");
    assert.ok(entry, "the override must be in the audit trail");
    assert.match(entry.metadata.overrideReason, /NBR VAT wing/);
    return `${res.body.alertsCreated} alert(s), override logged under ${reviewer.name}`;
  });

  await step("a second version records the human decision", () => {
    const versions = DB.ObligationVersion
      .filter((v) => String(v.obligationId) === String(weakRun.obligation._id))
      .sort((a, b) => a.version - b.version);
    assert.equal(versions.length, 2);
    assert.equal(versions[1].changeType, "verified");
    assert.equal(versions[0].changeType, "extracted", "version 1 must survive the correction");
    return `v1 ${versions[0].changeType} -> v2 ${versions[1].changeType}`;
  });

  console.log("\n5. SME OWNER RECEIVES THE ALERT");

  let ownerView;
  await step("owner sees alerts for their own shops", async () => {
    ownerView = (await run(dashboardRoutes, "get", "/owner", owner)).body;
    assert.ok(ownerView.alerts.length >= 2);
    return `${ownerView.alerts.length} alerts, ${ownerView.urgentAlerts} urgent`;
  });

  await step("each alert answers the four owner questions in Bangla", () => {
    ownerView.alerts.forEach((a) => {
      assert.ok(a.whatChanged, "whatChanged missing");
      assert.ok(a.whyItMatters, "whyItMatters missing");
      assert.ok(a.whatToDo, "whatToDo missing");
      assert.match(a.whatChanged, /[\u0980-\u09FF]/, "must be written in Bangla");
    });
    return ownerView.alerts[0].whatChanged.slice(0, 46) + "…";
  });

  await step("acknowledging an alert is audited", async () => {
    const before = DB.AuditLog.length;
    const res = await run(alertRoutes, "post", `/${ownerView.alerts[0]._id}/acknowledge`, owner);
    assert.equal(res.status, 200);
    assert.equal(DB.AuditLog.length, before + 1);
    assert.equal(DB.AuditLog[DB.AuditLog.length - 1].action, "ALERT_ACKNOWLEDGED");
    return "ALERT_ACKNOWLEDGED written";
  });

  console.log("\n6. SOURCE TRANSPARENCY");

  await step("obligation detail carries full provenance", async () => {
    const res = await run(obligationRoutes, "get", `/${goodRun.obligation._id}`, accountant);
    const d = res.body;
    assert.ok(d.circular.title, "circular title");
    assert.ok(d.circular.sourceUrl, "source URL");
    assert.ok(d.circular.publishedDate, "published date");
    assert.ok(d.documentText.length > 0, "source text");
    assert.ok(d.versions.length >= 1, "version history");
    assert.ok(d.obligation.fieldGrounding.some((f) => f.evidence), "verbatim evidence");
    assert.equal(d.affectedClients.length, 2);
    return `${d.versions.length} version(s), ${d.affectedClients.length} clients`;
  });

  console.log("\n7. AUDIT TRAIL AND HASH CHAIN");

  await step("every required action was recorded", () => {
    const seen = new Set(DB.AuditLog.map((l) => l.action));
    [
      "CIRCULAR_PROCESSED", "OBLIGATION_EXTRACTED", "REVIEW_PERFORMED",
      "OBLIGATION_VERIFIED_WITH_OVERRIDE", "ALERT_GENERATED", "ALERT_PUBLISHED",
      "ALERT_ACKNOWLEDGED",
    ].forEach((a) => assert.ok(seen.has(a), `${a} was never logged`));
    return `${DB.AuditLog.length} records, ${seen.size} distinct actions`;
  });

  await step("chain verifies as intact", async () => {
    const v = await audit.verifyAuditChain();
    assert.equal(v.intact, true, JSON.stringify(v.issues.slice(0, 2)));
    assert.equal(v.genesis, "GENESIS");
    return `${v.checked} records recomputed`;
  });

  await step("tampering with a published decision is detected", async () => {
    const entry = DB.AuditLog.find((l) => l.action === "OBLIGATION_VERIFIED_WITH_OVERRIDE");
    const original = entry.actorId;
    entry.actorId = accountant._id; // reassign who approved it
    const v = await audit.verifyAuditChain();
    assert.equal(v.intact, false, "reassigning the approver must break the chain");
    entry.actorId = original;
    assert.equal((await audit.verifyAuditChain()).intact, true);
    return "approver swap caught, then restored";
  });

  console.log("\n8. BLOCKCHAIN ANCHOR");

  let anchor;
  await step("anchor commits to the whole trail", async () => {
    const res = await run(auditRoutes, "post", "/anchor", reviewer);
    assert.equal(res.status, 200);
    anchor = res.body.anchor;
    assert.equal(anchor.submitted, false, "a demo anchor must never claim submission");
    assert.equal(anchor.label, "Prototype blockchain anchor");
    return `${anchor.entryCountTotal} records, ${anchor.anchorId.slice(0, 18)}…`;
  });

  await step("anchor id is independently re-derivable", async () => {
    const res = await run(bcRoutes, "get", `/anchors/${anchor._id}/verify`, accountant);
    assert.equal(res.body.result.valid, true);
    return res.body.result.reason;
  });

  await step("owners cannot read the audit trail", async () => {
    const a = await run(auditRoutes, "get", "/", owner);
    const b = await run(bcRoutes, "get", "/status", owner);
    assert.equal(a.status, 403);
    assert.equal(b.status, 403);
    return "audit and blockchain both 403 for owner";
  });

  console.log("\n9. FINAL STATE");

  await step("dashboard reflects everything that happened", async () => {
    const final = (await run(dashboardRoutes, "get", "/accountant", accountant)).body;
    assert.ok(final.obligationsExtracted >= 2);
    assert.ok(final.verifiedObligations >= 2);
    assert.ok(final.affectedClients >= 2);
    return `${final.obligationsExtracted} extracted, ${final.verifiedObligations} verified, ${final.affectedClients} clients affected`;
  });

  await step("no alert exists for an unverified obligation", () => {
    const verified = new Set(
      DB.Obligation.filter((o) => o.reviewStatus === "verified").map((o) => String(o._id))
    );
    const leaks = DB.Alert.filter((a) => !verified.has(String(a.obligationId)));
    assert.equal(leaks.length, 0);
    return `${DB.Alert.length} alerts, 0 from unverified obligations`;
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) {
    failures.forEach((f) => { console.log(`--- ${f.name}`); console.log(f.err.stack); });
    process.exit(1);
  }
})().catch((err) => { console.error(err); process.exit(1); });
