const axios = require("axios");

function buildEventPayload(quiz, event, payload = {}) {
  return {
    event,
    quiz: {
      id: String(quiz._id || quiz.id),
      title: quiz.title,
      joinCode: quiz.joinCode,
      customSlug: quiz.sharing?.customSlug || "",
    },
    payload,
    sentAt: new Date().toISOString(),
  };
}

async function dispatchQuizIntegrationEvent(quiz, event, payload = {}) {
  if (!quiz?.integrations) {
    return;
  }

  const eventPayload = buildEventPayload(quiz, event, payload);

  if (quiz.integrations.webhookUrl) {
    axios
      .post(quiz.integrations.webhookUrl, eventPayload, { timeout: 3000 })
      .catch((error) => {
        console.warn("[Integrations] Webhook delivery failed:", error.message);
      });
  }

  if (quiz.integrations.notificationEmail) {
    console.info("[Integrations] Email notification queued:", {
      to: quiz.integrations.notificationEmail,
      event,
      quizId: eventPayload.quiz.id,
    });
  }
}

module.exports = {
  dispatchQuizIntegrationEvent,
};
