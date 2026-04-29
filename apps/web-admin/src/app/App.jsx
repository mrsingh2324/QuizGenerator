import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import DashboardPage from "../pages/DashboardPage";
import LoginPage from "../pages/LoginPage";
import QuizHistoryPage from "../pages/QuizHistoryPage";
import QuizReviewPage from "../pages/QuizReviewPage";
import ReportsPage from "../pages/ReportsPage";
import SessionsPage from "../pages/SessionsPage";
import WorkspacePage from "../pages/WorkspacePage";
import { ensureDemoAdmin } from "../services/api";

function RequireAdmin() {
  const [ready, setReady] = useState(Boolean(localStorage.getItem("admin")));
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let active = true;

    async function bootstrapAdmin() {
      if (localStorage.getItem("admin")) {
        return;
      }

      try {
        const admin = await ensureDemoAdmin();
        localStorage.setItem("admin", JSON.stringify(admin));
        if (active) {
          setReady(true);
        }
      } catch (error) {
        if (active) {
          setFailed(error.message || "Could not prepare workspace.");
        }
      }
    }

    bootstrapAdmin();

    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return <Navigate to="/login" replace state={{ error: failed }} />;
  }

  if (!ready) {
    return (
      <main className="login-shell">
        <section className="login-card animate-rise">
          <p className="eyebrow">Preparing Workspace</p>
          <h1>Loading dashboard...</h1>
        </section>
      </main>
    );
  }

  return <AdminLayout />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route path="/" element={<Navigate to="/workspace" replace />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/create" element={<DashboardPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/quizzes/:quizId/history" element={<QuizHistoryPage />} />
        <Route path="/quizzes/:quizId/review" element={<QuizReviewPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
