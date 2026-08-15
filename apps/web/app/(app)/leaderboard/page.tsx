"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";
import { apiGetLeaderboard } from "../../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function LeaderboardPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/portfolio");
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    apiGetLeaderboard().then(setLeaderboard).catch(() => {});
  }, [isAdmin]);

  if (loading) return <div className="page-header"><p>Loading…</p></div>;
  if (!isAdmin) return null;

  return (
    <>
      <div className="page-header">
        <h1>🏆 Leaderboard</h1>
        <p>Top-performing master traders — admin view.</p>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Master</th>
                <th>Followers</th>
                <th>Total Follower P&L</th>
                <th>Fees Accrued</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No leaderboard data yet</td></tr>
              ) : (
                leaderboard.map((entry, idx) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <tr key={String(entry.masterUserId)}>
                      <td><span style={{ fontSize: 20 }}>{medals[idx] ?? idx + 1}</span></td>
                      <td style={{ fontWeight: 700 }}>{String(entry.masterUserId)}</td>
                      <td>{String(entry.followers)}</td>
                      <td className={Number(entry.totalFollowerPnl) >= 0 ? "text-green" : "text-red"} style={{ fontWeight: 600 }}>
                        {fmt(Number(entry.totalFollowerPnl))}
                      </td>
                      <td className="font-mono">{fmt(Number(entry.totalMasterFeesAccrued))}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
