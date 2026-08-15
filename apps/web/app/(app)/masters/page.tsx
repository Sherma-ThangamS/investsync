"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../components/auth-provider";
import {
  apiGetMasters,
  apiBecomeMaster,
  apiGetMinFollow,
  apiFollowMasterWithMode,
} from "../../lib/api";

interface MinFollowInfo {
  minAmount: number;
  step: number;
  positions: Array<{ symbol: string; name: string; quantity: number; price: number; value: number }>;
}

export default function MastersPage() {
  const { user } = useAuth();
  const [masters, setMasters] = useState<Record<string, unknown>[]>([]);
  const [showBecome, setShowBecome] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ userId: string; mode: "follow" | "snapshot" } | null>(null);
  const [minInfo, setMinInfo] = useState<MinFollowInfo | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [msg, setMsg] = useState("");

  // Form state for become-a-master
  const [displayName, setDisplayName] = useState("");
  const [perfFee, setPerfFee] = useState("10");
  const [subFee, setSubFee] = useState("0");
  const [strategy, setStrategy] = useState("");

  useEffect(() => {
    apiGetMasters().then(setMasters).catch(() => {});
  }, []);

  async function handleBecome() {
    try {
      await apiBecomeMaster({
        displayName,
        performanceFeePercent: Number(perfFee),
        monthlySubscriptionFee: Number(subFee),
        strategyDescription: strategy,
      });
      setMsg("You are now a master trader!");
      setShowBecome(false);
      apiGetMasters().then(setMasters);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    }
  }

  async function openAction(masterUserId: string, mode: "follow" | "snapshot") {
    setActionTarget({ userId: masterUserId, mode });
    setMultiplier(1);
    try {
      const info = await apiGetMinFollow(masterUserId);
      setMinInfo(info);
    } catch {
      setMinInfo({ minAmount: 0, step: 0, positions: [] });
    }
  }

  async function handleConfirm() {
    if (!actionTarget) return;
    const capital = minInfo ? minInfo.step * multiplier : 10000;
    try {
      await apiFollowMasterWithMode(actionTarget.userId, capital, actionTarget.mode);
      const label = actionTarget.mode === "follow" ? "Following" : "Snapshot copied";
      setMsg(`${label} ${actionTarget.userId} with $${capital.toFixed(2)}!`);
      setActionTarget(null);
      setMinInfo(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    }
  }

  const isMaster = user?.role === "master" || user?.role === "both" || user?.role === "admin";

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>Master Traders</h1>
            <p>Browse traders — <strong>Follow</strong> for ongoing copy trading, or <strong>Snapshot Copy</strong> for a one-time portfolio mirror.</p>
          </div>
          {!isMaster && (
            <button className="btn btn-primary" onClick={() => setShowBecome(true)}>
              + Become a Master
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: "var(--accent)" }}>
          {msg}
          <button style={{ marginLeft: 12, cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }} onClick={() => setMsg("")}>✕</button>
        </div>
      )}

      {/* Become a Master Modal */}
      {showBecome && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Become a Master Trader</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Display Name</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your trader name" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Performance Fee %</label>
                <input className="input" type="number" value={perfFee} onChange={(e) => setPerfFee(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Monthly Fee $</label>
                <input className="input" type="number" value={subFee} onChange={(e) => setSubFee(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Strategy Description</label>
              <textarea className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)} rows={3} placeholder="Describe your trading strategy…" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={handleBecome}>Submit</button>
              <button className="btn btn-secondary" onClick={() => setShowBecome(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Action Panel — Follow or Snapshot Copy with min-amount & steps */}
      {actionTarget && (
        <div className="card" style={{ padding: 24, marginBottom: 24, borderColor: "var(--accent)" }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            {actionTarget.mode === "follow" ? "📡 Follow (Ongoing Copy)" : "📸 Snapshot Copy (One-Time)"}
            <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8, color: "var(--text-muted)" }}>
              Master: {actionTarget.userId}
            </span>
          </div>

          {minInfo && minInfo.positions.length > 0 ? (
            <>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                This master holds {minInfo.positions.length} stock(s). Minimum lot based on portfolio ratio:
              </div>

              {/* Show positions in the minimum lot */}
              <div className="table-container" style={{ marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr><th>Symbol</th><th>Name</th><th>Min Shares</th><th>Price</th><th>Value</th></tr>
                  </thead>
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

              {/* Multiplier step control */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Multiplier:</span>
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
              Master has no open positions yet. You can still allocate capital.
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Capital:</span>
                <input className="input" type="number" min={100} value={minInfo?.step || 10000} style={{ width: 140 }}
                  onChange={() => {}} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleConfirm}>
              {actionTarget.mode === "follow" ? "📡 Confirm Follow" : "📸 Confirm Snapshot Copy"}
            </button>
            <button className="btn btn-secondary" onClick={() => { setActionTarget(null); setMinInfo(null); }}>Cancel</button>
          </div>

          {actionTarget.mode === "follow" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              ℹ️ <strong>Follow</strong> = ongoing copy trading. When the master buys or sells, it will be reflected in your portfolio automatically using MARA.
            </div>
          )}
          {actionTarget.mode === "snapshot" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              ℹ️ <strong>Snapshot Copy</strong> = one-time copy of the master&apos;s current portfolio. Future master trades will NOT be reflected.
            </div>
          )}
        </div>
      )}

      {/* Masters Grid */}
      <div className="grid-3">
        {masters.length === 0 ? (
          <div className="card" style={{ gridColumn: "1/-1", padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👑</div>
            <p>No master traders yet. Be the first!</p>
          </div>
        ) : (
          masters.map((m) => (
            <div key={String(m.userId)} className="master-card">
              <div className="master-card-header">
                <div className="master-card-avatar">
                  {String(m.displayName ?? m.userId).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    <Link href={`/masters/${String(m.userId)}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {String(m.displayName)}
                    </Link>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>ID: {String(m.userId)}</div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, minHeight: 40 }}>
                {String(m.strategyDescription)}
              </p>

              <div className="master-card-stats">
                <div>
                  <div className="master-card-stat-label">Perf. Fee</div>
                  <div className="master-card-stat-value">{Number(m.performanceFeePercent)}%</div>
                </div>
                <div>
                  <div className="master-card-stat-label">Monthly Fee</div>
                  <div className="master-card-stat-value">${Number(m.monthlySubscriptionFee)}</div>
                </div>
              </div>

              {String(m.userId) !== user?.id && (
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => openAction(String(m.userId), "follow")}
                  >
                    📡 Follow
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => openAction(String(m.userId), "snapshot")}
                  >
                    📸 Snapshot Copy
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
