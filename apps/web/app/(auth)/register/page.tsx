"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../components/auth-provider";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [role, setRole] = useState<"follower" | "master">("follower");
  const [password, setPassword] = useState("");
  const [initialCapital, setInitialCapital] = useState("50000");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const userId = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);

    try {
      await register({
        id: userId,
        name,
        role,
        initialCapital: Number(initialCapital),
        password,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <span className="logo-icon">⚡</span>
        CopyTrade
      </div>

      <h1 className="auth-title">Create your account</h1>
      <p className="auth-subtitle">Start copy-trading in minutes</p>

      {error && (
        <div
          style={{
            background: "var(--red-soft)",
            color: "var(--red)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            className="form-input"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Starting Capital ($)</label>
          <input
            className="form-input"
            type="number"
            placeholder="50000"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            required
            min={1000}
          />
        </div>
        <div className="form-group">
          <label className="form-label">I want to</label>
          <select
            className="form-input"
            value={role}
            onChange={(e) => setRole(e.target.value as "follower" | "master")}
          >
            <option value="follower">Follow &amp; copy master traders</option>
            <option value="master">Become a master trader</option>
          </select>
        </div>
        <div
          style={{ marginBottom: 20, fontSize: 13 }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "start",
              gap: 8,
              color: "var(--text-secondary)",
            }}
          >
            <input type="checkbox" style={{ marginTop: 3 }} required />
            <span>
              I agree to the{" "}
              <a href="#" style={{ color: "var(--accent)" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" style={{ color: "var(--accent)" }}>
                Privacy Policy
              </a>
              . This is a simulation only — not a broker, not investment advice.
            </span>
          </label>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
