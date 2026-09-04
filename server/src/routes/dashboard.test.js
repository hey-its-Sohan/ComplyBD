/**
 * Exercises the section-I demo flow against the real route handlers with an
 * in-memory stand-in for Mongo. Verifies the data each screen depends on and,
 * critically, that unverified obligations never reach a business.
 */
const assert = require("node:assert/strict");

// ---- in-memory store -------------------------------------------------------
const DB = { Business: [], Alert: [], Obligation: [], Circular: [], User: [], AuditLog: [], Anchor: [], ObligationVersion: [] };
let seq = 0;
const oid = () => "id" + (++seq);

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
function makeModel(name) {
  const api = {
    find: (q) => chain(DB[name].filter((d) => matches(d, q))),
    findById: (id) => chain(DB[name].find((d) => String(d._id) === String(id)) || null),
    findOne: (q) => chain(DB[name].find((d) => matches(d, q)) || null),
    countDocuments: async (q) => DB[name].filter((d) => matches(d, q)).length,
    create: async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const made = arr.map((d) => ({ _id: oid(), save: async () => {}, ...d }));
      DB[name].push(...made);
      return Array.isArray(docs) ? made : made[0];
    },
  };
  return api;
}
function chain(result) {
  const p = Promise.resolve(result);
  p.populate = () => p; p.sort = () => p; p.select = () => p; p.limit = () => p;
  return p;
}

const Module = require("node:module");
const orig = Module._load;
const models = {};
Object.keys(DB).forEach(n => models[n] = makeModel(n));
// Minimal express stand-in that records routes so handlers can be invoked directly.
function makeRouter() {
  const stack = [];
  const add = (method) => (path, ...handlers) => {
    stack.push({ route: { path, methods: { [method]: true }, stack: handlers.map(h => ({ handle: h })) } });
  };
  return { stack, get: add("get"), post: add("post"), patch: add("patch"), delete: add("delete") };
}
const expressStub = () => ({});
expressStub.Router = makeRouter;

Module._load = function (req, parent) {
  if (req === "express") return expressStub;
  if (req.endsWith("middleware/auth")) {
    return { authRequired: (r,s,n)=>n(), requireRoles: () => (r,s,n)=>n() };
  }
  if (req === "mongoose") {
    const S = function(){}; S.prototype.index = function(){return this;};
    S.Types = { ObjectId:"ObjectId", Mixed:"Mixed" };
    return { Schema: S, model: () => ({}) };
  }
  const m = req.match(/models\/(\w+)$/);
  if (m && models[m[1]]) return models[m[1]];
  return orig.apply(this, arguments);
};

// ---- fixtures --------------------------------------------------------------
const accountant = { _id: oid(), name: "ফারহানা রহমান", role: "accountant", email:"a@c.com" };
const owner = { _id: oid(), name: "রাকিব হাসান", role: "owner" };
const reviewer = { _id: oid(), name: "নাবিলা চৌধুরী", role: "reviewer" };
DB.User.push(accountant, owner, reviewer);

const circ = { _id: oid(), title: "এসআরও ১৫৮ — রেস্তোরাঁ মূসক", source:"NBR", documentText:"…", sourceUrl:"https://x" };
DB.Circular.push(circ);

const biz = (name, category, auth="authorized") => {
  const b = { _id: oid(), name, category, location:"ঢাকা", ownerId: owner._id, accountantId: accountant._id, authorizationStatus: auth, vatBin:"000-1" };
  DB.Business.push(b); return b;
};
const b1 = biz("ধানমন্ডি স্পাইস কিচেন","Restaurant");
const b2 = biz("গুলশান গার্ডেন বিস্ট্রো","Restaurant");
const b3 = biz("বনানী মিনি মার্ট","Retail Shop");
const b4 = biz("মতিঝিল গ্যাজেট হাব","Electronics Shop");
const b5 = biz("নিউ মার্কেট স্টাইল হাউস","Clothing Business");

const mkOb = (o) => { const d = { _id: oid(), circularId: circ._id, matchedBusinessCount:0, save: async()=>{}, ...o }; DB.Obligation.push(d); return d; };
const verifiedOb = mkOb({ obligationType:"VAT Rate Change", businessCategory:"Restaurant", effectiveDate:new Date("2026-09-15"), reviewStatus:"verified", confidence:94, confidenceBand:"high", summaryBangla:"…", requiredAction:"চালান হালনাগাদ করুন।", extractionMethod:"llm-openai", autoVerified:true, groundingStatus:"grounded" });
const pendingOb  = mkOb({ obligationType:"Invoice Data Fields", businessCategory:"Electronics Shop", effectiveDate:new Date("2026-11-01"), reviewStatus:"pending", confidence:77, summaryBangla:"…", fieldGrounding:[] });
const blockedOb  = mkOb({ obligationType:"Server Connectivity", businessCategory:"Retail Shop", reviewStatus:"needs_review", confidence:38, confidenceBand:"low", summaryBangla:"…",
  fieldGrounding:[{field:"businessCategory",grounded:true},{field:"obligationType",grounded:true},{field:"effectiveDate",grounded:false},{field:"penalty",grounded:false}] });
mkOb({ obligationType:"Cash Transaction Limit", businessCategory:"Small Manufacturer", reviewStatus:"rejected", confidence:22, summaryBangla:"…" });

// ---- express harness -------------------------------------------------------
function run(router, method, path, user, body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    const layer = router.stack.find((l) => l.route && l.route.methods[method] &&
      new RegExp("^" + l.route.path.replace(/:[^/]+/g, "([^/]+)") + "$").test(path));
    if (!layer) return reject(new Error(`no route ${method} ${path}`));
    const keys = (l => (l.route.path.match(/:[^/]+/g) || []).map(k => k.slice(1)))(layer);
    const vals = new RegExp("^" + layer.route.path.replace(/:[^/]+/g, "([^/]+)") + "$").exec(path).slice(1);
    const req = { user, body, query, params: Object.fromEntries(keys.map((k,i)=>[k,vals[i]])), headers:{} };
    const res = { statusCode:200, status(c){this.statusCode=c;return this;}, json(d){resolve({status:this.statusCode,body:d});} };
    const handlers = layer.route.stack.map(s=>s.handle).filter(h=>h.length<=3);
    (async () => { try { await handlers[handlers.length-1](req,res,()=>{}); } catch(e){ reject(e);} })();
  });
}

(async () => {
  const { matchAndAlert } = require("../utils/match");
  const dashboard = require("./dashboard");

  console.log("F. ALERT MATCHING");
  const made = await matchAndAlert(verifiedOb, accountant._id);
  console.log("  verified Restaurant obligation matched:", made.length, "businesses");
  assert.equal(made.length, 2, "should match both restaurants");
  assert.equal(verifiedOb.matchedBusinessCount, 2);
  console.log("  matchedBusinessCount stored:", verifiedOb.matchedBusinessCount);

  const none1 = await matchAndAlert(pendingOb, accountant._id);
  const none2 = await matchAndAlert(blockedOb, accountant._id);
  assert.equal(none1.length + none2.length, 0, "unverified obligations must not create alerts");
  console.log("  pending + needs_review produced:", none1.length + none2.length, "alerts (correct)");
  console.log("  alert priorities:", [...new Set(DB.Alert.map(a=>a.priority))].join(", "));

  console.log("\nI. DEMO FLOW — accountant");
  const dash = (await run(dashboard, "get", "/accountant", accountant)).body;
  console.log("  clients:", dash.totalClients, "| alerts:", dash.totalAlerts, "| needs review:", dash.requiresReview);
  console.log("  compliance changes:", dash.changes.length);
  const vatChange = dash.changes.find(c=>c.obligationType==="VAT Rate Change");
  console.log("  VAT change ->", vatChange.priority, "|", vatChange.reviewStatus, "| affected clients:", vatChange.affectedClients);
  assert.equal(vatChange.affectedClients, 2);
  assert.ok(dash.categoryBreakdown.length >= 4, "chart data present");

  const clients = (await run(dashboard, "get", "/clients", accountant)).body.clients;
  console.log("  client rows:", clients.length);
  const k = clients.find(c=>c.name===b1.name);
  console.log("  ", k.name, "->", k.health.label, "| active:", k.activeAlerts, "| urgent:", k.urgentAlerts);
  assert.equal(clients.length, 5);

  const detail = (await run(dashboard, "get", `/clients/${b1._id}`, accountant)).body;
  console.log("  detail: current", detail.currentAlerts.length, "| obligations", detail.obligations.length, "| history", detail.historicalAlerts.length);

  console.log("\n  scoping");
  const forbidden = await run(dashboard, "get", `/clients/${b1._id}`, { _id:"other", role:"accountant", name:"x" });
  console.log("  other accountant gets:", forbidden.status, "-", forbidden.body.message);
  assert.equal(forbidden.status, 403);

  console.log("\nI. DEMO FLOW — open a regulatory change");
  const obligations = require("./obligations");
  const change = (await run(obligations, "get", `/${verifiedOb._id}`, accountant)).body;
  console.log("  obligation:", change.obligation.obligationType, "|", change.obligation.reviewStatus);
  console.log("  affected clients:", change.affectedClients.length,
    "->", change.affectedClients.map(c=>c.name).join(", "));
  assert.equal(change.affectedClients.length, 2, "both restaurants should appear");
  assert.ok(change.affectedClients.every(c=>c.alertId), "each row needs an alert to open");

  const held = (await run(obligations, "get", `/${blockedOb._id}`, accountant)).body;
  console.log("  ungrounded obligation reached:", held.affectedClients.length, "clients");
  console.log("  would-match but withheld:", held.pendingMatches.map(p=>p.name).join(", ") || "none");
  assert.equal(held.affectedClients.length, 0, "an unverified obligation must reach nobody");
  assert.ok(held.pendingMatches.length > 0, "the withheld match should still be visible");

  console.log("\nI. DEMO FLOW — SME owner");
  const own = (await run(dashboard, "get", "/owner", owner)).body;
  console.log("  shops:", own.businesses.length, "| alerts:", own.alerts.length, "| open:", own.openAlerts, "| urgent:", own.urgentAlerts);
  console.log("  accountant contact:", own.accountant ? own.accountant.name : "none");
  assert.ok(own.accountant, "owner must be able to reach an accountant");

  console.log("\nSAFETY: alerts referencing unverified obligations");
  const verifiedIds = DB.Obligation.filter(o=>o.reviewStatus==="verified").map(o=>String(o._id));
  const leaks = DB.Alert.filter(a=>!verifiedIds.includes(String(a.obligationId)));
  console.log("  leaked alerts:", leaks.length);
  assert.equal(leaks.length, 0);

  console.log("\nAll demo-flow assertions passed.\n");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
