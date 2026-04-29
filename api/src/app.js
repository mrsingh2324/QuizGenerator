const cors = require("cors");
const express = require("express");
const passport = require("passport");

const { configurePassport } = require("./modules/auth/passportConfig");
const authRoutes = require("./modules/auth/authRoutes");
const aiJobRoutes = require("./modules/ai-processing/aiJobRoutes");
const attemptRoutes = require("./modules/answers/attemptRoutes");
const documentRoutes = require("./modules/documents/documentRoutes");
const liveSessionRoutes = require("./modules/live-sessions/liveSessionRoutes");
const userRoutes = require("./modules/participants/userRoutes");
const quizRoutes = require("./modules/quiz-publishing/quizRoutes");
const { globalLimiter } = require("./middleware/rateLimiter");

configurePassport();

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CLIENT_URL || "*")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (allowedOrigins.includes("*") || !origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(passport.initialize());
app.use(globalLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/ai-jobs", aiJobRoutes);
app.use("/api/live-sessions", liveSessionRoutes);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    code: err.code || "API_ERROR",
    message: err.message || "Internal server error",
    details: err.details || null,
    provider: err.provider || null,
  });
});

module.exports = app;
