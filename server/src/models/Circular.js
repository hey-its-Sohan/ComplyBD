const mongoose = require("mongoose");

const circularSchema = new mongoose.Schema({
  title: { type: String, required: true },
  source: { type: String, default: "NBR" },
  documentText: { type: String, required: true },
  publishedDate: Date,
  effectiveDate: Date,
  sourceUrl: String,
  status: { type: String, enum: ["ingested", "extracted", "archived"], default: "ingested" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Circular", circularSchema);
