const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export async function joinQuiz(joinCode, participantName, participantEmail = "") {
  return request(`/api/quizzes/${joinCode}/join`, {
    method: "POST",
    body: JSON.stringify({ participantName, participantEmail }),
  });
}

export async function fetchQuizLeaderboard(quizId) {
  return request(`/api/quizzes/${quizId}/leaderboard`);
}
