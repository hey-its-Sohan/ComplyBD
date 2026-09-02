const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ["Restaurant", "Retail Shop", "Electronics Shop", "Clothing Business", "Small Manufacturer"],
    required: true,
  },
  location: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  accountantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  authorizationStatus: { type: String, enum: ["authorized", "pending", "revoked"], default: "authorized" },
  tin: String,
  vatBin: String,
});

module.exports = mongoose.model("Business", businessSchema);
