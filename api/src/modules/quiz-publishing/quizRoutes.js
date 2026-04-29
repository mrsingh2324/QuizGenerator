const express = require("express");

const {
  createQuiz,
  createQuizFromTopic,
  getQuizById,
  getQuizLeaderboard,
  joinQuiz,
  listQuizzes,
  publishQuiz,
  updateQuizStatus,
} = require("./quizController");
const { requireAdmin } = require("../../middleware/auth");
const { aiLimiter } = require("../../middleware/rateLimiter");

const router = express.Router();

router.get("/", listQuizzes);
router.post("/", requireAdmin, createQuiz);
router.post("/generate-from-topic", requireAdmin, aiLimiter, createQuizFromTopic);
router.get("/:quizId", getQuizById);
router.get("/:quizId/leaderboard", getQuizLeaderboard);
router.post("/:quizId/publish", requireAdmin, publishQuiz);
router.patch("/:quizId/status", requireAdmin, updateQuizStatus);
// Participants join without auth — they only need the join code
router.post("/:joinCode/join", joinQuiz);

module.exports = router;
