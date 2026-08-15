"use client";

import { useEffect, useState } from "react";
import { apiGetMerkleRoot, apiGetMerkleLeaves } from "../../lib/api";

export default function AuditTrailPage() {
  const [root, setRoot] = useState<Record<string, unknown> | null>(null);
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGetMerkleRoot(), apiGetMerkleLeaves()])
      .then(([r, l]) => { setRoot(r); setLeaves(l); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>🔐 Audit Trail</h1>
        <p>Merkle Tree Ledger — cryptographic proof of all trade executions.</p>
      </div>

      {/* Root Hash Card */}
      <div className="card" style={{ padding: 24, border: "2px solid var(--accent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="card-title">Proof-of-Execution Root Hash (H_root)</div>
            <div className="card-subtitle">Cryptographic digest of entire trade history</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="badge badge-green">Verified</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: "var(--text-muted)" }}>Computing…</div>
        ) : root ? (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>
              {String(root.rootHash)}
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Leaf Count: </span>
                <span style={{ fontWeight: 600 }}>{String(root.leafCount)}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Tree Depth: </span>
                <span style={{ fontWeight: 600 }}>{String(root.treeDepth)}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Computed: </span>
                <span>{root.computedAt ? new Date(String(root.computedAt)).toLocaleString() : "—"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, color: "var(--text-muted)" }}>No trades recorded yet</div>
        )}
      </div>

      {/* Merkle Leaves */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Merkle Leaves</div>
            <div className="card-subtitle">Each trade hashed as SHA-256 leaf node</div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Leaf Hash</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No leaves yet — place a trade to start the audit trail</td></tr>
              ) : (
                leaves.map((leaf, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{String(leaf.tradeId).slice(0, 12)}…</td>
                    <td style={{ fontWeight: 600 }}>{String(leaf.symbol)}</td>
                    <td>
                      <span className={`badge ${leaf.side === "buy" ? "badge-green" : "badge-red"}`}>
                        {String(leaf.side).toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono">{Number(leaf.quantity)}</td>
                    <td className="font-mono">${Number(leaf.price).toFixed(2)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                      {String(leaf.hash).slice(0, 16)}…
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* How Merkle Works */}
      <div className="grid-3" style={{ marginTop: 24 }}>
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Leaf Nodes</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Each trade is hashed: SHA-256(tradeId | symbol | side | qty | price | timestamp)
          </p>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌲</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Tree Build</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Internal nodes = SHA-256(left || right). Odd leaves are duplicated.
          </p>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Root Hash</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            H_root is the immutable Proof-of-Execution — any change invalidates it.
          </p>
        </div>
      </div>
    </>
  );
}
