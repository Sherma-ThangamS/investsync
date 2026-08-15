/**
 * Unified Schema Adapter
 *
 * Normalises trade signals from heterogeneous broker / exchange APIs
 * into a single canonical InvestSync `TradeSignal` format.
 *
 * Each broker adapter maps its native payload → `TradeSignal`.
 * The `UnifiedSchemaAdapter` holds a registry of adapters and
 * provides a single `normalise()` entry-point.
 */

export interface TradeSignal {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Original source identifier */
  source: string;
  /** Optional raw payload for audit */
  raw?: unknown;
}

export type BrokerAdapter = (raw: unknown) => TradeSignal;

export class UnifiedSchemaAdapter {
  private adapters = new Map<string, BrokerAdapter>();

  /** Register an adapter for a given broker key. */
  register(brokerKey: string, adapter: BrokerAdapter): void {
    this.adapters.set(brokerKey, adapter);
  }

  /** Normalise a raw broker payload into a canonical TradeSignal. */
  normalise(brokerKey: string, raw: unknown): TradeSignal {
    const adapter = this.adapters.get(brokerKey);
    if (!adapter) {
      throw new Error(`No adapter registered for broker: ${brokerKey}`);
    }
    return adapter(raw);
  }

  /** List registered broker keys. */
  brokers(): string[] {
    return [...this.adapters.keys()];
  }
}

/* ── Built-in adapter: InvestSync Paper Trading engine ── */

export const paperTradingAdapter: BrokerAdapter = (raw) => {
  const r = raw as Record<string, unknown>;
  return {
    symbol: String(r.symbol ?? "").toUpperCase(),
    side: String(r.side) === "sell" ? "sell" : "buy",
    quantity: Number(r.quantity ?? 0),
    price: Number(r.price ?? 0),
    timestamp: typeof r.filledAt === "string" ? r.filledAt : new Date().toISOString(),
    source: "investsync-paper",
    raw,
  };
};
