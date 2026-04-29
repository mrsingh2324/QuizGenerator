const Attempt = require("../answers/Attempt");
const {
  completeAttemptById,
  getLeaderboardForQuiz,
  getLeaderboardForSession,
  submitAttemptAnswer,
} = require("../answers/attemptService");
const LiveSession = require("./LiveSession");
const Quiz = require("../quiz-publishing/Quiz");
const { normalizeLeaderboardEntry, normalizeQuestion } = require("../../utils/normalize");
const quizEventBus = require("./quizEventBus");
const {
  getSessionState,
  removeSessionState,
  setSessionState,
} = require("./socketSessionStore");

function emitRoomEvent(roomCode, eventName, payload) {
  quizEventBus.emit("room:event", {
    roomCode,
    eventName,
    payload,
  });
}

function getConnectedParticipantCount(state) {
  return state.participantSockets.size;
}

function getQuestionPayload(state) {
  return normalizeQuestion(state.currentQuestion, {
    index: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
  });
}

async function emitLeaderboard(state) {
  const leaderboard = state.sessionId
    ? await getLeaderboardForSession(state.sessionId)
    : await getLeaderboardForQuiz(state.quizId);
  const normalized = leaderboard.map((entry, index) =>
    normalizeLeaderboardEntry(entry, index + 1)
  );

  emitRoomEvent(state.joinCode, "leaderboard:update", normalized);
  return normalized;
}

async function finalizeQuiz(state) {
  const attempts = await Attempt.find(state.sessionId ? { session: state.sessionId } : { quiz: state.quizId });
  await Promise.all(attempts.map((attempt) => completeAttemptById(attempt._id)));

  state.phase = "final_results";

  const session = await LiveSession.findOne({
    joinCode: state.joinCode,
    status: { $ne: "closed" },
  });

  if (session) {
    session.status = "final_results";
    session.endedAt = new Date();
    await session.save();
  }

  const finalLeaderboard = await emitLeaderboard(state);

  emitRoomEvent(state.joinCode, "quiz:finished", {
    leaderboard: finalLeaderboard,
  });

  return finalLeaderboard;
}

async function startQuestion(joinCode, questionIndex = 0) {
  const state = getSessionState(joinCode);

  if (!state) {
    throw new Error("Session state not found");
  }

  if (state.questionTimer) {
    clearInterval(state.questionTimer);
    state.questionTimer = null;
  }

  if (state.summaryTimer) {
    clearTimeout(state.summaryTimer);
    state.summaryTimer = null;
  }

  state.currentQuestionIndex = questionIndex;
  state.currentQuestion = state.questions[questionIndex];
  state.phase = "question_live";
  state.answerCounts = new Map();
  state.answeredAttemptIds = new Set();
  state.remainingSeconds = state.questionTimeLimitSeconds;
  state.questionStartedAt = Date.now();

  const session = await LiveSession.findOne({ joinCode, status: { $ne: "closed" } });
  if (session) {
    session.status = "question_live";
    session.currentQuestionIndex = questionIndex;
    if (!session.startedAt) {
      session.startedAt = new Date();
    }
    await session.save();
  }

  emitRoomEvent(joinCode, "question:broadcast", {
    phase: "question_live",
    remainingSeconds: state.questionTimeLimitSeconds,
    question: getQuestionPayload(state),
  });

  emitRoomEvent(joinCode, "timer:sync", {
    phase: "question_live",
    remainingSeconds: state.questionTimeLimitSeconds,
  });

  state.questionTimer = setInterval(async () => {
    state.remainingSeconds -= 1;

    if (state.remainingSeconds > 0) {
      emitRoomEvent(joinCode, "timer:tick", {
        phase: "question_live",
        remainingSeconds: state.remainingSeconds,
      });
      return;
    }

    await finishQuestion(joinCode, "timer_finished");
  }, 1000);
}

async function finishQuestion(joinCode, reason = "timer_finished") {
  const state = getSessionState(joinCode);

  if (!state || state.phase !== "question_live") {
    return null;
  }

  if (state.questionTimer) {
    clearInterval(state.questionTimer);
    state.questionTimer = null;
  }

  state.phase = "answer_summary";
  state.remainingSeconds = state.resultsWindowSeconds;

  const counts = state.currentQuestion.options.map((_, optionIndex) => ({
    optionIndex,
    count: state.answerCounts.get(optionIndex) || 0,
  }));

  emitRoomEvent(joinCode, "question:summary", {
    questionId: String(state.currentQuestion._id),
    reason,
    counts,
    totalParticipants: getConnectedParticipantCount(state),
    durationSeconds: state.resultsWindowSeconds,
  });

  const leaderboard = await emitLeaderboard(state);

  emitRoomEvent(joinCode, "timer:sync", {
    phase: "answer_summary",
    remainingSeconds: state.resultsWindowSeconds,
  });

  state.summaryTimer = setTimeout(async () => {
    state.summaryTimer = null;
    const hasNextQuestion = state.currentQuestionIndex + 1 < state.questions.length;

    if (!hasNextQuestion) {
      await finalizeQuiz(state);
      return;
    }

    await startQuestion(joinCode, state.currentQuestionIndex + 1);
  }, state.resultsWindowSeconds * 1000);

  return leaderboard;
}

async function initializeQuizSession(joinCode) {
  let state = getSessionState(joinCode);

  if (state) {
    return state;
  }

  const quiz = await Quiz.findOne({ joinCode }).populate("questions");

  if (!quiz) {
    const error = new Error("Quiz not found");
    error.statusCode = 404;
    throw error;
  }

  const session = await LiveSession.findOne({
    quiz: quiz._id,
    joinCode,
    status: { $ne: "closed" },
  }).sort({ createdAt: -1 });

  state = setSessionState(joinCode, {
    joinCode,
    quizId: String(quiz._id),
    sessionId: session ? String(session._id) : null,
    questions: quiz.questions,
    currentQuestionIndex: 0,
    currentQuestion: quiz.questions[0] || null,
    phase: "waiting_for_players",
    questionTimeLimitSeconds: quiz.questionTimeLimitSeconds || 30,
    resultsWindowSeconds: quiz.resultsWindowSeconds || 5,
    remainingSeconds: quiz.questionTimeLimitSeconds || 30,
    participantSockets: new Map(),
    answerCounts: new Map(),
    answeredAttemptIds: new Set(),
    questionTimer: null,
    summaryTimer: null,
    questionStartedAt: null,
  });

  return state;
}

function createJoinSnapshot(state) {
  const snapshot = {
    joinCode: state.joinCode,
    phase: state.phase,
    participantsConnected: getConnectedParticipantCount(state),
  };

  if (state.phase === "question_live" && state.currentQuestion) {
    snapshot.activeQuestion = getQuestionPayload(state);
    snapshot.remainingSeconds = Math.max(
      0,
      state.remainingSeconds ||
        state.questionTimeLimitSeconds -
          Math.floor((Date.now() - state.questionStartedAt) / 1000)
    );
  }

  return snapshot;
}

async function joinQuizSession({ joinCode, role = "participant", attemptId, socketId }) {
  const roomCode = joinCode.toUpperCase();
  const state = await initializeQuizSession(roomCode);

  if (role === "participant" && attemptId) {
    state.participantSockets.set(String(attemptId), socketId);
  }

  emitRoomEvent(roomCode, "room:presence", {
    joinCode: roomCode,
    participantsConnected: getConnectedParticipantCount(state),
    phase: state.phase,
  });

  return createJoinSnapshot(state);
}

async function startQuizSession(joinCode) {
  const roomCode = joinCode.toUpperCase();
  const state = await initializeQuizSession(roomCode);
  await startQuestion(roomCode, state.currentQuestionIndex || 0);
}

async function advanceQuizSession(joinCode) {
  const roomCode = joinCode.toUpperCase();
  const state = getSessionState(roomCode);

  if (!state) {
    throw new Error("Session state not found");
  }

  if (state.phase === "answer_summary") {
    if (state.summaryTimer) {
      clearTimeout(state.summaryTimer);
      state.summaryTimer = null;
    }

    const hasNextQuestion = state.currentQuestionIndex + 1 < state.questions.length;

    if (!hasNextQuestion) {
      await finalizeQuiz(state);
      return;
    }

    await startQuestion(roomCode, state.currentQuestionIndex + 1);
    return;
  }

  if (state.phase === "question_live") {
    await finishQuestion(roomCode, "host_forced_advance");
  }
}

async function submitQuizAnswer({ joinCode, attemptId, questionId, selectedOptionIndex }) {
  const roomCode = joinCode.toUpperCase();
  const state = getSessionState(roomCode);

  if (!state) {
    throw new Error("Session state not found");
  }

  if (state.phase !== "question_live") {
    throw new Error("Question is not currently active");
  }

  if (String(state.currentQuestion._id) !== String(questionId)) {
    throw new Error("Answer submitted for the wrong question");
  }

  const { attempt, isCorrect } = await submitAttemptAnswer({
    attemptId,
    questionId,
    selectedOptionIndex,
  });

  state.answeredAttemptIds.add(String(attemptId));
  state.answerCounts.set(
    selectedOptionIndex,
    (state.answerCounts.get(selectedOptionIndex) || 0) + 1
  );

  emitRoomEvent(roomCode, "answers:progress", {
    answeredCount: state.answeredAttemptIds.size,
    participantCount: getConnectedParticipantCount(state),
  });

  if (
    getConnectedParticipantCount(state) > 0 &&
    state.answeredAttemptIds.size >= getConnectedParticipantCount(state)
  ) {
    await finishQuestion(roomCode, "all_answered");
  }

  return {
    attemptId: String(attempt._id),
    isCorrect,
    score: attempt.score,
  };
}

async function getQuizSessionLeaderboard(joinCode) {
  const roomCode = joinCode.toUpperCase();
  const state = await initializeQuizSession(roomCode);
  return emitLeaderboard(state);
}

function leaveQuizSession({ joinCode, role, attemptId }) {
  if (!joinCode) {
    return;
  }

  const roomCode = joinCode.toUpperCase();
  const state = getSessionState(roomCode);

  if (!state) {
    return;
  }

  if (role === "participant" && attemptId) {
    state.participantSockets.delete(String(attemptId));
  }

  emitRoomEvent(roomCode, "room:presence", {
    joinCode: roomCode,
    participantsConnected: getConnectedParticipantCount(state),
    phase: state.phase,
  });

  if (state.phase === "final_results" && getConnectedParticipantCount(state) === 0) {
    removeSessionState(roomCode);
  }
}

module.exports = {
  advanceQuizSession,
  getQuizSessionLeaderboard,
  initializeQuizSession,
  joinQuizSession,
  leaveQuizSession,
  startQuizSession,
  submitQuizAnswer,
};
