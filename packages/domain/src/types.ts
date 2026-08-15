export type UserRole = "master" | "follower" | "both" | "admin";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  initialCapital: number;
}

export interface UserProfile {
  userId: string;
  /** Annualized volatility tolerance (%) */
  volatilityTolerance: number;
  /** Risk preference 0–100 */
  riskScore: number;
  /** Leverage multiplier (1 = no leverage) */
  leverage: number;
}

export interface MasterProfile {
  userId: string;
  displayName: string;
  performanceFeePercent: number;
  monthlySubscriptionFee: number;
  strategyDescription: string;
}

export interface RiskControls {
  paused: boolean;
  maxDrawdownPercent: number;
}

export interface FollowSubscription {
  id: string;
  followerUserId: string;
  masterUserId: string;
  allocatedCapital: number;
  startEquity: number;
  highWaterMark: number;
  riskControls: RiskControls;
  /** "follow" = ongoing copy trading, "snapshot" = one-time portfolio copy */
  mode: "follow" | "snapshot";
}

/** A position held within a subscription account */
export interface CopyPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
}

export interface Trade {
  id: string;
  masterUserId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  createdAt: string;
}

export interface MirroredTrade {
  id: string;
  sourceTradeId: string;
  subscriptionId: string;
  followerUserId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  notional: number;
  createdAt: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
}

export interface Portfolio {
  userId: string;
  cash: number;
  positions: Position[];
  equity: number;
  pnl: number;
}

export interface FeeLedgerEntry {
  id: string;
  subscriptionId: string;
  type: "performance" | "subscription";
  amount: number;
  reason: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  masterUserId: string;
  followers: number;
  totalFollowerPnl: number;
  totalMasterFeesAccrued: number;
}

/* ── Notification & Approval types ── */

export interface TradeNotification {
  id: string;
  masterUserId: string;
  followerUserId: string;
  subscriptionId: string;
  tradeId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  /** pending | approved | rejected | expired */
  status: "pending" | "approved" | "rejected" | "expired";
  intentHash: string;
  createdAt: string;
  decidedAt?: string;
  /** Seconds follower has to approve (default 60) */
  timeoutSec: number;
}

/* ── Paper Trading order (persisted) ── */

export interface PaperOrder {
  id: string;
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  status: "filled";
  filledAt: string;
}
