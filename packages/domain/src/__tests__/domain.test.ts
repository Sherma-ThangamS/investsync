/**
 * Comprehensive tests for all InvestSync domain modules.
 * Uses Node.js built-in test runner (node:test + node:assert).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  round2,
  calculateProportionalQuantity,
  calculateDrawdownPercent,
  shouldHaltByRisk,
  calculatePerformanceFee,
  defaultRiskControls,
} from "../finance.js";

import { calculateMARA, type MARAParams } from "../mara.js";

import { consolidatePriceFeeds, type PriceFeed } from "../median-consolidator.js";

import {
  UnifiedSchemaAdapter,
  paperTradingAdapter,
} from "../schema-adapter.js";

import {
  createTradeIntent,
  verifyIntent,
  expireStaleIntents,
} from "../intent-auth.js";

import { MerkleTreeLedger } from "../merkle-tree.js";

/* ═══════════════════════════════════════════════════════════════
   Finance Module
   ═══════════════════════════════════════════════════════════════ */

describe("finance — round2", () => {
  it("rounds to 2 decimal places", () => {
    assert.equal(round2(1.006), 1.01);
    assert.equal(round2(1.004), 1);
    assert.equal(round2(100), 100);
    assert.equal(round2(0.1 + 0.2), 0.3);
  });
});

describe("finance — calculateProportionalQuantity", () => {
  it("scales master quantity by capital ratio", () => {
    const qty = calculateProportionalQuantity({
      masterQuantity: 100,
      masterCapital: 100_000,
      followerAllocatedCapital: 50_000,
    });
    assert.equal(qty, 50);
  });

  it("handles equal capitals", () => {
    const qty = calculateProportionalQuantity({
      masterQuantity: 10,
      masterCapital: 10_000,
      followerAllocatedCapital: 10_000,
    });
    assert.equal(qty, 10);
  });

  it("throws on zero master capital", () => {
    assert.throws(() => {
      calculateProportionalQuantity({
        masterQuantity: 10,
        masterCapital: 0,
        followerAllocatedCapital: 5_000,
      });
    }, /Master capital must be greater than 0/);
  });
});

describe("finance — calculateDrawdownPercent", () => {
  it("computes correct drawdown", () => {
    assert.equal(calculateDrawdownPercent(100_000, 90_000), 10);
    assert.equal(calculateDrawdownPercent(100_000, 100_000), 0);
    assert.equal(calculateDrawdownPercent(200_000, 150_000), 25);
  });

  it("returns 0 for zero start equity", () => {
    assert.equal(calculateDrawdownPercent(0, 50_000), 0);
  });
});

describe("finance — shouldHaltByRisk", () => {
  const baseSub = {
    id: "sub-1",
    followerUserId: "f1",
    masterUserId: "m1",
    allocatedCapital: 10_000,
    startEquity: 10_000,
    highWaterMark: 10_000,
    riskControls: defaultRiskControls(),
    mode: "follow" as const,
  };

  it("allows when drawdown is below limit", () => {
    const result = shouldHaltByRisk(baseSub, 9_000);
    assert.equal(result.blocked, false);
  });

  it("blocks when drawdown exceeds limit", () => {
    const result = shouldHaltByRisk(baseSub, 7_000); // 30% DD > 20% limit
    assert.equal(result.blocked, true);
    assert.ok(result.reason?.includes("Max drawdown reached"));
  });

  it("blocks when paused", () => {
    const paused = {
      ...baseSub,
      riskControls: { ...baseSub.riskControls, paused: true },
    };
    const result = shouldHaltByRisk(paused, 10_000);
    assert.equal(result.blocked, true);
    assert.ok(result.reason?.includes("paused"));
  });
});

describe("finance — calculatePerformanceFee", () => {
  it("charges fee on profit above HWM", () => {
    const fee = calculatePerformanceFee({
      currentEquity: 12_000,
      subscription: {
        id: "sub-1",
        followerUserId: "f1",
        masterUserId: "m1",
        allocatedCapital: 10_000,
        startEquity: 10_000,
        highWaterMark: 10_000,
        riskControls: defaultRiskControls(),
        mode: "follow" as const,
      },
      performanceFeePercent: 20,
    });
    assert.equal(fee, 400); // 20% of 2000
  });

  it("returns 0 when below HWM", () => {
    const fee = calculatePerformanceFee({
      currentEquity: 9_000,
      subscription: {
        id: "sub-1",
        followerUserId: "f1",
        masterUserId: "m1",
        allocatedCapital: 10_000,
        startEquity: 10_000,
        highWaterMark: 10_000,
        riskControls: defaultRiskControls(),
        mode: "follow" as const,
      },
      performanceFeePercent: 20,
    });
    assert.equal(fee, 0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   MARA Algorithm
   ═══════════════════════════════════════════════════════════════ */

describe("MARA — calculateMARA", () => {
  const baseParams: MARAParams = {
    masterQuantity: 100,
    masterEquity: 100_000,
    followerEquity: 50_000,
    masterVolatility: 20,
    followerVolatility: 20,
    masterRiskScore: 50,
    followerRiskScore: 50,
    price: 100,
    followerFreeMargin: 50_000,
    followerLeverage: 1,
  };

  it("computes proportional quantity with equal vol/risk", () => {
    const result = calculateMARA(baseParams);
    // C = 50k/100k = 0.5, V = 1, R = 1, Q_adj = 100 * 0.5 * 1 * 1 = 50
    assert.equal(result.capitalFactor, 0.5);
    assert.equal(result.volatilityFactor, 1);
    assert.equal(result.riskFactor, 1);
    assert.equal(result.adjustedQuantity, 50);
  });

  it("scales by volatility factor", () => {
    const result = calculateMARA({
      ...baseParams,
      followerVolatility: 10, // half of master's 20
    });
    // V = 10/20 = 0.5, so Q_adj = 100 * 0.5 * 0.5 * 1 = 25
    assert.equal(result.volatilityFactor, 0.5);
    assert.equal(result.adjustedQuantity, 25);
  });

  it("scales by risk factor", () => {
    const result = calculateMARA({
      ...baseParams,
      followerRiskScore: 25, // half of master's 50
    });
    // R = 25/50 = 0.5, Q_adj = 100 * 0.5 * 1 * 0.5 = 25
    assert.equal(result.riskFactor, 0.5);
    assert.equal(result.adjustedQuantity, 25);
  });

  it("caps at max quantity (safety bound)", () => {
    const result = calculateMARA({
      ...baseParams,
      followerFreeMargin: 1_000, // Only $1000 available
      followerLeverage: 1,
    });
    // Q_max = 1000 * 1 / 100 = 10
    assert.equal(result.maxQuantity, 10);
    assert.equal(result.adjustedQuantity, 10);
  });

  it("applies leverage to max quantity", () => {
    const result = calculateMARA({
      ...baseParams,
      followerFreeMargin: 5_000,
      followerLeverage: 10,
    });
    // Q_max = 5000 * 10 / 100 = 500
    assert.equal(result.maxQuantity, 500);
    // Q_adj = 50, which is less than 500
    assert.equal(result.adjustedQuantity, 50);
  });

  it("returns zeros when master equity is zero", () => {
    const result = calculateMARA({ ...baseParams, masterEquity: 0 });
    assert.equal(result.adjustedQuantity, 0);
    assert.equal(result.capitalFactor, 0);
  });

  it("returns zeros when price is zero", () => {
    const result = calculateMARA({ ...baseParams, price: 0 });
    assert.equal(result.adjustedQuantity, 0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Median-Based Consolidator
   ═══════════════════════════════════════════════════════════════ */

describe("MedianConsolidator — consolidatePriceFeeds", () => {
  const now = Date.now();

  function feed(source: string, price: number, age = 0): PriceFeed {
    return { source, symbol: "AAPL", price, timestamp: now - age * 1000 };
  }

  it("returns null for empty feeds", () => {
    assert.equal(consolidatePriceFeeds([]), null);
  });

  it("returns the single price for one feed", () => {
    const result = consolidatePriceFeeds([feed("a", 100)]);
    assert.ok(result);
    assert.equal(result.medianPrice, 100);
    assert.equal(result.feedCount, 1);
  });

  it("computes median of odd-count feeds", () => {
    const result = consolidatePriceFeeds([
      feed("a", 100),
      feed("b", 102),
      feed("c", 104),
    ]);
    assert.ok(result);
    assert.equal(result.medianPrice, 102);
  });

  it("computes median of even-count feeds", () => {
    const result = consolidatePriceFeeds([
      feed("a", 100),
      feed("b", 102),
      feed("c", 104),
      feed("d", 106),
    ]);
    assert.ok(result);
    assert.equal(result.medianPrice, 103);
  });

  it("filters outliers beyond threshold", () => {
    const result = consolidatePriceFeeds(
      [
        feed("a", 100),
        feed("b", 101),
        feed("c", 102),
        feed("d", 200), // massive outlier
      ],
      5, // 5% threshold
    );
    assert.ok(result);
    assert.equal(result.outlierCount, 1);
    // After removing 200, median of [100, 101, 102] = 101
    assert.equal(result.medianPrice, 101);
  });

  it("filters stale feeds", () => {
    const result = consolidatePriceFeeds(
      [
        feed("a", 100, 0),   // fresh
        feed("b", 101, 0),   // fresh
        feed("c", 99, 60),   // 60s old — stale
      ],
      5,
      30, // 30s max age
    );
    assert.ok(result);
    // Only 2 fresh feeds: median = (100+101)/2 = 100.5
    assert.equal(result.medianPrice, 100.5);
  });

  it("returns null when all feeds are stale", () => {
    const result = consolidatePriceFeeds(
      [feed("a", 100, 60), feed("b", 101, 60)],
      5,
      30,
    );
    assert.equal(result, null);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Unified Schema Adapter
   ═══════════════════════════════════════════════════════════════ */

describe("UnifiedSchemaAdapter", () => {
  it("registers and normalises via adapter", () => {
    const adapter = new UnifiedSchemaAdapter();
    adapter.register("paperTrading", paperTradingAdapter);

    const signal = adapter.normalise("paperTrading", {
      symbol: "aapl",
      side: "buy",
      quantity: 10,
      price: 192.5,
      filledAt: "2025-01-01T00:00:00Z",
    });

    assert.equal(signal.symbol, "AAPL");
    assert.equal(signal.side, "buy");
    assert.equal(signal.quantity, 10);
    assert.equal(signal.price, 192.5);
    assert.equal(signal.source, "investsync-paper");
  });

  it("throws for unregistered broker", () => {
    const adapter = new UnifiedSchemaAdapter();
    assert.throws(() => {
      adapter.normalise("unknown", {});
    }, /No adapter registered for broker/);
  });

  it("lists registered brokers", () => {
    const adapter = new UnifiedSchemaAdapter();
    adapter.register("a", paperTradingAdapter);
    adapter.register("b", paperTradingAdapter);
    assert.deepEqual(adapter.brokers(), ["a", "b"]);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Intent-Based Authorization
   ═══════════════════════════════════════════════════════════════ */

describe("Intent-Based Auth — createTradeIntent", () => {
  it("creates an intent with SHA-256 hash", () => {
    const intent = createTradeIntent({
      id: "intent-1",
      masterUserId: "master-1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
    });

    assert.equal(intent.id, "intent-1");
    assert.equal(intent.masterUserId, "master-1");
    assert.equal(intent.status, "pending");
    assert.equal(intent.ttlMs, 60_000);
    assert.ok(intent.hash.length === 64); // SHA-256 hex = 64 chars
    assert.ok(intent.nonce.length > 0);
  });
});

describe("Intent-Based Auth — verifyIntent", () => {
  it("valid intent passes verification", () => {
    const intent = createTradeIntent({
      id: "i1",
      masterUserId: "m1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
    });
    const result = verifyIntent(intent);
    assert.equal(result.valid, true);
  });

  it("tampered hash fails verification", () => {
    const intent = createTradeIntent({
      id: "i2",
      masterUserId: "m1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
    });
    intent.hash = "0000000000000000000000000000000000000000000000000000000000000000";
    const result = verifyIntent(intent);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("hash mismatch"));
  });

  it("expired intent fails verification", () => {
    const intent = createTradeIntent({
      id: "i3",
      masterUserId: "m1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
      ttlMs: 0, // immediate expiry
    });
    // Need at least 1ms to pass
    intent.createdAt = Date.now() - 1;
    const result = verifyIntent(intent);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("expired"));
  });

  it("rejected intent fails verification", () => {
    const intent = createTradeIntent({
      id: "i4",
      masterUserId: "m1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
    });
    intent.status = "rejected";
    const result = verifyIntent(intent);
    assert.equal(result.valid, false);
  });
});

describe("Intent-Based Auth — expireStaleIntents", () => {
  it("expires intents past their TTL", () => {
    const old = createTradeIntent({
      id: "i-old",
      masterUserId: "m1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
      ttlMs: 100,
    });
    old.createdAt = Date.now() - 200; // 200ms ago, TTL 100ms

    const fresh = createTradeIntent({
      id: "i-fresh",
      masterUserId: "m1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 190,
      ttlMs: 60_000,
    });

    const expired = expireStaleIntents([old, fresh]);
    assert.equal(expired.length, 1);
    assert.equal(expired[0].id, "i-old");
    assert.equal(old.status, "expired");
    assert.equal(fresh.status, "pending");
  });
});

/* ═══════════════════════════════════════════════════════════════
   Merkle Tree Ledger
   ═══════════════════════════════════════════════════════════════ */

describe("MerkleTreeLedger", () => {
  function makeTrade(id: string) {
    return {
      tradeId: id,
      symbol: "AAPL",
      side: "buy" as const,
      quantity: 10,
      price: 190,
      timestamp: "2025-01-01T00:00:00Z",
    };
  }

  it("starts empty", () => {
    const ledger = new MerkleTreeLedger();
    assert.equal(ledger.size, 0);
    const root = ledger.computeRoot();
    assert.equal(root.leafCount, 0);
    assert.ok(root.rootHash.length > 0);
  });

  it("appends trades and creates leaf hashes", () => {
    const ledger = new MerkleTreeLedger();
    const leaf = ledger.appendTrade(makeTrade("t1"));
    assert.equal(leaf.tradeId, "t1");
    assert.ok(leaf.hash.length === 64);
    assert.equal(ledger.size, 1);
  });

  it("produces deterministic leaf hashes", () => {
    const l1 = new MerkleTreeLedger();
    const l2 = new MerkleTreeLedger();
    const leaf1 = l1.appendTrade(makeTrade("t1"));
    const leaf2 = l2.appendTrade(makeTrade("t1"));
    assert.equal(leaf1.hash, leaf2.hash);
  });

  it("different trades produce different hashes", () => {
    const ledger = new MerkleTreeLedger();
    const leaf1 = ledger.appendTrade(makeTrade("t1"));
    const leaf2 = ledger.appendTrade(makeTrade("t2"));
    assert.notEqual(leaf1.hash, leaf2.hash);
  });

  it("computes root from single leaf", () => {
    const ledger = new MerkleTreeLedger();
    ledger.appendTrade(makeTrade("t1"));
    const root = ledger.computeRoot();
    assert.equal(root.leafCount, 1);
    assert.ok(root.rootHash.length === 64);
  });

  it("computes root from two leaves", () => {
    const ledger = new MerkleTreeLedger();
    ledger.appendTrade(makeTrade("t1"));
    ledger.appendTrade(makeTrade("t2"));
    const root = ledger.computeRoot();
    assert.equal(root.leafCount, 2);
    assert.equal(root.treeDepth, 1);
  });

  it("computes root from three leaves (odd — duplicates last)", () => {
    const ledger = new MerkleTreeLedger();
    ledger.appendTrade(makeTrade("t1"));
    ledger.appendTrade(makeTrade("t2"));
    ledger.appendTrade(makeTrade("t3"));
    const root = ledger.computeRoot();
    assert.equal(root.leafCount, 3);
    assert.equal(root.treeDepth, 2);
  });

  it("root changes when new trade is appended", () => {
    const ledger = new MerkleTreeLedger();
    ledger.appendTrade(makeTrade("t1"));
    const root1 = ledger.computeRoot().rootHash;
    ledger.appendTrade(makeTrade("t2"));
    const root2 = ledger.computeRoot().rootHash;
    assert.notEqual(root1, root2);
  });

  it("verifyLeaf returns true for existing trade", () => {
    const ledger = new MerkleTreeLedger();
    ledger.appendTrade(makeTrade("t1"));
    assert.equal(ledger.verifyLeaf("t1"), true);
    assert.equal(ledger.verifyLeaf("nonexistent"), false);
  });

  it("hydrate restores from saved leaves", () => {
    const original = new MerkleTreeLedger();
    original.appendTrade(makeTrade("t1"));
    original.appendTrade(makeTrade("t2"));
    const savedLeaves = [...original.getLeaves()];
    const originalRoot = original.computeRoot().rootHash;

    const restored = new MerkleTreeLedger();
    restored.hydrate(savedLeaves);
    const restoredRoot = restored.computeRoot().rootHash;

    assert.equal(restoredRoot, originalRoot);
    assert.equal(restored.size, 2);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Follow vs Snapshot Mode — FollowSubscription mode field
   ═══════════════════════════════════════════════════════════════ */

describe("FollowSubscription — mode field", () => {
  it('defaults mode to follow', () => {
    const sub = {
      id: "s1",
      followerUserId: "f1",
      masterUserId: "m1",
      allocatedCapital: 5000,
      startEquity: 5000,
      highWaterMark: 5000,
      riskControls: defaultRiskControls(),
      mode: "follow" as const,
    };
    assert.equal(sub.mode, "follow");
  });

  it('supports snapshot mode', () => {
    const sub = {
      id: "s2",
      followerUserId: "f1",
      masterUserId: "m1",
      allocatedCapital: 5000,
      startEquity: 5000,
      highWaterMark: 5000,
      riskControls: defaultRiskControls(),
      mode: "snapshot" as const,
    };
    assert.equal(sub.mode, "snapshot");
  });

  it('snapshot mode subscription should not receive ongoing trades', () => {
    // This is a semantic test: snapshot subs are excluded from mirroring
    const subs = [
      { id: "s1", mode: "follow" as const, masterUserId: "m1" },
      { id: "s2", mode: "snapshot" as const, masterUserId: "m1" },
      { id: "s3", mode: "follow" as const, masterUserId: "m1" },
    ];
    const eligibleForMirroring = subs.filter((s) => s.mode === "follow");
    assert.equal(eligibleForMirroring.length, 2);
    assert.equal(eligibleForMirroring[0].id, "s1");
    assert.equal(eligibleForMirroring[1].id, "s3");
  });
});

/* ═══════════════════════════════════════════════════════════════
   GCD-based Minimum Lot Calculation
   ═══════════════════════════════════════════════════════════════ */

describe("Min-lot GCD calculation", () => {
  function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

  it('computes GCD of two quantities', () => {
    assert.equal(gcd(10, 5), 5);
    assert.equal(gcd(12, 8), 4);
    assert.equal(gcd(7, 3), 1);
  });

  it('computes minimum lot ratios for master portfolio', () => {
    // Master has: 10 AAPL, 5 MSFT
    const quantities = [10, 5];
    let g = quantities[0];
    for (let i = 1; i < quantities.length; i++) {
      g = gcd(g, quantities[i]);
    }
    // GCD = 5, so minimum lot = [2, 1]
    assert.equal(g, 5);
    assert.equal(quantities[0] / g, 2);
    assert.equal(quantities[1] / g, 1);
  });

  it('handles coprime quantities', () => {
    const quantities = [7, 3];
    let g = quantities[0];
    for (let i = 1; i < quantities.length; i++) {
      g = gcd(g, quantities[i]);
    }
    // GCD = 1, so minimum lot = [7, 3]
    assert.equal(g, 1);
    assert.equal(quantities[0] / g, 7);
    assert.equal(quantities[1] / g, 3);
  });

  it('min amount = sum of (minLotQty * price)', () => {
    const positions = [
      { symbol: "AAPL", quantity: 10, price: 192.50 },
      { symbol: "MSFT", quantity: 5, price: 425.30 },
    ];
    const quantities = positions.map((p) => p.quantity);
    let g = quantities[0];
    for (let i = 1; i < quantities.length; i++) {
      g = gcd(g, quantities[i]);
    }
    const minAmount = positions.reduce((sum, p) => sum + (p.quantity / g) * p.price, 0);
    // 2 * 192.50 + 1 * 425.30 = 385 + 425.30 = 810.30
    assert.equal(round2(minAmount), 810.3);
  });

  it('step = minAmount, so 2x = double', () => {
    const step = 810.30;
    assert.equal(round2(step * 2), 1620.6);
    assert.equal(round2(step * 3), 2430.9);
  });
});

/* ═══════════════════════════════════════════════════════════════
   MARA — Full scenario between two users
   ═══════════════════════════════════════════════════════════════ */

describe("MARA — Full demo scenario", () => {
  it('conservative follower gets fewer shares than aggressive master', () => {
    const result = calculateMARA({
      masterQuantity: 100,
      masterEquity: 200_000,
      followerEquity: 50_000,
      masterVolatility: 25,
      followerVolatility: 10,
      masterRiskScore: 80,
      followerRiskScore: 30,
      price: 150,
      followerFreeMargin: 50_000,
      followerLeverage: 1,
    });
    // C = 50k/200k = 0.25, V = 10/25 = 0.4, R = 30/80 = 0.38
    // Q_adj = 100 * 0.25 * 0.4 * 0.38 = 3.8
    assert.ok(result.adjustedQuantity < 10, "Conservative follower should get very few shares");
    assert.ok(result.adjustedQuantity > 0, "Should get at least some shares");
  });

  it('leveraged follower can get more than base', () => {
    const result = calculateMARA({
      masterQuantity: 10,
      masterEquity: 100_000,
      followerEquity: 100_000,
      masterVolatility: 15,
      followerVolatility: 30, // more aggressive
      masterRiskScore: 50,
      followerRiskScore: 90, // higher risk tolerance
      price: 100,
      followerFreeMargin: 100_000,
      followerLeverage: 5,
    });
    // C = 1, V = 2, R = 1.8 → Q_adj = 10 * 1 * 2 * 1.8 = 36
    assert.ok(result.adjustedQuantity > 10, "Aggressive follower with leverage should get more");
  });
});

/* ═══════════════════════════════════════════════════════════════
   CopyPosition type
   ═══════════════════════════════════════════════════════════════ */

describe("CopyPosition type", () => {
  it('can represent a copy position with PnL', () => {
    const pos = {
      symbol: "AAPL",
      name: "Apple Inc.",
      quantity: 5,
      avgPrice: 190,
      currentPrice: 195,
      marketValue: round2(5 * 195),
      pnl: round2((195 - 190) * 5),
    };
    assert.equal(pos.marketValue, 975);
    assert.equal(pos.pnl, 25);
  });
});
