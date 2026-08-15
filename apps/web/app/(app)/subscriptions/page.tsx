"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiGetSubscriptions, apiUpdateRiskControls, apiGetSubscriptionPositions } from "../../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface SubPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Record<string, unknown>[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [positionsData, setPositionsData] = useState<Record<string, { positions: SubPosition[]; cash: number; equity: number; pnl: number }>>({});

  useEffect(() => {
    if (user?.id) {
      apiGetSubscriptions(user.id).then(setSubs).catch(() => {});
    }
  }, [user?.id]);

  async function togglePause(subId: string, currentlyPaused: boolean) {
    await apiUpdateRiskControls(subId, { paused: !currentlyPaused });
    if (user?.id) apiGetSubscriptions(user.id).then(setSubs);
  }

  async function toggleExpand(subId: string) {
    if (expanded === subId) {
      setExpanded(null);
      return;
    }
    setExpanded(subId);
    if (!positionsData[subId]) {
      try {
        const data = await apiGetSubscriptionPositions(subId) as Record<string, unknown>;
        setPositionsData((prev) => ({
          ...prev,
          [subId]: {
            positions: (data.positions ?? []) as SubPosition[],
            cash: Number(data.cash ?? 0),
            equity: Number(data.equity ?? 0),
            pnl: Number(data.pnl ?? 0),
          },
        }));
      } catch { /* ignore */ }
    }
  }

  const followSubs = subs.filter((s) => String(s.mode ?? "follow") === "follow");
  const snapshotSubs = subs.filter((s) => String(s.mode ?? "follow") === "snapshot");

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>Subscription Breakdown</h1>
            <p>Manage your subscriptions. Click any subscription to see its stock positions.</p>
          </div>
          <Link href="/masters" className="btn btn-primary">+ New Subscription</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-label">Total</div>
          <div className="stat-value">{subs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📡</div>
          <div className="stat-label">Follow (Ongoing)</div>
          <div className="stat-value text-green">{followSubs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📸</div>
          <div className="stat-label">Snapshot (One-Time)</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{snapshotSubs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">💰</div>
          <div className="stat-label">Total Allocated</div>
          <div className="stat-value">{fmt(subs.reduce((sum, s) => sum + Number(s.allocatedCapital ?? 0), 0))}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All Subscriptions</div>
        </div>

        {subs.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No Subscriptions</div>
            <p className="text-muted">Browse <Link href="/masters">Master Traders</Link> to start</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 0 }}>
            {subs.map((sub) => {
              const rc = sub.riskControls as Record<string, unknown> | undefined;
              const paused = Boolean(rc?.paused);
              const mode = String(sub.mode ?? "follow");
              const subId = String(sub.id);
              const isExpanded = expanded === subId;
              const detail = positionsData[subId];
              const positions = (sub.positions ?? []) as SubPosition[];
              const inlinePositions = positions.length > 0 ? positions : detail?.positions ?? [];

              return (
                <div key={subId} style={{ borderBottom: "1px solid var(--border)" }}>
                  {/* Subscription Row — clickable */}
                  <div
                    onClick={() => toggleExpand(subId)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto",
                      gap: 12,
                      padding: "16px",
                      cursor: "pointer",
                      background: isExpanded ? "var(--bg-secondary)" : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{String(sub.masterDisplayName ?? sub.masterUserId)}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{subId.slice(0, 8)}…</div>
                    </div>
                    <div>
                      <span className={`badge ${mode === "follow" ? "badge-blue" : "badge-purple"}`}>
                        {mode === "follow" ? "📡 Follow" : "📸 Snapshot"}
                      </span>
                    </div>
                    <div className="font-mono">{fmt(Number(sub.allocatedCapital ?? 0))}</div>
                    <div className={`font-mono ${Number(sub.currentPnl ?? 0) >= 0 ? "text-green" : "text-red"}`}>
                      {Number(sub.currentPnl ?? 0) >= 0 ? "+" : ""}{fmt(Number(sub.currentPnl ?? 0))}
                    </div>
                    <div>
                      <span className={`badge ${paused ? "badge-yellow" : "badge-green"}`}>
                        {paused ? "Paused" : "Active"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); togglePause(subId, paused); }}
                      >
                        {paused ? "▶️" : "⏸️"}
                      </button>
                      <span style={{ color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded — Stock Positions */}
                  {isExpanded && (
                    <div style={{ padding: "0 16px 16px", background: "var(--bg-secondary)" }}>
                      {inlinePositions.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                          No positions in this subscription yet.
                        </div>
                      ) : (
                        <div className="table-container">
                          <table>
                            <thead>
                              <tr><th>Symbol</th><th>Name</th><th>Shares</th><th>Avg Price</th><th>Current</th><th>Value</th><th>P&L</th></tr>
                            </thead>
                            <tbody>
                              {inlinePositions.map((p) => (
                                <tr key={p.symbol}>
                                  <td style={{ fontWeight: 700 }}>{p.symbol}</td>
                                  <td>{p.name}</td>
                                  <td className="font-mono">{p.quantity}</td>
                                  <td className="font-mono">${p.avgPrice.toFixed(2)}</td>
                                  <td className="font-mono">${p.currentPrice.toFixed(2)}</td>
                                  <td className="font-mono">{fmt(p.marketValue)}</td>
                                  <td className={`font-mono ${p.pnl >= 0 ? "text-green" : "text-red"}`}>
                                    {p.pnl >= 0 ? "+" : ""}{fmt(p.pnl)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {detail && (
                        <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                          <span>Cash: <strong>{fmt(detail.cash)}</strong></span>
                          <span>Equity: <strong>{fmt(detail.equity)}</strong></span>
                          <span className={detail.pnl >= 0 ? "text-green" : "text-red"}>
                            P&L: <strong>{detail.pnl >= 0 ? "+" : ""}{fmt(detail.pnl)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
