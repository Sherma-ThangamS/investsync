"use client";

import { useEffect, useState } from "react";
import StatCard from "../../components/stat-card";
import { useAuth } from "../../components/auth-provider";
import { apiGetFees } from "../../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function FeesPage() {
  const { user } = useAuth();
  const [fees, setFees] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (user?.id) {
      apiGetFees({ followerUserId: user.id }).then(setFees).catch(() => {});
    }
  }, [user?.id]);

  const perfFees = fees.filter((f) => f.type === "performance");
  const subFees = fees.filter((f) => f.type === "subscription");
  const totalPerf = perfFees.reduce((s, f) => s + Number(f.amount), 0);
  const totalSub = subFees.reduce((s, f) => s + Number(f.amount), 0);
  const total = totalPerf + totalSub;

  return (
    <>
      <div className="page-header">
        <h1>Fees & Billing</h1>
        <p>Complete transparency into all fees charged on your subscriptions.</p>
      </div>

      <div className="stats-grid">
        <StatCard icon="💰" iconColor="green" label="Total Fees" value={fmt(total)} change={`${fees.length} entries`} />
        <StatCard icon="📈" iconColor="blue" label="Performance Fees" value={fmt(totalPerf)} change={`${perfFees.length} charges`} />
        <StatCard icon="📋" iconColor="purple" label="Subscription Fees" value={fmt(totalSub)} change={`${subFees.length} charges`} />
        <StatCard icon="📊" iconColor="yellow" label="Avg Fee" value={fmt(fees.length > 0 ? total / fees.length : 0)} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Fee Ledger</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Subscription</th>
              </tr>
            </thead>
            <tbody>
              {fees.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No fees recorded</td></tr>
              ) : (
                fees.map((f) => (
                  <tr key={String(f.id)}>
                    <td style={{ fontSize: 12 }}>{new Date(String(f.createdAt)).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${f.type === "performance" ? "badge-green" : "badge-purple"}`}>
                        {String(f.type)}
                      </span>
                    </td>
                    <td className="font-mono text-green" style={{ fontWeight: 600 }}>{fmt(Number(f.amount))}</td>
                    <td className="text-muted" style={{ fontSize: 13 }}>{String(f.reason)}</td>
                    <td className="font-mono text-muted" style={{ fontSize: 12 }}>{String(f.subscriptionId).slice(0, 8)}…</td>
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
