import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculatePayout(wager: number, odds: number, profitBoostPercent = 0): number {
  if (!wager || !odds) return 0;
  const effectiveOdds = calculateBoostedOdds(odds, profitBoostPercent);
  const profit = effectiveOdds > 0 ? wager * (effectiveOdds / 100) : wager * (100 / Math.abs(effectiveOdds));
  return Math.round((wager + profit + Number.EPSILON) * 100) / 100;
}

export function calculateBoostedOdds(odds: number, profitBoostPercent = 0): number {
  const decimal = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
  const boosted = 1 + (decimal - 1) * (1 + Math.max(0, Math.round(profitBoostPercent)) / 100);
  return boosted >= 2 ? Math.ceil((boosted - 1) * 100) : -Math.floor(100 / (boosted - 1));
}

export function calculateParlayOdds(legs: Array<{ odds: number | string }>): number {
  if (legs.length < 2) return 0;
  const decimalOdds = legs.reduce((combined, leg) => {
    const odds = Number(leg.odds);
    if (!Number.isFinite(odds) || odds === 0) return 0;
    const decimal = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
    return combined * decimal;
  }, 1);
  if (decimalOdds <= 1) return 0;
  return Math.round(decimalOdds >= 2 ? (decimalOdds - 1) * 100 : -100 / (decimalOdds - 1));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatOdds(odds: number): string {
  if (!odds) return '';
  return odds > 0 ? `+${odds}` : `${odds}`;
}
