const mongoose = require("mongoose");

/**
 * One published commitment to the state of the audit trail.
 *
 * `mode` and `submitted` are stored rather than derived so a record always says
 * honestly how it was created. An anchor written in demo mode stays labelled as
 * a prototype anchor forever, even if the server is later reconfigured to use a
 * real network.
 */
const anchorSchema = new mongoose.Schema({
  /** Merkle root of the audit records covered by this anchor. */
  merkleRoot: { type: String, required: true },

  /** The digest actually handed to the blockchain service. */
  committedHash: { type: String, default: "" },

  /** Chain-tip hash at the moment of anchoring. */
  latestHash: { type: String, default: "" },

  fromHash: String,
  toHash: String,

  /** Records covered by this batch, and by the chain up to this point. */
  entryCount: Number,
  entryCountTotal: { type: Number, default: 0 },

  /** Retained from the first build so older anchors still render. */
  chain: { type: String, default: "ComplyBD prototype ledger (simulated)" },

  network: { type: String, default: "" },
  mode: { type: String, enum: ["demo", "testnet"], default: "demo" },

  /** True only when a transaction was really broadcast. */
  submitted: { type: Boolean, default: false },

  label: { type: String, default: "Prototype blockchain anchor" },
  note: { type: String, default: "" },
  explorerUrl: { type: String, default: null },

  anchorId: { type: String, default: "" },
  txHash: String,

  status: { type: String, enum: ["anchored", "pending", "failed"], default: "anchored" },
  anchoredAt: { type: Date, default: Date.now },
});

anchorSchema.index({ anchoredAt: -1 });

module.exports = mongoose.model("Anchor", anchorSchema);
