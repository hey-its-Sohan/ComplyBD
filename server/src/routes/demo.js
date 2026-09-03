const express = require("express");
const { seed } = require("../seed/seed");
const { requireDemoMode, demoStatus, isDemoMode } = require("../services/demoMode");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/demo/status
 * Open to any signed-in user: it reports which engines are active, which the
 * interface needs in order to label itself honestly.
 */
router.get("/status", authRequired, (_req, res) => {
  res.json(demoStatus());
});

/**
 * POST /api/demo/reset
 *
 * Drops every application collection and rebuilds the demo dataset: users,
 * businesses, circulars, obligations, version history, alerts, audit log and
 * anchors. Existing sessions keep working because the seeded accounts are
 * recreated with the same emails, though ids change.
 *
 * Guarded twice. `requireDemoMode` blocks it outright unless DEMO_MODE is on,
 * and it is unauthenticated by design so a demo can be recovered even from a
 * broken login state — which is only safe because of that first guard. Never
 * enable demo mode on an installation holding real client data.
 */
router.post("/reset", requireDemoMode, async (_req, res) => {
  const started = Date.now();
  try {
    const result = await seed();
    res.json({
      ok: true,
      message: "Demo data rebuilt.",
      durationMs: Date.now() - started,
      counts: result?.counts || null,
      accounts: [
        { role: "accountant", email: "accountant@complybd.com" },
        { role: "reviewer", email: "reviewer@complybd.com" },
        { role: "owner", email: "owner@complybd.com" },
      ],
      password: "demo123",
      demoMode: isDemoMode(),
    });
  } catch (err) {
    console.error("Demo reset failed:", err);
    res.status(500).json({ ok: false, message: `Reset failed: ${err.message}` });
  }
});

module.exports = router;
