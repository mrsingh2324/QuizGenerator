const Attempt = require("../answers/Attempt");
const crypto = require("crypto");
const { getLeaderboardForQuiz } = require("../answers/attemptService");
const Question = require("../question-bank/Question");
const LiveSession = require("../live-sessions/LiveSession");
const { analyzeTopicText } = require("../../services/aiService");
const { dispatchQuizIntegrationEvent } = require("../../services/integrationService");
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
      theme,
      sharing,
      integrations,
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
      theme,
      sharing,
      integrations,
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
      status: "draft",
      questionTimeLimitSeconds: 20,
      resultsWindowSeconds: 5,
    };

    console.log("[Create Quiz From Topic] Creating draft quiz with", aiResult.questions.length, "questions");

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
    await dispatchQuizIntegrationEvent(quiz, "quiz.published", {
      joinCode: quiz.joinCode,
    });

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

async function updateQuizSettings(req, res, next) {
  try {
    const {
      title,
      description,
      category,
      questionTimeLimitSeconds,
      resultsWindowSeconds,
      theme,
      sharing,
      integrations,
    } = req.body;

    const quiz = await Quiz.findById(req.params.quizId)
      .populate("createdBy", "name email role")
      .populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ message: "title cannot be empty" });
      }
      quiz.title = String(title).trim();
    }

    if (description !== undefined) {
      quiz.description = String(description).trim();
    }

    if (category !== undefined) {
      quiz.category = String(category).trim() || "general";
    }

    if (questionTimeLimitSeconds !== undefined) {
      const nextTimeLimit = Number(questionTimeLimitSeconds);
      if (!Number.isInteger(nextTimeLimit) || nextTimeLimit < 5 || nextTimeLimit > 120) {
        return res.status(400).json({
          message: "questionTimeLimitSeconds must be an integer between 5 and 120",
        });
      }
      quiz.questionTimeLimitSeconds = nextTimeLimit;
    }

    if (resultsWindowSeconds !== undefined) {
      const nextResultsWindow = Number(resultsWindowSeconds);
      if (!Number.isInteger(nextResultsWindow) || nextResultsWindow < 1 || nextResultsWindow > 30) {
        return res.status(400).json({
          message: "resultsWindowSeconds must be an integer between 1 and 30",
        });
      }
      quiz.resultsWindowSeconds = nextResultsWindow;
    }

    if (theme && typeof theme === "object") {
      quiz.theme = {
        ...(quiz.theme?.toObject ? quiz.theme.toObject() : quiz.theme || {}),
        ...theme,
      };
    }

    if (sharing && typeof sharing === "object") {
      const nextSharing = {
        ...(quiz.sharing?.toObject ? quiz.sharing.toObject() : quiz.sharing || {}),
        ...sharing,
      };

      if (!["public", "private"].includes(nextSharing.visibility || "public")) {
        return res.status(400).json({ message: "sharing.visibility must be public or private" });
      }

      if (nextSharing.customSlug) {
        const normalizedSlug = String(nextSharing.customSlug)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "");

        if (!/^[a-z0-9-]{3,40}$/.test(normalizedSlug)) {
          return res.status(400).json({
            message: "customSlug must be 3-40 letters, numbers, or hyphens",
          });
        }

        const existingSlugQuiz = await Quiz.findOne({
          _id: { $ne: quiz._id },
          "sharing.customSlug": normalizedSlug,
        });

        if (existingSlugQuiz) {
          return res.status(409).json({ message: "customSlug is already in use" });
        }

        nextSharing.customSlug = normalizedSlug;
      }

      const maxParticipants = Number(nextSharing.maxParticipants || 0);
      if (!Number.isInteger(maxParticipants) || maxParticipants < 0) {
        return res.status(400).json({ message: "maxParticipants must be 0 or a positive integer" });
      }

      nextSharing.maxParticipants = maxParticipants;
      nextSharing.availableFrom = nextSharing.availableFrom ? new Date(nextSharing.availableFrom) : null;
      nextSharing.availableUntil = nextSharing.availableUntil ? new Date(nextSharing.availableUntil) : null;

      if (
        (nextSharing.availableFrom && Number.isNaN(nextSharing.availableFrom.getTime())) ||
        (nextSharing.availableUntil && Number.isNaN(nextSharing.availableUntil.getTime()))
      ) {
        return res.status(400).json({ message: "Availability dates are invalid" });
      }
      quiz.sharing = nextSharing;
    }

    if (integrations && typeof integrations === "object") {
      quiz.integrations = {
        ...(quiz.integrations?.toObject ? quiz.integrations.toObject() : quiz.integrations || {}),
        ...integrations,
      };
    }

    await quiz.save();
    return res.status(200).json(normalizeQuiz(quiz));
  } catch (error) {
    return next(error);
  }
}

async function joinQuiz(req, res, next) {
  try {
    const { joinCode } = req.params;
    const { participantName, participantEmail, accessPassword } = req.body;

    if (!participantName) {
      return res.status(400).json({
        message: "participantName is required",
      });
    }

    const quiz = await Quiz.findOne({
      $or: [
        { joinCode: joinCode.toUpperCase() },
        { "sharing.customSlug": joinCode.toLowerCase() },
      ],
    }).populate("questions");

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

    const now = new Date();

    if (quiz.sharing?.availableFrom && now < quiz.sharing.availableFrom) {
      return res.status(403).json({ message: "Quiz is not available yet" });
    }

    if (quiz.sharing?.availableUntil && now > quiz.sharing.availableUntil) {
      return res.status(403).json({ message: "Quiz availability has ended" });
    }

    if (quiz.sharing?.visibility === "private") {
      if (!quiz.sharing.accessPassword || quiz.sharing.accessPassword !== accessPassword) {
        return res.status(403).json({ message: "Quiz password is required or incorrect" });
      }
    }

    const activeSession = await LiveSession.findOne({
      quiz: quiz._id,
      joinCode: quiz.joinCode,
      status: { $ne: "closed" },
    }).sort({ createdAt: -1 });

    if (quiz.sharing?.maxParticipants > 0) {
      const currentParticipants = await Attempt.countDocuments(
        activeSession ? { session: activeSession._id } : { quiz: quiz._id }
      );

      if (currentParticipants >= quiz.sharing.maxParticipants) {
        return res.status(403).json({ message: "This quiz has reached its participant limit" });
      }
    }

    const participantData = {
      name: participantName,
      role: "participant",
    };

    if (participantEmail && participantEmail.trim()) {
      participantData.email = participantEmail.trim();
    } else {
      participantData.email = `participant-${crypto.randomUUID()}@quiz.local`;
    }

    const participant = await User.create(participantData);
    const attempt = await Attempt.create({
      quiz: quiz._id,
      session: activeSession?._id || null,
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

async function getQuizQuestions(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId).populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    return res.status(200).json(quiz.questions);
  } catch (error) {
    return next(error);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const { prompt, options, correctOptionIndex } = req.body;
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const ownsQuestion = quiz.questions.some(
      (questionId) => String(questionId) === req.params.questionId
    );

    if (!ownsQuestion) {
      return res.status(404).json({ message: "Question not found for quiz" });
    }

    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (prompt !== undefined && !String(prompt).trim()) {
      return res.status(400).json({ message: "prompt cannot be empty" });
    }

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2 || options.some((option) => !String(option).trim())) {
        return res.status(400).json({ message: "options must include at least two non-empty values" });
      }
    }

    const nextCorrectOptionIndex =
      correctOptionIndex !== undefined ? Number(correctOptionIndex) : question.correctOptionIndex;
    const nextOptions = options || question.options;

    if (
      !Number.isInteger(nextCorrectOptionIndex) ||
      nextCorrectOptionIndex < 0 ||
      nextCorrectOptionIndex >= nextOptions.length
    ) {
      return res.status(400).json({ message: "correctOptionIndex must match an available option" });
    }

    if (prompt !== undefined) {
      question.prompt = prompt;
    }

    if (options !== undefined) {
      question.options = options;
    }

    if (correctOptionIndex !== undefined) {
      question.correctOptionIndex = nextCorrectOptionIndex;
    }

    await question.save();
    return res.status(200).json(question);
  } catch (error) {
    return next(error);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const originalLength = quiz.questions.length;
    quiz.questions = quiz.questions.filter((questionId) => String(questionId) !== req.params.questionId);

    if (quiz.questions.length === originalLength) {
      return res.status(404).json({ message: "Question not found for quiz" });
    }

    await Question.findByIdAndDelete(req.params.questionId);

    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();

    return res.status(200).json({ message: "Question deleted" });
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
  updateQuizSettings,
  updateQuizStatus,
  joinQuiz,
  getQuizLeaderboard,
  getQuizQuestions,
  updateQuestion,
  deleteQuestion,
};
