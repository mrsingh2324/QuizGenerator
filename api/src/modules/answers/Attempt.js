const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const attemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["joined", "in_progress", "completed"],
      default: "joined",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Attempt", attemptSchema);
