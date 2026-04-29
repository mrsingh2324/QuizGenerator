const Attempt = require("./Attempt");
const Question = require("../question-bank/Question");

function calculateScore(answers) {
  return answers.filter((answer) => answer.isCorrect).length * 10;
}

async function submitAttemptAnswer({ attemptId, questionId, selectedOptionIndex }) {
  const [attempt, question] = await Promise.all([
    Attempt.findById(attemptId),
    Question.findById(questionId),
  ]);

  if (!attempt) {
    const error = new Error("Attempt not found");
    error.statusCode = 404;
    throw error;
  }

  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }

  const isCorrect = question.correctOptionIndex === selectedOptionIndex;
  const existingAnswerIndex = attempt.answers.findIndex(
    (answer) => String(answer.question) === String(questionId)
  );

  const answerPayload = {
    question: question._id,
    selectedOptionIndex,
    isCorrect,
    answeredAt: new Date(),
  };

  if (existingAnswerIndex >= 0) {
    attempt.answers[existingAnswerIndex] = answerPayload;
  } else {
    attempt.answers.push(answerPayload);
  }

  attempt.status = "in_progress";
  attempt.score = calculateScore(attempt.answers);
  await attempt.save();

  return {
    attempt,
    question,
    isCorrect,
  };
}

async function completeAttemptById(attemptId) {
  const attempt = await Attempt.findById(attemptId);

  if (!attempt) {
    const error = new Error("Attempt not found");
    error.statusCode = 404;
    throw error;
  }

  attempt.status = "completed";
  attempt.completedAt = new Date();
  attempt.score = calculateScore(attempt.answers);
  await attempt.save();

  return attempt;
}

async function getLeaderboardForQuiz(quizId) {
  const attempts = await Attempt.find({ quiz: quizId })
    .populate("user", "name")
    .sort({ score: -1, updatedAt: 1 });

  return attempts.map((attempt, index) => ({
    rank: index + 1,
    attemptId: attempt._id,
    participant: attempt.user ? attempt.user.name : "Unknown",
    score: attempt.score,
    status: attempt.status,
    completedAt: attempt.completedAt,
  }));
}

async function getLeaderboardForSession(sessionId) {
  const attempts = await Attempt.find({ session: sessionId })
    .populate("user", "name")
    .sort({ score: -1, updatedAt: 1 });

  return attempts.map((attempt, index) => ({
    rank: index + 1,
    attemptId: attempt._id,
    participant: attempt.user ? attempt.user.name : "Unknown",
    score: attempt.score,
    status: attempt.status,
    completedAt: attempt.completedAt,
  }));
}

module.exports = {
  calculateScore,
  submitAttemptAnswer,
  completeAttemptById,
  getLeaderboardForQuiz,
  getLeaderboardForSession,
};
