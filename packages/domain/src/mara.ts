/**
 * MARA — Modified Adaptive Replication Algorithm
 *
 * Core Equation:
 *   Q_adj = Q_base × C × V × R
 *
 * Where:
 *   C = Capital Factor  = E_F / E_M   (follower equity / master equity)
 *   V = Volatility Factor = σ_F / σ_M (follower vol tolerance / master vol)
 *   R = Risk Factor     = R_F / R_M   (follower risk pref / master risk pref)
 *
 * Safety bound:
 *   Q_max = (FreeMargin × Leverage) / Price
 *   Q_adj = min(Q_adj, Q_max)
 *
 * All values are clamped to [0, Q_max] and rounded to 2 decimal places.
 */

import { round2 } from "./finance.js";

/* ── Types ── */

export interface MARAParams {
  /** Quantity the master is trading */
  masterQuantity: number;
  /** Master account equity */
  masterEquity: number;
  /** Follower account equity */
  followerEquity: number;
  /** Master volatility tolerance (σ_M) — annualized % */
  masterVolatility: number;
  /** Follower volatility tolerance (σ_F) — annualized % */
  followerVolatility: number;
  /** Master risk preference 0–100 */
  masterRiskScore: number;
  /** Follower risk preference 0–100 */
  followerRiskScore: number;
  /** Current price of the instrument */
  price: number;
  /** Follower free margin (available cash) */
  followerFreeMargin: number;
  /** Follower leverage multiplier (default 1 for no leverage) */
  followerLeverage?: number;
}

export interface MARAResult {
  /** Base quantity before adjustment */
  baseQuantity: number;
  /** Capital Factor (C) */
  capitalFactor: number;
  /** Volatility Factor (V) */
  volatilityFactor: number;
  /** Risk Factor (R) */
  riskFactor: number;
  /** Raw adjusted quantity before safety bound */
  rawAdjustedQuantity: number;
  /** Maximum quantity allowed by margin */
  maxQuantity: number;
  /** Final adjusted quantity */
  adjustedQuantity: number;
}

/* ── Core MARA calculation ── */

export function calculateMARA(params: MARAParams): MARAResult {
  const {
    masterQuantity,
    masterEquity,
    followerEquity,
    masterVolatility,
    followerVolatility,
    masterRiskScore,
    followerRiskScore,
    price,
    followerFreeMargin,
    followerLeverage = 1,
  } = params;

  // Guard against division by zero
  if (masterEquity <= 0 || masterVolatility <= 0 || masterRiskScore <= 0 || price <= 0) {
    return {
      baseQuantity: masterQuantity,
      capitalFactor: 0,
      volatilityFactor: 0,
      riskFactor: 0,
      rawAdjustedQuantity: 0,
      maxQuantity: 0,
      adjustedQuantity: 0,
    };
  }

  // C = E_F / E_M
  const capitalFactor = round2(followerEquity / masterEquity);

  // V = σ_F / σ_M
  const volatilityFactor = round2(followerVolatility / masterVolatility);

  // R = R_F / R_M
  const riskFactor = round2(followerRiskScore / masterRiskScore);

  // Q_adj = Q_base × C × V × R
  const rawAdjustedQuantity = round2(masterQuantity * capitalFactor * volatilityFactor * riskFactor);

  // Q_max = (FreeMargin × Leverage) / Price
  const maxQuantity = round2((followerFreeMargin * followerLeverage) / price);

  // Final = min(Q_adj, Q_max), clamped to >= 0
  const adjustedQuantity = round2(Math.max(0, Math.min(rawAdjustedQuantity, maxQuantity)));

  return {
    baseQuantity: masterQuantity,
    capitalFactor,
    volatilityFactor,
    riskFactor,
    rawAdjustedQuantity,
    maxQuantity,
    adjustedQuantity,
  };
}
