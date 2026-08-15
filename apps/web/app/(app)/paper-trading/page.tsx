"use client";

import { useState, useEffect, useCallback } from "react";
import {
  apiGetSimulationQuotes,
  apiPlaceSimulationOrder,
  apiGetSimulationPortfolio,
  apiGetSimulationOrders,
} from "../../lib/api";

/* ── Types ── */
interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

interface Portfolio {
  cash: number;
  marketValue: number;
  totalEquity: number;
  positions: Position[];
}

interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  status: string;
  filledAt: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function PaperTradingPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"market" | "portfolio" | "orders">("market");

  /* Order form */
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [q, p, o] = await Promise.all([
        apiGetSimulationQuotes(),
        apiGetSimulationPortfolio(),
        apiGetSimulationOrders(),
      ]);
      setQuotes(q as unknown as Quote[]);
      setPortfolio(p as unknown as Portfolio);
      setOrders((o as unknown as Order[]).reverse());
    } catch {
      /* silent — user may not have token yet */
    }
  }, []);

  /* Poll every 5 seconds */
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  async function handlePlaceOrder() {
    if (!selectedSymbol || !quantity) return;
    setOrderLoading(true);
    setOrderMsg("");
    try {
      const result = (await apiPlaceSimulationOrder({
        symbol: selectedSymbol,
        side,
        quantity: Number(quantity),
      })) as unknown as Order;
      setOrderMsg(
        `${side.toUpperCase()} ${result.quantity} ${result.symbol} @ ${fmt(result.price)} — Total ${fmt(result.total)}`,
      );
      await fetchAll();
    } catch (err) {
      setOrderMsg(err instanceof Error ? err.message : "Order failed");
    } finally {
      setOrderLoading(false);
    }
  }

  const selectedQuote = quotes.find((q) => q.symbol === selectedSymbol);

  return (
    <>
      <div className="page-header">
        <h1>📝 Paper Trading</h1>
        <p>Practice trading with simulated market data — no real money at risk.</p>
      </div>

      {/* Portfolio Summary */}
      {portfolio && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>💵</div>
              <div>
                <div className="stat-label">Cash</div>
                <div className="stat-value">{fmt(portfolio.cash)}</div>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>📊</div>
              <div>
                <div className="stat-label">Market Value</div>
                <div className="stat-value">{fmt(portfolio.marketValue)}</div>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon" style={{ background: "var(--green-soft)", color: "var(--green)" }}>💰</div>
              <div>
                <div className="stat-label">Total Equity</div>
                <div className="stat-value">{fmt(portfolio.totalEquity)}</div>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon" style={{ background: "var(--yellow-soft)", color: "var(--yellow)" }}>📋</div>
              <div>
                <div className="stat-label">Positions</div>
                <div className="stat-value">{portfolio.positions.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: 24 }}>
        {/* ─── Left: Order Form ─── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Place Order</div>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Symbol</label>
              <select
                className="form-input"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
              >
                <option value="">Select a stock…</option>
                {quotes.map((q) => (
                  <option key={q.symbol} value={q.symbol}>
                    {q.symbol} — {q.name} ({fmt(q.price)})
                  </option>
                ))}
              </select>
            </div>

            {selectedQuote && (
              <div
                style={{
                  background: "var(--bg-elevated)",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>Live Price</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt(selectedQuote.price)}{" "}
                  <span style={{ color: selectedQuote.change >= 0 ? "var(--green)" : "var(--red)", fontSize: 12 }}>
                    {selectedQuote.change >= 0 ? "+" : ""}
                    {selectedQuote.changePercent.toFixed(2)}%
                  </span>
                </span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Side</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${side === "buy" ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setSide("buy")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`btn ${side === "sell" ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    ...(side === "sell" ? { background: "var(--red)", borderColor: "var(--red)" } : {}),
                  }}
                  onClick={() => setSide("sell")}
                >
                  Sell
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity</label>
              <input
                className="form-input"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
              />
            </div>

            {selectedQuote && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Estimated total:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {fmt(selectedQuote.price * Number(quantity || 0))}
                </strong>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handlePlaceOrder}
              disabled={orderLoading || !selectedSymbol}
            >
              {orderLoading ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${selectedSymbol || "..."}`}
            </button>

            {orderMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  background: orderMsg.includes("fail") || orderMsg.includes("Insufficient")
                    ? "var(--red-soft)"
                    : "var(--green-soft)",
                  color: orderMsg.includes("fail") || orderMsg.includes("Insufficient")
                    ? "var(--red)"
                    : "var(--green)",
                }}
              >
                {orderMsg}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Tabs ─── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: "flex", gap: 8 }}>
              {(["market", "portfolio", "orders"] as const).map((t) => (
                <button
                  key={t}
                  className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setTab(t)}
                >
                  {t === "market" ? "Market" : t === "portfolio" ? "Positions" : "Order History"}
                </button>
              ))}
            </div>
          </div>

          {tab === "market" && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Change</th>
                    <th>Volume</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.symbol}>
                      <td style={{ fontWeight: 600 }}>{q.symbol}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{q.name}</td>
                      <td>{fmt(q.price)}</td>
                      <td style={{ color: q.change >= 0 ? "var(--green)" : "var(--red)" }}>
                        {q.change >= 0 ? "+" : ""}
                        {q.changePercent.toFixed(2)}%
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{fmtVol(q.volume)}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setSelectedSymbol(q.symbol);
                            setSide("buy");
                          }}
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "portfolio" && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Avg Price</th>
                    <th>Current</th>
                    <th>Market Value</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio && portfolio.positions.length > 0 ? (
                    portfolio.positions.map((p) => (
                      <tr key={p.symbol}>
                        <td style={{ fontWeight: 600 }}>{p.symbol}</td>
                        <td>{p.quantity}</td>
                        <td>{fmt(p.avgPrice)}</td>
                        <td>{fmt(p.currentPrice)}</td>
                        <td>{fmt(p.marketValue)}</td>
                        <td style={{ color: p.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                          {p.pnl >= 0 ? "+" : ""}
                          {fmt(p.pnl)} ({p.pnlPercent.toFixed(2)}%)
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
                        No open positions — place your first trade!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "orders" && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? (
                    orders.map((o) => (
                      <tr key={o.id}>
                        <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                          {new Date(o.filledAt).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 600 }}>{o.symbol}</td>
                        <td>
                          <span
                            className={`status-badge ${o.side === "buy" ? "status-active" : "status-stopped"}`}
                          >
                            {o.side.toUpperCase()}
                          </span>
                        </td>
                        <td>{o.quantity}</td>
                        <td>{fmt(o.price)}</td>
                        <td>{fmt(o.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
                        No orders yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
