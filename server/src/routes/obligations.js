const express = require("express");
const Obligation = require("../models/Obligation");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, async (req, res) => {
  const filter = {};
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  if (req.query.category) filter.businessCategory = req.query.category;
  const obligations = await Obligation.find(filter).populate("circularId", "title source publishedDate").populate("verifiedBy", "name").sort({ createdAt: -1 });
  res.json(obligations);
});

router.get("/:id", authRequired, async (req, res) => {
  const obligation = await Obligation.findById(req.params.id).populate("circularId").populate("verifiedBy", "name email");
  if (!obligation) return res.status(404).json({ message: "Obligation not found" });
  const circular = obligation.circularId;
  res.json({ obligation, circular, documentText: circular ? circular.documentText : "" });
});

module.exports = router;
