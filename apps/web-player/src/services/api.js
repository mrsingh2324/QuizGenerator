const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || `Request failed: ${response.status}`);
  }

  return data;
}

export async function joinQuiz(joinCode, participantName, participantEmail = "", accessPassword = "") {
  return request(`/api/quizzes/${joinCode}/join`, {
    method: "POST",
    body: JSON.stringify({ participantName, participantEmail, accessPassword }),
  });
}

export async function fetchQuizLeaderboard(quizId) {
  return request(`/api/quizzes/${quizId}/leaderboard`);
}
