import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import {
  createLiveSession,
  fetchQuizzes,
  fetchSessionQr,
  generateQuizFromTopic,
  uploadDocumentForQuiz,
} from "../services/api";
import { getAdminSocket } from "../services/socket";

const PLAYER_URL = import.meta.env.VITE_PLAYER_URL || "http://localhost:3001";

const initialTopicForm = {
  title: "",
  topic: "",
  difficulty: "medium",
  count: 5,
};

function DashboardPage() {
  const { user } = useAuth();

  const [quizzes, setQuizzes] = useState([]);
  const [topicForm, setTopicForm] = useState(initialTopicForm);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [statusText, setStatusText] = useState("Create a quiz from topic text or upload a document.");
  const [activeSession, setActiveSession] = useState(null);
  const [qrInfo, setQrInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchQuizzes()
      .then(setQuizzes)
      .catch((err) => setStatusText(err.message));
  }, []);

  const stats = useMemo(() => {
    const published = quizzes.filter((q) => q.status === "published").length;
    const withJoinCode = quizzes.filter((q) => q.joinCode).length;
    return [
      { label: "Total quizzes", value: quizzes.length },
      { label: "Published", value: published },
      { label: "Join codes", value: withJoinCode },
      { label: "Live ready", value: activeSession ? 1 : 0 },
    ];
  }, [activeSession, quizzes]);

  async function refreshQuizzes() {
    const data = await fetchQuizzes();
    setQuizzes(data);
  }

  async function handleTopicSubmit(event) {
    event.preventDefault();

    if (!topicForm.title.trim() || !topicForm.topic.trim()) {
      setStatusText("Title and topic are required.");
      return;
    }

    setLoading(true);
    setStatusText("Sending topic to AI and generating quiz…");

    try {
      const result = await generateQuizFromTopic({
        title: topicForm.title.trim(),
        topic: topicForm.topic.trim(),
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
      });

      if (result.requiresPreferences) {
        setStatusText(result.aiResult.preferencePrompt || "AI needs more preferences.");
        return;
      }

      setStatusText(`Quiz "${result.title}" created with code ${result.joinCode}`);
      setTopicForm(initialTopicForm);
      await refreshQuizzes();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!uploadTitle.trim() || !uploadFile) {
      setStatusText("Upload title and file are required.");
      return;
    }

    setLoading(true);
    setStatusText("Uploading document, extracting text, and sending to AI…");

    try {
      const result = await uploadDocumentForQuiz({
        title: uploadTitle.trim(),
        file: uploadFile,
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
      });

      setStatusText(
        result.aiResult.action === "needs_preferences"
          ? result.aiResult.preferencePrompt
          : result.aiResult.action === "error"
            ? `Document uploaded, but AI analysis failed. ${result.aiResult.message}`
            : `Document processed. AI action: ${result.aiResult.action}`
      );
      setUploadTitle("");
      setUploadFile(null);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  function startQuizForSession(session) {
    if (!session?.joinCode) return;

    setStatusText("Starting live quiz…");

    const playerUrl = `${PLAYER_URL}/live?code=${session.joinCode}`;

    getAdminSocket().emit(
      "host:start-quiz",
      { joinCode: session.joinCode },
      (response) => {
        if (response.ok) {
          setStatusText("Live quiz started! Opening player view…");
          window.open(playerUrl, "_blank");
        } else {
          setStatusText(response.message || "Unable to start.");
        }
      }
    );
  }

  async function handleLaunchSession(quiz) {
    setLoading(true);
    setStatusText(`Launching session for "${quiz.title}"…`);

    try {
      const session = await createLiveSession({ quizId: quiz._id || quiz.id });
      const qr = await fetchSessionQr(session._id || session.id);
      const socket = getAdminSocket();

      socket.emit(
        "room:join",
        { joinCode: session.joinCode, role: "host", name: user?.name || "Host" },
        () => {}
      );

      setActiveSession(session);
      setQrInfo(qr);
      setStatusText(`Session ready — join code ${session.joinCode}`);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card animate-rise">
        <div>
          <p className="eyebrow">Control Center</p>
          <h2>Topic AI, document upload, live session launch, and QR join flow.</h2>
        </div>
        <div className="status-pill">{statusText}</div>
      </section>

      <section className="stats-grid">
        {stats.map((item, index) => (
          <article
            key={item.label}
            className="stat-card animate-rise"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-grid dashboard-grid-wide">
        <form className="panel animate-rise" onSubmit={handleTopicSubmit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AI Topic Generator</p>
              <h3>Create from Topic</h3>
            </div>
          </div>

          <label className="field">
            <span>Quiz title</span>
            <input
              value={topicForm.title}
              onChange={(e) => setTopicForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Fractions Basics"
              required
            />
          </label>

          <label className="field">
            <span>Topic or study material</span>
            <textarea
              value={topicForm.topic}
              onChange={(e) => setTopicForm((f) => ({ ...f, topic: e.target.value }))}
              rows={5}
              placeholder="Enter a topic name or paste study notes"
              required
            />
          </label>

          <div className="inline-fields">
            <label className="field">
              <span>Difficulty</span>
              <select
                value={topicForm.difficulty}
                onChange={(e) => setTopicForm((f) => ({ ...f, difficulty: e.target.value }))}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>

            <label className="field">
              <span>Question count</span>
              <input
                min="1"
                max="20"
                type="number"
                value={topicForm.count}
                onChange={(e) => setTopicForm((f) => ({ ...f, count: e.target.value }))}
              />
            </label>
          </div>

          <button className="primary-button" disabled={loading} type="submit">
            Generate Quiz
          </button>
        </form>

        <form className="panel animate-rise" onSubmit={handleUploadSubmit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Document Flow</p>
              <h3>Upload PDF or DOCX</h3>
            </div>
          </div>

          <label className="field">
            <span>Document title</span>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Chapter 4 Notes"
              required
            />
          </label>

          <label className="field">
            <span>Choose file</span>
            <input
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              type="file"
              required
            />
          </label>

          <button className="primary-button" disabled={loading} type="submit">
            Upload and Analyze
          </button>
        </form>
      </section>

      <section className="dashboard-grid">
        <section className="panel animate-rise">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Published Quizzes</p>
              <h3>Launch a Live Session</h3>
            </div>
          </div>

          <div className="quiz-list">
            {quizzes.length === 0 ? (
              <div className="empty-state">No quizzes yet. Create one above.</div>
            ) : (
              quizzes.map((quiz) => (
                <article className="quiz-item" key={quiz._id || quiz.id}>
                  <div>
                    <h4>{quiz.title}</h4>
                    <p>
                      Code: <strong>{quiz.joinCode}</strong> · {quiz.totalQuestions} questions
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => handleLaunchSession(quiz)}
                    type="button"
                    disabled={loading}
                  >
                    Launch
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel animate-rise">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Join Assets</p>
              <h3>QR and Host Controls</h3>
            </div>
          </div>

          {!activeSession || !qrInfo ? (
            <div className="empty-state">Launch a session to generate its QR code.</div>
          ) : (
            <div className="qr-panel">
              <img alt="Quiz join QR code" className="qr-image" src={qrInfo.qrCodeDataUrl} />
              <p>
                Join code: <strong>{qrInfo.joinCode}</strong>
              </p>
              <a
                className="ghost-link-dark"
                href={qrInfo.joinUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open player join link
              </a>
              <button
                className="primary-button"
                onClick={() => startQuizForSession(activeSession)}
                type="button"
              >
                Start Live Quiz
              </button>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default DashboardPage;
