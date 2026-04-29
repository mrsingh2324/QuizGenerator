const express = require("express");

const {
  advanceLiveSession,
  createLiveSession,
  endLiveSession,
  getLiveSessionById,
  getSessionQrCode,
  getSessionLeaderboard,
  startLiveSession,
} = require("./liveSessionController");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

router.post("/", requireAdmin, createLiveSession);
router.get("/:sessionId", requireAdmin, getLiveSessionById);
router.post("/:sessionId/start", requireAdmin, startLiveSession);
router.post("/:sessionId/advance", requireAdmin, advanceLiveSession);
router.post("/:sessionId/end", requireAdmin, endLiveSession);
router.get("/:sessionId/leaderboard", requireAdmin, getSessionLeaderboard);
router.get("/:sessionId/qr", requireAdmin, getSessionQrCode);

module.exports = router;
