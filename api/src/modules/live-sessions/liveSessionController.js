const Attempt = require("../answers/Attempt");
const QRCode = require("qrcode");
const { getLeaderboardForQuiz } = require("../answers/attemptService");
const {
  normalizeLeaderboardEntry,
  normalizeLiveSession,
} = require("../../utils/normalize");
const Quiz = require("../quiz-publishing/Quiz");
const LiveSession = require("./LiveSession");

async function createLiveSession(req, res, next) {
  try {
    const { quizId, hostId } = req.body;

    if (!quizId || !hostId) {
      return res.status(400).json({
        message: "quizId and hostId are required",
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

    const leaderboard = await getLeaderboardForQuiz(session.quiz);

    return res
      .status(200)
      .json(leaderboard.map((entry, index) => normalizeLeaderboardEntry(entry, index + 1)));
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
};
