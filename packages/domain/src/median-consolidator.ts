/**
 * Median-Based Consolidator
 *
 * Aggregates price feeds from multiple sources and returns the
 * median value, filtering out outliers. This provides a tamper-resistant
 * fair price even when some feeds are stale or manipulated.
 *
 * Algorithm:
 *   1. Collect price samples from N sources
 *   2. Sort ascending
 *   3. If odd count, median = middle element
 *   4. If even count, median = average of two middle elements
 *   5. Filter outliers beyond ±threshold% from median
 *   6. Recompute median from filtered set
 */

import { round2 } from "./finance.js";

export interface PriceFeed {
  source: string;
  symbol: string;
  price: number;
  timestamp: number;
}

export interface ConsolidatedPrice {
  symbol: string;
  medianPrice: number;
  feedCount: number;
  outlierCount: number;
  sources: string[];
  consolidatedAt: string;
}

/** Compute plain median of a numeric array (must be non-empty). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Consolidate multiple price feeds for the same symbol into a single
 * median-based price. Outliers beyond `outlierThresholdPercent` from
 * the raw median are dropped and the median is recomputed.
 *
 * @param feeds  Array of price feeds (all for the same symbol)
 * @param outlierThresholdPercent  Max deviation from median to keep (default 5%)
 * @param maxAgeSec  Max age in seconds before a feed is considered stale (default 30s)
 */
export function consolidatePriceFeeds(
  feeds: PriceFeed[],
  outlierThresholdPercent = 5,
  maxAgeSec = 30,
): ConsolidatedPrice | null {
  if (feeds.length === 0) return null;

  const now = Date.now();
  // Filter stale feeds
  const fresh = feeds.filter((f) => (now - f.timestamp) / 1000 <= maxAgeSec);
  if (fresh.length === 0) return null;

  const symbol = fresh[0].symbol;
  const prices = fresh.map((f) => f.price);

  // First pass: raw median
  const rawMedian = median(prices);

  // Filter outliers
  const threshold = rawMedian * (outlierThresholdPercent / 100);
  const filtered = fresh.filter((f) => Math.abs(f.price - rawMedian) <= threshold);

  if (filtered.length === 0) {
    // If all are outliers (shouldn't happen), fall back to raw median
    return {
      symbol,
      medianPrice: round2(rawMedian),
      feedCount: fresh.length,
      outlierCount: 0,
      sources: fresh.map((f) => f.source),
      consolidatedAt: new Date().toISOString(),
    };
  }

  const finalMedian = median(filtered.map((f) => f.price));

  return {
    symbol,
    medianPrice: round2(finalMedian),
    feedCount: fresh.length,
    outlierCount: fresh.length - filtered.length,
    sources: filtered.map((f) => f.source),
    consolidatedAt: new Date().toISOString(),
  };
}
