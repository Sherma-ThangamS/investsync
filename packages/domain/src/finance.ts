import type { FollowSubscription, RiskControls } from "./types.js";

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validatePerformanceFee(percent: number): void {
  if (percent < 0 || percent > 100) {
    throw new Error("Performance fee must be between 0 and 100");
  }
}

export function calculateProportionalQuantity(params: {
  masterQuantity: number;
  masterCapital: number;
  followerAllocatedCapital: number;
}): number {
  const { masterQuantity, masterCapital, followerAllocatedCapital } = params;
  if (masterCapital <= 0) {
    throw new Error("Master capital must be greater than 0");
  }

  const ratio = followerAllocatedCapital / masterCapital;
  return round2(masterQuantity * ratio);
}

export function calculateDrawdownPercent(startEquity: number, currentEquity: number): number {
  if (startEquity <= 0) {
    return 0;
  }

  return round2(((startEquity - currentEquity) / startEquity) * 100);
}

export function shouldHaltByRisk(
  subscription: FollowSubscription,
  currentEquity: number
): { blocked: boolean; reason?: string } {
  const { riskControls } = subscription;

  if (riskControls.paused) {
    return { blocked: true, reason: "Copying is paused by follower" };
  }

  const drawdown = calculateDrawdownPercent(subscription.startEquity, currentEquity);
  if (drawdown >= riskControls.maxDrawdownPercent) {
    return {
      blocked: true,
      reason: `Max drawdown reached: ${drawdown}% >= ${riskControls.maxDrawdownPercent}%`,
    };
  }

  return { blocked: false };
}

export function calculatePerformanceFee(params: {
  currentEquity: number;
  subscription: FollowSubscription;
  performanceFeePercent: number;
}): number {
  const { currentEquity, subscription, performanceFeePercent } = params;
  validatePerformanceFee(performanceFeePercent);

  const profitAboveHwm = Math.max(0, currentEquity - subscription.highWaterMark);
  return round2((profitAboveHwm * performanceFeePercent) / 100);
}

export function defaultRiskControls(): RiskControls {
  return {
    paused: false,
    maxDrawdownPercent: 20,
  };
}
