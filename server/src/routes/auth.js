const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken, authRequired } = require("../middleware/auth");
const { writeAudit } = require("../utils/audit");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || "").toLowerCase() });
  if (!user) return res.status(401).json({ message: "ইমেইল বা পাসওয়ার্ড ভুল" });
  const ok = await bcrypt.compare(String(password || ""), user.password);
  if (!ok) return res.status(401).json({ message: "ইমেইল বা পাসওয়ার্ড ভুল" });
  const token = signToken(user);
  await writeAudit({
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: user._id,
    actorId: user._id,
    metadata: { email: user.email, role: user.role },
  });
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
