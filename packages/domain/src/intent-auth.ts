/**
 * Intent-Based Authorization
 *
 * Staged trades flow:
 *   1. Master places a trade → an Intent is created with a SHA-256 hash
 *   2. The intent has a 60-second TTL
 *   3. Follower must approve the intent within TTL
 *   4. On approval, a crypto handshake verifies the intent hash
 *   5. If TTL expires, the intent is auto-rejected
 *
 * Intent hash = SHA-256(masterUserId | symbol | side | quantity | price | nonce)
 */

import { createHash, randomBytes } from "node:crypto";

export interface TradeIntent {
  id: string;
  masterUserId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  /** Cryptographic nonce */
  nonce: string;
  /** SHA-256 hash of the intent payload */
  hash: string;
  /** Unix timestamp of creation (ms) */
  createdAt: number;
  /** TTL in milliseconds (default 60000) */
  ttlMs: number;
  /** Current state */
  status: "pending" | "approved" | "rejected" | "expired";
}

export interface IntentVerification {
  valid: boolean;
  reason?: string;
}

/** Default TTL: 60 seconds */
const DEFAULT_TTL_MS = 60_000;

/**
 * Create a new trade intent with crypto handshake hash.
 */
export function createTradeIntent(params: {
  id: string;
  masterUserId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  ttlMs?: number;
}): TradeIntent {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${params.masterUserId}|${params.symbol}|${params.side}|${params.quantity}|${params.price}|${nonce}`;
  const hash = createHash("sha256").update(payload).digest("hex");

  return {
    id: params.id,
    masterUserId: params.masterUserId,
    symbol: params.symbol,
    side: params.side,
    quantity: params.quantity,
    price: params.price,
    nonce,
    hash,
    createdAt: Date.now(),
    ttlMs: params.ttlMs ?? DEFAULT_TTL_MS,
    status: "pending",
  };
}

/**
 * Verify an intent is still valid (not expired, hash matches).
 */
export function verifyIntent(intent: TradeIntent): IntentVerification {
  const now = Date.now();
  if (now - intent.createdAt > intent.ttlMs) {
    return { valid: false, reason: "Intent expired (TTL exceeded)" };
  }

  if (intent.status === "expired" || intent.status === "rejected") {
    return { valid: false, reason: `Intent already ${intent.status}` };
  }

  // Re-derive hash to verify integrity
  const payload = `${intent.masterUserId}|${intent.symbol}|${intent.side}|${intent.quantity}|${intent.price}|${intent.nonce}`;
  const expectedHash = createHash("sha256").update(payload).digest("hex");

  if (expectedHash !== intent.hash) {
    return { valid: false, reason: "Intent hash mismatch — payload tampered" };
  }

  return { valid: true };
}

/**
 * Mark expired intents in a collection.
 */
export function expireStaleIntents(intents: TradeIntent[]): TradeIntent[] {
  const now = Date.now();
  const expired: TradeIntent[] = [];
  for (const intent of intents) {
    if (intent.status === "pending" && now - intent.createdAt > intent.ttlMs) {
      intent.status = "expired";
      expired.push(intent);
    }
  }
  return expired;
}
