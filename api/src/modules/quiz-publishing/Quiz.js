const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "general",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true,
      },
    ],
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
    },
    questionTimeLimitSeconds: {
      type: Number,
      min: 5,
      max: 120,
      default: 30,
    },
    resultsWindowSeconds: {
      type: Number,
      min: 1,
      max: 30,
      default: 5,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Quiz", quizSchema);
