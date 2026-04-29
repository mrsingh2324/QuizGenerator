import { NavLink, Outlet } from "react-router-dom";

function AdminLayout() {
  const admin = JSON.parse(localStorage.getItem("admin") || "null");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <div className="brand-mark">Q</div>
          <div>
            <p className="eyebrow">Quiz Workspace</p>
            <h1>Formsuite</h1>
          </div>
        </div>
        <nav className="admin-nav">
          <NavLink className="nav-chip" to="/workspace">Workspace</NavLink>
          <NavLink className="nav-chip" to="/create">Create</NavLink>
          <NavLink className="nav-chip" to="/sessions">Live Sessions</NavLink>
          <NavLink className="nav-chip" to="/reports">Reports</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar-dot">{admin?.name?.charAt(0) || "S"}</span>
          <div>
            <strong>{admin?.name || "Satyam Workspace"}</strong>
            <p>{admin?.email || "workspace-admin@quiz.local"}</p>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">Builder Suite</p>
            <strong>Create, launch, and analyze quizzes</strong>
          </div>
          <div className="header-actions">
            <span className="header-pill">Gemini enabled</span>
            <span className="header-pill">Live ready</span>
          </div>
        </header>
        <Outlet />
        <footer className="app-footer">
          <span>Formsuite Workspace</span>
          <span>Templates, AI generation, live sessions, and reports.</span>
        </footer>
      </main>
    </div>
  );
}

export default AdminLayout;
