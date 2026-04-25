const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const parts = [data?.message || `Request failed: ${response.status}`];

    if (data?.details) {
      parts.push(data.details);
    }

    throw new Error(parts.join(" "));
  }

  return data;
}

export async function createAdmin(payload) {
  return request("/api/users/admins", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchQuizzes() {
  return request("/api/quizzes");
}

export async function createQuiz(payload) {
  return request("/api/quizzes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function generateQuizFromTopic(payload) {
  return request("/api/quizzes/generate-from-topic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function uploadDocumentForQuiz(payload) {
  const formData = new FormData();
  formData.append("admin", payload.admin);
  formData.append("title", payload.title);
  formData.append("file", payload.file);

  if (payload.difficulty) {
    formData.append("difficulty", payload.difficulty);
  }

  if (payload.count !== undefined && payload.count !== "") {
    formData.append("count", payload.count);
  }

  return request("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function createLiveSession(payload) {
  return request("/api/live-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchSessionQr(sessionId) {
  return request(`/api/live-sessions/${sessionId}/qr`);
}
