const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Request failed: ${response.status}`);
  }

  return data;
}

const SESSION_KEY = (joinCode) => `qz_session_${joinCode.toUpperCase()}`;

export function saveParticipantSession(joinCode, attemptId, playerName) {
  try {
    sessionStorage.setItem(
      SESSION_KEY(joinCode),
      JSON.stringify({ attemptId, playerName, ts: Date.now() })
    );
  } catch {
    // sessionStorage unavailable (private browsing edge cases) — ignore
  }
}

export function loadParticipantSession(joinCode) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(joinCode));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard sessions older than 4 hours
    if (Date.now() - data.ts > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY(joinCode));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearParticipantSession(joinCode) {
  try {
    sessionStorage.removeItem(SESSION_KEY(joinCode));
  } catch {
    // ignore
  }
}

export async function joinQuiz(joinCode, participantName, existingAttemptId = null) {
  return request(`/api/quizzes/${joinCode}/join`, {
    method: "POST",
    body: JSON.stringify({
      participantName,
      ...(existingAttemptId ? { attemptId: existingAttemptId } : {}),
    }),
  });
}

export async function fetchQuizLeaderboard(quizId) {
  return request(`/api/quizzes/${quizId}/leaderboard`);
}
