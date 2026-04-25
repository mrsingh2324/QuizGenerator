const Attempt = require("../answers/Attempt");
const { getLeaderboardForQuiz } = require("../answers/attemptService");
const Question = require("../question-bank/Question");
const LiveSession = require("../live-sessions/LiveSession");
const { analyzeTopicText } = require("../../services/aiService");
const {
  normalizeLeaderboardEntry,
  normalizeQuiz,
  normalizeUser,
} = require("../../utils/normalize");
const Quiz = require("./Quiz");
const User = require("../participants/User");
const generateJoinCode = require("./generateJoinCode");

async function generateUniqueJoinCode() {
  let joinCode = generateJoinCode();
  let existingQuiz = await Quiz.findOne({ joinCode });

  while (existingQuiz) {
    joinCode = generateJoinCode();
    existingQuiz = await Quiz.findOne({ joinCode });
  }

  return joinCode;
}

async function findOrCreateAdmin({ adminId, adminName, adminEmail }) {
  if (adminId) {
    const existingAdmin = await User.findById(adminId);

    if (!existingAdmin) {
      const error = new Error("Admin not found");
      error.statusCode = 404;
      throw error;
    }

    return existingAdmin;
  }

  return User.create({
    name: adminName,
    email: adminEmail,
    role: "admin",
  });
}

async function createQuiz(req, res, next) {
  try {
    const {
      title,
      description,
      category,
      adminId,
      adminName,
      adminEmail,
      questions,
      questionTimeLimitSeconds,
      resultsWindowSeconds,
      status = "draft",
    } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "title, adminId or adminName, and at least one question are required",
      });
    }
    if (!adminId && !adminName) {
      return res.status(400).json({
        message: "adminId or adminName is required",
      });
    }

    const admin = await findOrCreateAdmin({
      adminId,
      adminName,
      adminEmail,
    });

    const invalidQuestion = questions.find(
      (question) =>
        !question.prompt ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        question.correctOptionIndex === undefined ||
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex > 3
    );

    if (invalidQuestion) {
      return res.status(400).json({
        message: "Each question must include prompt, 4 options, and a valid correctOptionIndex",
      });
    }

    const createdQuestions = await Question.insertMany(questions);

    const desiredStatus = ["draft", "published", "closed"].includes(status) ? status : "draft";
    const joinCode = await generateUniqueJoinCode();

    const quiz = await Quiz.create({
      title,
      description,
      category,
      createdBy: admin._id,
      questions: createdQuestions.map((question) => question._id),
      joinCode,
      status: desiredStatus,
      totalQuestions: createdQuestions.length,
      questionTimeLimitSeconds,
      resultsWindowSeconds,
    });

    const populatedQuiz = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email role")
      .populate("questions");

    return res.status(201).json(normalizeQuiz(populatedQuiz));
  } catch (error) {
    return next(error);
  }
}

async function createQuizFromTopic(req, res, next) {
  try {
    const {
      topic,
      title,
      description,
      category,
      adminId,
      adminName,
      adminEmail,
      difficulty,
      count,
    } = req.body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ message: "topic is required" });
    }

    if (!adminId && !adminName) {
      return res.status(400).json({ message: "adminId or adminName is required" });
    }

    console.log("[Create Quiz From Topic] Request received:", {
      title: title || "(not provided)",
      topicLength: topic.length,
      difficulty: difficulty || "not specified",
      count: count || "not specified",
      adminId,
      adminName,
      timestamp: new Date().toISOString(),
    });

    const aiResult = await analyzeTopicText({
      topic,
      difficulty,
      count,
    });

    console.log("[Create Quiz From Topic] AI analysis result:", {
      action: aiResult.action,
      containsQuestions: aiResult.containsQuestions,
      preferencesNeeded: aiResult.preferencesNeeded,
    });

    if (aiResult.action === "needs_preferences") {
      console.log("[Create Quiz From Topic] Preferences needed, returning to user");
      return res.status(200).json({
        requiresPreferences: true,
        aiResult,
      });
    }

    req.body = {
      title: title || aiResult.title || topic,
      description: description || `AI-generated quiz for ${topic}`,
      category: category || "ai-generated",
      adminId,
      adminName,
      adminEmail,
      questions: aiResult.questions.map((question) => ({
        ...question,
        sourceType: aiResult.containsQuestions ? "document" : "ai_generated",
      })),
      status: "published",
      questionTimeLimitSeconds: 20,
      resultsWindowSeconds: 5,
    };

    console.log("[Create Quiz From Topic] Creating quiz with", aiResult.questions.length, "questions");

    return createQuiz(req, res, next);
  } catch (error) {
    console.error("[Create Quiz From Topic] Error:", {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return next(error);
  }
}

async function listQuizzes(_req, res, next) {
  try {
    const quizzes = await Quiz.find()
      .populate("createdBy", "name email role")
      .populate("questions")
      .sort({ createdAt: -1 });

    return res.status(200).json(quizzes.map((quiz) => normalizeQuiz(quiz)));
  } catch (error) {
    return next(error);
  }
}

async function getQuizById(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
      .populate("createdBy", "name email role")
      .populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    return res.status(200).json(normalizeQuiz(quiz));
  } catch (error) {
    return next(error);
  }
}

async function publishQuiz(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    quiz.status = "published";
    await quiz.save();

    return res.status(200).json(normalizeQuiz(quiz, { includeQuestions: false }));
  } catch (error) {
    return next(error);
  }
}

async function updateQuizStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!["draft", "published", "closed"].includes(status)) {
      return res.status(400).json({
        message: "status must be draft, published, or closed",
      });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    quiz.status = status;
    await quiz.save();

    return res.status(200).json(normalizeQuiz(quiz, { includeQuestions: false }));
  } catch (error) {
    return next(error);
  }
}

async function joinQuiz(req, res, next) {
  try {
    const { joinCode } = req.params;
    const { participantName, participantEmail } = req.body;

    if (!participantName) {
      return res.status(400).json({
        message: "participantName is required",
      });
    }

    const quiz = await Quiz.findOne({ joinCode: joinCode.toUpperCase() }).populate("questions");

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found",
      });
    }

    if (quiz.status !== "published") {
      return res.status(400).json({
        message: "Quiz is not open for joining",
      });
    }

    const participant = await User.create({
      name: participantName,
      email: participantEmail,
      role: "participant",
    });

    const attempt = await Attempt.create({
      quiz: quiz._id,
      user: participant._id,
      status: "joined",
    });

    await LiveSession.findOneAndUpdate(
      { quiz: quiz._id, status: { $ne: "closed" } },
      { $inc: { participantCount: 1 } }
    );

    return res.status(200).json({
      message: "Joined quiz successfully",
      quiz: normalizeQuiz(quiz),
      participant: normalizeUser(participant),
      attemptId: String(attempt._id),
    });
  } catch (error) {
    return next(error);
  }
}

async function getQuizLeaderboard(req, res, next) {
  try {
    const leaderboard = await getLeaderboardForQuiz(req.params.quizId);
    return res
      .status(200)
      .json(leaderboard.map((entry, index) => normalizeLeaderboardEntry(entry, index + 1)));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createQuiz,
  createQuizFromTopic,
  listQuizzes,
  getQuizById,
  publishQuiz,
  updateQuizStatus,
  joinQuiz,
  getQuizLeaderboard,
};
