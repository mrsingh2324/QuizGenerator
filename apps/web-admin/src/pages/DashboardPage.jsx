import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createLiveSession,
  createQuiz,
  fetchQuizzes,
  fetchSessionQr,
  generateQuizFromTopic,
  uploadDocumentForQuiz,
} from "../services/api";
import { getAdminSocket } from "../services/socket";
import quizTemplates from "../data/quizTemplates";

const initialTopicForm = {
  title: "",
  topic: "",
  difficulty: "medium",
  count: 5,
};

function DashboardPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [topicForm, setTopicForm] = useState(initialTopicForm);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [statusText, setStatusText] = useState("Create a quiz from topic text or upload a document.");
  const [preferencePrompt, setPreferencePrompt] = useState("");
  const [preferenceSource, setPreferenceSource] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [qrInfo, setQrInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const adminId = admin?._id || admin?.id;

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const storedAdmin = JSON.parse(localStorage.getItem("admin") || "null");

        if (!storedAdmin?._id && !storedAdmin?.id) {
          navigate("/login", { replace: true });
          return;
        }

        const loadedQuizzes = await fetchQuizzes();

        if (!active) {
          return;
        }

        setAdmin(storedAdmin);
        setQuizzes(loadedQuizzes);
      } catch (error) {
        if (active) {
          setStatusText(error.message);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!activeSession?.joinCode) {
      return undefined;
    }

    const socket = getAdminSocket();
    const activeJoinCode = activeSession.joinCode;

    function handlePresence(payload) {
      if (payload?.joinCode === activeJoinCode) {
        setParticipantCount(payload.participantsConnected || 0);
      }
    }

    function handleParticipantJoined(payload) {
      setParticipantCount((payload?.participants || []).length);
    }

    socket.on("room:presence", handlePresence);
    socket.on("room:participant-joined", handleParticipantJoined);

    return () => {
      socket.off("room:presence", handlePresence);
      socket.off("room:participant-joined", handleParticipantJoined);
    };
  }, [activeSession?.joinCode]);

  const stats = useMemo(() => {
    const published = quizzes.filter((quiz) => quiz.status === "published").length;
    const drafts = quizzes.filter((quiz) => quiz.status === "draft").length;

    return [
      { label: "Total quizzes", value: quizzes.length },
      { label: "Published", value: published },
      { label: "Drafts", value: drafts },
      { label: "Live ready", value: activeSession ? 1 : 0 },
    ];
  }, [activeSession, quizzes]);

  const publishedQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.status === "published"),
    [quizzes]
  );

  async function refreshQuizzes() {
    const data = await fetchQuizzes();
    setQuizzes(data);
  }

  async function handleTemplateCreate(template) {
    if (!admin) {
      setStatusText("Admin profile is still loading.");
      return;
    }

    setLoading(true);
    setStatusText(`Creating draft from ${template.title} template...`);

    try {
      const result = await createQuiz({
        title: template.title,
        description: template.description,
        category: template.category,
        adminId,
        questions: template.questions.map((question) => ({
          ...question,
          sourceType: "manual",
        })),
        status: "draft",
        questionTimeLimitSeconds: 20,
        resultsWindowSeconds: 5,
      });

      setStatusText(`Draft "${result.title}" created from template. Review it before publishing.`);
      navigate(`/quizzes/${result._id || result.id}/review`, { state: { quiz: result } });
      await refreshQuizzes();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTopicSubmit(event) {
    event.preventDefault();

    if (!admin) {
      setStatusText("Admin profile is still loading.");
      return;
    }

    if (!topicForm.title.trim() || !topicForm.topic.trim()) {
      setStatusText("Title and topic are required.");
      return;
    }

    setLoading(true);
    setStatusText("Sending topic to AI and generating quiz...");
    setPreferencePrompt("");
    setPreferenceSource("");

    try {
      const result = await generateQuizFromTopic({
        title: topicForm.title.trim(),
        topic: topicForm.topic.trim(),
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
        adminId,
      });

      if (result.requiresPreferences) {
        const prompt = result.aiResult.preferencePrompt || "Choose a difficulty and question count, then submit again.";
        setPreferencePrompt(prompt);
        setPreferenceSource("topic");
        setStatusText("AI needs more quiz preferences before it can generate questions.");
        return;
      }

      setStatusText(`Draft "${result.title}" created. Review it before publishing.`);
      setTopicForm(initialTopicForm);
      navigate(`/quizzes/${result._id || result.id}/review`, { state: { quiz: result } });
      await refreshQuizzes();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleStartQuiz() {
    if (activeSession) {
      startQuizForSession(activeSession);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!admin) {
      setStatusText("Admin profile is still loading.");
      return;
    }

    if (!uploadTitle.trim() || !uploadFile) {
      setStatusText("Upload title and file are required.");
      return;
    }

    setLoading(true);
    setStatusText("Uploading document, extracting text, and sending it to AI...");
    setPreferencePrompt("");
    setPreferenceSource("");

    try {
      const result = await uploadDocumentForQuiz({
        admin: adminId,
        title: uploadTitle.trim(),
        file: uploadFile,
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
      });

      if (result.draftQuiz) {
        setStatusText(`Draft "${result.draftQuiz.title}" created. Review it before publishing.`);
        setUploadTitle("");
        setUploadFile(null);
        navigate(`/quizzes/${result.draftQuiz._id || result.draftQuiz.id}/review`, {
          state: { quiz: result.draftQuiz },
        });
        await refreshQuizzes();
        return;
      }

      if (result.aiResult.action === "needs_preferences") {
        setPreferencePrompt(
          result.aiResult.preferencePrompt || "Choose a difficulty and question count, then upload again."
        );
        setPreferenceSource("document");
      }

      setStatusText(
        result.aiResult.action === "needs_preferences"
          ? "AI needs more quiz preferences before it can generate questions."
          : result.aiResult.action === "error"
            ? `Document uploaded, but AI analysis failed. ${result.aiResult.message}${result.aiResult.details ? ` ${result.aiResult.details}` : ""}`
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

  async function handleLaunchSession(quiz) {
    if (!admin) {
      return;
    }

    setStatusText(`Launching session for ${quiz.title}...`);

    try {
      const session = await createLiveSession({
        quizId: quiz._id || quiz.id,
        hostId: adminId,
      });

      const qr = await fetchSessionQr(session._id || session.id);
      const socket = getAdminSocket();

      socket.emit(
        "room:join",
        {
          joinCode: session.joinCode,
          role: "host",
          name: admin.name,
        },
        (response) => {
          if (response?.ok) {
            setParticipantCount(response.data?.participantsConnected || 0);
          }
        }
      );

      setActiveSession(session);
      setParticipantCount(session.participantCount || 0);
      setQrInfo(qr);
      setStatusText(`Session ready. Join code ${session.joinCode}`);
    } catch (error) {
      setStatusText(error.message);
    }
  }

  function startQuizForSession(session) {
    if (!session?.joinCode) {
      return;
    }

    setStatusText("Starting live quiz...");

    getAdminSocket().emit(
      "host:start-quiz",
      { joinCode: session.joinCode },
      (response) => {
        if (response.ok) {
          setActiveSession((current) =>
            current ? { ...current, status: "question_live" } : current
          );
          setStatusText("Live quiz started.");
        } else {
          setStatusText(response.message || "Unable to start.");
        }
      }
    );
  }

  return (
    <div className="page-stack">
      <section className="create-hero animate-rise">
        <div>
          <p className="eyebrow">Create Center</p>
          <h2>Start from AI, an uploaded document, or a ready-made template.</h2>
          <p className="support-copy">
            Choose the fastest path, then review questions before publishing.
          </p>
        </div>
        <div className="status-pill">{statusText}</div>
      </section>

      <section className="workspace-panel animate-rise">
        <div className="table-heading">
          <div>
            <p className="eyebrow">Template Gallery</p>
            <h3>Start with a quiz template</h3>
          </div>
          <span className="status-note">{quizTemplates.length} templates available</span>
        </div>
        <div className="template-grid">
          {quizTemplates.map((template) => (
            <article
              className="template-card"
              key={template.id}
              style={{ "--template-accent": template.accent }}
            >
              <div className="template-card-top">
                <span className="template-icon">{template.category.slice(0, 2).toUpperCase()}</span>
                <span className="status-badge">{template.level}</span>
              </div>
              <h4>{template.title}</h4>
              <p>{template.description}</p>
              <div className="template-meta">
                <span>{template.category}</span>
                <span>{template.questions.length} questions</span>
              </div>
              <button
                className="primary-button"
                disabled={loading}
                onClick={() => handleTemplateCreate(template)}
                type="button"
              >
                {loading ? <span className="spinner-label"><span className="spinner" /> Creating</span> : "Use Template"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((item, index) => (
          <article key={item.label} className="stat-card animate-rise" style={{ animationDelay: `${index * 80}ms` }}>
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
              onChange={(event) =>
                setTopicForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Fractions Basics"
              required
            />
          </label>

          <label className="field">
            <span>Topic or study material</span>
            <textarea
              value={topicForm.topic}
              onChange={(event) =>
                setTopicForm((current) => ({ ...current, topic: event.target.value }))
              }
              rows={5}
              placeholder="Enter a topic name or paste study notes"
              required
            />
          </label>

          {preferencePrompt && preferenceSource === "topic" ? (
            <div className="preference-callout">
              <p className="eyebrow">AI preference request</p>
              <p>{preferencePrompt}</p>
            </div>
          ) : null}

          <div className="inline-fields">
            <label className="field">
              <span>Difficulty</span>
              <select
                value={topicForm.difficulty}
                onChange={(event) =>
                  setTopicForm((current) => ({ ...current, difficulty: event.target.value }))
                }
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
                onChange={(event) =>
                  setTopicForm((current) => ({ ...current, count: event.target.value }))
                }
              />
            </label>
          </div>

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <span className="spinner-label"><span className="spinner" /> Generating</span> : "Generate Quiz"}
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
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Chapter 4 Notes"
              required
            />
          </label>

          <label className="field">
            <span>Choose file</span>
            <input
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              type="file"
              required
            />
          </label>

          {preferencePrompt && preferenceSource === "document" ? (
            <div className="preference-callout">
              <p className="eyebrow">AI preference request</p>
              <p>{preferencePrompt}</p>
            </div>
          ) : null}

          <div className="inline-fields">
            <label className="field">
              <span>Difficulty</span>
              <select
                value={topicForm.difficulty}
                onChange={(event) =>
                  setTopicForm((current) => ({ ...current, difficulty: event.target.value }))
                }
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
                onChange={(event) =>
                  setTopicForm((current) => ({ ...current, count: event.target.value }))
                }
                type="number"
                value={topicForm.count}
              />
            </label>
          </div>

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <span className="spinner-label"><span className="spinner" /> Analyzing</span> : "Upload and Analyze"}
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
            {publishedQuizzes.length === 0 ? (
              <div className="empty-state">No published quizzes yet. Review and publish a draft first.</div>
            ) : (
              publishedQuizzes.map((quiz) => (
                <article className="quiz-item" key={quiz._id || quiz.id}>
                  <div>
                    <h4>{quiz.title}</h4>
                    <p>
                      Code: <strong>{quiz.joinCode}</strong> • {quiz.totalQuestions} questions
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => handleLaunchSession(quiz)}
                    type="button"
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
              <a className="ghost-link-dark" href={qrInfo.joinUrl} target="_blank" rel="noreferrer">
                Open player join link
              </a>
              <button className="primary-button" onClick={handleStartQuiz} type="button">
                Start Live Quiz
              </button>
              <p className="support-copy">
                Participants joined: <strong>{participantCount}</strong>
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default DashboardPage;
