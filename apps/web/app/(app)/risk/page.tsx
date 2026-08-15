"use client";

import { useEffect, useState } from "react";
import { apiGetRisk, apiUpdateRiskControls } from "../../lib/api";

export default function RiskPage() {
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    apiGetRisk()
      .then((data) => {
        setAlerts(data.alerts);
        setSubscriptions(data.subscriptions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  async function togglePause(subId: string, currentlyPaused: boolean) {
    try {
      await apiUpdateRiskControls(subId, { paused: !currentlyPaused });
      refresh();
    } catch { /* ignore */ }
  }

  const activeAlerts = alerts.filter(
    (a) => a.severity === "high" || a.severity === "critical"
  );
  const healthySubs = subscriptions.filter((s) => {
    const dd = Number(s.currentDrawdownPercent ?? 0);
    const limit = Number((s as Record<string, unknown> & { riskControls?: { maxDrawdownPercent?: number } }).riskControls?.maxDrawdownPercent ?? 1);
    return String(s.status) !== "paused" && (limit > 0 ? dd / limit < 0.4 : true);
  });
  const pausedSubs = subscriptions.filter((s) => {
    const rc = (s as Record<string, unknown> & { riskControls?: { paused?: boolean } }).riskControls;
    return rc?.paused === true;
  });

  if (loading) {
    return <div className="page-header"><h1>🛡️ Risk Manager</h1><p>Loading…</p></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>🛡️ Risk Manager</h1>
        <p>Monitor drawdown levels, alerts, and control risk across all subscriptions.</p>
      </div>

      {/* Alert Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div className="stat-label">Critical / High Alerts</div>
          <div className="stat-value text-red">{activeAlerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">📊</div>
          <div className="stat-label">Total Alerts</div>
          <div className="stat-value">{alerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-label">Healthy Subs</div>
          <div className="stat-value text-green">{healthySubs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">⏸️</div>
          <div className="stat-label">Paused</div>
          <div className="stat-value text-yellow">{pausedSubs.length}</div>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="card mb-24">
        <div className="card-header">
          <div>
            <div className="card-title">Risk Alerts</div>
            <div className="card-subtitle">Real-time monitoring of drawdown thresholds</div>
          </div>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">All Clear</div>
            <p className="text-muted">No risk alerts at this time.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {alerts.map((alert) => (
              <div
                key={String(alert.id)}
                className="flex items-center gap-16"
                style={{
                  padding: "16px",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: `4px solid ${
                    alert.severity === "critical"
                      ? "var(--red)"
                      : alert.severity === "high"
                        ? "var(--yellow)"
                        : alert.severity === "medium"
                          ? "var(--accent)"
                          : "var(--green)"
                  }`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-8 mb-8">
                    <span
                      className={`badge ${
                        alert.severity === "critical"
                          ? "badge-red"
                          : alert.severity === "high"
                            ? "badge-yellow"
                            : alert.severity === "medium"
                              ? "badge-blue"
                              : "badge-green"
                      }`}
                    >
                      {String(alert.severity).toUpperCase()}
                    </span>
                    <span className="badge badge-gray">{String(alert.type ?? "").replace(/_/g, " ")}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{String(alert.message)}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {String(alert.followerName)} → {String(alert.masterName)} · Sub: {String(alert.subscriptionId)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {alert.timestamp ? new Date(String(alert.timestamp)).toLocaleString() : ""}
                  </div>
                  <div className="flex gap-8" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => togglePause(String(alert.subscriptionId), false)}
                    >
                      Pause Sub
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawdown Overview */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Drawdown Monitor</div>
            <div className="card-subtitle">Current drawdown vs. maximum allowed per subscription</div>
          </div>
        </div>
        {subscriptions.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No Subscriptions</div>
            <p className="text-muted">Follow a master trader to start monitoring risk.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Subscription</th>
                  <th>Follower</th>
                  <th>Master</th>
                  <th>Drawdown</th>
                  <th>Limit</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const rc = (sub as Record<string, unknown> & { riskControls?: { maxDrawdownPercent?: number; paused?: boolean } }).riskControls;
                  const dd = Number(sub.currentDrawdownPercent ?? 0);
                  const limit = Number(rc?.maxDrawdownPercent ?? 0);
                  const usage = limit > 0 ? dd / limit : 0;
                  const paused = rc?.paused === true;
                  return (
                    <tr key={String(sub.id)}>
                      <td className="font-mono text-muted" style={{ fontSize: 12 }}>{String(sub.id).slice(0, 8)}</td>
                      <td style={{ fontWeight: 600 }}>{String(sub.followerName ?? sub.followerUserId)}</td>
                      <td>{String(sub.masterName ?? sub.masterUserId)}</td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        {(dd * 100).toFixed(1)}%
                      </td>
                      <td className="font-mono text-muted">
                        {(limit * 100).toFixed(0)}%
                      </td>
                      <td>
                        <div className="flex items-center gap-8">
                          <div className="progress-bar" style={{ width: 80 }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: `${Math.min(usage * 100, 100)}%`,
                                background:
                                  usage > 0.7 ? "var(--red)" : usage > 0.4 ? "var(--yellow)" : "var(--green)",
                              }}
                            />
                          </div>
                          <span
                            className={`${usage > 0.7 ? "text-red" : usage > 0.4 ? "text-yellow" : "text-green"}`}
                            style={{ fontSize: 13, fontWeight: 600 }}
                          >
                            {(usage * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            paused ? "badge-yellow" : "badge-green"
                          }`}
                        >
                          {paused ? "paused" : "active"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-8">
                          <button
                            className={`btn btn-ghost btn-sm ${paused ? "text-green" : ""}`}
                            onClick={() => togglePause(String(sub.id), paused)}
                          >
                            {paused ? "Resume" : "Pause"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
