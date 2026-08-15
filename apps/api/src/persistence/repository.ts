import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import type {
  FeeLedgerEntry,
  FollowSubscription,
  MasterProfile,
  MirroredTrade,
  PaperOrder,
  Trade,
  TradeNotification,
  User,
  UserProfile,
} from "../../../../packages/domain/src/index.js";
import type { TradeIntent } from "../../../../packages/domain/src/intent-auth.js";
import type { MerkleLeaf } from "../../../../packages/domain/src/merkle-tree.js";

type FeeFilter = {
  subscriptionId?: string;
  masterUserId?: string;
  followerUserId?: string;
};

export class InvestSyncRepository {
  constructor(private readonly pool: Pool) {}

  async saveUser(user: User): Promise<void> {
    await this.pool.execute(
      `
      INSERT INTO users (id, name, role, initial_capital)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        role = VALUES(role),
        initial_capital = VALUES(initial_capital)
      `,
      [user.id, user.name, user.role, user.initialCapital]
    );
  }

  async saveCredential(userId: string, passwordHash: string): Promise<void> {
    await this.pool.execute(
      `
      INSERT INTO user_credentials (user_id, password_hash)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
      `,
      [userId, passwordHash]
    );
  }

  async getCredentialHash(userId: string): Promise<string | undefined> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT password_hash FROM user_credentials WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const typedRows = rows as Array<{ password_hash: string }>;

    return typedRows[0]?.password_hash;
  }

  async saveMasterProfile(profile: MasterProfile): Promise<void> {
    await this.pool.execute(
      `
      INSERT INTO master_profiles (
        user_id,
        display_name,
        performance_fee_percent,
        monthly_subscription_fee,
        strategy_description
      )
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        display_name = VALUES(display_name),
        performance_fee_percent = VALUES(performance_fee_percent),
        monthly_subscription_fee = VALUES(monthly_subscription_fee),
        strategy_description = VALUES(strategy_description)
      `,
      [
        profile.userId,
        profile.displayName,
        profile.performanceFeePercent,
        profile.monthlySubscriptionFee,
        profile.strategyDescription,
      ]
    );
  }

  async saveSubscription(subscription: FollowSubscription): Promise<void> {
    await this.pool.execute(
      `
      INSERT INTO subscriptions (
        id,
        follower_user_id,
        master_user_id,
        allocated_capital,
        start_equity,
        high_water_mark,
        paused,
        max_drawdown_percent,
        mode
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        follower_user_id = VALUES(follower_user_id),
        master_user_id = VALUES(master_user_id),
        allocated_capital = VALUES(allocated_capital),
        start_equity = VALUES(start_equity),
        high_water_mark = VALUES(high_water_mark),
        paused = VALUES(paused),
        max_drawdown_percent = VALUES(max_drawdown_percent),
        mode = VALUES(mode)
      `,
      [
        subscription.id,
        subscription.followerUserId,
        subscription.masterUserId,
        subscription.allocatedCapital,
        subscription.startEquity,
        subscription.highWaterMark,
        subscription.riskControls.paused,
        subscription.riskControls.maxDrawdownPercent,
        subscription.mode,
      ]
    );
  }

  async saveTradeResult(params: {
    masterTrade: Trade;
    mirroredTrades: MirroredTrade[];
    feeEntries: FeeLedgerEntry[];
  }): Promise<void> {
    const { masterTrade, mirroredTrades, feeEntries } = params;

    await this.pool.execute(
      `
      INSERT INTO trade_events (
        id,
        type,
        source_trade_id,
        master_user_id,
        follower_user_id,
        subscription_id,
        symbol,
        side,
        quantity,
        price,
        notional,
        created_at
      )
      VALUES (?, 'master_trade', NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id
      `,
      [
        masterTrade.id,
        masterTrade.masterUserId,
        masterTrade.symbol,
        masterTrade.side,
        masterTrade.quantity,
        masterTrade.price,
        masterTrade.quantity * masterTrade.price,
        masterTrade.createdAt,
      ]
    );

    for (const mirrored of mirroredTrades) {
      await this.pool.execute(
        `
        INSERT INTO trade_events (
          id,
          type,
          source_trade_id,
          master_user_id,
          follower_user_id,
          subscription_id,
          symbol,
          side,
          quantity,
          price,
          notional,
          created_at
        )
        VALUES (?, 'mirrored_trade', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
        `,
        [
          mirrored.id,
          mirrored.sourceTradeId,
          masterTrade.masterUserId,
          mirrored.followerUserId,
          mirrored.subscriptionId,
          mirrored.symbol,
          mirrored.side,
          mirrored.quantity,
          mirrored.price,
          mirrored.notional,
          mirrored.createdAt,
        ]
      );
    }

    await this.saveFeeEntries(feeEntries);
  }

  async saveFeeEntries(entries: FeeLedgerEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.pool.execute(
        `
        INSERT INTO fee_ledger (
          id,
          subscription_id,
          fee_type,
          amount,
          reason,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
        `,
        [entry.id, entry.subscriptionId, entry.type, entry.amount, entry.reason, entry.createdAt]
      );
    }
  }

  async loadBootstrap(): Promise<{
    users: User[];
    masters: MasterProfile[];
    subscriptions: FollowSubscription[];
  }> {
    const [users] = await this.pool.query<RowDataPacket[]>(
      "SELECT id, name, role, initial_capital FROM users"
    );

    const [masters] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT user_id, display_name, performance_fee_percent, monthly_subscription_fee, strategy_description
      FROM master_profiles
      `
    );

    const [subscriptions] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT id, follower_user_id, master_user_id, allocated_capital, start_equity, high_water_mark, paused, max_drawdown_percent, mode
      FROM subscriptions
      `
    );

    const typedUsers = users as Array<{
      id: string;
      name: string;
      role: User["role"];
      initial_capital: number;
    }>;
    const typedMasters = masters as Array<{
      user_id: string;
      display_name: string;
      performance_fee_percent: number;
      monthly_subscription_fee: number;
      strategy_description: string;
    }>;
    const typedSubscriptions = subscriptions as Array<{
      id: string;
      follower_user_id: string;
      master_user_id: string;
      allocated_capital: number;
      start_equity: number;
      high_water_mark: number;
      paused: number;
      max_drawdown_percent: number;
    }>;

    return {
      users: typedUsers.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        initialCapital: Number(row.initial_capital),
      })),
      masters: typedMasters.map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        performanceFeePercent: Number(row.performance_fee_percent),
        monthlySubscriptionFee: Number(row.monthly_subscription_fee),
        strategyDescription: row.strategy_description,
      })),
      subscriptions: typedSubscriptions.map((row) => ({
        id: row.id,
        followerUserId: row.follower_user_id,
        masterUserId: row.master_user_id,
        allocatedCapital: Number(row.allocated_capital),
        startEquity: Number(row.start_equity),
        highWaterMark: Number(row.high_water_mark),
        mode: (row as any).mode === "snapshot" ? "snapshot" as const : "follow" as const,
        riskControls: {
          paused: Boolean(row.paused),
          maxDrawdownPercent: Number(row.max_drawdown_percent),
        },
      })),
    };
  }

  async listMasters(): Promise<MasterProfile[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT user_id, display_name, performance_fee_percent, monthly_subscription_fee, strategy_description
      FROM master_profiles
      ORDER BY created_at DESC
      `
    );

    const typedRows = rows as Array<{
      user_id: string;
      display_name: string;
      performance_fee_percent: number;
      monthly_subscription_fee: number;
      strategy_description: string;
    }>;

    return typedRows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      performanceFeePercent: Number(row.performance_fee_percent),
      monthlySubscriptionFee: Number(row.monthly_subscription_fee),
      strategyDescription: row.strategy_description,
    }));
  }

  async listSubscriptionsByFollower(followerUserId: string): Promise<FollowSubscription[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT id, follower_user_id, master_user_id, allocated_capital, start_equity, high_water_mark, paused, max_drawdown_percent, mode
      FROM subscriptions
      WHERE follower_user_id = ?
      ORDER BY created_at DESC
      `,
      [followerUserId]
    );

    const typedRows = rows as Array<{
      id: string;
      follower_user_id: string;
      master_user_id: string;
      allocated_capital: number;
      start_equity: number;
      high_water_mark: number;
      paused: number;
      max_drawdown_percent: number;
    }>;

    return typedRows.map((row) => ({
      id: row.id,
      followerUserId: row.follower_user_id,
      masterUserId: row.master_user_id,
      allocatedCapital: Number(row.allocated_capital),
      startEquity: Number(row.start_equity),
      highWaterMark: Number(row.high_water_mark),
      mode: (row as any).mode === "snapshot" ? "snapshot" as const : "follow" as const,
      riskControls: {
        paused: Boolean(row.paused),
        maxDrawdownPercent: Number(row.max_drawdown_percent),
      },
    }));
  }

  async listFees(filter: FeeFilter): Promise<FeeLedgerEntry[]> {
    const conditions: string[] = [];
    const values: Array<string> = [];

    if (filter.subscriptionId) {
      conditions.push("fl.subscription_id = ?");
      values.push(filter.subscriptionId);
    }

    if (filter.masterUserId) {
      conditions.push("s.master_user_id = ?");
      values.push(filter.masterUserId);
    }

    if (filter.followerUserId) {
      conditions.push("s.follower_user_id = ?");
      values.push(filter.followerUserId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT fl.id, fl.subscription_id, fl.fee_type, fl.amount, fl.reason, fl.created_at
      FROM fee_ledger fl
      JOIN subscriptions s ON s.id = fl.subscription_id
      ${whereClause}
      ORDER BY fl.created_at DESC
      `,
      values
    );

    const typedRows = rows as Array<{
      id: string;
      subscription_id: string;
      fee_type: FeeLedgerEntry["type"];
      amount: number;
      reason: string;
      created_at: string;
    }>;

    return typedRows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      type: row.fee_type,
      amount: Number(row.amount),
      reason: row.reason,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  /* ── Paper Orders ── */

  async savePaperOrder(order: PaperOrder): Promise<void> {
    await this.pool.execute(
      `INSERT INTO paper_orders (id, user_id, symbol, side, quantity, price, total, status, filled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [order.id, order.userId, order.symbol, order.side, order.quantity, order.price, order.total, order.status, order.filledAt],
    );
  }

  async listPaperOrders(userId: string): Promise<PaperOrder[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id, user_id, symbol, side, quantity, price, total, status, filled_at FROM paper_orders WHERE user_id = ? ORDER BY filled_at DESC",
      [userId],
    );
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      symbol: String(r.symbol),
      side: String(r.side) as "buy" | "sell",
      quantity: Number(r.quantity),
      price: Number(r.price),
      total: Number(r.total),
      status: "filled" as const,
      filledAt: new Date(r.filled_at as string).toISOString(),
    }));
  }

  /* ── User Profiles ── */

  async saveUserProfile(profile: UserProfile): Promise<void> {
    await this.pool.execute(
      `INSERT INTO user_profiles (user_id, volatility_tolerance, risk_score, leverage)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         volatility_tolerance = VALUES(volatility_tolerance),
         risk_score = VALUES(risk_score),
         leverage = VALUES(leverage)`,
      [profile.userId, profile.volatilityTolerance, profile.riskScore, profile.leverage],
    );
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT user_id, volatility_tolerance, risk_score, leverage FROM user_profiles WHERE user_id = ? LIMIT 1",
      [userId],
    );
    const typed = rows as Array<Record<string, unknown>>;
    if (typed.length === 0) return undefined;
    const r = typed[0];
    return {
      userId: String(r.user_id),
      volatilityTolerance: Number(r.volatility_tolerance),
      riskScore: Number(r.risk_score),
      leverage: Number(r.leverage),
    };
  }

  /* ── Trade Notifications ── */

  async saveNotification(n: TradeNotification): Promise<void> {
    await this.pool.execute(
      `INSERT INTO trade_notifications (id, master_user_id, follower_user_id, subscription_id, trade_id, symbol, side, quantity, price, status, intent_hash, timeout_sec, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         decided_at = VALUES(decided_at)`,
      [n.id, n.masterUserId, n.followerUserId, n.subscriptionId, n.tradeId, n.symbol, n.side, n.quantity, n.price, n.status, n.intentHash, n.timeoutSec, n.decidedAt ?? null],
    );
  }

  async listNotifications(followerUserId: string): Promise<TradeNotification[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM trade_notifications WHERE follower_user_id = ? ORDER BY created_at DESC",
      [followerUserId],
    );
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      masterUserId: String(r.master_user_id),
      followerUserId: String(r.follower_user_id),
      subscriptionId: String(r.subscription_id),
      tradeId: String(r.trade_id),
      symbol: String(r.symbol),
      side: String(r.side) as "buy" | "sell",
      quantity: Number(r.quantity),
      price: Number(r.price),
      status: String(r.status) as TradeNotification["status"],
      intentHash: String(r.intent_hash),
      createdAt: new Date(r.created_at as string).toISOString(),
      decidedAt: r.decided_at ? new Date(r.decided_at as string).toISOString() : undefined,
      timeoutSec: Number(r.timeout_sec),
    }));
  }

  async updateNotificationStatus(id: string, status: TradeNotification["status"]): Promise<void> {
    await this.pool.execute(
      "UPDATE trade_notifications SET status = ?, decided_at = NOW() WHERE id = ?",
      [status, id],
    );
  }

  /* ── Trade Intents ── */

  async saveIntent(intent: TradeIntent): Promise<void> {
    await this.pool.execute(
      `INSERT INTO trade_intents (id, master_user_id, symbol, side, quantity, price, nonce, hash, ttl_ms, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [intent.id, intent.masterUserId, intent.symbol, intent.side, intent.quantity, intent.price, intent.nonce, intent.hash, intent.ttlMs, intent.status, intent.createdAt],
    );
  }

  async getIntent(id: string): Promise<TradeIntent | undefined> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM trade_intents WHERE id = ? LIMIT 1",
      [id],
    );
    const typed = rows as Array<Record<string, unknown>>;
    if (typed.length === 0) return undefined;
    const r = typed[0];
    return {
      id: String(r.id),
      masterUserId: String(r.master_user_id),
      symbol: String(r.symbol),
      side: String(r.side) as "buy" | "sell",
      quantity: Number(r.quantity),
      price: Number(r.price),
      nonce: String(r.nonce),
      hash: String(r.hash),
      createdAt: Number(r.created_at),
      ttlMs: Number(r.ttl_ms),
      status: String(r.status) as TradeIntent["status"],
    };
  }

  /* ── Merkle Tree ── */

  async saveMerkleLeaf(leaf: MerkleLeaf): Promise<void> {
    await this.pool.execute(
      `INSERT INTO merkle_leaves (trade_id, symbol, side, quantity, price, leaf_hash, trade_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [leaf.tradeId, leaf.symbol, leaf.side, leaf.quantity, leaf.price, leaf.hash, leaf.timestamp],
    );
  }

  async loadMerkleLeaves(): Promise<MerkleLeaf[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT trade_id, symbol, side, quantity, price, leaf_hash, trade_timestamp FROM merkle_leaves ORDER BY id ASC",
    );
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      tradeId: String(r.trade_id),
      symbol: String(r.symbol),
      side: String(r.side) as "buy" | "sell",
      quantity: Number(r.quantity),
      price: Number(r.price),
      hash: String(r.leaf_hash),
      timestamp: String(r.trade_timestamp),
    }));
  }

  async saveMerkleRoot(root: { rootHash: string; leafCount: number; treeDepth: number }): Promise<void> {
    await this.pool.execute(
      "INSERT INTO merkle_roots (root_hash, leaf_count, tree_depth) VALUES (?, ?, ?)",
      [root.rootHash, root.leafCount, root.treeDepth],
    );
  }

  /* ── Users (extended) ── */

  async listUsers(): Promise<User[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT id, name, role, initial_capital FROM users ORDER BY created_at DESC");
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      role: String(r.role) as User["role"],
      initialCapital: Number(r.initial_capital),
    }));
  }

  async updateUserRole(userId: string, role: User["role"]): Promise<void> {
    await this.pool.execute("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
  }
}
