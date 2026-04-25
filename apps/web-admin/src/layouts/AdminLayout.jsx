import { Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <p className="eyebrow">Quizizz Clone</p>
          <h1>Admin Console</h1>
        </div>
        <nav className="admin-nav">
          <span className="nav-chip active">Dashboard</span>
          <span className="nav-chip">Question Review</span>
          <span className="nav-chip">Live Sessions</span>
          <span className="nav-chip">Reports</span>
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
