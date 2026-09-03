require("dotenv").config();
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) require("dotenv").config({ path: envPath });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const { authRequired } = require("./middleware/auth");
const { seed } = require("./seed/seed");
const { anchorAuditTrail } = require("./utils/audit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const businessRoutes = require("./routes/businesses");
const circularRoutes = require("./routes/circulars");
const obligationRoutes = require("./routes/obligations");
const alertRoutes = require("./routes/alerts");
const reviewRoutes = require("./routes/reviews");
const auditRoutes = require("./routes/audit");
const dashboardRoutes = require("./routes/dashboard");
const pipelineRoutes = require("./routes/pipeline");
const blockchainRoutes = require("./routes/blockchain");
const demoRoutes = require("./routes/demo");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "ComplyBD", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/circulars", circularRoutes);
app.use("/api/obligations", obligationRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/demo", demoRoutes);

app.get("/api/me/ping", authRequired, (req, res) => {
  res.json({ user: req.user });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const User = require("./models/User");
  const count = await User.countDocuments();
  if (count === 0) {
    console.log("Empty database — seeding demo data...");
    await seed();
  }
  app.listen(PORT, () => {
    console.log(`ComplyBD API running on http://localhost:${PORT}`);
  });
  // Periodic anchoring is opt-in and off by default.
  //
  // The whitepaper's model is periodic anchoring, and this is that mechanism.
  // But a background timer firing every minute would append an AUDIT_ANCHORED
  // record each time, burying the interesting entries in the timeline, and it
  // would silently anchor mid-demo so the presenter's own "Create blockchain
  // anchor" click has nothing left to cover. Manual anchoring is always
  // available from the UI; set an interval only for an unattended deployment.
  const autoAnchorMs = Number(process.env.AUTO_ANCHOR_INTERVAL_MS || 0);
  if (autoAnchorMs > 0) {
    console.log(`Automatic audit anchoring every ${Math.round(autoAnchorMs / 1000)}s`);
    const timer = setInterval(() => {
      anchorAuditTrail().catch((err) => console.warn("Anchor skipped:", err.message));
    }, autoAnchorMs);
    // Do not hold the process open on its own account.
    if (typeof timer.unref === "function") timer.unref();
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  process.exit(0);
});
