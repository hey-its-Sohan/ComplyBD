const express = require("express");
const User = require("../models/User");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, async (_req, res) => {
  const users = await User.find().select("-password").sort({ name: 1 });
  res.json(users);
});

module.exports = router;
