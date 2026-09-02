const AuditLog = require("../models/AuditLog");
const Anchor = require("../models/Anchor");
const { genesisHash, hashAuditPayload, sha256 } = require("./hash");

async function getLatestHash() {
  const last = await AuditLog.findOne().sort({ timestamp: -1, _id: -1 });
  return last ? last.currentHash : genesisHash();
}

async function writeAudit({ action, entityType, entityId, actorId, metadata }) {
  const timestamp = new Date();
  const previousHash = await getLatestHash();
  const currentHash = hashAuditPayload({
    previousHash,
    action,
    entityType,
    entityId,
    actorId,
    timestamp: timestamp.toISOString(),
    metadata,
  });

  const entry = await AuditLog.create({
    action,
    entityType,
    entityId: entityId ? String(entityId) : "",
    actorId: actorId || null,
    previousHash,
    currentHash,
    metadata: metadata || {},
    timestamp,
  });
  return entry;
}

function merkleRoot(hashes) {
  if (!hashes.length) return sha256("empty");
  let layer = hashes.slice();
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] || left;
      next.push(sha256(left + right));
    }
    layer = next;
  }
  return layer[0];
}

async function anchorAuditTrail() {
  const logs = await AuditLog.find().sort({ timestamp: 1, _id: 1 });
  if (!logs.length) return null;

  const lastAnchor = await Anchor.findOne().sort({ anchoredAt: -1 });
  const newLogs = lastAnchor
    ? logs.filter((l) => l.timestamp > lastAnchor.anchoredAt)
    : logs;
  if (!newLogs.length) return lastAnchor;

  const hashes = newLogs.map((l) => l.currentHash);
  const root = merkleRoot(hashes);
  const txHash = sha256(`anchor:${root}:${Date.now()}`);

  return Anchor.create({
    merkleRoot: root,
    fromHash: newLogs[0].currentHash,
    toHash: newLogs[newLogs.length - 1].currentHash,
    entryCount: newLogs.length,
    chain: "simulated-polygon",
    txHash,
  });
}

module.exports = { writeAudit, getLatestHash, merkleRoot, anchorAuditTrail };
