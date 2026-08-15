"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-provider";
import StatCard from "../components/stat-card";
import { apiGetSnapshot, apiGetLeaderboard } from "../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function DashboardPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/portfolio");
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([apiGetSnapshot(), apiGetLeaderboard()])
      .then(([snap, lb]) => {
        setSnapshot(snap);
        setLeaderboard(lb);
      })
      .catch((err) => setError(err.message));
  }, [isAdmin]);

  if (loading) return <div className="page-header"><p>Loading…</p></div>;
  if (!isAdmin) return null;

  const users = (snapshot?.users as unknown[]) ?? [];
  const masters = (snapshot?.masters as unknown[]) ?? [];
  const subscriptions = (snapshot?.subscriptions as unknown[]) ?? [];
  const trades = (snapshot?.masterTrades as unknown[]) ?? [];

  return (
    <>
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Platform-wide overview — admin access only.</p>
      </div>

      {error && <div className="card" style={{ borderColor: "var(--red)", padding: 16 }}>{error}</div>}

      <div className="stats-grid">
        <StatCard icon="👥" iconColor="blue" label="Total Users" value={String(users.length)} />
        <StatCard icon="👑" iconColor="yellow" label="Master Traders" value={String(masters.length)} />
        <StatCard icon="📋" iconColor="purple" label="Subscriptions" value={String(subscriptions.length)} />
        <StatCard icon="📈" iconColor="green" label="Total Trades" value={String(trades.length)} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Top Traders</div>
            <div className="card-subtitle">Ranked by follower P&L</div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Master</th>
                <th>Followers</th>
                <th>Total Follower P&L</th>
                <th>Fees Accrued</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No data yet</td></tr>
              ) : (
                leaderboard.map((entry, idx) => (
                  <tr key={String(entry.masterUserId)}>
                    <td style={{ fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{String(entry.masterUserId)}</td>
                    <td>{String(entry.followers)}</td>
                    <td className={Number(entry.totalFollowerPnl) >= 0 ? "text-green" : "text-red"} style={{ fontWeight: 600 }}>
                      {fmt(Number(entry.totalFollowerPnl))}
                    </td>
                    <td className="font-mono">{fmt(Number(entry.totalMasterFeesAccrued))}</td>
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
