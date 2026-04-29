const Attempt = require("../answers/Attempt");
const QRCode = require("qrcode");
const { getLeaderboardForSession } = require("../answers/attemptService");
const {
  normalizeLeaderboardEntry,
  normalizeLiveSession,
} = require("../../utils/normalize");
const { dispatchQuizIntegrationEvent } = require("../../services/integrationService");
const Quiz = require("../quiz-publishing/Quiz");
const LiveSession = require("./LiveSession");
const generateJoinCode = require("../quiz-publishing/generateJoinCode");

async function generateUniqueJoinCode() {
  let joinCode = generateJoinCode();
  let existingQuiz = await Quiz.findOne({ joinCode });

  while (existingQuiz) {
    joinCode = generateJoinCode();
    existingQuiz = await Quiz.findOne({ joinCode });
  }

  return joinCode;
}

async function createLiveSession(req, res, next) {
  try {
    const { quizId } = req.body;
    // hostId comes from the authenticated user's JWT; fall back to body for legacy clients
    const hostId = req.user?.userId || req.body.hostId;

    if (!quizId || !hostId) {
      return res.status(400).json({
        message: "quizId is required",
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.status !== "published") {
      quiz.status = "published";
      await quiz.save();
    }

    const session = await LiveSession.create({
      quiz: quiz._id,
      host: hostId,
      joinCode: quiz.joinCode,
      status: "waiting_for_players",
    });
    await dispatchQuizIntegrationEvent(quiz, "quiz.launch_created", {
      sessionId: String(session._id),
      joinCode: session.joinCode,
    });

    return res.status(201).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function getLiveSessionById(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId)
      .populate("quiz", "title joinCode totalQuestions")
      .populate("host", "name email");

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function startLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    session.status = "question_live";
    session.startedAt = new Date();
    await session.save();

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function advanceLiveSession(req, res, next) {
  try {
    const { status } = req.body;
    const session = await LiveSession.findById(req.params.sessionId).populate(
      "quiz",
      "questions totalQuestions"
    );

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    if (status) {
      session.status = status;
    } else if (session.currentQuestionIndex + 1 >= session.quiz.totalQuestions) {
      session.status = "final_results";
    } else {
      session.currentQuestionIndex += 1;
      session.status = "question_live";
    }

    await session.save();

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function endLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    session.status = "closed";
    session.endedAt = new Date();
    await session.save();

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function getSessionLeaderboard(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    const leaderboard = await getLeaderboardForSession(session._id);

    return res
      .status(200)
      .json(leaderboard.map((entry, index) => normalizeLeaderboardEntry(entry, index + 1)));
  } catch (error) {
    return next(error);
  }
}

async function getQuizLaunchHistory(req, res, next) {
  try {
    const sessions = await LiveSession.find({ quiz: req.params.quizId })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("quiz", "title joinCode totalQuestions")
      .populate("host", "name email");

    const history = await Promise.all(
      sessions.map(async (session) => {
        const participants = await Attempt.find({ session: session._id })
          .populate("user", "name email")
          .sort({ score: -1, updatedAt: 1 });

        return {
          ...normalizeLiveSession(session),
          participants: participants.map((attempt, index) => ({
            rank: index + 1,
            attemptId: String(attempt._id),
            name: attempt.user?.name || "Unknown",
            email: attempt.user?.email || "",
            score: attempt.score || 0,
            status: attempt.status,
            answered: attempt.answers?.length || 0,
            joinedAt: attempt.joinedAt,
            completedAt: attempt.completedAt,
          })),
        };
      })
    );

    return res.status(200).json(history);
  } catch (error) {
    return next(error);
  }
}

async function launchQuizAgain(req, res, next) {
  try {
    const { hostId } = req.body;

    if (!hostId) {
      return res.status(400).json({ message: "hostId is required" });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const joinCode = await generateUniqueJoinCode();
    quiz.joinCode = joinCode;
    quiz.status = "published";
    await quiz.save();

    const session = await LiveSession.create({
      quiz: quiz._id,
      host: hostId,
      joinCode,
      status: "waiting_for_players",
    });
    await dispatchQuizIntegrationEvent(quiz, "quiz.launch_again", {
      sessionId: String(session._id),
      joinCode,
    });

    return res.status(201).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

function csvEscape(value) {
  const stringValue = value === undefined || value === null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

async function buildQuizReport(quizId) {
  const quiz = await Quiz.findById(quizId).populate("questions");

  if (!quiz) {
    const error = new Error("Quiz not found");
    error.statusCode = 404;
    throw error;
  }

  const attempts = await Attempt.find({ quiz: quiz._id })
    .populate("user", "name email")
    .populate("session", "joinCode createdAt startedAt endedAt status")
    .populate("answers.question");

  const questionStatsById = new Map(
    (quiz.questions || []).map((question) => [
      String(question._id),
      {
        questionId: String(question._id),
        prompt: question.prompt,
        correctOptionIndex: question.correctOptionIndex,
        attempts: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
      },
    ])
  );

  const participantRows = attempts.map((attempt) => {
    const answers = (attempt.answers || []).map((answer) => {
      const question = answer.question;
      const questionId = String(question?._id || answer.question);
      const stat = questionStatsById.get(questionId);

      if (stat) {
        stat.attempts += 1;
        if (answer.isCorrect) {
          stat.correct += 1;
        } else {
          stat.incorrect += 1;
        }
      }

      return {
        questionId,
        prompt: question?.prompt || "",
        selectedOptionIndex: answer.selectedOptionIndex,
        selectedOption: question?.options?.[answer.selectedOptionIndex] || "",
        correctOptionIndex: question?.correctOptionIndex ?? null,
        correctOption:
          question?.correctOptionIndex !== undefined
            ? question?.options?.[question.correctOptionIndex] || ""
            : "",
        isCorrect: answer.isCorrect,
        answeredAt: answer.answeredAt,
      };
    });

    const durationSeconds =
      attempt.completedAt && attempt.joinedAt
        ? Math.max(0, Math.round((new Date(attempt.completedAt) - new Date(attempt.joinedAt)) / 1000))
        : null;

    return {
      attemptId: String(attempt._id),
      participant: attempt.user?.name || "Unknown",
      email: attempt.user?.email || "",
      score: attempt.score || 0,
      status: attempt.status,
      joinedAt: attempt.joinedAt,
      completedAt: attempt.completedAt,
      durationSeconds,
      answeredCount: answers.length,
      sessionId: attempt.session?._id ? String(attempt.session._id) : null,
      joinCode: attempt.session?.joinCode || "",
      answers,
    };
  });

  const questionStats = Array.from(questionStatsById.values()).map((stat) => ({
    ...stat,
    accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
  }));

  const averageScore =
    participantRows.length > 0
      ? Math.round(
          participantRows.reduce((total, participant) => total + participant.score, 0) /
            participantRows.length
        )
      : 0;

  const completedAttempts = participantRows.filter((participant) => participant.completedAt);
  const averageTimeSeconds =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce(
            (total, participant) => total + (participant.durationSeconds || 0),
            0
          ) / completedAttempts.length
        )
      : 0;

  const hardestQuestions = questionStats
    .filter((question) => question.attempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return {
    quiz: {
      id: String(quiz._id),
      title: quiz.title,
      joinCode: quiz.joinCode,
      totalQuestions: quiz.questions?.length || 0,
    },
    summary: {
      attempts: participantRows.length,
      completed: participantRows.filter((participant) => participant.status === "completed").length,
      averageScore,
      averageTimeSeconds,
      totalQuestions: quiz.questions?.length || 0,
    },
    participants: participantRows,
    questionStats,
    hardestQuestions,
  };
}

async function getQuizReport(req, res, next) {
  try {
    const report = await buildQuizReport(req.params.quizId);
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
}

async function exportQuizReportCsv(req, res, next) {
  try {
    const report = await buildQuizReport(req.params.quizId);
    const rows = [
      [
        "Participant",
        "Email",
        "Join Code",
        "Score",
        "Status",
        "Joined At",
        "Completed At",
        "Duration Seconds",
        "Question",
        "Selected Option",
        "Correct Option",
        "Correct",
        "Answered At",
      ],
    ];

    report.participants.forEach((participant) => {
      if (participant.answers.length === 0) {
        rows.push([
          participant.participant,
          participant.email,
          participant.joinCode,
          participant.score,
          participant.status,
          participant.joinedAt,
          participant.completedAt,
          participant.durationSeconds,
          "",
          "",
          "",
          "",
          "",
        ]);
        return;
      }

      participant.answers.forEach((answer) => {
        rows.push([
          participant.participant,
          participant.email,
          participant.joinCode,
          participant.score,
          participant.status,
          participant.joinedAt,
          participant.completedAt,
          participant.durationSeconds,
          answer.prompt,
          answer.selectedOption,
          answer.correctOption,
          answer.isCorrect ? "Yes" : "No",
          answer.answeredAt,
        ]);
      });
    });

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.quiz.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.csv"`
    );
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
}

async function getSessionQrCode(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId).populate("quiz", "joinCode");

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    const playerBaseUrl = process.env.PLAYER_URL || "http://localhost:3001";
    const joinUrl = `${playerBaseUrl}/?code=${session.joinCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
    });

    return res.status(200).json({
      joinCode: session.joinCode,
      joinUrl,
      qrCodeDataUrl,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createLiveSession,
  getLiveSessionById,
  startLiveSession,
  advanceLiveSession,
  endLiveSession,
  getSessionLeaderboard,
  getSessionQrCode,
  getQuizLaunchHistory,
  getQuizReport,
  exportQuizReportCsv,
  launchQuizAgain,
};
