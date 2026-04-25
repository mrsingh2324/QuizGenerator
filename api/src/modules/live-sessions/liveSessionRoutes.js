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

const router = express.Router();

router.post("/", createLiveSession);
router.get("/:sessionId", getLiveSessionById);
router.post("/:sessionId/start", startLiveSession);
router.post("/:sessionId/advance", advanceLiveSession);
router.post("/:sessionId/end", endLiveSession);
router.get("/:sessionId/leaderboard", getSessionLeaderboard);
router.get("/:sessionId/qr", getSessionQrCode);

module.exports = router;
