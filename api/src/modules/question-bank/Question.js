const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 2;
        },
        message: "A question must have at least two options",
      },
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    sourceType: {
      type: String,
      enum: ["manual", "document", "ai_generated"],
      default: "manual",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    explanation: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Question", questionSchema);
