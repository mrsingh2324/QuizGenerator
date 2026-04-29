import { Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { disconnectAdminSocket } from "../services/socket";

function AdminLayout() {
  const { user, logout } = useAuth();

  function handleLogout() {
    disconnectAdminSocket();
    logout();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <p className="eyebrow">Quizizz</p>
          <h1>Admin Console</h1>
        </div>

        <nav className="admin-nav">
          <span className="nav-chip active">Dashboard</span>
          <span className="nav-chip">Question Review</span>
          <span className="nav-chip">Live Sessions</span>
          <span className="nav-chip">Reports</span>
        </nav>

        <div className="sidebar-user">
          {user?.avatar && (
            <img className="sidebar-avatar" src={user.avatar} alt={user.name} />
          )}
          {!user?.avatar && (
            <div className="sidebar-avatar-placeholder">
              {(user?.name || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || "Admin"}</span>
            <span className="sidebar-user-email">{user?.email || ""}</span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} type="button" title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
