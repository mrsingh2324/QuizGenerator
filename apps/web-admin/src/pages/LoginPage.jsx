import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createAdmin } from "../services/api";

function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const admin = await createAdmin({ name: name.trim(), email: email.trim() });
      localStorage.setItem("admin", JSON.stringify(admin));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Could not sign in. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card animate-rise">
        <p className="eyebrow">Admin Access</p>
        <h1>Admin Console</h1>
        <p className="support-copy">Enter your name and email to continue as quiz host.</p>

        {error ? <p className="error-text">{error}</p> : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Quiz Creator"
              required
              value={name}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="creator@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Enter Admin Console"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
