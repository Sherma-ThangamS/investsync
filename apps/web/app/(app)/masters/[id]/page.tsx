"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatCard from "../../../components/stat-card";
import {
  apiGetMasterDetail,
  apiGetMinFollow,
  apiFollowMasterWithMode,
} from "../../../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface MinFollowInfo {
  minAmount: number;
  step: number;
  positions: Array<{ symbol: string; name: string; quantity: number; price: number; value: number }>;
}

export default function MasterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMode, setActionMode] = useState<"follow" | "snapshot" | null>(null);
  const [minInfo, setMinInfo] = useState<MinFollowInfo | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiGetMasterDetail(id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function openAction(mode: "follow" | "snapshot") {
    setActionMode(mode);
    setMultiplier(1);
    try {
      const info = await apiGetMinFollow(id);
      setMinInfo(info);
    } catch {
      setMinInfo({ minAmount: 0, step: 0, positions: [] });
    }
  }

  async function handleConfirm() {
    if (!actionMode) return;
    setBusy(true);
    const capital = minInfo && minInfo.step > 0 ? minInfo.step * multiplier : 10000;
    try {
      await apiFollowMasterWithMode(id, capital, actionMode);
      setMsg(actionMode === "follow"
        ? `Now following with $${capital.toFixed(2)}! Trades will be mirrored.`
        : `Snapshot copied with $${capital.toFixed(2)}!`);
      setActionMode(null);
      const fresh = await apiGetMasterDetail(id);
      setData(fresh);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    }
    setBusy(false);
  }

  if (loading) {
    return <div className="page-header"><h1>Master Detail</h1><p>Loading…</p></div>;
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Master Not Found</div>
        <p className="text-muted">{error || "The trader you're looking for doesn't exist."}</p>
        <Link href="/masters" className="btn btn-primary mt-24">← Back to Masters</Link>
      </div>
    );
  }

  const master = data.master as Record<string, unknown>;
  const subs = (data.subscriptions ?? []) as Record<string, unknown>[];
  const trades = (data.trades ?? []) as Record<string, unknown>[];
  const fees = (data.fees ?? []) as Record<string, unknown>[];
  const stats = (data.stats ?? {}) as Record<string, unknown>;

  const displayName = String(master.displayName ?? master.userId ?? "");
  const perfFee = Number(master.performanceFeePercent ?? 0);
  const subFee = Number(master.monthlySubscriptionFee ?? 0);
  const strategy = String(master.strategyDescription ?? "—");
  const totalFees = Number(stats.totalFees ?? fees.reduce((s, f) => s + Number(f.amount ?? 0), 0));

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        <Link href="/masters" style={{ color: "var(--text-secondary)" }}>Masters</Link>
        {" / "}
        <span style={{ color: "var(--text-primary)" }}>{displayName}</span>
      </div>

      {msg && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: "var(--accent)" }}>
          {msg}
          <button style={{ marginLeft: 12, cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }} onClick={() => setMsg("")}>✕</button>
        </div>
      )}

      {/* Profile Header */}
      <div className="card mb-24">
        <div className="flex gap-24 items-center" style={{ flexWrap: "wrap" }}>
          <div className="master-card-avatar" style={{ width: 72, height: 72, fontSize: 28 }}>
            {displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{displayName}</h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{strategy}</p>
            <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
              <span className="badge badge-blue">Perf Fee: {perfFee}%</span>
              <span className="badge badge-green">Sub Fee: ${subFee}/mo</span>
            </div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={() => openAction("follow")} disabled={busy}>
              📡 Follow
            </button>
            <button className="btn btn-secondary" onClick={() => openAction("snapshot")} disabled={busy}>
              📸 Snapshot Copy
            </button>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      {actionMode && (
        <div className="card mb-24" style={{ padding: 24, borderColor: "var(--accent)" }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            {actionMode === "follow" ? "📡 Follow (Ongoing Copy)" : "📸 Snapshot Copy (One-Time)"}
          </div>

          {minInfo && minInfo.positions.length > 0 ? (
            <>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                Minimum lot based on portfolio ratio ({minInfo.positions.length} stocks):
              </div>
              <div className="table-container" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Symbol</th><th>Name</th><th>Shares</th><th>Price</th><th>Value</th></tr></thead>
                  <tbody>
                    {minInfo.positions.map((p) => (
                      <tr key={p.symbol}>
                        <td style={{ fontWeight: 700 }}>{p.symbol}</td>
                        <td>{p.name}</td>
                        <td className="font-mono">{p.quantity * multiplier}</td>
                        <td className="font-mono">${p.price.toFixed(2)}</td>
                        <td className="font-mono">${(p.value * multiplier).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Step:</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setMultiplier(Math.max(1, multiplier - 1))}>−</button>
                <span style={{ fontWeight: 700, fontSize: 20, minWidth: 30, textAlign: "center" }}>{multiplier}×</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setMultiplier(multiplier + 1)}>+</button>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
                  Total: ${(minInfo.step * multiplier).toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 16, color: "var(--text-muted)" }}>
              Master has no open positions yet. Capital will be held until they start trading.
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={busy}>
              {busy ? "Processing…" : actionMode === "follow" ? "📡 Confirm Follow" : "📸 Confirm Snapshot"}
            </button>
            <button className="btn btn-secondary" onClick={() => { setActionMode(null); setMinInfo(null); }}>Cancel</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
            {actionMode === "follow"
              ? "ℹ️ Follow = ongoing. Master's future trades will be reflected in your portfolio using MARA."
              : "ℹ️ Snapshot = one-time copy. Future master trades will NOT be reflected."}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon="👥" iconColor="blue" label="Followers" value={String(stats.followerCount ?? subs.length)} />
        <StatCard icon="📊" iconColor="green" label="Total Trades" value={String(stats.totalTrades ?? trades.length)} />
        <StatCard icon="💰" iconColor="yellow" label="Total Fees Earned" value={fmt(totalFees)} />
        <StatCard icon="📈" iconColor="purple" label="Active Subs" value={String(subs.length)} />
      </div>

      {/* Two-column: Followers + Fee Info */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Followers ({subs.length})</div>
          </div>
          {subs.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <p className="text-muted">No followers yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Follower</th><th>Capital</th><th>Mode</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const paused = (s as Record<string, unknown> & { riskControls?: { paused?: boolean } }).riskControls?.paused;
                    const mode = String(s.mode ?? "follow");
                    return (
                      <tr key={String(s.id)}>
                        <td style={{ fontWeight: 600 }}>{String(s.followerUserId)}</td>
                        <td className="font-mono">{fmt(Number(s.allocatedCapital ?? 0))}</td>
                        <td>
                          <span className={`badge ${mode === "follow" ? "badge-blue" : "badge-purple"}`}>
                            {mode === "follow" ? "📡 Follow" : "📸 Snapshot"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${paused ? "badge-yellow" : "badge-green"}`}>
                            {paused ? "paused" : "active"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Fee Structure</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Performance Fee</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Charged on follower profits</div>
              </div>
              <span className="badge badge-green">{perfFee}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Monthly Fee</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Flat monthly fee</div>
              </div>
              <span className="badge badge-blue">${subFee}/mo</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Total Fees Earned</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>All-time across {subs.length} followers</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{fmt(totalFees)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="card mt-24">
        <div className="card-header">
          <div className="card-title">Recent Trades</div>
          <Link href="/copied-trades" className="btn btn-ghost btn-sm">View all →</Link>
        </div>
        {trades.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <p className="text-muted">No trades recorded yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Notional</th></tr>
              </thead>
              <tbody>
                {trades.slice(0, 8).map((t, i) => {
                  const side = String(t.side ?? "").toUpperCase();
                  const qty = Number(t.quantity ?? 0);
                  const price2 = Number(t.price ?? 0);
                  return (
                    <tr key={String(t.id ?? i)}>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {t.createdAt ? new Date(String(t.createdAt)).toLocaleString() : "—"}
                      </td>
                      <td style={{ fontWeight: 700 }}>{String(t.symbol ?? "")}</td>
                      <td>
                        <span className={`badge ${side === "BUY" ? "badge-green" : "badge-red"}`}>{side}</span>
                      </td>
                      <td className="font-mono">{qty}</td>
                      <td className="font-mono">${price2.toFixed(2)}</td>
                      <td className="font-mono">{fmt(qty * price2)}</td>
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
