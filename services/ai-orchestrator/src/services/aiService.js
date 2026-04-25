const createGeminiClient = require("../config/gemini");
const { toAiServiceError } = require("../utils/aiError");

const client = createGeminiClient();

async function generateStructuredContent({ model, prompt, schema }) {
  const schemaName = schema?.type || "unknown_schema";
  console.log("[Gemini AI] Request started:", {
    model,
    schema: schemaName,
    promptLength: typeof prompt === "string" ? prompt.length : Array.isArray(prompt) ? prompt.join("\n").length : 0,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log("[Gemini AI] Sending request to Gemini API...");
    const startTime = Date.now();

    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    });

    const duration = Date.now() - startTime;

    if (!response.text) {
      console.error("[Gemini AI] Error: No response text received from Gemini");
      throw new Error("Gemini did not return structured output");
    }

    const result = JSON.parse(response.text);
    console.log("[Gemini AI] Request completed successfully:", {
      model,
      schema: schemaName,
      durationMs: duration,
      resultKeys: Object.keys(result),
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    console.error("[Gemini AI] Request failed:", {
      error: error.message,
      model,
      schema: schemaName,
      timestamp: new Date().toISOString(),
    });
    throw toAiServiceError(error);
  }
}

module.exports = {
  generateStructuredContent,
};
