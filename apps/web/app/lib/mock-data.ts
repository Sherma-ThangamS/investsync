/* ──────────────────────────────────────────────────────────────
   Mock data for the Copy-Trading Platform UI.
   All data is static so pages render without a backend.
   ────────────────────────────────────────────────────────────── */

// ────── Users ──────
export interface User {
  id: string;
  name: string;
  email: string;
  role: "master" | "follower";
  avatarUrl: string;
  joinedAt: string;
}

export const users: User[] = [
  { id: "u1", name: "Alex Morgan", email: "alex@copytrade.io", role: "master", avatarUrl: "", joinedAt: "2025-01-15" },
  { id: "u2", name: "Jordan Lee", email: "jordan@copytrade.io", role: "master", avatarUrl: "", joinedAt: "2025-02-03" },
  { id: "u3", name: "Sam Rivera", email: "sam@copytrade.io", role: "master", avatarUrl: "", joinedAt: "2025-03-12" },
  { id: "u4", name: "Taylor Kim", email: "taylor@copytrade.io", role: "follower", avatarUrl: "", joinedAt: "2025-04-01" },
  { id: "u5", name: "Casey Nguyen", email: "casey@copytrade.io", role: "follower", avatarUrl: "", joinedAt: "2025-04-20" },
  { id: "u6", name: "Jamie Patel", email: "jamie@copytrade.io", role: "follower", avatarUrl: "", joinedAt: "2025-05-08" },
  { id: "u7", name: "Riley Chen", email: "riley@copytrade.io", role: "follower", avatarUrl: "", joinedAt: "2025-06-02" },
  { id: "u8", name: "Morgan Scott", email: "morgan@copytrade.io", role: "follower", avatarUrl: "", joinedAt: "2025-06-15" },
];

// ────── Master Profiles ──────
export interface MasterProfile {
  userId: string;
  name: string;
  bio: string;
  strategy: string;
  performanceFeeRate: number;
  subscriptionFeeRate: number;
  followers: number;
  totalPnl: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  avgTradeReturn: number;
  monthlyReturns: number[];
  aum: number;
  joinedAt: string;
  tags: string[];
}

export const masters: MasterProfile[] = [
  {
    userId: "u1", name: "Alex Morgan", bio: "Systematic quant trader focusing on mean-reversion strategies across major pairs.",
    strategy: "Mean Reversion", performanceFeeRate: 0.20, subscriptionFeeRate: 0.01,
    followers: 142, totalPnl: 84520.50, winRate: 0.68, maxDrawdown: 0.12,
    sharpeRatio: 1.92, totalTrades: 1247, avgTradeReturn: 0.0034,
    monthlyReturns: [3.2, 1.8, 4.1, -0.9, 2.7, 3.5, 1.2, -1.4, 5.1, 2.3, 3.8, 4.2],
    aum: 2450000, joinedAt: "2025-01-15", tags: ["Quant", "Low Risk", "Consistent"],
  },
  {
    userId: "u2", name: "Jordan Lee", bio: "Momentum-based swing trader with a focus on breakout patterns and trend following.",
    strategy: "Momentum / Swing", performanceFeeRate: 0.25, subscriptionFeeRate: 0.015,
    followers: 89, totalPnl: 127340.00, winRate: 0.55, maxDrawdown: 0.22,
    sharpeRatio: 1.45, totalTrades: 834, avgTradeReturn: 0.0061,
    monthlyReturns: [6.1, -2.3, 8.4, 3.2, -1.8, 12.1, -3.4, 5.6, 7.2, -0.5, 4.8, 9.1],
    aum: 1870000, joinedAt: "2025-02-03", tags: ["High Return", "Swing", "Aggressive"],
  },
  {
    userId: "u3", name: "Sam Rivera", bio: "Conservative portfolio manager using diversified multi-asset allocation strategies.",
    strategy: "Multi-Asset Allocation", performanceFeeRate: 0.15, subscriptionFeeRate: 0.008,
    followers: 231, totalPnl: 42180.75, winRate: 0.72, maxDrawdown: 0.08,
    sharpeRatio: 2.15, totalTrades: 562, avgTradeReturn: 0.0022,
    monthlyReturns: [1.4, 2.0, 1.8, 1.1, 2.3, 1.5, 2.1, 0.8, 1.9, 2.5, 1.7, 2.2],
    aum: 5120000, joinedAt: "2025-03-12", tags: ["Conservative", "Diversified", "Steady"],
  },
];

// ────── Subscriptions ──────
export interface Subscription {
  id: string;
  followerUserId: string;
  followerName: string;
  masterUserId: string;
  masterName: string;
  allocatedCapital: number;
  currentEquity: number;
  pnl: number;
  pnlPercent: number;
  status: "active" | "paused" | "stopped";
  maxDrawdownLimit: number;
  currentDrawdown: number;
  subscribedAt: string;
}

export const subscriptions: Subscription[] = [
  { id: "sub1", followerUserId: "u4", followerName: "Taylor Kim", masterUserId: "u1", masterName: "Alex Morgan", allocatedCapital: 10000, currentEquity: 11240, pnl: 1240, pnlPercent: 12.4, status: "active", maxDrawdownLimit: 0.15, currentDrawdown: 0.03, subscribedAt: "2025-05-01" },
  { id: "sub2", followerUserId: "u4", followerName: "Taylor Kim", masterUserId: "u2", masterName: "Jordan Lee", allocatedCapital: 5000, currentEquity: 5680, pnl: 680, pnlPercent: 13.6, status: "active", maxDrawdownLimit: 0.20, currentDrawdown: 0.05, subscribedAt: "2025-05-10" },
  { id: "sub3", followerUserId: "u5", followerName: "Casey Nguyen", masterUserId: "u1", masterName: "Alex Morgan", allocatedCapital: 25000, currentEquity: 27350, pnl: 2350, pnlPercent: 9.4, status: "active", maxDrawdownLimit: 0.12, currentDrawdown: 0.02, subscribedAt: "2025-04-25" },
  { id: "sub4", followerUserId: "u5", followerName: "Casey Nguyen", masterUserId: "u3", masterName: "Sam Rivera", allocatedCapital: 15000, currentEquity: 15780, pnl: 780, pnlPercent: 5.2, status: "active", maxDrawdownLimit: 0.10, currentDrawdown: 0.01, subscribedAt: "2025-05-15" },
  { id: "sub5", followerUserId: "u6", followerName: "Jamie Patel", masterUserId: "u2", masterName: "Jordan Lee", allocatedCapital: 8000, currentEquity: 7520, pnl: -480, pnlPercent: -6.0, status: "paused", maxDrawdownLimit: 0.15, currentDrawdown: 0.12, subscribedAt: "2025-06-01" },
  { id: "sub6", followerUserId: "u7", followerName: "Riley Chen", masterUserId: "u1", masterName: "Alex Morgan", allocatedCapital: 50000, currentEquity: 54200, pnl: 4200, pnlPercent: 8.4, status: "active", maxDrawdownLimit: 0.10, currentDrawdown: 0.04, subscribedAt: "2025-04-10" },
  { id: "sub7", followerUserId: "u7", followerName: "Riley Chen", masterUserId: "u3", masterName: "Sam Rivera", allocatedCapital: 30000, currentEquity: 31450, pnl: 1450, pnlPercent: 4.83, status: "active", maxDrawdownLimit: 0.08, currentDrawdown: 0.02, subscribedAt: "2025-05-20" },
  { id: "sub8", followerUserId: "u8", followerName: "Morgan Scott", masterUserId: "u1", masterName: "Alex Morgan", allocatedCapital: 20000, currentEquity: 21800, pnl: 1800, pnlPercent: 9.0, status: "active", maxDrawdownLimit: 0.12, currentDrawdown: 0.03, subscribedAt: "2025-06-05" },
];

// ────── Trade Events (Copied Trades) ──────
export interface TradeEvent {
  id: string;
  subscriptionId: string;
  masterName: string;
  followerName: string;
  symbol: string;
  side: "BUY" | "SELL";
  masterQty: number;
  followerQty: number;
  price: number;
  pnl: number;
  timestamp: string;
}

export const trades: TradeEvent[] = [
  { id: "t1", subscriptionId: "sub1", masterName: "Alex Morgan", followerName: "Taylor Kim", symbol: "AAPL", side: "BUY", masterQty: 100, followerQty: 20, price: 187.50, pnl: 240, timestamp: "2025-12-01T09:30:00Z" },
  { id: "t2", subscriptionId: "sub1", masterName: "Alex Morgan", followerName: "Taylor Kim", symbol: "MSFT", side: "BUY", masterQty: 50, followerQty: 10, price: 415.20, pnl: 180, timestamp: "2025-12-01T10:15:00Z" },
  { id: "t3", subscriptionId: "sub2", masterName: "Jordan Lee", followerName: "Taylor Kim", symbol: "TSLA", side: "BUY", masterQty: 200, followerQty: 20, price: 248.90, pnl: -120, timestamp: "2025-12-01T11:00:00Z" },
  { id: "t4", subscriptionId: "sub3", masterName: "Alex Morgan", followerName: "Casey Nguyen", symbol: "AAPL", side: "BUY", masterQty: 100, followerQty: 50, price: 187.50, pnl: 600, timestamp: "2025-12-01T09:30:00Z" },
  { id: "t5", subscriptionId: "sub6", masterName: "Alex Morgan", followerName: "Riley Chen", symbol: "AAPL", side: "BUY", masterQty: 100, followerQty: 100, price: 187.50, pnl: 1200, timestamp: "2025-12-01T09:30:00Z" },
  { id: "t6", subscriptionId: "sub6", masterName: "Alex Morgan", followerName: "Riley Chen", symbol: "MSFT", side: "BUY", masterQty: 50, followerQty: 50, price: 415.20, pnl: 900, timestamp: "2025-12-01T10:15:00Z" },
  { id: "t7", subscriptionId: "sub1", masterName: "Alex Morgan", followerName: "Taylor Kim", symbol: "AAPL", side: "SELL", masterQty: 50, followerQty: 10, price: 192.30, pnl: 480, timestamp: "2025-12-02T14:20:00Z" },
  { id: "t8", subscriptionId: "sub5", masterName: "Jordan Lee", followerName: "Jamie Patel", symbol: "NVDA", side: "BUY", masterQty: 80, followerQty: 16, price: 142.10, pnl: -320, timestamp: "2025-12-02T09:45:00Z" },
  { id: "t9", subscriptionId: "sub4", masterName: "Sam Rivera", followerName: "Casey Nguyen", symbol: "BND", side: "BUY", masterQty: 500, followerQty: 150, price: 72.40, pnl: 210, timestamp: "2025-12-02T10:30:00Z" },
  { id: "t10", subscriptionId: "sub7", masterName: "Sam Rivera", followerName: "Riley Chen", symbol: "VTI", side: "BUY", masterQty: 300, followerQty: 180, price: 268.50, pnl: 540, timestamp: "2025-12-02T11:00:00Z" },
  { id: "t11", subscriptionId: "sub2", masterName: "Jordan Lee", followerName: "Taylor Kim", symbol: "TSLA", side: "SELL", masterQty: 200, followerQty: 20, price: 255.40, pnl: 130, timestamp: "2025-12-03T09:30:00Z" },
  { id: "t12", subscriptionId: "sub8", masterName: "Alex Morgan", followerName: "Morgan Scott", symbol: "GOOGL", side: "BUY", masterQty: 40, followerQty: 16, price: 178.90, pnl: 320, timestamp: "2025-12-03T10:00:00Z" },
];

// ────── Fee Ledger ──────
export interface FeeEntry {
  id: string;
  subscriptionId: string;
  masterName: string;
  followerName: string;
  type: "performance" | "subscription";
  amount: number;
  basis: string;
  timestamp: string;
}

export const fees: FeeEntry[] = [
  { id: "f1", subscriptionId: "sub1", masterName: "Alex Morgan", followerName: "Taylor Kim", type: "performance", amount: 248.00, basis: "20% of $1,240 profit", timestamp: "2025-12-01T23:59:00Z" },
  { id: "f2", subscriptionId: "sub1", masterName: "Alex Morgan", followerName: "Taylor Kim", type: "subscription", amount: 100.00, basis: "1% of $10,000 allocated", timestamp: "2025-12-01T00:00:00Z" },
  { id: "f3", subscriptionId: "sub2", masterName: "Jordan Lee", followerName: "Taylor Kim", type: "performance", amount: 170.00, basis: "25% of $680 profit", timestamp: "2025-12-01T23:59:00Z" },
  { id: "f4", subscriptionId: "sub3", masterName: "Alex Morgan", followerName: "Casey Nguyen", type: "performance", amount: 470.00, basis: "20% of $2,350 profit", timestamp: "2025-12-01T23:59:00Z" },
  { id: "f5", subscriptionId: "sub4", masterName: "Sam Rivera", followerName: "Casey Nguyen", type: "subscription", amount: 120.00, basis: "0.8% of $15,000 allocated", timestamp: "2025-12-01T00:00:00Z" },
  { id: "f6", subscriptionId: "sub6", masterName: "Alex Morgan", followerName: "Riley Chen", type: "performance", amount: 840.00, basis: "20% of $4,200 profit", timestamp: "2025-12-01T23:59:00Z" },
  { id: "f7", subscriptionId: "sub7", masterName: "Sam Rivera", followerName: "Riley Chen", type: "performance", amount: 217.50, basis: "15% of $1,450 profit", timestamp: "2025-12-01T23:59:00Z" },
  { id: "f8", subscriptionId: "sub8", masterName: "Alex Morgan", followerName: "Morgan Scott", type: "performance", amount: 360.00, basis: "20% of $1,800 profit", timestamp: "2025-12-02T23:59:00Z" },
  { id: "f9", subscriptionId: "sub3", masterName: "Alex Morgan", followerName: "Casey Nguyen", type: "subscription", amount: 250.00, basis: "1% of $25,000 allocated", timestamp: "2025-12-02T00:00:00Z" },
  { id: "f10", subscriptionId: "sub6", masterName: "Alex Morgan", followerName: "Riley Chen", type: "subscription", amount: 500.00, basis: "1% of $50,000 allocated", timestamp: "2025-12-02T00:00:00Z" },
];

// ────── Portfolio Holdings ──────
export interface Holding {
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
}

export const portfolio: Holding[] = [
  { symbol: "AAPL", name: "Apple Inc.", qty: 120, avgPrice: 187.50, currentPrice: 193.20, value: 23184, pnl: 684, pnlPercent: 3.04, allocation: 0.28 },
  { symbol: "MSFT", name: "Microsoft Corp.", qty: 60, avgPrice: 415.20, currentPrice: 428.40, value: 25704, pnl: 792, pnlPercent: 3.18, allocation: 0.31 },
  { symbol: "TSLA", name: "Tesla Inc.", qty: 20, avgPrice: 248.90, currentPrice: 255.40, value: 5108, pnl: 130, pnlPercent: 2.61, allocation: 0.06 },
  { symbol: "GOOGL", name: "Alphabet Inc.", qty: 16, avgPrice: 178.90, currentPrice: 182.50, value: 2920, pnl: 57.60, pnlPercent: 2.01, allocation: 0.04 },
  { symbol: "VTI", name: "Vanguard Total Stock", qty: 180, avgPrice: 268.50, currentPrice: 271.30, value: 48834, pnl: 504, pnlPercent: 1.04, allocation: 0.22 },
  { symbol: "BND", name: "Vanguard Total Bond", qty: 150, avgPrice: 72.40, currentPrice: 73.10, value: 10965, pnl: 105, pnlPercent: 0.97, allocation: 0.09 },
];

// ────── Aggregated Stats ──────
export const dashboardStats = {
  totalAum: 8_440_000,
  totalMasters: 3,
  totalFollowers: 5,
  totalSubscriptions: 8,
  activeSubscriptions: 7,
  pausedSubscriptions: 1,
  totalFees: 3_275.50,
  totalPnl: 12_020,
  avgWinRate: 0.65,
  platformVolume: 42_850_000,
};

// ────── Leaderboard ──────
export interface LeaderboardEntry {
  rank: number;
  masterUserId: string;
  name: string;
  followers: number;
  totalPnl: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  feesEarned: number;
}

export const leaderboard: LeaderboardEntry[] = [
  { rank: 1, masterUserId: "u3", name: "Sam Rivera", followers: 231, totalPnl: 42180.75, winRate: 0.72, sharpe: 2.15, maxDrawdown: 0.08, feesEarned: 8250 },
  { rank: 2, masterUserId: "u1", name: "Alex Morgan", followers: 142, totalPnl: 84520.50, winRate: 0.68, sharpe: 1.92, maxDrawdown: 0.12, feesEarned: 18420 },
  { rank: 3, masterUserId: "u2", name: "Jordan Lee", followers: 89, totalPnl: 127340.00, winRate: 0.55, sharpe: 1.45, maxDrawdown: 0.22, feesEarned: 12680 },
];

// ────── Risk Alerts ──────
export interface RiskAlert {
  id: string;
  subscriptionId: string;
  followerName: string;
  masterName: string;
  type: "drawdown_warning" | "drawdown_breach" | "paused" | "max_loss";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

export const riskAlerts: RiskAlert[] = [
  { id: "ra1", subscriptionId: "sub5", followerName: "Jamie Patel", masterName: "Jordan Lee", type: "drawdown_warning", message: "Drawdown at 12%, approaching 15% limit", severity: "high", timestamp: "2025-12-03T08:00:00Z" },
  { id: "ra2", subscriptionId: "sub6", followerName: "Riley Chen", masterName: "Alex Morgan", type: "drawdown_warning", message: "Drawdown at 4%, within safe range", severity: "low", timestamp: "2025-12-03T08:00:00Z" },
  { id: "ra3", subscriptionId: "sub2", followerName: "Taylor Kim", masterName: "Jordan Lee", type: "drawdown_warning", message: "Drawdown at 5%, watch closely", severity: "medium", timestamp: "2025-12-03T08:00:00Z" },
  { id: "ra4", subscriptionId: "sub5", followerName: "Jamie Patel", masterName: "Jordan Lee", type: "paused", message: "Subscription paused due to high drawdown risk", severity: "critical", timestamp: "2025-12-02T16:00:00Z" },
];

// ────── Activity Log ──────
export interface Activity {
  id: string;
  type: "trade" | "subscription" | "fee" | "risk" | "auth";
  message: string;
  timestamp: string;
}

export const recentActivity: Activity[] = [
  { id: "a1", type: "trade", message: "Alex Morgan opened BUY 100 AAPL @ $187.50 — mirrored to 4 followers", timestamp: "2025-12-03T09:30:00Z" },
  { id: "a2", type: "trade", message: "Jordan Lee closed SELL 200 TSLA @ $255.40", timestamp: "2025-12-03T09:30:00Z" },
  { id: "a3", type: "subscription", message: "Morgan Scott subscribed to Alex Morgan with $20,000", timestamp: "2025-12-03T08:15:00Z" },
  { id: "a4", type: "risk", message: "Jamie Patel subscription to Jordan Lee paused (drawdown 12%)", timestamp: "2025-12-02T16:00:00Z" },
  { id: "a5", type: "fee", message: "Performance fee $840 accrued for Alex Morgan from Riley Chen", timestamp: "2025-12-01T23:59:00Z" },
  { id: "a6", type: "fee", message: "Subscription fee $500 charged to Riley Chen for Alex Morgan", timestamp: "2025-12-02T00:00:00Z" },
  { id: "a7", type: "auth", message: "New user Riley Chen registered as follower", timestamp: "2025-12-01T10:00:00Z" },
  { id: "a8", type: "trade", message: "Sam Rivera opened BUY 300 VTI @ $268.50 — mirrored to 2 followers", timestamp: "2025-12-02T11:00:00Z" },
];

// Current logged-in user (for demo)
export const currentUser: User = users[3]; // Taylor Kim, follower
