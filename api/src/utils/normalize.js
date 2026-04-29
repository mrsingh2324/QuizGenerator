// normalizeQuestion strips the correct answer — safe to send to participants during
// an active question phase. Never include correctOptionIndex/explanation here.
function normalizeQuestion(question, extra = {}) {
  if (!question) {
    return null;
  }

  return {
    id: String(question._id || question.id),
    prompt: question.prompt,
    options: Array.isArray(question.options) ? question.options : [],
    difficulty: question.difficulty || "medium",
    sourceType: question.sourceType || "manual",
    ...extra,
  };
}

// Used only after a question ends (summary event + admin views).
function normalizeQuestionWithAnswer(question, extra = {}) {
  if (!question) {
    return null;
  }

  return {
    ...normalizeQuestion(question, extra),
    correctOptionIndex:
      question.correctOptionIndex !== undefined ? question.correctOptionIndex : null,
    explanation: question.explanation || "",
  };
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  if (typeof user === "string") {
    return { id: user, name: "", email: "", role: "", avatar: "" };
  }

  if (!user._id && !user.id) {
    return { id: String(user), name: "", email: "", role: "", avatar: "" };
  }

  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email || "",
    role: user.role,
    avatar: user.avatar || "",
  };
}

function normalizeQuiz(quiz, options = {}) {
  if (!quiz) {
    return null;
  }

  const includeQuestions = options.includeQuestions !== false;
  const total = quiz.totalQuestions || quiz.questions?.length || 0;

  return {
    id: String(quiz._id || quiz.id),
    title: quiz.title,
    description: quiz.description || "",
    category: quiz.category || "general",
    joinCode: quiz.joinCode,
    status: quiz.status,
    totalQuestions: total,
    questionTimeLimitSeconds: quiz.questionTimeLimitSeconds || 30,
    resultsWindowSeconds: quiz.resultsWindowSeconds || 5,
    createdBy: normalizeUser(quiz.createdBy),
    // Public quiz listing never exposes answers — normalizeQuestion is used here
    questions: includeQuestions
      ? (quiz.questions || []).map((q, index) =>
          normalizeQuestion(q, { index, totalQuestions: total })
        )
      : undefined,
  };
}

function normalizeAttempt(attempt) {
  if (!attempt) {
    return null;
  }

  return {
    id: String(attempt._id || attempt.id),
    quiz: attempt.quiz ? String(attempt.quiz._id || attempt.quiz) : null,
    user: normalizeUser(attempt.user),
    score: attempt.score || 0,
    status: attempt.status || "joined",
    joinedAt: attempt.joinedAt || null,
    completedAt: attempt.completedAt || null,
  };
}

function normalizeLeaderboardEntry(entry, fallbackRank) {
  if (!entry) {
    return null;
  }

  return {
    rank: entry.rank || fallbackRank || null,
    attemptId: entry.attemptId ? String(entry.attemptId) : null,
    participant: entry.participant || entry.user?.name || "Unknown",
    score: entry.score || 0,
    status: entry.status || "joined",
    completedAt: entry.completedAt || null,
  };
}

function normalizeLiveSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: String(session._id || session.id),
    quiz: session.quiz ? String(session.quiz._id || session.quiz) : null,
    host: normalizeUser(session.host),
    joinCode: session.joinCode,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex || 0,
    participantCount: session.participantCount || 0,
    startedAt: session.startedAt || null,
    endedAt: session.endedAt || null,
  };
}

module.exports = {
  normalizeAttempt,
  normalizeLeaderboardEntry,
  normalizeLiveSession,
  normalizeQuestion,
  normalizeQuestionWithAnswer,
  normalizeQuiz,
  normalizeUser,
};
