const express = require("express");

const {
  advanceLiveSession,
  createLiveSession,
  endLiveSession,
  exportQuizReportCsv,
  getLiveSessionById,
  getQuizLaunchHistory,
  getQuizReport,
  getSessionQrCode,
  getSessionLeaderboard,
  launchQuizAgain,
  startLiveSession,
} = require("./liveSessionController");

const router = express.Router();

router.post("/", createLiveSession);
router.get("/quiz/:quizId/history", getQuizLaunchHistory);
router.get("/quiz/:quizId/report", getQuizReport);
router.get("/quiz/:quizId/report.csv", exportQuizReportCsv);
router.post("/quiz/:quizId/launch-again", launchQuizAgain);
router.get("/:sessionId", getLiveSessionById);
router.post("/:sessionId/start", startLiveSession);
router.post("/:sessionId/advance", advanceLiveSession);
router.post("/:sessionId/end", endLiveSession);
router.get("/:sessionId/leaderboard", getSessionLeaderboard);
router.get("/:sessionId/qr", getSessionQrCode);

module.exports = router;
