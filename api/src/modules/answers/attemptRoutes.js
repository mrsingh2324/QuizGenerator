const express = require("express");

const { completeAttempt, getAttemptById, submitAnswer } = require("./attemptController");

const router = express.Router();

router.get("/:attemptId", getAttemptById);
router.post("/:attemptId/answers", submitAnswer);
router.post("/:attemptId/complete", completeAttempt);

module.exports = router;
