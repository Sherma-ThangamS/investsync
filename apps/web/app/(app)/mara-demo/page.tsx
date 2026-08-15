"use client";

import { useState } from "react";
import { apiRunMARADemo } from "../../lib/api";

export default function MARADemoPage() {
  // Master inputs
  const [masterQty, setMasterQty] = useState(10);
  const [masterEquity, setMasterEquity] = useState(100000);
  const [masterVol, setMasterVol] = useState(15);
  const [masterRisk, setMasterRisk] = useState(70);

  // Follower inputs
  const [followerEquity, setFollowerEquity] = useState(50000);
  const [followerVol, setFollowerVol] = useState(10);
  const [followerRisk, setFollowerRisk] = useState(40);
  const [followerMargin, setFollowerMargin] = useState(50000);
  const [followerLeverage, setFollowerLeverage] = useState(1);

  // Trade inputs
  const [price, setPrice] = useState(192.5);

  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function runDemo() {
    setLoading(true);
    try {
      const data = await apiRunMARADemo({
        masterQuantity: masterQty,
        masterEquity,
        followerEquity,
        masterVolatility: masterVol,
        followerVolatility: followerVol,
        masterRiskScore: masterRisk,
        followerRiskScore: followerRisk,
        price,
        followerFreeMargin: followerMargin,
        followerLeverage,
      });
      setResult(data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  const r = result?.result as Record<string, unknown> | undefined;
  const explanation = result?.explanation as Record<string, string> | undefined;

  return (
    <>
      <div className="page-header">
        <h1>🧮 MARA Algorithm Demo</h1>
        <p>
          Interactive demonstration of the <strong>Modified Adaptive Replication Algorithm</strong>.
          Adjust parameters for two users and see how MARA calculates the optimal follower quantity.
        </p>
      </div>

      <div className="grid-2">
        {/* Master Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">👑 Master Trader</div>
          </div>
          <div style={{ display: "grid", gap: 14, padding: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Trade Quantity (Q_base)
              </label>
              <input className="input" type="number" value={masterQty} onChange={(e) => setMasterQty(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Account Equity (E_M) — $
              </label>
              <input className="input" type="number" value={masterEquity} onChange={(e) => setMasterEquity(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Volatility Tolerance (σ_M) — %
              </label>
              <input className="input" type="number" value={masterVol} onChange={(e) => setMasterVol(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Risk Score (R_M) — 0-100
              </label>
              <input className="input" type="number" min={1} max={100} value={masterRisk} onChange={(e) => setMasterRisk(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Follower Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">👤 Follower</div>
          </div>
          <div style={{ display: "grid", gap: 14, padding: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Account Equity (E_F) — $
              </label>
              <input className="input" type="number" value={followerEquity} onChange={(e) => setFollowerEquity(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Volatility Tolerance (σ_F) — %
              </label>
              <input className="input" type="number" value={followerVol} onChange={(e) => setFollowerVol(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Risk Score (R_F) — 0-100
              </label>
              <input className="input" type="number" min={1} max={100} value={followerRisk} onChange={(e) => setFollowerRisk(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Free Margin — $
              </label>
              <input className="input" type="number" value={followerMargin} onChange={(e) => setFollowerMargin(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Leverage (1 = no leverage)
              </label>
              <input className="input" type="number" min={1} max={20} value={followerLeverage} onChange={(e) => setFollowerLeverage(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {/* Trade Price */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Instrument Price — $
            </label>
            <input className="input" type="number" step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" style={{ height: 42, marginTop: 20 }} onClick={runDemo} disabled={loading}>
            {loading ? "Calculating…" : "▶ Run MARA Calculation"}
          </button>
        </div>
      </div>

      {/* Results */}
      {r && explanation && (
        <div style={{ marginTop: 24 }}>
          {/* Formula */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📐 MARA Formula</div>
            </div>
            <div style={{ padding: 20, fontFamily: "var(--font-mono, monospace)", fontSize: 14, lineHeight: 2.2 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", marginBottom: 16 }}>
                {String(explanation.formula)}
              </div>
              <div><span style={{ color: "var(--text-muted)" }}>Capital Factor:</span> {String(explanation.capitalFactor)}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Volatility Factor:</span> {String(explanation.volatilityFactor)}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Risk Factor:</span> {String(explanation.riskFactor)}</div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Raw Calculation:</span> {String(explanation.rawCalculation)}
              </div>
              <div><span style={{ color: "var(--text-muted)" }}>Safety Bound:</span> {String(explanation.safetyBound)}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--success)", marginTop: 8 }}>
                {String(explanation.final)}
              </div>
            </div>
          </div>

          {/* Visual Comparison */}
          <div className="grid-2" style={{ marginTop: 24 }}>
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>👑</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Master Trades</div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{masterQty}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>shares @ ${price.toFixed(2)}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>
                = ${(masterQty * price).toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: 32, borderColor: "var(--accent)" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>👤</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Follower Gets (MARA Adjusted)</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: "var(--accent)" }}>{Number(r.adjustedQuantity)}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>shares @ ${price.toFixed(2)}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>
                = ${(Number(r.adjustedQuantity) * price).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">Factor Breakdown</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Capital Factor (C)</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{Number(r.capitalFactor).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {Number(r.capitalFactor) < 1 ? "Smaller account → fewer shares" : Number(r.capitalFactor) > 1 ? "Larger account → more shares" : "Equal accounts"}
                </div>
                <div style={{
                  height: 6, borderRadius: 3, marginTop: 8,
                  background: `linear-gradient(90deg, var(--accent) ${Math.min(Number(r.capitalFactor) * 50, 100)}%, var(--bg-secondary) 0)`,
                }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Volatility Factor (V)</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{Number(r.volatilityFactor).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {Number(r.volatilityFactor) < 1 ? "Lower risk tolerance" : Number(r.volatilityFactor) > 1 ? "Higher risk tolerance" : "Equal tolerance"}
                </div>
                <div style={{
                  height: 6, borderRadius: 3, marginTop: 8,
                  background: `linear-gradient(90deg, var(--warning) ${Math.min(Number(r.volatilityFactor) * 50, 100)}%, var(--bg-secondary) 0)`,
                }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Risk Factor (R)</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{Number(r.riskFactor).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {Number(r.riskFactor) < 1 ? "More conservative" : Number(r.riskFactor) > 1 ? "More aggressive" : "Equal risk"}
                </div>
                <div style={{
                  height: 6, borderRadius: 3, marginTop: 8,
                  background: `linear-gradient(90deg, var(--success) ${Math.min(Number(r.riskFactor) * 50, 100)}%, var(--bg-secondary) 0)`,
                }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
