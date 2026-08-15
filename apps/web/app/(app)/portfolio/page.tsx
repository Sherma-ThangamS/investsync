"use client";

import { useEffect, useState } from "react";
import StatCard from "../../components/stat-card";
import { useAuth } from "../../components/auth-provider";
import { apiGetSimulationPortfolio, apiGetSubscriptions } from "../../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Record<string, unknown> | null>(null);
  const [subs, setSubs] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiGetSimulationPortfolio().then(setPortfolio).catch(() => {});
    if (user?.id) {
      apiGetSubscriptions(user.id).then(setSubs).catch(() => {});
    }
  }, [user?.id]);

  const positions = (portfolio?.positions as Record<string, unknown>[]) ?? [];
  const cash = Number(portfolio?.cash ?? 0);
  const totalEquity = Number(portfolio?.totalEquity ?? 0);
  const marketValue = Number(portfolio?.marketValue ?? 0);

  return (
    <>
      <div className="page-header">
        <h1>Portfolio</h1>
        <p>Track your consolidated holdings across paper trading and subscriptions.</p>
      </div>

      <div className="stats-grid">
        <StatCard icon="💼" iconColor="blue" label="Total Equity" value={fmt(totalEquity)} />
        <StatCard icon="💵" iconColor="green" label="Cash" value={fmt(cash)} />
        <StatCard icon="📊" iconColor="purple" label="Market Value" value={fmt(marketValue)} />
        <StatCard icon="📋" iconColor="yellow" label="Subscriptions" value={String(subs.length)} />
      </div>

      {/* Positions Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Positions</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Qty</th>
                <th>Avg Price</th>
                <th>Current</th>
                <th>Market Value</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No positions — start trading!</td></tr>
              ) : (
                positions.map((p) => {
                  const pnl = Number(p.pnl ?? 0);
                  return (
                    <tr key={String(p.symbol)}>
                      <td style={{ fontWeight: 700 }}>{String(p.symbol)}</td>
                      <td className="text-muted">{String(p.name)}</td>
                      <td className="font-mono">{Number(p.quantity)}</td>
                      <td className="font-mono">${Number(p.avgPrice).toFixed(2)}</td>
                      <td className="font-mono">${Number(p.currentPrice).toFixed(2)}</td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>{fmt(Number(p.marketValue))}</td>
                      <td className={`font-mono ${pnl >= 0 ? "text-green" : "text-red"}`} style={{ fontWeight: 600 }}>
                        {pnl >= 0 ? "+" : ""}{fmt(pnl)} ({Number(p.pnlPercent).toFixed(1)}%)
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscriptions Breakdown */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Subscription Breakdown</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Master</th>
                <th>Allocated Capital</th>
                <th>High Water Mark</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No subscriptions</td></tr>
              ) : (
                subs.map((s) => (
                  <tr key={String(s.id)}>
                    <td style={{ fontWeight: 600 }}>{String(s.masterUserId)}</td>
                    <td className="font-mono">{fmt(Number(s.allocatedCapital))}</td>
                    <td className="font-mono">{fmt(Number(s.highWaterMark))}</td>
                    <td>
                      <span className={`badge ${s.riskControls && (s.riskControls as Record<string, unknown>).paused ? "badge-yellow" : "badge-green"}`}>
                        {s.riskControls && (s.riskControls as Record<string, unknown>).paused ? "Paused" : "Active"}
                      </span>
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
