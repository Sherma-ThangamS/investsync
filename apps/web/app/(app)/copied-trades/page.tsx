"use client";

import { useEffect, useState } from "react";
import { apiGetTrades, apiGetNotifications } from "../../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function CopiedTradesPage() {
  const [trades, setTrades] = useState<Record<string, unknown>[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGetTrades().catch(() => []),
      apiGetNotifications().catch(() => []),
    ]).then(([t, n]) => {
      setTrades(t);
      setNotifications(n);
    }).finally(() => setLoading(false));
  }, []);

  // Merge: use notifications (which include auto-mirrored trades) as the primary source
  const allExecuted = notifications.filter((n) => n.status === "approved");

  const filtered = allExecuted.filter((t) => {
    if (filter === "buy") return String(t.side).toUpperCase() === "BUY";
    if (filter === "sell") return String(t.side).toUpperCase() === "SELL";
    return true;
  });

  const totalNotional = allExecuted.reduce((s, t) => s + (Number(t.quantity ?? 0) * Number(t.price ?? 0)), 0);
  const buys = allExecuted.filter((t) => String(t.side).toUpperCase() === "BUY").length;
  const sells = allExecuted.filter((t) => String(t.side).toUpperCase() === "SELL").length;

  if (loading) {
    return <div className="page-header"><h1>Copied Trades</h1><p>Loading…</p></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Copied Trades</h1>
        <p>All executed copy trades from your subscriptions — both initial copies and ongoing mirrored trades.</p>
      </div>

      {/* Summary */}
      <div className="flex gap-16 mb-24" style={{ flexWrap: "wrap" }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{allExecuted.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">Total Notional</div>
          <div className="stat-value">{fmt(totalNotional)}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">Buys / Sells</div>
          <div className="stat-value">
            <span className="text-green">{buys}</span>
            <span className="text-muted" style={{ fontSize: 20 }}> / </span>
            <span className="text-red">{sells}</span>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">Engine Mirrored</div>
          <div className="stat-value">{trades.length}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {(["all", "buy", "sell"] as const).map((f) => (
          <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Trades" : f === "buy" ? "BUY Only" : "SELL Only"}
          </button>
        ))}
      </div>

      {/* Trades Table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No Copied Trades Yet</div>
            <p className="text-muted">Follow a master trader — when they trade, you will see mirrored copies here.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Master</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Notional</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const price = Number(t.price ?? 0);
                  const qty = Number(t.quantity ?? 0);
                  const notional = qty * price;
                  const side = String(t.side ?? "").toUpperCase();
                  return (
                    <tr key={String(t.id ?? i)}>
                      <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {t.decidedAt
                          ? new Date(String(t.decidedAt)).toLocaleString()
                          : t.createdAt
                            ? new Date(String(t.createdAt)).toLocaleString()
                            : "—"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{String(t.masterUserId ?? "")}</td>
                      <td style={{ fontWeight: 700 }}>{String(t.symbol ?? "")}</td>
                      <td>
                        <span className={`badge ${side === "BUY" ? "badge-green" : "badge-red"}`}>{side}</span>
                      </td>
                      <td className="font-mono">{qty}</td>
                      <td className="font-mono">${price.toFixed(2)}</td>
                      <td className="font-mono">{fmt(notional)}</td>
                      <td>
                        <span className="badge badge-green">Executed</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between items-center" style={{ marginTop: 20, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Showing {filtered.length} of {allExecuted.length} executed trades
          </span>
        </div>
      </div>
    </>
  );
}

