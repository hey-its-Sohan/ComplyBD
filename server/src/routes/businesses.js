const express = require("express");
const Business = require("../models/Business");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, async (req, res) => {
  const filter = {};
  if (req.user.role === "owner") filter.ownerId = req.user._id;
  if (req.user.role === "accountant") filter.accountantId = req.user._id;
  const businesses = await Business.find(filter).populate("ownerId", "name email").populate("accountantId", "name email");
  res.json(businesses);
});

router.get("/:id", authRequired, async (req, res) => {
  const business = await Business.findById(req.params.id).populate("ownerId", "name email").populate("accountantId", "name email");
  if (!business) return res.status(404).json({ message: "Business not found" });
  res.json(business);
});

module.exports = router;
