/** Exercises the audit + blockchain HTTP handlers against the in-memory store. */
const assert = require("node:assert/strict");
const Module = require("node:module");

const DB = { AuditLog: [], Anchor: [], Business: [], ObligationVersion: [] };
let seq = 0; const oid = () => "id" + String(++seq).padStart(4,"0");
const matches = (d,q)=>Object.entries(q||{}).every(([k,v])=>{
  const val=d[k];
  if(v&&typeof v==="object"&&!(v instanceof Date)){
    if("$in" in v)return v.$in.map(String).includes(String(val));
    if("$ne" in v)return String(val)!==String(v.$ne);
    if("$nin" in v)return !v.$nin.map(String).includes(String(val));
  }
  return String(val)===String(v);
});
function chainable(rows, single){
  const st={rows:rows.slice()};
  const t={ sort(sp){const[[k,d]]=Object.entries(sp);st.rows.sort((a,b)=>a[k]===b[k]?0:(a[k]>b[k]?1:-1)*(d<0?-1:1));return t;},
    limit(n){st.rows=st.rows.slice(0,n);return t;}, populate(){return t;}, select(){return t;},
    then(r,j){return Promise.resolve(single?st.rows[0]||null:st.rows).then(r,j);} };
  return t;
}
function model(n){return{
  find:q=>chainable(DB[n].filter(d=>matches(d,q)),false),
  findOne:q=>chainable(DB[n].filter(d=>matches(d,q)),true),
  findById:id=>chainable(DB[n].filter(d=>String(d._id)===String(id)),true),
  countDocuments:async q=>DB[n].filter(d=>matches(d,q)).length,
  distinct:async f=>[...new Set(DB[n].map(d=>d[f]))],
  create:async docs=>{const a=Array.isArray(docs)?docs:[docs];
    const m=a.map(d=>({_id:oid(),save:async()=>{},...d}));DB[n].push(...m);
    return Array.isArray(docs)?m:m[0];},
};}
const models={}; Object.keys(DB).forEach(n=>models[n]=model(n));

function makeRouter(){const stack=[];const add=m=>(p,...h)=>stack.push({route:{path:p,methods:{[m]:true},stack:h.flat().map(x=>({handle:x}))}});
  return {stack,get:add("get"),post:add("post"),patch:add("patch"),delete:add("delete")};}
const expressStub=()=>({}); expressStub.Router=makeRouter;

const orig=Module._load;
Module._load=function(req){
  if(req==="express")return expressStub;
  if(req.endsWith("middleware/auth"))return{
    authRequired:(q,s,n)=>n(),
    // Real behaviour, so role gates are actually exercised rather than bypassed.
    requireRoles:(...roles)=>(q,s,n)=>
      roles.includes(q.user?.role)?n():s.status(403).json({message:"Forbidden"}),
  };
  const m=req.match(/models\/(\w+)$/); if(m&&models[m[1]])return models[m[1]];
  if(req==="mongoose"){const S=function(){};S.prototype.index=function(){return this};
    S.Types={ObjectId:"ObjectId",Mixed:"Mixed"};return{Schema:S,model:()=>({})};}
  return orig.apply(this,arguments);
};

function run(router,method,path,user,body={},query={}){
  return new Promise((res,rej)=>{
    const layer=router.stack.find(l=>l.route.methods[method]&&
      new RegExp("^"+l.route.path.replace(/:[^/]+/g,"([^/]+)")+"$").test(path));
    if(!layer)return rej(new Error(`no route ${method} ${path}`));
    const keys=(layer.route.path.match(/:[^/]+/g)||[]).map(k=>k.slice(1));
    const vals=new RegExp("^"+layer.route.path.replace(/:[^/]+/g,"([^/]+)")+"$").exec(path).slice(1);
    const req={user,body,query,params:Object.fromEntries(keys.map((k,i)=>[k,vals[i]])),headers:{}};
    const r={statusCode:200,status(c){this.statusCode=c;return this;},json(d){res({status:this.statusCode,body:d});}};
    const hs=layer.route.stack.map(s=>s.handle).flat().filter(h=>typeof h==="function"&&h.length<=3);
    (async()=>{
      try{
        let i=0; let done=false;
        const proxy={...r,status(c){r.statusCode=c;return proxy;},json(d){done=true;r.json.call({statusCode:r.statusCode},d);}};
        const next=async()=>{ if(done||i>=hs.length)return; const h=hs[i++]; await h(req,proxy,next); };
        await next();
      }catch(e){rej(e);}
    })();
  });
}

(async()=>{
  const audit=require("../utils/audit");
  const auditRoutes=require("./audit");
  const bcRoutes=require("./blockchain");
  const bizRoutes=require("./businesses");

  const rev={_id:oid(),name:"নাবিলা চৌধুরী",role:"reviewer"};
  const acct={_id:oid(),name:"ফারহানা রহমান",role:"accountant"};
  const owner={_id:oid(),name:"রাকিব হাসান",role:"owner"};

  for(const a of ["CIRCULAR_INGESTED","CIRCULAR_PROCESSED","OBLIGATION_EXTRACTED","REVIEW_PERFORMED","OBLIGATION_VERIFIED","ALERT_GENERATED","ALERT_PUBLISHED"])
    await audit.writeAudit({action:a,entityType:"Test",entityId:"e1",actorId:acct._id,metadata:{a}});

  console.log("GET /audit");
  const list=(await run(auditRoutes,"get","/",acct)).body;
  console.log("  rows:",list.length,"| newest:",list[0].actionLabel,"| seq:",list[0].sequence);
  assert.equal(list.length,7);
  assert.equal(list[0].sequence,6,"newest first");
  assert.ok(list[0].actionLabel,"human label present");

  console.log("GET /audit/verify");
  const v=(await run(auditRoutes,"get","/verify",acct)).body;
  console.log("  intact:",v.intact,"| checked:",v.checked,"| genesis:",v.genesis);
  assert.equal(v.intact,true);

  console.log("GET /audit/summary");
  const sum=(await run(auditRoutes,"get","/summary",acct)).body;
  console.log("  records:",sum.totalRecords,"| unanchored:",sum.unanchoredRecords,"| mode:",sum.blockchain.mode);
  assert.equal(sum.unanchoredRecords,7);

  console.log("POST /audit/anchor");
  const anc=(await run(auditRoutes,"post","/anchor",rev)).body;
  console.log("  anchorId:",anc.anchor.anchorId.slice(0,20)+"…");
  console.log("  label:",anc.anchor.label,"| submitted:",anc.anchor.submitted);
  console.log("  covered:",anc.anchor.entryCountTotal,"records");
  assert.equal(anc.anchor.submitted,false,"demo anchor must not claim submission");
  // Exactly one record stays unanchored: the AUDIT_ANCHORED entry describing
  // this anchor, written after it. An anchor cannot commit to the record that
  // announces it; the next anchor covers it.
  console.log("  unanchored after:",anc.summary.unanchoredRecords,"(the AUDIT_ANCHORED entry itself)");
  assert.equal(anc.summary.unanchoredRecords,1);
  assert.equal(DB.AuditLog[DB.AuditLog.length-1].action,"AUDIT_ANCHORED");

  console.log("GET /blockchain/status");
  const st=(await run(bcRoutes,"get","/status",acct)).body;
  console.log("  mode:",st.service.mode,"| anchors:",st.anchorCount,"| chainIntact:",st.chainIntact);
  assert.equal(st.chainIntact,true);
  assert.equal(st.anchorCount,1);

  console.log("GET /blockchain/anchors/:id/verify");
  const ver=(await run(bcRoutes,"get",`/anchors/${DB.Anchor[0]._id}/verify`,acct)).body;
  console.log("  valid:",ver.result.valid,"|",ver.result.reason);
  assert.equal(ver.result.valid,true);

  console.log("\nrole restrictions (businesses)");
  DB.Business.push({_id:"b1",name:"ধানমন্ডি স্পাইস কিচেন",category:"Restaurant",location:"ঢাকা",
    ownerId:owner._id,accountantId:acct._id,authorizationStatus:"authorized",save:async()=>{}});
  DB.Business.push({_id:"b2",name:"অন্য দোকান",category:"Retail Shop",location:"ঢাকা",
    ownerId:"other",accountantId:"other",authorizationStatus:"authorized",save:async()=>{}});

  const ownerList=(await run(bizRoutes,"get","/",owner)).body;
  console.log("  owner sees:",ownerList.length,"business(es)");
  assert.equal(ownerList.length,1,"owner sees only their own");

  const acctList=(await run(bizRoutes,"get","/",acct)).body;
  console.log("  accountant sees:",acctList.length);
  assert.equal(acctList.length,1,"accountant sees only assigned clients");

  const revList=(await run(bizRoutes,"get","/",rev)).body;
  console.log("  reviewer sees:",revList.length);
  assert.equal(revList.length,2);

  const denied=await run(bizRoutes,"get","/b2",acct);
  console.log("  accountant on unassigned client:",denied.status);
  assert.equal(denied.status,403);

  console.log("\nPATCH /businesses/:id -> BUSINESS_UPDATED");
  const before=DB.AuditLog.length;
  const upd=(await run(bizRoutes,"patch","/b1",acct,{category:"Retail Shop"})).body;
  console.log("  changed:",upd.changed);
  const entry=DB.AuditLog[DB.AuditLog.length-1];
  console.log("  audit action:",entry.action,"| from",entry.metadata.changes.category.from,"->",entry.metadata.changes.category.to);
  assert.equal(DB.AuditLog.length,before+1);
  assert.equal(entry.action,"BUSINESS_UPDATED");

  console.log("\naudit trail is staff-only");
  const ownerAudit=await run(auditRoutes,"get","/",owner);
  console.log("  owner GET /audit ->",ownerAudit.status);
  assert.equal(ownerAudit.status,403,"an owner must not read the global audit trail");

  const ownerSummary=await run(auditRoutes,"get","/summary",owner);
  console.log("  owner GET /audit/summary ->",ownerSummary.status);
  assert.equal(ownerSummary.status,403);

  const ownerChain=await run(bcRoutes,"get","/status",owner);
  console.log("  owner GET /blockchain/status ->",ownerChain.status);
  assert.equal(ownerChain.status,403);

  const staffAudit=await run(auditRoutes,"get","/",acct);
  console.log("  accountant GET /audit ->",staffAudit.status,`(${staffAudit.body.length} rows)`);
  assert.equal(staffAudit.status,200);

  const ownerAnchor=await run(auditRoutes,"post","/anchor",owner);
  console.log("  owner POST /audit/anchor ->",ownerAnchor.status);
  assert.equal(ownerAnchor.status,403);

  console.log("\nchain still intact after all route activity:",(await audit.verifyAuditChain()).intact);
  assert.equal((await audit.verifyAuditChain()).intact,true);
  console.log("\nAll route assertions passed.\n");
})().catch(e=>{console.error("FAILED:",e.message);process.exit(1);});
