const express = require("express");

const {
  createQuiz,
  createQuizFromTopic,
  deleteQuestion,
  getQuizById,
  getQuizLeaderboard,
  getQuizQuestions,
  joinQuiz,
  listQuizzes,
  publishQuiz,
  updateQuizSettings,
  updateQuestion,
  updateQuizStatus,
} = require("./quizController");

const router = express.Router();

router.get("/", listQuizzes);
router.post("/", createQuiz);
router.post("/generate-from-topic", createQuizFromTopic);
router.get("/:quizId", getQuizById);
router.get("/:quizId/leaderboard", getQuizLeaderboard);
router.get("/:quizId/questions", getQuizQuestions);
router.patch("/:quizId/questions/:questionId", updateQuestion);
router.delete("/:quizId/questions/:questionId", deleteQuestion);
router.post("/:quizId/publish", publishQuiz);
router.patch("/:quizId/settings", updateQuizSettings);
router.patch("/:quizId/status", updateQuizStatus);
router.post("/:joinCode/join", joinQuiz);

module.exports = router;
