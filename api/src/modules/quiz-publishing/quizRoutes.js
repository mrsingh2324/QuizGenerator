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

const router = express.Router();

router.get("/", listQuizzes);
router.post("/", createQuiz);
router.post("/generate-from-topic", createQuizFromTopic);
router.get("/:quizId", getQuizById);
router.get("/:quizId/leaderboard", getQuizLeaderboard);
router.post("/:quizId/publish", publishQuiz);
router.patch("/:quizId/status", updateQuizStatus);
router.post("/:joinCode/join", joinQuiz);

module.exports = router;
