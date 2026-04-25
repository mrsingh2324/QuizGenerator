const { generateStructuredContent } = require("./aiService");
const {
  conceptsSchema,
  inputClassificationSchema,
  mcqSchema,
  questionDraftSchema,
  summarySchema,
} = require("../schemas/aiPipelineSchemas");
const quizAnalysisSchema = require("../schemas/quizAnalysisSchema");

function buildSharedContext({ text, difficulty, count }) {
  return [
    `Creator difficulty preference: ${difficulty || "not provided"}`,
    `Creator question count preference: ${count || "not provided"}`,
    "",
    "Input text:",
    text,
  ].join("\n");
}

async function classifyInput({ model, text, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "Classify whether the input already contains quiz questions or is study material/topic text.",
      "Return a short usable title.",
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: inputClassificationSchema,
  });
}

async function summarizeTopic({ model, text, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "Summarize the input for quiz creation.",
      "Focus on the teaching content only.",
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: summarySchema,
  });
}

async function extractKeyConcepts({ model, text, summary, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "Extract the key concepts that should be tested in a quiz.",
      "Return a compact list of concepts, avoiding duplicates.",
      "",
      `Summary:\n${summary}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: conceptsSchema,
  });
}

async function parseExistingQuestions({ model, text, summary, concepts, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "The input already contains questions.",
      "Normalize them into MCQ JSON with exactly 4 options per question.",
      "Do not invent extra questions beyond what is reliably present.",
      "",
      `Summary:\n${summary}`,
      "",
      `Key concepts:\n${concepts.join("\n")}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: mcqSchema,
  });
}

async function generateConceptQuestions({
  model,
  text,
  summary,
  concepts,
  difficulty,
  count,
}) {
  return generateStructuredContent({
    model,
    prompt: [
      `Generate exactly ${count} high-quality quiz questions from the key concepts at ${difficulty} difficulty.`,
      "Each generated question should have one correct answer and a short explanation.",
      "Do not convert them to MCQ options yet.",
      "",
      `Summary:\n${summary}`,
      "",
      `Key concepts:\n${concepts.join("\n")}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: questionDraftSchema,
  });
}

async function convertDraftsToMcq({
  model,
  text,
  summary,
  concepts,
  drafts,
  difficulty,
  count,
}) {
  return generateStructuredContent({
    model,
    prompt: [
      "Convert the drafted quiz questions into final MCQ JSON.",
      "Each question must have exactly 4 options and a zero-based correctOptionIndex.",
      "Distractors should be plausible and non-duplicate.",
      "",
      `Summary:\n${summary}`,
      "",
      `Key concepts:\n${concepts.join("\n")}`,
      "",
      `Draft questions JSON:\n${JSON.stringify(drafts)}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: mcqSchema,
  });
}

async function processQuizText({ text, difficulty, count }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const hasPreferences =
    ["easy", "medium", "hard"].includes(difficulty) &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= 50;

  console.log("[AI Processing] Starting quiz text analysis...", {
    model,
    hasPreferences,
    textLength: text.length,
    difficulty: difficulty || "not_specified",
    count: count || "not_specified",
    timestamp: new Date().toISOString(),
  });

  // Step 1: Classify input type
  console.log("[AI Processing] Step 1/5: Classifying input type...");
  const classification = await classifyInput({
    model,
    text,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 1/5: Classification complete:", {
    containsQuestions: classification.containsQuestions,
    detectedInputType: classification.detectedInputType,
    title: classification.title,
  });

  // Step 2: Summarize topic
  console.log("[AI Processing] Step 2/5: Generating topic summary...");
  const summaryResult = await summarizeTopic({
    model,
    text,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 2/5: Summary generated, length:", summaryResult.topicSummary.length);

  // Step 3: Extract key concepts
  console.log("[AI Processing] Step 3/5: Extracting key concepts...");
  const conceptsResult = await extractKeyConcepts({
    model,
    text,
    summary: summaryResult.topicSummary,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 3/5: Extracted", conceptsResult.keyConcepts.length, "key concepts");

  const baseResult = {
    containsQuestions: classification.containsQuestions,
    detectedInputType: classification.detectedInputType,
    title: classification.title,
    topicSummary: summaryResult.topicSummary,
    keyConcepts: conceptsResult.keyConcepts,
  };

  if (classification.containsQuestions) {
    console.log("[AI Processing] Input contains existing questions, parsing...");
    const parsedQuestions = await parseExistingQuestions({
      model,
      text,
      summary: summaryResult.topicSummary,
      concepts: conceptsResult.keyConcepts,
      difficulty,
      count,
    });
    console.log("[AI Processing] Parsed", parsedQuestions.questions.length, "existing questions");

    return {
      ...baseResult,
      action: "parsed",
      preferencesNeeded: false,
      preferencePrompt: "",
      questions: parsedQuestions.questions.map((question) => ({
        ...question,
        options: question.options.slice(0, 4),
      })),
    };
  }

  if (!hasPreferences) {
    console.log("[AI Processing] Preferences needed - returning to user");
    return {
      ...baseResult,
      action: "needs_preferences",
      preferencesNeeded: true,
      preferencePrompt:
        "The uploaded content is topic/study material, not ready-made questions. Please choose the difficulty and the number of questions to generate.",
      questions: [],
    };
  }

  // Step 4: Generate concept questions
  console.log("[AI Processing] Step 4/5: Generating concept questions...", { count, difficulty });
  const drafts = await generateConceptQuestions({
    model,
    text,
    summary: summaryResult.topicSummary,
    concepts: conceptsResult.keyConcepts,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 4/5: Generated", drafts.questions.length, "draft questions");

  // Step 5: Convert drafts to MCQ format
  console.log("[AI Processing] Step 5/5: Converting drafts to MCQ format...");
  const mcqs = await convertDraftsToMcq({
    model,
    text,
    summary: summaryResult.topicSummary,
    concepts: conceptsResult.keyConcepts,
    drafts: drafts.questions,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 5/5: Conversion complete, final questions:", mcqs.questions.length);

  console.log("[AI Processing] Quiz analysis complete!", {
    totalQuestions: mcqs.questions.length,
    action: "generated",
    duration: Date.now(),
  });

  return {
    ...baseResult,
    action: "generated",
    preferencesNeeded: false,
    preferencePrompt: "",
    questions: mcqs.questions.map((question) => ({
      ...question,
      options: question.options.slice(0, 4),
    })),
  };
}

module.exports = {
  processQuizText,
};
