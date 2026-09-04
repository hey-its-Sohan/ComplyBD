/**
 * inMemoryDB.js
 * -----------------------------------------------------------------------------
 * Ultra-lightweight, zero-dependency embedded database for ComplyBD.
 * Runs instantly in pure JavaScript without requiring MongoDB binaries or internet downloads.
 * Persists data to server/data/db.json so data survives restarts.
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const sift = require("sift").default || require("sift");

const dataDir = path.join(__dirname, "..", "..", "data");
const dbFilePath = path.join(dataDir, "db.json");

const DB = {
  User: [],
  Business: [],
  Circular: [],
  Obligation: [],
  Alert: [],
  AuditLog: [],
  Anchor: [],
  ObligationVersion: [],
};

// Load saved data if exists
function loadPersistedData() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(dbFilePath)) {
      const content = fs.readFileSync(dbFilePath, "utf8");
      const saved = JSON.parse(content);
      for (const key of Object.keys(DB)) {
        if (Array.isArray(saved[key])) {
          DB[key] = saved[key].map((d) => wrapDoc(key, d));
        }
      }
      console.log("[EmbeddedDB] Loaded persisted state from db.json");
    }
  } catch (err) {
    console.warn("[EmbeddedDB] Failed to load persisted state:", err.message);
  }
}

let saveTimer = null;
function persistData() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const serializable = {};
      for (const [k, rows] of Object.entries(DB)) {
        serializable[k] = rows.map((r) => {
          const clone = { ...r };
          delete clone.save;
          delete clone.toObject;
          delete clone.toJSON;
          return clone;
        });
      }
      fs.writeFileSync(dbFilePath, JSON.stringify(serializable, null, 2), "utf8");
    } catch (err) {
      console.warn("[EmbeddedDB] Failed to save state to db.json:", err.message);
    }
  }, 100);
}

function normalizeId(val) {
  if (val && typeof val === "object" && val._id) return String(val._id);
  if (val && typeof val === "object" && val._bsontype === "ObjectID") return val.toString();
  return String(val || "");
}

function normalizeQuery(q) {
  if (!q || typeof q !== "object") return q;
  if (q instanceof Date || q instanceof RegExp) return q;
  if (Array.isArray(q)) return q.map(normalizeQuery);

  const res = {};
  for (const [k, v] of Object.entries(q)) {
    if (v && typeof v === "object" && v._bsontype === "ObjectID") {
      res[k] = v.toString();
    } else if (v && typeof v === "object" && !(v instanceof Date) && !(v instanceof RegExp)) {
      res[k] = normalizeQuery(v);
    } else {
      res[k] = v;
    }
  }
  return res;
}

const REF_COLLECTIONS = {
  ownerId: "User",
  accountantId: "User",
  verifiedBy: "User",
  actorId: "User",
  businessId: "Business",
  circularId: "Circular",
  obligationId: "Obligation",
};

function populateDoc(doc, spec) {
  if (!doc) return doc;
  const p = typeof spec === "string" ? spec.trim().split(/\s+/)[0] : spec.path;
  const fields = typeof spec === "string" ? spec.trim().split(/\s+/).slice(1) : (spec.select ? spec.select.trim().split(/\s+/) : null);
  const subPopulate = typeof spec === "object" ? spec.populate : null;

  const targetCol = REF_COLLECTIONS[p];
  if (targetCol && doc[p] !== undefined && doc[p] !== null) {
    const rawVal = doc[p];
    const targetId = typeof rawVal === "object" && rawVal._id ? String(rawVal._id) : String(rawVal);
    const found = DB[targetCol].find((d) => String(d._id) === targetId);
    if (found) {
      let targetClone = { ...found };
      if (fields && fields.length > 0) {
        const picked = { _id: targetClone._id };
        fields.forEach((f) => {
          if (f && targetClone[f] !== undefined) picked[f] = targetClone[f];
        });
        targetClone = picked;
      }
      if (subPopulate) {
        populateDoc(targetClone, subPopulate);
      }
      doc[p] = wrapDoc(targetCol, targetClone);
    }
  }
  return doc;
}

function wrapDoc(collectionName, data) {
  if (!data || typeof data !== "object") return data;
  if (!data._id) {
    data._id = new mongoose.Types.ObjectId().toString();
  } else {
    data._id = String(data._id);
  }

  const doc = { ...data };

  doc.save = async function () {
    const idx = DB[collectionName].findIndex((d) => String(d._id) === String(doc._id));
    if (idx >= 0) {
      DB[collectionName][idx] = doc;
    } else {
      DB[collectionName].push(doc);
    }
    persistData();
    return doc;
  };

  doc.toObject = function () {
    const obj = { ...this };
    delete obj.save;
    delete obj.toObject;
    delete obj.toJSON;
    return obj;
  };

  doc.toJSON = doc.toObject;

  return doc;
}

function applyUpdate(doc, update) {
  if (!update || typeof update !== "object") return doc;
  const setOps = update.$set || update;
  for (const [k, v] of Object.entries(setOps)) {
    if (k.startsWith("$")) continue;
    doc[k] = v;
  }
  return doc;
}

function createQuery(collectionName, items, isSingle = false) {
  let rows = [...items];
  const populates = [];
  let sortCriteria = null;
  let limitCount = null;
  let skipCount = null;
  let selectFields = null;

  const queryObj = {
    sort(crit) {
      sortCriteria = crit;
      return queryObj;
    },
    limit(n) {
      limitCount = n;
      return queryObj;
    },
    skip(n) {
      skipCount = n;
      return queryObj;
    },
    select(fields) {
      selectFields = fields;
      return queryObj;
    },
    populate(spec, select) {
      if (typeof spec === "string" && select) {
        populates.push({ path: spec, select });
      } else {
        populates.push(spec);
      }
      return queryObj;
    },
    lean() {
      return queryObj;
    },
    exec() {
      return queryObj.then((res) => res);
    },
    then(resolve, reject) {
      try {
        let result = [...rows];

        if (sortCriteria) {
          if (typeof sortCriteria === "string") {
            const parts = sortCriteria.trim().split(/\s+/);
            parts.forEach((p) => {
              const desc = p.startsWith("-");
              const field = desc ? p.slice(1) : p;
              result.sort((a, b) => {
                if (a[field] === b[field]) return 0;
                return (a[field] > b[field] ? 1 : -1) * (desc ? -1 : 1);
              });
            });
          } else if (typeof sortCriteria === "object") {
            for (const [k, dir] of Object.entries(sortCriteria)) {
              const mul = Number(dir) < 0 ? -1 : 1;
              result.sort((a, b) => {
                if (a[k] === b[k]) return 0;
                return (a[k] > b[k] ? 1 : -1) * mul;
              });
            }
          }
        }

        if (skipCount != null && skipCount > 0) {
          result = result.slice(skipCount);
        }
        if (limitCount != null && limitCount >= 0) {
          result = result.slice(0, limitCount);
        }

        let out = result.map((d) => wrapDoc(collectionName, { ...d }));

        for (const pop of populates) {
          out = out.map((d) => populateDoc(d, pop));
        }

        if (selectFields) {
          const fields = typeof selectFields === "string" ? selectFields.trim().split(/\s+/) : Object.keys(selectFields);
          const isExclude = fields.some((f) => f.startsWith("-"));
          if (!isExclude) {
            out = out.map((d) => {
              const picked = { _id: d._id, save: d.save, toObject: d.toObject, toJSON: d.toJSON };
              fields.forEach((f) => {
                if (d[f] !== undefined) picked[f] = d[f];
              });
              return picked;
            });
          }
        }

        if (isSingle) {
          resolve(out[0] || null);
        } else {
          resolve(out);
        }
      } catch (err) {
        reject(err);
      }
    },
  };

  return queryObj;
}

function createModel(name) {
  return {
    modelName: name,
    find(filter = {}) {
      const matcher = sift(normalizeQuery(filter));
      const filtered = DB[name].filter((doc) => {
        // Also ensure _id matching works whether passed as string or ObjectId
        const normalizedDoc = { ...doc, _id: String(doc._id) };
        return matcher(normalizedDoc);
      });
      return createQuery(name, filtered, false);
    },
    findOne(filter = {}) {
      const matcher = sift(normalizeQuery(filter));
      const filtered = DB[name].filter((doc) => {
        const normalizedDoc = { ...doc, _id: String(doc._id) };
        return matcher(normalizedDoc);
      });
      return createQuery(name, filtered, true);
    },
    findById(id) {
      const strId = normalizeId(id);
      const filtered = DB[name].filter((doc) => String(doc._id) === strId);
      return createQuery(name, filtered, true);
    },
    async countDocuments(filter = {}) {
      const matcher = sift(normalizeQuery(filter));
      return DB[name].filter((doc) => {
        const normalizedDoc = { ...doc, _id: String(doc._id) };
        return matcher(normalizedDoc);
      }).length;
    },
    async distinct(field, filter = {}) {
      const matcher = sift(normalizeQuery(filter));
      const filtered = DB[name].filter((doc) => matcher({ ...doc, _id: String(doc._id) }));
      return [...new Set(filtered.map((d) => d[field]).filter((v) => v !== undefined))];
    },
    async create(docs) {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const doc = wrapDoc(name, { ...d });
        if (!doc.createdAt) doc.createdAt = new Date();
        DB[name].push(doc);
        return doc;
      });
      persistData();
      return Array.isArray(docs) ? created : created[0];
    },
    async insertMany(docs) {
      return this.create(docs);
    },
    async deleteMany(filter = {}) {
      const matcher = sift(normalizeQuery(filter));
      const keep = [];
      let count = 0;
      for (const d of DB[name]) {
        if (matcher({ ...d, _id: String(d._id) })) {
          count++;
        } else {
          keep.push(d);
        }
      }
      DB[name] = keep;
      persistData();
      return { deletedCount: count };
    },
    async deleteOne(filter = {}) {
      const matcher = sift(normalizeQuery(filter));
      const idx = DB[name].findIndex((d) => matcher({ ...d, _id: String(d._id) }));
      if (idx >= 0) {
        DB[name].splice(idx, 1);
        persistData();
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },
    async updateOne(filter, update) {
      const matcher = sift(normalizeQuery(filter));
      const doc = DB[name].find((d) => matcher({ ...d, _id: String(d._id) }));
      if (doc) {
        applyUpdate(doc, update);
        persistData();
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    },
    async updateMany(filter, update) {
      const matcher = sift(normalizeQuery(filter));
      let count = 0;
      for (const doc of DB[name]) {
        if (matcher({ ...doc, _id: String(doc._id) })) {
          applyUpdate(doc, update);
          count++;
        }
      }
      if (count > 0) persistData();
      return { modifiedCount: count };
    },
    async findByIdAndUpdate(id, update, options = {}) {
      const strId = normalizeId(id);
      const doc = DB[name].find((d) => String(d._id) === strId);
      if (!doc) return null;
      applyUpdate(doc, update);
      persistData();
      return wrapDoc(name, { ...doc });
    },
  };
}

const embeddedModels = {};
for (const key of Object.keys(DB)) {
  embeddedModels[key] = createModel(key);
}

loadPersistedData();

module.exports = {
  DB,
  embeddedModels,
  createModel,
};
