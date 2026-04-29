import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchQuizzes } from "../services/api";

function getQuizId(quiz) {
  return quiz._id || quiz.id;
}

function WorkspacePage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusText, setStatusText] = useState("Workspace ready.");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const data = await fetchQuizzes();
        if (active) {
          setQuizzes(data);
          setStatusText(`${data.length} quizzes loaded from your workspace.`);
        }
      } catch (error) {
        if (active) {
          setStatusText(error.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  const filteredQuizzes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return quizzes.filter((quiz) => {
      const matchesStatus = statusFilter === "all" || quiz.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        quiz.title?.toLowerCase().includes(normalizedQuery) ||
        quiz.category?.toLowerCase().includes(normalizedQuery) ||
        quiz.joinCode?.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, quizzes, statusFilter]);

  const stats = useMemo(() => {
    const published = quizzes.filter((quiz) => quiz.status === "published").length;
    const drafts = quizzes.filter((quiz) => quiz.status === "draft").length;
    const closed = quizzes.filter((quiz) => quiz.status === "closed").length;
    const questions = quizzes.reduce((total, quiz) => total + (quiz.totalQuestions || 0), 0);

    return [
      { label: "All quizzes", value: quizzes.length },
      { label: "Published", value: published },
      { label: "Drafts", value: drafts },
      { label: "Questions", value: questions },
      { label: "Closed", value: closed },
    ];
  }, [quizzes]);

  const recentQuizzes = filteredQuizzes.slice(0, 8);

  return (
    <div className="workspace-page">
      <section className="workspace-topbar">
        <div>
          <p className="eyebrow">My Workspace</p>
          <h2>Quiz dashboard</h2>
        </div>
        <div className="workspace-actions">
          <label className="search-box">
            <span>Search</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search quizzes, codes, categories"
              value={query}
            />
          </label>
          <Link className="primary-button" to="/create">
            Create Quiz
          </Link>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="workspace-panel folder-panel">
          <p className="eyebrow">Folders</p>
          <button
            className={statusFilter === "all" ? "folder-item active" : "folder-item"}
            onClick={() => setStatusFilter("all")}
            type="button"
          >
            All items
            <span>{quizzes.length}</span>
          </button>
          <button
            className={statusFilter === "draft" ? "folder-item active" : "folder-item"}
            onClick={() => setStatusFilter("draft")}
            type="button"
          >
            Drafts
            <span>{quizzes.filter((quiz) => quiz.status === "draft").length}</span>
          </button>
          <button
            className={statusFilter === "published" ? "folder-item active" : "folder-item"}
            onClick={() => setStatusFilter("published")}
            type="button"
          >
            Published
            <span>{quizzes.filter((quiz) => quiz.status === "published").length}</span>
          </button>
          <button
            className={statusFilter === "closed" ? "folder-item active" : "folder-item"}
            onClick={() => setStatusFilter("closed")}
            type="button"
          >
            Closed
            <span>{quizzes.filter((quiz) => quiz.status === "closed").length}</span>
          </button>
        </aside>

        <div className="workspace-content">
          <section className="quick-create-grid">
            <Link className="quick-create-card" to="/create">
              <span className="quick-icon">AI</span>
              <div>
                <strong>Generate with Gemini</strong>
                <p>Create a quiz from a topic or notes.</p>
              </div>
            </Link>
            <Link className="quick-create-card" to="/create">
              <span className="quick-icon">DOC</span>
              <div>
                <strong>Import document</strong>
                <p>Upload PDF or DOCX and review questions.</p>
              </div>
            </Link>
            <Link className="quick-create-card" to="/sessions">
              <span className="quick-icon">LIVE</span>
              <div>
                <strong>Run live session</strong>
                <p>Launch QR and join-code based quizzes.</p>
              </div>
            </Link>
          </section>

          <section className="stats-strip">
            {stats.map((item) => (
              <article className="metric-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </section>

          <section className="workspace-panel">
            <div className="table-heading">
              <div>
                <p className="eyebrow">Recent Forms</p>
                <h3>Quizzes</h3>
              </div>
              <span className="status-note">{loading ? "Loading..." : statusText}</span>
            </div>

            {recentQuizzes.length === 0 ? (
              <div className="empty-state">
                No quizzes match this view. Create a quiz or change the filter.
              </div>
            ) : (
              <div className="workspace-table">
                <div className="workspace-row workspace-row-head">
                  <span>Name</span>
                  <span>Status</span>
                  <span>Join code</span>
                  <span>Questions</span>
                  <span>Actions</span>
                </div>
                {recentQuizzes.map((quiz) => (
                  <div className="workspace-row" key={getQuizId(quiz)}>
                    <div>
                      <strong>{quiz.title}</strong>
                      <p>{quiz.category || "general"}</p>
                    </div>
                    <span className={`status-badge status-${quiz.status}`}>{quiz.status}</span>
                    <span>{quiz.joinCode || "-"}</span>
                    <span>{quiz.totalQuestions || 0}</span>
                    <div className="row-actions">
                      <button
                        className="secondary-button compact-button"
                        onClick={() => navigate(`/quizzes/${getQuizId(quiz)}/review`, { state: { quiz } })}
                        type="button"
                      >
                        Review
                      </button>
                      <button
                        className="ghost-button compact-button"
                        onClick={() => navigate(`/quizzes/${getQuizId(quiz)}/history`, { state: { quiz } })}
                        type="button"
                      >
                        Launch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

export default WorkspacePage;
