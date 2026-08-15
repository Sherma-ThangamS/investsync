"use client";

import { useEffect, useState } from "react";
import { apiGetProfile, apiUpdateProfile } from "../../lib/api";
import { useAuth } from "../../components/auth-provider";

export default function SettingsPage() {
  const { user } = useAuth();
  const [volatility, setVolatility] = useState(50);
  const [riskScore, setRiskScore] = useState(50);
  const [leverage, setLeverage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiGetProfile()
      .then((p) => {
        if (p.volatilityTolerance != null) setVolatility(Number(p.volatilityTolerance));
        if (p.riskScore != null) setRiskScore(Number(p.riskScore));
        if (p.leverage != null) setLeverage(Number(p.leverage));
      })
      .catch(() => {});
  }, []);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    try {
      await apiUpdateProfile({ volatilityTolerance: volatility, riskScore, leverage });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account, preferences, and platform configuration.</p>
      </div>

      {/* Profile Section */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">Profile</div>
        </div>
        <div className="flex gap-24" style={{ flexWrap: "wrap" }}>
          <div>
            <div className="user-avatar" style={{ width: 80, height: 80, fontSize: 28 }}>
              {(user?.name ?? "U").split(" ").map((w) => w[0]).join("")}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">User ID</label>
                <input className="form-input" type="text" defaultValue={user?.id ?? ""} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" type="text" defaultValue={user?.name ?? ""} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <input className="form-input" type="text" defaultValue={user?.role ?? ""} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Capital</label>
                <input className="form-input" type="text" defaultValue={`$${(user?.initialCapital ?? 0).toLocaleString()}`} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MARA Profile Settings */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">MARA Profile — Risk & Volatility</div>
          <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Profile"}
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
          These values feed into the MARA algorithm (Qadj = Qbase × C × V × R) to size copied trades proportionally.
        </p>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Volatility Tolerance (0–100)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="100"
              value={volatility}
              onChange={(e) => setVolatility(Number(e.target.value))}
            />
            <span className="text-muted" style={{ fontSize: 12 }}>
              Higher values tolerate more volatility in copied trades
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Risk Score (0–100)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="100"
              value={riskScore}
              onChange={(e) => setRiskScore(Number(e.target.value))}
            />
            <span className="text-muted" style={{ fontSize: 12 }}>
              Overall risk appetite — used as the R factor in MARA
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Leverage Multiplier</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="20"
              step="0.5"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
            />
            <span className="text-muted" style={{ fontSize: 12 }}>
              ×{leverage} — used for position safety cap (FreeMargin × Leverage / Price)
            </span>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">Security</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="flex justify-between items-center" style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 600 }}>Password</div>
              <div className="text-muted" style={{ fontSize: 13 }}>Stored using scrypt hashing</div>
            </div>
            <span className="badge badge-green">Secure</span>
          </div>
          <div className="flex justify-between items-center" style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 600 }}>Intent-Based Auth</div>
              <div className="text-muted" style={{ fontSize: 13 }}>SHA-256 trade intents with 60s TTL</div>
            </div>
            <span className="badge badge-blue">Active</span>
          </div>
          <div className="flex justify-between items-center" style={{ padding: "14px 0" }}>
            <div>
              <div style={{ fontWeight: 600 }}>Merkle Tree Audit</div>
              <div className="text-muted" style={{ fontSize: 13 }}>Proof-of-Execution for all trades</div>
            </div>
            <span className="badge badge-blue">Active</span>
          </div>
        </div>
      </div>

      {/* Notifications Preferences (static display) */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">Notifications</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { label: "Trade Executed", desc: "When a master trade is mirrored to your account", default_: true },
            { label: "Drawdown Alert", desc: "When drawdown exceeds warning threshold", default_: true },
            { label: "Fee Charged", desc: "When performance or subscription fee is accrued", default_: true },
            { label: "Subscription Changes", desc: "When a subscription is paused or stopped", default_: true },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center" style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div className="text-muted" style={{ fontSize: 13 }}>{item.desc}</div>
              </div>
              <span className="badge badge-green">Enabled</span>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Info */}
      <div className="card" style={{ borderColor: "var(--border)" }}>
        <div className="card-header">
          <div className="card-title">Platform Info</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
          <div className="flex justify-between">
            <span className="text-muted">Mode</span>
            <span className="badge badge-blue">Simulation Only</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Default Broker</span>
            <span>Paper Trading (built-in)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Position Sizing</span>
            <span>MARA Algorithm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Audit</span>
            <span>Merkle Tree Ledger</span>
          </div>
        </div>
      </div>
    </>
  );
}
