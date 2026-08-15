"use client";

import { useState } from "react";
import { useAuth } from "../../components/auth-provider";

export default function BrokerConnectPage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(true); // Paper trading is always connected

  return (
    <>
      <div className="page-header">
        <h1>🔗 Connect Broker</h1>
        <p>Connect to a broker to execute trades. InvestSync Paper Trading is the default broker.</p>
      </div>

      <div className="grid-2">
        {/* Paper Trading Broker (Built-in) */}
        <div className="card" style={{ border: "2px solid var(--accent)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 32 }}>📝</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>InvestSync Paper Trading</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Built-in simulation engine</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Status</span>
              <span className="badge badge-green">Connected</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Starting Capital</span>
              <span style={{ fontWeight: 600 }}>${(user?.initialCapital ?? 100000).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Markets</span>
              <span>12 US Stocks & ETFs</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Price Updates</span>
              <span>Every 5 seconds</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Trade Persistence</span>
              <span>MySQL Database</span>
            </div>
          </div>

          <a href="/paper-trading" className="btn btn-primary" style={{ width: "100%" }}>
            Open Paper Trading →
          </a>
        </div>

        {/* Future Brokers (placeholders) */}
        <div className="card" style={{ padding: 24, opacity: 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 32 }}>🏦</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>External Broker</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Coming soon</div>
            </div>
          </div>

          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
            Connect your existing brokerage account to execute real trades.
            The Unified Schema Adapter normalizes signals from any supported broker API.
          </p>

          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Supported APIs</span>
              <span>REST, WebSocket, FIX</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>Schema Adapter</span>
              <span>Unified normalisation</span>
            </div>
          </div>

          <button className="btn btn-secondary" style={{ width: "100%" }} disabled>
            Coming Soon
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>How Broker Connection Works</div>
        <div className="grid-3">
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>1️⃣</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Connect</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Select a broker and connect your account. Paper Trading is always available.
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>2️⃣</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Trade</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Place trades directly or mirror master trader signals via MARA algorithm.
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>3️⃣</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Audit</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Every trade is hashed into the Merkle Tree Ledger for verifiable audit trail.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
