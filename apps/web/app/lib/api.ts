/* ──────────────────────────────────────────────────────────────
   API client for the InvestSync platform backend.
   Handles token storage, auth requests, and data fetching.
   ────────────────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/* ── Token helpers ── */

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ct_token");
}

export function setToken(token: string): void {
  localStorage.setItem("ct_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("ct_token");
}

/* ── Generic fetch wrapper ── */

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/* ── Auth types ── */

export interface AuthUser {
  id: string;
  name: string;
  role: "master" | "follower" | "both" | "admin";
  initialCapital: number;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

/* ── Auth endpoints ── */

export async function apiRegister(params: {
  id: string;
  name: string;
  role: "master" | "follower";
  initialCapital: number;
  password: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setToken(data.token);
  return data;
}

export async function apiLogin(params: {
  id: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setToken(data.token);
  return data;
}

export async function apiGetMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me");
}

/* ── Data endpoints ── */

export async function apiGetMasters() {
  return apiFetch<Record<string, unknown>[]>("/masters");
}

export async function apiGetLeaderboard() {
  return apiFetch<Record<string, unknown>[]>("/leaderboard");
}

export async function apiGetSnapshot() {
  return apiFetch<Record<string, unknown>>("/snapshot");
}

export async function apiGetSubscriptions(followerUserId: string) {
  return apiFetch<Record<string, unknown>[]>(`/followers/${followerUserId}/subscriptions`);
}

export async function apiGetFees(query?: Record<string, string>) {
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  return apiFetch<Record<string, unknown>[]>(`/fees${qs}`);
}

export async function apiPlaceMasterTrade(
  masterUserId: string,
  trade: { symbol: string; side: "buy" | "sell"; quantity: number; price: number },
) {
  return apiFetch<Record<string, unknown>>(`/masters/${masterUserId}/trades`, {
    method: "POST",
    body: JSON.stringify(trade),
  });
}

export async function apiCreateSubscription(params: {
  id: string;
  followerUserId: string;
  masterUserId: string;
  allocatedCapital: number;
}) {
  return apiFetch<Record<string, unknown>>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiUpdateRiskControls(
  subscriptionId: string,
  params: { paused?: boolean; maxDrawdownPercent?: number },
) {
  return apiFetch<Record<string, unknown>>(`/subscriptions/${subscriptionId}/risk`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

/* ── Paper Trading Simulation ── */

export async function apiGetSimulationQuotes() {
  return apiFetch<Record<string, unknown>[]>("/simulation/quotes");
}

export async function apiPlaceSimulationOrder(params: {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
}) {
  return apiFetch<Record<string, unknown>>("/simulation/orders", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiGetSimulationPortfolio() {
  return apiFetch<Record<string, unknown>>("/simulation/portfolio");
}

export async function apiGetSimulationOrders() {
  return apiFetch<Record<string, unknown>[]>("/simulation/orders");
}

/* ── Become a Master ── */

export async function apiBecomeMaster(params: {
  displayName: string;
  performanceFeePercent: number;
  monthlySubscriptionFee: number;
  strategyDescription: string;
}) {
  return apiFetch<Record<string, unknown>>("/become-master", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/* ── Follow a Master ── */

export async function apiFollowMaster(masterUserId: string, allocatedCapital: number) {
  return apiFetch<Record<string, unknown>>(`/follow/${masterUserId}`, {
    method: "POST",
    body: JSON.stringify({ allocatedCapital }),
  });
}

/* ── Notifications ── */

export async function apiGetNotifications() {
  return apiFetch<Record<string, unknown>[]>("/notifications");
}

export async function apiApproveNotification(id: string) {
  return apiFetch<Record<string, unknown>>(`/notifications/${id}/approve`, { method: "POST" });
}

export async function apiRejectNotification(id: string) {
  return apiFetch<Record<string, unknown>>(`/notifications/${id}/reject`, { method: "POST" });
}

/* ── User Profile ── */

export async function apiGetProfile() {
  return apiFetch<Record<string, unknown>>("/profile");
}

export async function apiUpdateProfile(params: {
  volatilityTolerance: number;
  riskScore: number;
  leverage: number;
}) {
  return apiFetch<Record<string, unknown>>("/profile", {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/* ── Merkle Tree ── */

export async function apiGetMerkleRoot() {
  return apiFetch<Record<string, unknown>>("/merkle/root");
}

export async function apiGetMerkleLeaves() {
  return apiFetch<Record<string, unknown>[]>("/merkle/leaves");
}

export async function apiVerifyMerkleTrade(tradeId: string) {
  return apiFetch<Record<string, unknown>>(`/merkle/verify/${tradeId}`);
}

/* ── Trades ── */

export async function apiGetTrades() {
  return apiFetch<Record<string, unknown>[]>("/trades");
}

/* ── Master Detail ── */

export async function apiGetMasterDetail(masterId: string) {
  return apiFetch<Record<string, unknown>>(`/masters/${encodeURIComponent(masterId)}`);
}

/* ── Master Min-Follow Info ── */

export async function apiGetMinFollow(masterUserId: string) {
  return apiFetch<{
    minAmount: number;
    step: number;
    positions: Array<{ symbol: string; name: string; quantity: number; price: number; value: number }>;
  }>(`/masters/${encodeURIComponent(masterUserId)}/min-follow`);
}

/* ── Follow / Snapshot Copy ── */

export async function apiFollowMasterWithMode(
  masterUserId: string,
  allocatedCapital: number,
  mode: "follow" | "snapshot",
) {
  return apiFetch<Record<string, unknown>>(`/follow/${encodeURIComponent(masterUserId)}`, {
    method: "POST",
    body: JSON.stringify({ allocatedCapital, mode }),
  });
}

/* ── Subscription Positions Detail ── */

export async function apiGetSubscriptionPositions(subscriptionId: string) {
  return apiFetch<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}/positions`);
}

/* ── MARA Demo ── */

export async function apiRunMARADemo(params: {
  masterQuantity: number;
  masterEquity: number;
  followerEquity: number;
  masterVolatility: number;
  followerVolatility: number;
  masterRiskScore: number;
  followerRiskScore: number;
  price: number;
  followerFreeMargin: number;
  followerLeverage: number;
}) {
  return apiFetch<Record<string, unknown>>("/demo/mara", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/* ── Risk ── */

export async function apiGetRisk() {
  return apiFetch<{ alerts: Record<string, unknown>[]; subscriptions: Record<string, unknown>[] }>("/risk");
}
