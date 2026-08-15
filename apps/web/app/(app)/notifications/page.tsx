"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../components/auth-provider";
import {
  apiGetNotifications,
  apiApproveNotification,
  apiRejectNotification,
} from "../../lib/api";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiGetNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function handleApprove(id: string) {
    await apiApproveNotification(id);
    load();
  }

  async function handleReject(id: string) {
    await apiRejectNotification(id);
    load();
  }

  const pending = notifications.filter((n) => n.status === "pending");
  const history = notifications.filter((n) => n.status !== "pending");

  return (
    <>
      <div className="page-header">
        <h1>🔔 Trade Notifications</h1>
        <p>Master trade signals awaiting your approval. You have {pending.length} pending.</p>
      </div>

      {/* Pending Notifications */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Pending Approvals</div>
            <div className="card-subtitle">Approve within the timeout to mirror the trade</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p>No pending trade notifications</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, padding: 16 }}>
            {pending.map((n) => (
              <div key={String(n.id)} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {String(n.side).toUpperCase()} {String(n.quantity)} {String(n.symbol)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Price: ${Number(n.price).toFixed(2)} · From: {String(n.masterUserId)} · Timeout: {String(n.timeoutSec)}s
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(String(n.id))}>
                    ✓ Approve
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleReject(String(n.id))}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Notification History</div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Trade</th>
                <th>Master</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No history</td></tr>
              ) : (
                history.map((n) => (
                  <tr key={String(n.id)}>
                    <td style={{ fontWeight: 600 }}>
                      {String(n.side).toUpperCase()} {String(n.quantity)} {String(n.symbol)} @ ${Number(n.price).toFixed(2)}
                    </td>
                    <td>{String(n.masterUserId)}</td>
                    <td>
                      <span className={`badge ${n.status === "approved" ? "badge-green" : n.status === "rejected" ? "badge-red" : "badge-yellow"}`}>
                        {String(n.status)}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {n.decidedAt ? new Date(String(n.decidedAt)).toLocaleString() : new Date(String(n.createdAt)).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
