import {
  calculatePerformanceFee,
  calculateProportionalQuantity,
  defaultRiskControls,
  round2,
  shouldHaltByRisk,
  type FeeLedgerEntry,
  type FollowSubscription,
  type LeaderboardEntry,
  type MasterProfile,
  type MirroredTrade,
  type Portfolio,
  type Trade,
  type User,
} from "../../../packages/domain/src/index.js";

type MasterTradeInput = {
  masterUserId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
};

type EngineSnapshot = {
  users: User[];
  masters: MasterProfile[];
  subscriptions: FollowSubscription[];
  portfolios: Portfolio[];
  subscriptionAccounts: Array<{ subscriptionId: string; cash: number; equity: number; pnl: number; positions: Array<{ symbol: string; quantity: number; averagePrice: number }> }>;
  masterTrades: Trade[];
  mirroredTrades: MirroredTrade[];
  fees: FeeLedgerEntry[];
  leaderboard: LeaderboardEntry[];
};

type SubscriptionAccount = {
  subscriptionId: string;
  cash: number;
  positions: Portfolio["positions"];
  equity: number;
  pnl: number;
};

export class CopyTradingEngine {
  private users = new Map<string, User>();
  private masters = new Map<string, MasterProfile>();
  private subscriptions = new Map<string, FollowSubscription>();
  private subscriptionAccounts = new Map<string, SubscriptionAccount>();
  private portfolios = new Map<string, Portfolio>();
  private masterTrades: Trade[] = [];
  private mirroredTrades: MirroredTrade[] = [];
  private fees: FeeLedgerEntry[] = [];

  createUser(user: User): User {
    this.users.set(user.id, user);
    if (!this.portfolios.has(user.id)) {
      this.portfolios.set(user.id, {
        userId: user.id,
        cash: user.initialCapital,
        positions: [],
        equity: user.initialCapital,
        pnl: 0,
      });
    }

    return user;
  }

  createMasterProfile(profile: MasterProfile): MasterProfile {
    const user = this.users.get(profile.userId);
    if (!user) {
      throw new Error("Master user does not exist");
    }

    this.masters.set(profile.userId, profile);
    return profile;
  }

  followMaster(params: {
    id: string;
    followerUserId: string;
    masterUserId: string;
    allocatedCapital: number;
    mode?: "follow" | "snapshot";
  }): FollowSubscription {
    const follower = this.users.get(params.followerUserId);
    const master = this.masters.get(params.masterUserId);

    if (!follower) {
      throw new Error("Follower user does not exist");
    }

    if (!master) {
      throw new Error("Master profile does not exist");
    }

    const subscription: FollowSubscription = {
      id: params.id,
      followerUserId: params.followerUserId,
      masterUserId: params.masterUserId,
      allocatedCapital: params.allocatedCapital,
      startEquity: params.allocatedCapital,
      highWaterMark: params.allocatedCapital,
      riskControls: defaultRiskControls(),
      mode: params.mode ?? "follow",
    };

    this.subscriptions.set(subscription.id, subscription);
    this.subscriptionAccounts.set(subscription.id, {
      subscriptionId: subscription.id,
      cash: subscription.allocatedCapital,
      positions: [],
      equity: subscription.allocatedCapital,
      pnl: 0,
    });
    return subscription;
  }

  updateRiskControls(params: {
    subscriptionId: string;
    paused?: boolean;
    maxDrawdownPercent?: number;
  }): FollowSubscription {
    const subscription = this.getSubscription(params.subscriptionId);

    if (typeof params.paused === "boolean") {
      subscription.riskControls.paused = params.paused;
    }

    if (typeof params.maxDrawdownPercent === "number") {
      subscription.riskControls.maxDrawdownPercent = params.maxDrawdownPercent;
    }

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  hydrateSubscription(subscription: FollowSubscription): FollowSubscription {
    this.subscriptions.set(subscription.id, subscription);
    this.subscriptionAccounts.set(subscription.id, {
      subscriptionId: subscription.id,
      cash: subscription.highWaterMark,
      positions: [],
      equity: subscription.highWaterMark,
      pnl: round2(subscription.highWaterMark - subscription.startEquity),
    });

    return subscription;
  }

  /** Get a subscription account's positions and cash */
  getSubscriptionAccountDetail(subscriptionId: string): SubscriptionAccount | undefined {
    return this.subscriptionAccounts.get(subscriptionId);
  }

  /** Apply a trade directly to a subscription account (used for snapshot copy and manual mirror) */
  applyTradeToSubscription(
    subscriptionId: string,
    side: "buy" | "sell",
    symbol: string,
    quantity: number,
    price: number,
  ): void {
    const subscription = this.getSubscription(subscriptionId);
    this.applyTradeToSubscriptionAccount(
      subscriptionId,
      side,
      symbol,
      quantity,
      price,
      subscription.startEquity,
    );
  }

  placeMasterTrade(input: MasterTradeInput): {
    masterTrade: Trade;
    mirroredTrades: MirroredTrade[];
    feeEntries: FeeLedgerEntry[];
  } {
    const master = this.masters.get(input.masterUserId);
    const masterUser = this.users.get(input.masterUserId);

    if (!master || !masterUser) {
      throw new Error("Invalid master");
    }

    const masterTrade: Trade = {
      id: this.newId("trade"),
      masterUserId: input.masterUserId,
      symbol: input.symbol,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      createdAt: new Date().toISOString(),
    };

    this.masterTrades.push(masterTrade);
    this.applyTradeToPortfolio(masterUser.id, masterTrade.side, masterTrade.symbol, masterTrade.quantity, masterTrade.price);

    const mirroredTrades: MirroredTrade[] = [];
    const feeEntries: FeeLedgerEntry[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (subscription.masterUserId !== input.masterUserId) {
        continue;
      }

      // Only "follow" subscriptions get ongoing mirroring
      if (subscription.mode === "snapshot") {
        continue;
      }

      const subscriptionAccount = this.requireSubscriptionAccount(subscription.id);
      const riskCheck = shouldHaltByRisk(subscription, subscriptionAccount.equity);
      if (riskCheck.blocked) {
        continue;
      }

      const mirroredQuantity = calculateProportionalQuantity({
        masterQuantity: input.quantity,
        masterCapital: masterUser.initialCapital,
        followerAllocatedCapital: subscription.allocatedCapital,
      });

      if (mirroredQuantity <= 0) {
        continue;
      }

      this.applyTradeToPortfolio(
        subscription.followerUserId,
        input.side,
        input.symbol,
        mirroredQuantity,
        input.price
      );
      this.applyTradeToSubscriptionAccount(
        subscription.id,
        input.side,
        input.symbol,
        mirroredQuantity,
        input.price,
        subscription.startEquity
      );

      const mirroredTrade: MirroredTrade = {
        id: this.newId("mtrade"),
        sourceTradeId: masterTrade.id,
        subscriptionId: subscription.id,
        followerUserId: subscription.followerUserId,
        symbol: input.symbol,
        side: input.side,
        quantity: mirroredQuantity,
        price: input.price,
        notional: round2(mirroredQuantity * input.price),
        createdAt: new Date().toISOString(),
      };

      mirroredTrades.push(mirroredTrade);
      this.mirroredTrades.push(mirroredTrade);

      const updatedSubscriptionAccount = this.requireSubscriptionAccount(subscription.id);
      const performanceFee = calculatePerformanceFee({
        currentEquity: updatedSubscriptionAccount.equity,
        subscription,
        performanceFeePercent: master.performanceFeePercent,
      });

      if (performanceFee > 0) {
        const feeEntry: FeeLedgerEntry = {
          id: this.newId("fee"),
          subscriptionId: subscription.id,
          type: "performance",
          amount: performanceFee,
          reason: `Performance fee at ${master.performanceFeePercent}% over high-water-mark`,
          createdAt: new Date().toISOString(),
        };

        feeEntries.push(feeEntry);
        this.fees.push(feeEntry);
        subscription.highWaterMark = updatedSubscriptionAccount.equity;
      }
    }

    return {
      masterTrade,
      mirroredTrades,
      feeEntries,
    };
  }

  accrueMonthlySubscriptionFees(): FeeLedgerEntry[] {
    const entries: FeeLedgerEntry[] = [];
    for (const subscription of this.subscriptions.values()) {
      const master = this.masters.get(subscription.masterUserId);
      if (!master || master.monthlySubscriptionFee <= 0) {
        continue;
      }

      const entry: FeeLedgerEntry = {
        id: this.newId("fee"),
        subscriptionId: subscription.id,
        type: "subscription",
        amount: round2(master.monthlySubscriptionFee),
        reason: "Monthly subscription due (tracked only)",
        createdAt: new Date().toISOString(),
      };

      this.fees.push(entry);
      entries.push(entry);
    }

    return entries;
  }

  getLeaderboard(): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    for (const master of this.masters.values()) {
      const relatedSubscriptions = [...this.subscriptions.values()].filter(
        (sub) => sub.masterUserId === master.userId
      );

      const totalFollowerPnl = relatedSubscriptions.reduce((sum, sub) => {
        const account = this.requireSubscriptionAccount(sub.id);
        return round2(sum + account.pnl);
      }, 0);

      const totalMasterFeesAccrued = this.fees
        .filter((fee) => relatedSubscriptions.some((sub) => sub.id === fee.subscriptionId))
        .reduce((sum, fee) => round2(sum + fee.amount), 0);

      entries.push({
        masterUserId: master.userId,
        followers: relatedSubscriptions.length,
        totalFollowerPnl,
        totalMasterFeesAccrued,
      });
    }

    return entries.sort((a, b) => b.totalFollowerPnl - a.totalFollowerPnl);
  }

  snapshot(): EngineSnapshot {
    return {
      users: [...this.users.values()],
      masters: [...this.masters.values()],
      subscriptions: [...this.subscriptions.values()],
      portfolios: [...this.portfolios.values()],
      subscriptionAccounts: [...this.subscriptionAccounts.values()].map((account) => ({
        subscriptionId: account.subscriptionId,
        cash: account.cash,
        equity: account.equity,
        pnl: account.pnl,
        positions: account.positions.map((p) => ({ ...p })),
      })),
      masterTrades: this.masterTrades,
      mirroredTrades: this.mirroredTrades,
      fees: this.fees,
      leaderboard: this.getLeaderboard(),
    };
  }

  private applyTradeToSubscriptionAccount(
    subscriptionId: string,
    side: "buy" | "sell",
    symbol: string,
    quantity: number,
    price: number,
    startEquity: number
  ): void {
    const account = this.requireSubscriptionAccount(subscriptionId);
    const existingPosition = account.positions.find((position) => position.symbol === symbol);
    const notional = round2(quantity * price);

    if (side === "buy") {
      account.cash = round2(account.cash - notional);
      if (!existingPosition) {
        account.positions.push({ symbol, quantity, averagePrice: price });
      } else {
        const totalQuantity = existingPosition.quantity + quantity;
        existingPosition.averagePrice = round2(
          (existingPosition.averagePrice * existingPosition.quantity + price * quantity) / totalQuantity
        );
        existingPosition.quantity = round2(totalQuantity);
      }
    } else {
      account.cash = round2(account.cash + notional);
      if (existingPosition) {
        existingPosition.quantity = round2(Math.max(0, existingPosition.quantity - quantity));
      }
    }

    const marketValue = account.positions.reduce(
      (sum, position) => round2(sum + position.quantity * position.averagePrice),
      0
    );

    account.equity = round2(account.cash + marketValue);
    account.pnl = round2(account.equity - startEquity);
    this.subscriptionAccounts.set(subscriptionId, account);
  }

  private applyTradeToPortfolio(
    userId: string,
    side: "buy" | "sell",
    symbol: string,
    quantity: number,
    price: number
  ): void {
    const portfolio = this.requirePortfolio(userId);
    const existingPosition = portfolio.positions.find((position) => position.symbol === symbol);

    const notional = round2(quantity * price);
    if (side === "buy") {
      portfolio.cash = round2(portfolio.cash - notional);
      if (!existingPosition) {
        portfolio.positions.push({
          symbol,
          quantity,
          averagePrice: price,
        });
      } else {
        const totalQuantity = existingPosition.quantity + quantity;
        existingPosition.averagePrice = round2(
          (existingPosition.averagePrice * existingPosition.quantity + price * quantity) / totalQuantity
        );
        existingPosition.quantity = round2(totalQuantity);
      }
    } else {
      portfolio.cash = round2(portfolio.cash + notional);
      if (existingPosition) {
        existingPosition.quantity = round2(Math.max(0, existingPosition.quantity - quantity));
      }
    }

    const marketValue = portfolio.positions.reduce(
      (sum, position) => round2(sum + position.quantity * position.averagePrice),
      0
    );

    portfolio.equity = round2(portfolio.cash + marketValue);
    const user = this.users.get(userId);
    portfolio.pnl = user ? round2(portfolio.equity - user.initialCapital) : 0;

    this.portfolios.set(userId, portfolio);
  }

  private requirePortfolio(userId: string): Portfolio {
    const portfolio = this.portfolios.get(userId);
    if (!portfolio) {
      throw new Error(`Portfolio missing for user: ${userId}`);
    }

    return portfolio;
  }

  private requireSubscriptionAccount(subscriptionId: string): SubscriptionAccount {
    const account = this.subscriptionAccounts.get(subscriptionId);
    if (!account) {
      throw new Error(`Subscription account missing for subscription: ${subscriptionId}`);
    }

    return account;
  }

  private getSubscription(subscriptionId: string): FollowSubscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    return subscription;
  }

  private newId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
