const mongoose = require("mongoose");

const anchorSchema = new mongoose.Schema({
  merkleRoot: { type: String, required: true },
  fromHash: String,
  toHash: String,
  entryCount: Number,
  chain: { type: String, default: "simulated-polygon" },
  txHash: String,
  anchoredAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Anchor", anchorSchema);
