import cors from "cors";
import express from "express";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { CopyTradingEngine } from "../../engine/src/index.js";
import type { MasterProfile, PaperOrder, TradeNotification, User, UserRole, CopyPosition } from "../../../packages/domain/src/index.js";
import { round2, MerkleTreeLedger, createTradeIntent, verifyIntent } from "../../../packages/domain/src/index.js";
import { calculateMARA } from "../../../packages/domain/src/mara.js";
import { createPoolFromEnv } from "./persistence/mysql.js";
import { InvestSyncRepository } from "./persistence/repository.js";

const app = express();
const engine = new CopyTradingEngine();
const merkleLedger = new MerkleTreeLedger();
const credentials = new Map<string, string>();
const sessions = new Map<string, string>();
const repository = await createRepository();
await hydrateEngineState();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mode: "simulation",
    disclaimer: "Not a broker. Not investment advice.",
  });
});

app.post("/auth/register", async (req, res) => {
  try {
    const user = engine.createUser(toUser(req.body));
    const password = String((req.body as Record<string, unknown>).password ?? "");
    if (!password) {
      throw new Error("Password is required");
    }
  const passwordHash = hashPassword(password);
  credentials.set(user.id, passwordHash);
  await repository?.saveUser(user);
  await repository?.saveCredential(user.id, passwordHash);

    const token = createSession(user.id);

    res.status(201).json({
      token,
      user,
    });
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const userId = String((req.body as Record<string, unknown>).id ?? "");
    const password = String((req.body as Record<string, unknown>).password ?? "");

    const passwordHash = await getCredentialHash(userId);
    if (!passwordHash || !verifyPassword(password, passwordHash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = createSession(userId);
    const user = engine.snapshot().users.find((candidate) => candidate.id === userId);

    res.json({
      token,
      user,
    });
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.get("/auth/me", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) {
    return;
  }

  const user = engine.snapshot().users.find((candidate) => candidate.id === userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

app.post("/users", async (req, res) => {
  try {
    const user = engine.createUser(toUser(req.body));
    await repository?.saveUser(user);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.post("/masters", async (req, res) => {
  try {
    const profile = engine.createMasterProfile(toMasterProfile(req.body));
    await repository?.saveMasterProfile(profile);
    res.status(201).json(profile);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.get("/masters", async (_req, res) => {
  const masters = repository ? await repository.listMasters() : engine.snapshot().masters;
  res.json(masters);
});

app.post("/subscriptions", async (req, res) => {
  try {
    const { id, followerUserId, masterUserId, allocatedCapital, mode } = req.body;
    const subscription = engine.followMaster({
      id: String(id),
      followerUserId: String(followerUserId),
      masterUserId: String(masterUserId),
      allocatedCapital: Number(allocatedCapital),
      mode: mode === "snapshot" ? "snapshot" : "follow",
    });
    await repository?.saveSubscription(subscription);

    res.status(201).json(subscription);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.patch("/subscriptions/:id/risk", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const subscription = engine
      .snapshot()
      .subscriptions.find((candidate) => candidate.id === req.params.id);

    if (!subscription) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    if (subscription.followerUserId !== userId) {
      res.status(403).json({ error: "Only the follower can update risk controls" });
      return;
    }

    const updated = engine.updateRiskControls({
      subscriptionId: req.params.id,
      paused: req.body.paused,
      maxDrawdownPercent: req.body.maxDrawdownPercent,
    });
    await repository?.saveSubscription(updated);

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.get("/followers/:followerUserId/subscriptions", async (req, res) => {
  const subscriptions = repository
    ? await repository.listSubscriptionsByFollower(req.params.followerUserId)
    : engine
        .snapshot()
        .subscriptions.filter((subscription) => subscription.followerUserId === req.params.followerUserId);

  // Enrich with position data
  const enriched = subscriptions.map((sub) => {
    const account = engine.getSubscriptionAccountDetail(sub.id);
    const master = engine.snapshot().masters.find((m) => m.userId === sub.masterUserId);
    const positions: CopyPosition[] = (account?.positions ?? []).map((p) => {
      const currentPrice = livePrices.get(p.symbol) ?? p.averagePrice;
      const stock = SEED_STOCKS.find((s) => s.symbol === p.symbol);
      return {
        symbol: p.symbol,
        name: stock?.name ?? p.symbol,
        quantity: p.quantity,
        avgPrice: p.averagePrice,
        currentPrice,
        marketValue: round2(p.quantity * currentPrice),
        pnl: round2((currentPrice - p.averagePrice) * p.quantity),
      };
    });

    return {
      ...sub,
      masterDisplayName: master?.displayName ?? sub.masterUserId,
      positions,
      currentEquity: account?.equity ?? sub.startEquity,
      currentPnl: account?.pnl ?? 0,
    };
  });

  res.json(enriched);
});

/* Subscription detail — positions breakdown for a single subscription */
app.get("/subscriptions/:id/positions", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const sub = engine.snapshot().subscriptions.find((s) => s.id === req.params.id);
  if (!sub) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }

  if (sub.followerUserId !== userId) {
    const user = engine.snapshot().users.find((u) => u.id === userId);
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const account = engine.getSubscriptionAccountDetail(sub.id);
  const positions: CopyPosition[] = (account?.positions ?? []).map((p) => {
    const currentPrice = livePrices.get(p.symbol) ?? p.averagePrice;
    const stock = SEED_STOCKS.find((s) => s.symbol === p.symbol);
    return {
      symbol: p.symbol,
      name: stock?.name ?? p.symbol,
      quantity: p.quantity,
      avgPrice: p.averagePrice,
      currentPrice,
      marketValue: round2(p.quantity * currentPrice),
      pnl: round2((currentPrice - p.averagePrice) * p.quantity),
    };
  });

  res.json({
    subscription: sub,
    cash: account?.cash ?? 0,
    equity: account?.equity ?? sub.startEquity,
    pnl: account?.pnl ?? 0,
    positions,
  });
});

app.post("/masters/:masterUserId/trades", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    if (userId !== req.params.masterUserId) {
      res.status(403).json({ error: "Only the master can place master trades" });
      return;
    }

    const result = engine.placeMasterTrade({
      masterUserId: req.params.masterUserId,
      symbol: String(req.body.symbol),
      side: req.body.side,
      quantity: Number(req.body.quantity),
      price: Number(req.body.price),
    });
    await repository?.saveTradeResult(result);

    // Record in Merkle ledger
    const leaf = merkleLedger.appendTrade({
      tradeId: result.masterTrade.id,
      symbol: result.masterTrade.symbol,
      side: result.masterTrade.side,
      quantity: result.masterTrade.quantity,
      price: result.masterTrade.price,
      timestamp: result.masterTrade.createdAt,
    });
    await repository?.saveMerkleLeaf(leaf);

    // Create trade intent
    const intent = createTradeIntent({
      id: randomUUID(),
      masterUserId: req.params.masterUserId,
      symbol: result.masterTrade.symbol,
      side: result.masterTrade.side,
      quantity: result.masterTrade.quantity,
      price: result.masterTrade.price,
    });
    activeIntents.set(intent.hash, intent);
    await repository?.saveIntent(intent);

    // Notify all followers
    const subscriptions = engine.snapshot().subscriptions.filter(
      (s) => s.masterUserId === req.params.masterUserId,
    );
    for (const sub of subscriptions) {
      const notif: TradeNotification = {
        id: randomUUID(),
        masterUserId: req.params.masterUserId,
        followerUserId: sub.followerUserId,
        subscriptionId: sub.id,
        tradeId: result.masterTrade.id,
        symbol: result.masterTrade.symbol,
        side: result.masterTrade.side,
        quantity: result.masterTrade.quantity,
        price: result.masterTrade.price,
        status: "pending",
        intentHash: intent.hash,
        createdAt: new Date().toISOString(),
        timeoutSec: 60,
      };
      pendingNotifications.push(notif);
      await repository?.saveNotification(notif);
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.post("/fees/subscription/accrue", async (_req, res) => {
  try {
    const entries = engine.accrueMonthlySubscriptionFees();
    await repository?.saveFeeEntries(entries);
    res.status(201).json(entries);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.get("/leaderboard", (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  res.json(engine.getLeaderboard());
});

app.get("/snapshot", (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  res.json(engine.snapshot());
});

app.get("/fees", async (req, res) => {
  if (repository) {
    const entries = await repository.listFees({
      subscriptionId: typeof req.query.subscriptionId === "string" ? req.query.subscriptionId : undefined,
      masterUserId: typeof req.query.masterUserId === "string" ? req.query.masterUserId : undefined,
      followerUserId: typeof req.query.followerUserId === "string" ? req.query.followerUserId : undefined,
    });
    res.json(entries);
    return;
  }

  const snapshot = engine.snapshot();
  let entries = snapshot.fees;

  if (typeof req.query.subscriptionId === "string") {
    entries = entries.filter((entry) => entry.subscriptionId === req.query.subscriptionId);
  }

  if (typeof req.query.masterUserId === "string") {
    const subscriptionIds = new Set(
      snapshot.subscriptions
        .filter((sub) => sub.masterUserId === req.query.masterUserId)
        .map((sub) => sub.id)
    );
    entries = entries.filter((entry) => subscriptionIds.has(entry.subscriptionId));
  }

  if (typeof req.query.followerUserId === "string") {
    const subscriptionIds = new Set(
      snapshot.subscriptions
        .filter((sub) => sub.followerUserId === req.query.followerUserId)
        .map((sub) => sub.id)
    );
    entries = entries.filter((entry) => subscriptionIds.has(entry.subscriptionId));
  }

  res.json(entries);
});

/* ═══════════════════════════════════════════════════════════════
   Trades — mirrored & master trades visible to the logged-in user
   ═══════════════════════════════════════════════════════════════ */

app.get("/trades", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const snap = engine.snapshot();
  const user = snap.users.find((u) => u.id === userId);

  // Admin sees everything
  if (user?.role === "admin") {
    res.json(snap.mirroredTrades);
    return;
  }

  // Master: trades where they are the master
  // Follower: trades from their subscriptions
  const mySubs = snap.subscriptions.filter(
    (s) => s.followerUserId === userId || s.masterUserId === userId,
  );
  const subIds = new Set(mySubs.map((s) => s.id));
  const trades = snap.mirroredTrades.filter((t) => subIds.has(t.subscriptionId));
  res.json(trades);
});

/* ═══════════════════════════════════════════════════════════════
   Master Detail — single master profile with aggregated stats
   ═══════════════════════════════════════════════════════════════ */

app.get("/masters/:id", async (req, res) => {
  const masters = repository ? await repository.listMasters() : engine.snapshot().masters;
  const master = masters.find((m) => m.userId === req.params.id);
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const snap = engine.snapshot();
  const subs = snap.subscriptions.filter((s) => s.masterUserId === req.params.id);
  const subIds = new Set(subs.map((s) => s.id));
  const trades = snap.mirroredTrades.filter((t) => subIds.has(t.subscriptionId));
  const fees = snap.fees.filter((f) => subIds.has(f.subscriptionId));

  res.json({
    master,
    subscriptions: subs,
    trades,
    fees,
    stats: {
      followerCount: subs.length,
      totalTrades: trades.length,
      totalFees: fees.reduce((sum, f) => sum + f.amount, 0),
    },
  });
});

/* ═══════════════════════════════════════════════════════════════
   Risk overview — drawdown & alerts per subscription
   ═══════════════════════════════════════════════════════════════ */

app.get("/risk", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const snap = engine.snapshot();
  const user = snap.users.find((u) => u.id === userId);

  const subs = user?.role === "admin"
    ? snap.subscriptions
    : snap.subscriptions.filter((s) => s.followerUserId === userId);

  const alerts: Array<Record<string, unknown>> = [];

  for (const sub of subs) {
    const masterUser = snap.users.find((u) => u.id === sub.masterUserId);
    const followerUser = snap.users.find((u) => u.id === sub.followerUserId);
    const account = snap.subscriptionAccounts.find((a) => a.subscriptionId === sub.id);
    const currentEquity = account?.equity ?? sub.startEquity;
    const drawdownPct = sub.startEquity > 0
      ? (sub.startEquity - currentEquity) / sub.startEquity
      : 0;
    const usage = sub.riskControls.maxDrawdownPercent > 0
      ? (drawdownPct * 100) / sub.riskControls.maxDrawdownPercent
      : 0;

    if (usage > 0.7) {
      alerts.push({
        id: `alert-${sub.id}`,
        subscriptionId: sub.id,
        masterName: masterUser?.name ?? sub.masterUserId,
        followerName: followerUser?.name ?? sub.followerUserId,
        severity: usage > 0.9 ? "critical" : "high",
        type: "drawdown_warning",
        message: `Drawdown at ${(drawdownPct * 100).toFixed(1)}% of ${(sub.riskControls.maxDrawdownPercent).toFixed(0)}% limit`,
        timestamp: new Date().toISOString(),
      });
    }
    if (sub.riskControls.paused) {
      alerts.push({
        id: `alert-paused-${sub.id}`,
        subscriptionId: sub.id,
        masterName: masterUser?.name ?? sub.masterUserId,
        followerName: followerUser?.name ?? sub.followerUserId,
        severity: "medium",
        type: "subscription_paused",
        message: `Subscription paused`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const subscriptionsWithNames = subs.map((sub) => {
    const masterUser = snap.users.find((u) => u.id === sub.masterUserId);
    const followerUser = snap.users.find((u) => u.id === sub.followerUserId);
    const account = snap.subscriptionAccounts.find((a) => a.subscriptionId === sub.id);
    const currentEquity = account?.equity ?? sub.startEquity;
    const drawdownPct = sub.startEquity > 0
      ? (sub.startEquity - currentEquity) / sub.startEquity
      : 0;
    return {
      ...sub,
      masterName: masterUser?.name ?? sub.masterUserId,
      followerName: followerUser?.name ?? sub.followerUserId,
      currentDrawdownPercent: drawdownPct,
    };
  });

  res.json({ alerts, subscriptions: subscriptionsWithNames });
});

/* ═══════════════════════════════════════════════════════════════
   Become-a-Master — any user can register as a master trader
   ═══════════════════════════════════════════════════════════════ */

app.post("/become-master", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const user = engine.snapshot().users.find((u) => u.id === userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Update role to master (or both if already follower with subscriptions)
    const existingSubs = engine.snapshot().subscriptions.filter((s) => s.followerUserId === userId);
    const newRole = existingSubs.length > 0 ? "both" as const : "master" as const;

    // Re-create user with updated role
    engine.createUser({ ...user, role: newRole });
    await repository?.saveUser({ ...user, role: newRole });
    await repository?.updateUserRole(userId, newRole);

    const profile = engine.createMasterProfile(toMasterProfile({ ...req.body, userId }));
    await repository?.saveMasterProfile(profile);

    res.status(201).json({ user: { ...user, role: newRole }, profile });
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

/* ═══════════════════════════════════════════════════════════════
   Follow & Snapshot Copy — two modes of copying a master
   "follow" = ongoing copy trading (master trades reflected)
   "snapshot" = one-time portfolio copy (no further mirroring)
   ═══════════════════════════════════════════════════════════════ */

app.get("/masters/:masterUserId/min-follow", (req, res) => {
  const masterUserId = req.params.masterUserId;
  const positions = paperPositions.get(masterUserId);

  if (!positions || positions.size === 0) {
    res.json({ minAmount: 0, step: 0, positions: [] });
    return;
  }

  // Compute GCD of all share counts to find the minimum lot
  function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
  const quantities = [...positions.values()].map((p) => p.quantity);
  let g = quantities[0];
  for (let i = 1; i < quantities.length; i++) {
    g = gcd(g, quantities[i]);
  }

  const minLotPositions: Array<{ symbol: string; name: string; quantity: number; price: number; value: number }> = [];
  let minAmount = 0;

  for (const [symbol, pos] of positions) {
    const lotQty = pos.quantity / g;
    const price = livePrices.get(symbol) ?? pos.avgPrice;
    const stock = SEED_STOCKS.find((s) => s.symbol === symbol);
    const value = round2(lotQty * price);
    minLotPositions.push({ symbol, name: stock?.name ?? symbol, quantity: lotQty, price, value });
    minAmount += value;
  }

  res.json({
    minAmount: round2(minAmount),
    step: round2(minAmount),
    positions: minLotPositions,
  });
});

app.post("/follow/:masterUserId", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const allocatedCapital = Number(req.body.allocatedCapital);
    if (!allocatedCapital || allocatedCapital <= 0) {
      res.status(400).json({ error: "allocatedCapital must be positive" });
      return;
    }

    const mode: "follow" | "snapshot" = req.body.mode === "snapshot" ? "snapshot" : "follow";

    const subscription = engine.followMaster({
      id: randomUUID(),
      followerUserId: userId,
      masterUserId: req.params.masterUserId,
      allocatedCapital,
      mode,
    });
    await repository?.saveSubscription(subscription);

    // Copy master's current positions proportionally into the subscription account
    const masterPositions = paperPositions.get(req.params.masterUserId);
    const copiedPositions: CopyPosition[] = [];

    if (masterPositions && masterPositions.size > 0) {
      // Calculate master's total portfolio value
      let masterPortfolioValue = 0;
      for (const [symbol, pos] of masterPositions) {
        const price = livePrices.get(symbol) ?? pos.avgPrice;
        masterPortfolioValue += pos.quantity * price;
      }

      // Proportional allocation
      const ratio = masterPortfolioValue > 0 ? allocatedCapital / masterPortfolioValue : 0;

      for (const [symbol, pos] of masterPositions) {
        const price = livePrices.get(symbol) ?? pos.avgPrice;
        const qty = Math.floor(pos.quantity * ratio);
        if (qty <= 0) continue;

        // Apply to subscription account in engine
        engine.applyTradeToSubscription(subscription.id, "buy", symbol, qty, price);

        // Also apply to follower's paper positions
        ensurePaperUser(userId);
        const followerCash = paperCash.get(userId)!;
        const total = round2(qty * price);
        if (followerCash >= total) {
          paperCash.set(userId, round2(followerCash - total));
          const existing = paperPositions.get(userId)!.get(symbol);
          if (existing) {
            const newQty = existing.quantity + qty;
            const newAvg = round2((existing.avgPrice * existing.quantity + price * qty) / newQty);
            paperPositions.get(userId)!.set(symbol, { quantity: newQty, avgPrice: newAvg });
          } else {
            paperPositions.get(userId)!.set(symbol, { quantity: qty, avgPrice: price });
          }
        }

        const stock = SEED_STOCKS.find((s) => s.symbol === symbol);
        copiedPositions.push({
          symbol,
          name: stock?.name ?? symbol,
          quantity: qty,
          avgPrice: price,
          currentPrice: price,
          marketValue: round2(qty * price),
          pnl: 0,
        });

        // Record as a mirrored trade
        const mirroredTrade = {
          id: randomUUID(),
          sourceTradeId: `initial-copy-${subscription.id}`,
          subscriptionId: subscription.id,
          followerUserId: userId,
          symbol,
          side: "buy" as const,
          quantity: qty,
          price,
          notional: round2(qty * price),
          createdAt: new Date().toISOString(),
        };
        // store notification
        const notif: TradeNotification = {
          id: randomUUID(),
          masterUserId: req.params.masterUserId,
          followerUserId: userId,
          subscriptionId: subscription.id,
          tradeId: mirroredTrade.id,
          symbol,
          side: "buy",
          quantity: qty,
          price,
          status: "approved",
          intentHash: "",
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
          timeoutSec: 60,
        };
        pendingNotifications.push(notif);
      }
    }

    res.status(201).json({ subscription, copiedPositions });
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

/* ═══════════════════════════════════════════════════════════════
   Trade Notifications — master trade → follower approval
   ═══════════════════════════════════════════════════════════════ */

app.get("/notifications", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  if (repository) {
    const notifications = await repository.listNotifications(userId);
    res.json(notifications);
  } else {
    res.json(pendingNotifications.filter((n) => n.followerUserId === userId));
  }
});

app.post("/notifications/:id/approve", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const notif = pendingNotifications.find((n) => n.id === req.params.id && n.followerUserId === userId);
    if (!notif) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    // Check timeout
    const elapsed = (Date.now() - new Date(notif.createdAt).getTime()) / 1000;
    if (elapsed > notif.timeoutSec) {
      notif.status = "expired";
      await repository?.updateNotificationStatus(notif.id, "expired");
      res.status(410).json({ error: "Approval timeout expired" });
      return;
    }

    // Verify intent hash
    const intent = activeIntents.get(notif.intentHash);
    if (intent) {
      const verification = verifyIntent(intent);
      if (!verification.valid) {
        res.status(400).json({ error: verification.reason });
        return;
      }
      intent.status = "approved";
    }

    notif.status = "approved";
    notif.decidedAt = new Date().toISOString();
    await repository?.updateNotificationStatus(notif.id, "approved");

    // Apply the mirrored trade to follower's portfolio
    const subscription = engine.snapshot().subscriptions.find((s) => s.id === notif.subscriptionId);
    if (subscription) {
      const masterUser = engine.snapshot().users.find((u) => u.id === notif.masterUserId);
      const followerUser = engine.snapshot().users.find((u) => u.id === notif.followerUserId);
      const followerPortfolio = engine.snapshot().portfolios.find((p) => p.userId === userId);
      const followerProfile = userProfiles.get(userId);
      const masterProfile = userProfiles.get(notif.masterUserId);

      // Use MARA to compute adjusted quantity
      const maraResult = calculateMARA({
        masterQuantity: notif.quantity,
        masterEquity: masterUser?.initialCapital ?? 100000,
        followerEquity: followerUser?.initialCapital ?? 100000,
        masterVolatility: masterProfile?.volatilityTolerance ?? 15,
        followerVolatility: followerProfile?.volatilityTolerance ?? 15,
        masterRiskScore: masterProfile?.riskScore ?? 50,
        followerRiskScore: followerProfile?.riskScore ?? 50,
        price: notif.price,
        followerFreeMargin: followerPortfolio?.cash ?? 0,
        followerLeverage: followerProfile?.leverage ?? 1,
      });

      // Record in Merkle ledger
      const leaf = merkleLedger.appendTrade({
        tradeId: `approved-${notif.id}`,
        symbol: notif.symbol,
        side: notif.side,
        quantity: maraResult.adjustedQuantity,
        price: notif.price,
        timestamp: new Date().toISOString(),
      });
      await repository?.saveMerkleLeaf(leaf);

      res.json({ ...notif, maraResult, merkleLeafHash: leaf.hash });
    } else {
      res.json(notif);
    }
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

app.post("/notifications/:id/reject", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const notif = pendingNotifications.find((n) => n.id === req.params.id && n.followerUserId === userId);
  if (!notif) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  notif.status = "rejected";
  notif.decidedAt = new Date().toISOString();
  await repository?.updateNotificationStatus(notif.id, "rejected");
  res.json(notif);
});

/* ═══════════════════════════════════════════════════════════════
   User Profile — volatility, risk, leverage settings
   ═══════════════════════════════════════════════════════════════ */

app.get("/profile", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const profile = repository
    ? await repository.getUserProfile(userId)
    : userProfiles.get(userId);

  res.json(profile ?? { userId, volatilityTolerance: 15, riskScore: 50, leverage: 1 });
});

app.put("/profile", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const profile = {
      userId,
      volatilityTolerance: Number(req.body.volatilityTolerance ?? 15),
      riskScore: Math.min(100, Math.max(0, Number(req.body.riskScore ?? 50))),
      leverage: Math.max(1, Number(req.body.leverage ?? 1)),
    };

    userProfiles.set(userId, profile);
    await repository?.saveUserProfile(profile);

    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: toErrorMessage(error) });
  }
});

/* ═══════════════════════════════════════════════════════════════
   Merkle Tree — audit trail & Proof-of-Execution
   ═══════════════════════════════════════════════════════════════ */

app.get("/merkle/root", (_req, res) => {
  res.json(merkleLedger.computeRoot());
});

app.get("/merkle/leaves", (_req, res) => {
  res.json(merkleLedger.getLeaves());
});

app.get("/merkle/verify/:tradeId", (req, res) => {
  const exists = merkleLedger.verifyLeaf(req.params.tradeId);
  res.json({ tradeId: req.params.tradeId, verified: exists, root: merkleLedger.computeRoot() });
});

/* ═══════════════════════════════════════════════════════════════
   In-memory state for notifications, intents, profiles
   ═══════════════════════════════════════════════════════════════ */

const pendingNotifications: TradeNotification[] = [];
const activeIntents = new Map<string, import("../../../packages/domain/src/intent-auth.js").TradeIntent>();
const userProfiles = new Map<string, import("../../../packages/domain/src/index.js").UserProfile>();

/* ═══════════════════════════════════════════════════════════════
   Paper Trading Simulator — self-contained market simulation.
   Uses static seed prices + random walk.  No external API key needed.
   ═══════════════════════════════════════════════════════════════ */

interface SimulatedQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

interface PaperPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

const SEED_STOCKS: Array<{ symbol: string; name: string; basePrice: number }> = [
  { symbol: "AAPL", name: "Apple Inc.", basePrice: 192.50 },
  { symbol: "MSFT", name: "Microsoft Corp.", basePrice: 425.30 },
  { symbol: "GOOGL", name: "Alphabet Inc.", basePrice: 178.40 },
  { symbol: "AMZN", name: "Amazon.com Inc.", basePrice: 198.60 },
  { symbol: "TSLA", name: "Tesla Inc.", basePrice: 252.80 },
  { symbol: "NVDA", name: "NVIDIA Corp.", basePrice: 141.20 },
  { symbol: "META", name: "Meta Platforms", basePrice: 590.10 },
  { symbol: "JPM", name: "JPMorgan Chase", basePrice: 205.40 },
  { symbol: "V", name: "Visa Inc.", basePrice: 289.70 },
  { symbol: "BND", name: "Vanguard Total Bond", basePrice: 72.80 },
  { symbol: "VTI", name: "Vanguard Total Stock", basePrice: 270.50 },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", basePrice: 510.20 },
];

/* Simple in-memory state per user */
const paperCash = new Map<string, number>();
const paperPositions = new Map<string, Map<string, { quantity: number; avgPrice: number }>>();
const paperOrders = new Map<string, PaperOrder[]>();

/* Simulated live prices: base ± small random walk */
const livePrices = new Map<string, number>();
const dayOpen = new Map<string, number>();
for (const stock of SEED_STOCKS) {
  livePrices.set(stock.symbol, stock.basePrice);
  dayOpen.set(stock.symbol, stock.basePrice);
}

/* Advance prices every 5 seconds with random walk */
setInterval(() => {
  for (const stock of SEED_STOCKS) {
    const current = livePrices.get(stock.symbol)!;
    const drift = (Math.random() - 0.48) * 0.004; // slight upward bias
    const next = Math.max(current * (1 + drift), 1);
    livePrices.set(stock.symbol, round2(next));
  }
}, 5000);

function ensurePaperUser(userId: string) {
  if (!paperCash.has(userId)) {
    const user = engine.snapshot().users.find((u) => u.id === userId);
    paperCash.set(userId, user?.initialCapital ?? 100000);
    paperPositions.set(userId, new Map());
    paperOrders.set(userId, []);
  }
}

/* GET /simulation/quotes */
app.get("/simulation/quotes", (_req, res) => {
  const quotes: SimulatedQuote[] = SEED_STOCKS.map((stock) => {
    const price = livePrices.get(stock.symbol)!;
    const open = dayOpen.get(stock.symbol)!;
    const change = round2(price - open);
    const changePercent = round2((change / open) * 100);
    const high = round2(Math.max(price, open) * (1 + Math.random() * 0.01));
    const low = round2(Math.min(price, open) * (1 - Math.random() * 0.01));
    const volume = Math.floor(1_000_000 + Math.random() * 50_000_000);
    return { symbol: stock.symbol, name: stock.name, price, change, changePercent, high, low, volume };
  });
  res.json(quotes);
});

/* POST /simulation/orders — place a paper trade */
app.post("/simulation/orders", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  ensurePaperUser(userId);

  const { symbol, side, quantity } = req.body as { symbol: string; side: "buy" | "sell"; quantity: number };
  const price = livePrices.get(String(symbol).toUpperCase());
  if (!price) {
    res.status(400).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }

  const qty = Math.max(1, Math.floor(Number(quantity)));
  const total = round2(price * qty);

  const cash = paperCash.get(userId)!;
  const positions = paperPositions.get(userId)!;
  const orders = paperOrders.get(userId)!;

  if (side === "buy") {
    if (cash < total) {
      res.status(400).json({ error: `Insufficient cash. Have $${cash.toFixed(2)}, need $${total.toFixed(2)}` });
      return;
    }
    paperCash.set(userId, round2(cash - total));
    const existing = positions.get(symbol);
    if (existing) {
      const newQty = existing.quantity + qty;
      const newAvg = round2((existing.avgPrice * existing.quantity + price * qty) / newQty);
      positions.set(symbol, { quantity: newQty, avgPrice: newAvg });
    } else {
      positions.set(symbol, { quantity: qty, avgPrice: price });
    }
  } else {
    const existing = positions.get(symbol);
    if (!existing || existing.quantity < qty) {
      res.status(400).json({ error: `Insufficient shares. Have ${existing?.quantity ?? 0}, want to sell ${qty}` });
      return;
    }
    paperCash.set(userId, round2(cash + total));
    const newQty = existing.quantity - qty;
    if (newQty === 0) {
      positions.delete(symbol);
    } else {
      positions.set(symbol, { quantity: newQty, avgPrice: existing.avgPrice });
    }
  }

  const order: PaperOrder = {
    id: randomUUID(),
    userId,
    symbol: symbol.toUpperCase(),
    side: side as "buy" | "sell",
    quantity: qty,
    price,
    total,
    status: "filled",
    filledAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
  orders.push(order);

  // Persist to DB
  await repository?.savePaperOrder(order);

  // Record in Merkle ledger
  const leaf = merkleLedger.appendTrade({
    tradeId: order.id,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
    timestamp: order.filledAt,
  });
  await repository?.saveMerkleLeaf(leaf);

  // ── Mirror to follow-mode subscriptions (copy trade reflection) ──
  const mirroredCopies: Array<Record<string, unknown>> = [];
  const isMaster = engine.snapshot().masters.some((m) => m.userId === userId);

  if (isMaster) {
    const snap = engine.snapshot();
    const followSubs = snap.subscriptions.filter(
      (s) => s.masterUserId === userId && s.mode === "follow" && !s.riskControls.paused,
    );
    const masterUser = snap.users.find((u) => u.id === userId);
    const masterProfile = userProfiles.get(userId);

    for (const sub of followSubs) {
      const followerUser = snap.users.find((u) => u.id === sub.followerUserId);
      const followerProfile = userProfiles.get(sub.followerUserId);
      const followerPortfolio = snap.portfolios.find((p) => p.userId === sub.followerUserId);

      // Use MARA to compute adjusted quantity
      const maraResult = calculateMARA({
        masterQuantity: qty,
        masterEquity: masterUser?.initialCapital ?? 100000,
        followerEquity: followerUser?.initialCapital ?? 100000,
        masterVolatility: masterProfile?.volatilityTolerance ?? 15,
        followerVolatility: followerProfile?.volatilityTolerance ?? 15,
        masterRiskScore: masterProfile?.riskScore ?? 50,
        followerRiskScore: followerProfile?.riskScore ?? 50,
        price,
        followerFreeMargin: followerPortfolio?.cash ?? 0,
        followerLeverage: followerProfile?.leverage ?? 1,
      });

      const adjQty = Math.max(1, Math.floor(maraResult.adjustedQuantity));
      const adjTotal = round2(adjQty * price);

      // Apply to subscription account in engine
      engine.applyTradeToSubscription(sub.id, side as "buy" | "sell", symbol.toUpperCase(), adjQty, price);

      // Apply to follower's paper portfolio
      ensurePaperUser(sub.followerUserId);
      const fCash = paperCash.get(sub.followerUserId)!;
      const fPositions = paperPositions.get(sub.followerUserId)!;
      const fOrders = paperOrders.get(sub.followerUserId)!;

      if (side === "buy") {
        if (fCash < adjTotal) continue; // Skip if insufficient
        paperCash.set(sub.followerUserId, round2(fCash - adjTotal));
        const existing = fPositions.get(symbol.toUpperCase());
        if (existing) {
          const newQty = existing.quantity + adjQty;
          const newAvg = round2((existing.avgPrice * existing.quantity + price * adjQty) / newQty);
          fPositions.set(symbol.toUpperCase(), { quantity: newQty, avgPrice: newAvg });
        } else {
          fPositions.set(symbol.toUpperCase(), { quantity: adjQty, avgPrice: price });
        }
      } else {
        const existing = fPositions.get(symbol.toUpperCase());
        if (!existing || existing.quantity < adjQty) continue; // Skip if insufficient
        paperCash.set(sub.followerUserId, round2(fCash + adjTotal));
        const newQty = existing.quantity - adjQty;
        if (newQty === 0) {
          fPositions.delete(symbol.toUpperCase());
        } else {
          fPositions.set(symbol.toUpperCase(), { quantity: newQty, avgPrice: existing.avgPrice });
        }
      }

      // Record as follower paper order
      const followerOrder: PaperOrder = {
        id: randomUUID(),
        userId: sub.followerUserId,
        symbol: symbol.toUpperCase(),
        side: side as "buy" | "sell",
        quantity: adjQty,
        price,
        total: adjTotal,
        status: "filled",
        filledAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
      fOrders.push(followerOrder);
      await repository?.savePaperOrder(followerOrder);

      // Create notification for follower
      const notif: TradeNotification = {
        id: randomUUID(),
        masterUserId: userId,
        followerUserId: sub.followerUserId,
        subscriptionId: sub.id,
        tradeId: followerOrder.id,
        symbol: symbol.toUpperCase(),
        side: side as "buy" | "sell",
        quantity: adjQty,
        price,
        status: "approved",
        intentHash: "",
        createdAt: new Date().toISOString(),
        decidedAt: new Date().toISOString(),
        timeoutSec: 60,
      };
      pendingNotifications.push(notif);

      mirroredCopies.push({
        followerUserId: sub.followerUserId,
        subscriptionId: sub.id,
        symbol: symbol.toUpperCase(),
        side,
        originalQty: qty,
        adjustedQty: adjQty,
        maraFactors: {
          capitalFactor: maraResult.capitalFactor,
          volatilityFactor: maraResult.volatilityFactor,
          riskFactor: maraResult.riskFactor,
        },
      });
    }
  }

  res.status(201).json({ order, mirroredCopies });
});

/* GET /simulation/portfolio */
app.get("/simulation/portfolio", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  ensurePaperUser(userId);

  const cash = paperCash.get(userId)!;
  const positions = paperPositions.get(userId)!;

  const positionList: PaperPosition[] = [];
  let totalMarketValue = 0;

  for (const [symbol, pos] of positions) {
    const currentPrice = livePrices.get(symbol)!;
    const marketValue = round2(currentPrice * pos.quantity);
    const pnl = round2((currentPrice - pos.avgPrice) * pos.quantity);
    const pnlPercent = round2(((currentPrice - pos.avgPrice) / pos.avgPrice) * 100);
    const stock = SEED_STOCKS.find((s) => s.symbol === symbol);
    positionList.push({
      symbol,
      name: stock?.name ?? symbol,
      quantity: pos.quantity,
      avgPrice: pos.avgPrice,
      currentPrice,
      marketValue,
      pnl,
      pnlPercent,
    });
    totalMarketValue += marketValue;
  }

  res.json({
    cash: round2(cash),
    marketValue: round2(totalMarketValue),
    totalEquity: round2(cash + totalMarketValue),
    positions: positionList,
  });
});

/* GET /simulation/orders */
app.get("/simulation/orders", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  ensurePaperUser(userId);
  res.json(paperOrders.get(userId) ?? []);
});

/* ═══════════════════════════════════════════════════════════════
   MARA Demo — interactive demonstration between two users
   ═══════════════════════════════════════════════════════════════ */

app.post("/demo/mara", (req, res) => {
  const {
    masterQuantity = 10,
    masterEquity = 100000,
    followerEquity = 50000,
    masterVolatility = 15,
    followerVolatility = 10,
    masterRiskScore = 70,
    followerRiskScore = 40,
    price = 192.50,
    followerFreeMargin = 50000,
    followerLeverage = 1,
  } = req.body as Record<string, number>;

  const result = calculateMARA({
    masterQuantity,
    masterEquity,
    followerEquity,
    masterVolatility,
    followerVolatility,
    masterRiskScore,
    followerRiskScore,
    price,
    followerFreeMargin,
    followerLeverage,
  });

  res.json({
    inputs: {
      masterQuantity,
      masterEquity,
      followerEquity,
      masterVolatility,
      followerVolatility,
      masterRiskScore,
      followerRiskScore,
      price,
      followerFreeMargin,
      followerLeverage,
    },
    result,
    explanation: {
      formula: "Q_adj = Q_base × C × V × R",
      capitalFactor: `C = E_F / E_M = ${followerEquity} / ${masterEquity} = ${result.capitalFactor}`,
      volatilityFactor: `V = σ_F / σ_M = ${followerVolatility} / ${masterVolatility} = ${result.volatilityFactor}`,
      riskFactor: `R = R_F / R_M = ${followerRiskScore} / ${masterRiskScore} = ${result.riskFactor}`,
      rawCalculation: `Q_adj = ${masterQuantity} × ${result.capitalFactor} × ${result.volatilityFactor} × ${result.riskFactor} = ${result.rawAdjustedQuantity}`,
      safetyBound: `Q_max = (${followerFreeMargin} × ${followerLeverage}) / ${price} = ${result.maxQuantity}`,
      final: `Q_final = min(${result.rawAdjustedQuantity}, ${result.maxQuantity}) = ${result.adjustedQuantity}`,
    },
  });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

function toUser(payload: unknown): User {
  const typed = payload as Record<string, unknown>;
  const role = String(typed.role) as UserRole;

  return {
    id: String(typed.id),
    name: String(typed.name),
    role,
    initialCapital: Number(typed.initialCapital),
  };
}

function toMasterProfile(payload: unknown): MasterProfile {
  const typed = payload as Record<string, unknown>;

  return {
    userId: String(typed.userId),
    displayName: String(typed.displayName),
    performanceFeePercent: Number(typed.performanceFeePercent),
    monthlySubscriptionFee: Number(typed.monthlySubscriptionFee),
    strategyDescription: String(typed.strategyDescription),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function requireUserId(req: express.Request, res: express.Response): string | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return undefined;
  }

  const token = header.replace("Bearer ", "").trim();
  const userId = sessions.get(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid session token" });
    return undefined;
  }

  return userId;
}

function requireAdmin(req: express.Request, res: express.Response): string | undefined {
  const userId = requireUserId(req, res);
  if (!userId) return undefined;
  const user = engine.snapshot().users.find((u) => u.id === userId);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return undefined;
  }
  return userId;
}

function createSession(userId: string): string {
  const token = randomUUID();
  sessions.set(token, userId);
  return token;
}

function hashPassword(password: string): string {
  const salt = randomUUID();
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, originalKey] = hash.split(":");
  if (!salt || !originalKey) {
    return false;
  }

  const providedKey = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(providedKey, "hex"), Buffer.from(originalKey, "hex"));
}

async function createRepository(): Promise<InvestSyncRepository | undefined> {
  const pool = await createPoolFromEnv();
  if (!pool) {
    return undefined;
  }

  return new InvestSyncRepository(pool);
}

async function hydrateEngineState(): Promise<void> {
  if (!repository) {
    return;
  }

  const snapshot = await repository.loadBootstrap();

  for (const user of snapshot.users) {
    engine.createUser(user);
  }

  for (const master of snapshot.masters) {
    engine.createMasterProfile(master);
  }

  for (const subscription of snapshot.subscriptions) {
    engine.hydrateSubscription(subscription);
  }
}

async function getCredentialHash(userId: string): Promise<string | undefined> {
  const cached = credentials.get(userId);
  if (cached) {
    return cached;
  }

  const fromRepository = await repository?.getCredentialHash(userId);
  if (fromRepository) {
    credentials.set(userId, fromRepository);
  }

  return fromRepository;
}
